import { COOKIE_NAME } from "@shared/const";
import crypto from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import {
  emailDocumentDecision,
  emailFilesReceived,
  emailStoryDecision,
  emailStoryReceived,
} from "./_email";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import {
  SYSTEM_PROMPT as GOBLIN_SYSTEM_PROMPT,
  buildArchiveContextString,
  draftFromExtractedText,
  extractText,
  classifyDocument,
  qcReview,
} from "./_goblin";
import {
  MAX_FILES_PER_SUBMISSION,
  checkRateLimit,
  decodeBase64Strict,
  hashIp,
  validateUpload,
  writeAudit,
} from "./_uploadGuard";
import {
  createSubscriptionCheckoutSession,
  createCreditPackCheckoutSession,
  getCustomerPortalUrl,
} from "./stripe/checkout";
import { TIERS, CREDIT_PACKS } from "./stripe/products";
import { hasTier, freeGoblinRemaining, tierLabel, hasGoblinCredits } from "./stripe/gating";
import { scoreVerifiability, AUTO_PUBLISH_THRESHOLD } from "./goblinAutoPublish";
import { runGoblinPipeline } from "./_pipeline";
import * as newsFetcher from "./actorNewsFetcher";
import { analyzePredicates, persistPredicateFindings } from "./predicateAnalysisEngine";
import { predicateFindings } from "../drizzle/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

const isoDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);

/* =============== Story router =============== */
const storyRouter = router({
  /** Authenticated submission (v3: must be signed in) */
  submit: protectedProcedure
    .input(
      z.object({
        submitterName: z.string().max(200).optional(),
        alias: z.string().max(120).optional(),
        email: z.string().email().max(320),
        phone: z.string().max(60).optional(),
        headline: z.string().max(500).optional(),
        agencyInstitution: z.string().max(240).optional(),
        officeDepartment: z.string().max(160).optional(),
        location: z.string().max(240).optional(),
        incidentStart: isoDate,
        incidentEnd: isoDate,
        ongoingIncident: z.boolean().optional(),
        relatedCaseNumber: z.string().max(160).optional(),
        incidentTypes: z.array(z.string().max(160)).max(24).optional(),
        actorDetails: z.string().max(12000).optional(),
        evidenceDescription: z.string().max(12000).optional(),
        timelineDescription: z.string().max(12000).optional(),
        patternSignals: z.array(z.string().max(180)).max(32).optional(),
        publicRecordsStatus: z.string().max(8000).optional(),
        harmDescription: z.string().max(8000).optional(),
        requestedFollowup: z.string().max(8000).optional(),
        evidenceTypes: z.array(z.string().max(180)).max(32).optional(),
        caseNumber: z.string().max(120).optional(),
        court: z.string().max(200).optional(),
        department: z.string().max(120).optional(),
        judge: z.string().max(200).optional(),
        prosecutor: z.string().max(200).optional(),
        defenseAttorney: z.string().max(200).optional(),
        charges: z.string().optional(),
        dateCaseStarted: isoDate,
        custodyDays: z.number().int().min(0).optional(),
        stillPending: z.boolean().optional(),
        trialHeld: z.boolean().optional(),
        requestedTrial: z.boolean().optional(),
        counselWaivedTime: z.boolean().optional(),
        filingsBlocked: z.boolean().optional(),
        askedSelfRep: z.boolean().optional(),
        farettaHandled: z.boolean().optional(),
        competencyRaised: z.boolean().optional(),
        competencyContext: z.string().optional(),
        discoveryMissing: z.boolean().optional(),
        warrantsUsed: z.boolean().optional(),
        familyHarm: z.string().optional(),
        summary: z.string().min(20, "Please describe the situation").max(20000),
        mainIssue: z.string().max(500).optional(),
        publicPermission: z.boolean(),
        redactionConfirmed: z.boolean(),
        attachments: z
          .array(
            z.object({
              filename: z.string(),
              mimeType: z.string(),
              dataBase64: z.string(),
            }),
          )
          .max(MAX_FILES_PER_SUBMISSION)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.publicPermission || !input.redactionConfirmed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both confirmation checkboxes must be agreed to.",
        });
      }

      // Rate limit: max 3 submissions / 24h per signed-in user.
      await checkRateLimit({
        userId: ctx.user.id,
        action: "story_submitted",
        windowMs: 24 * 60 * 60 * 1000,
        max: 3,
      });

      // Pre-validate every attachment BEFORE writing the story row, so a single
      // bad file rejects the entire submission and nothing is half-created.
      const { attachments, ...payload } = input;
      const validated: Array<ReturnType<typeof validateUpload>> = [];
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const buffer = decodeBase64Strict(att.dataBase64);
          try {
            validated.push(
              validateUpload({
                filename: att.filename,
                mimeType: att.mimeType,
                buffer,
              }),
            );
          } catch (e: any) {
            await writeAudit({
              actorUserId: ctx.user.id,
              actorRole: ctx.user.role,
              action: "upload_rejected",
              targetType: "submission_attachment",
              metadata: {
                filename: att.filename,
                mimeType: att.mimeType,
                size: buffer.length,
                reason: e?.message ?? String(e),
              },
              ipHash: hashIp((ctx.req as any)?.ip),
            });
            throw e;
          }
        }
      }

      const ipHash = hashIp((ctx.req as any)?.ip);
      const hasStructuredIntake = Boolean(
        payload.headline ||
          payload.agencyInstitution ||
          payload.actorDetails ||
          payload.evidenceDescription ||
          payload.timelineDescription ||
          payload.publicRecordsStatus ||
          payload.requestedFollowup ||
          payload.incidentTypes?.length ||
          payload.patternSignals?.length ||
          payload.evidenceTypes?.length,
      );
      const summaryForReview = hasStructuredIntake
        ? [
            payload.summary && `Narrative:\n${payload.summary}`,
            payload.actorDetails && `Actors / institutions:\n${payload.actorDetails}`,
            payload.evidenceDescription && `Evidence inventory:\n${payload.evidenceDescription}`,
            payload.timelineDescription && `Timeline notes:\n${payload.timelineDescription}`,
            payload.incidentTypes?.length && `Incident types: ${payload.incidentTypes.join(", ")}`,
            payload.patternSignals?.length && `Pattern signals: ${payload.patternSignals.join(", ")}`,
            payload.evidenceTypes?.length && `Evidence types: ${payload.evidenceTypes.join(", ")}`,
            payload.publicRecordsStatus && `Public-records status:\n${payload.publicRecordsStatus}`,
            payload.harmDescription && `Harm / public impact:\n${payload.harmDescription}`,
            payload.requestedFollowup && `Suggested follow-up records:\n${payload.requestedFollowup}`,
            payload.location && `Location / jurisdiction: ${payload.location}`,
            payload.incidentEnd && `Last known date: ${payload.incidentEnd.toISOString().slice(0, 10)}`,
          ]
            .filter(Boolean)
            .join("\n\n")
        : payload.summary;
      const storyId = await db.insertStory({
        submitterName: payload.submitterName,
        alias: payload.alias,
        email: payload.email,
        phone: payload.phone,
        caseNumber: payload.caseNumber || payload.relatedCaseNumber || undefined,
        court: payload.court || payload.agencyInstitution || undefined,
        department: payload.department || payload.officeDepartment || undefined,
        judge: payload.judge,
        prosecutor: payload.prosecutor,
        defenseAttorney: payload.defenseAttorney || payload.actorDetails || undefined,
        charges: payload.charges || payload.incidentTypes?.join(", ") || undefined,
        dateCaseStarted: payload.dateCaseStarted ?? payload.incidentStart ?? undefined,
        custodyDays: payload.custodyDays,
        stillPending: payload.stillPending ?? payload.ongoingIncident,
        trialHeld: payload.trialHeld,
        requestedTrial: payload.requestedTrial,
        counselWaivedTime: payload.counselWaivedTime,
        filingsBlocked:
          payload.filingsBlocked ??
          payload.patternSignals?.some((s) => /blocked|ignored|never ruled/i.test(s)),
        askedSelfRep: payload.askedSelfRep,
        farettaHandled: payload.farettaHandled,
        competencyRaised: payload.competencyRaised,
        competencyContext: payload.competencyContext || payload.publicRecordsStatus || undefined,
        discoveryMissing:
          payload.discoveryMissing ??
          payload.patternSignals?.some((s) => /missing|withheld|gap/i.test(s)),
        warrantsUsed:
          payload.warrantsUsed ??
          payload.patternSignals?.some((s) => /custody|warrant|fine|supervision/i.test(s)),
        familyHarm: payload.familyHarm || payload.harmDescription || undefined,
        summary: summaryForReview,
        mainIssue: payload.mainIssue || payload.headline,
        publicPermission: payload.publicPermission,
        redactionConfirmed: payload.redactionConfirmed,
        ownerUserId: ctx.user.id,
        submitterIpHash: ipHash ?? undefined,
      });

      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "story_submitted",
        targetType: "story",
        targetId: storyId,
        ipHash: ipHash,
        metadata: { attachmentCount: validated.length },
      });

      // Upload validated attachments and create pending+private documents
      for (const att of validated) {
        try {
          const { key, url } = await storagePut(
            `submissions/story-${storyId}/${att.storageFilename}`,
            att.buffer,
            att.mime,
          );
          const docId = await db.insertDocument({
            title: att.filename,
            fileKey: key,
            fileUrl: url,
            mimeType: att.mime,
            fileSize: att.size,
            sourceType: "other",
            storyId,
            publicStatus: false,
            reviewStatus: "pending",
            redactionStatus: "unverified",
            visibility: "pending_review",
            aiPolicy: "no_ai_processing",
            uploadedBy: ctx.user.id,
          });
          await writeAudit({
            actorUserId: ctx.user.id,
            actorRole: ctx.user.role,
            action: "document_uploaded",
            targetType: "document",
            targetId: docId,
            ipHash: ipHash,
            metadata: { storyId, filename: att.filename, size: att.size },
          });
        } catch (e) {
          console.error("[story.submit] attachment write failed", e);
        }
      }

      try {
        await notifyOwner({
          title: "New Reno Record submission",
          content: `Story #${storyId} submitted by user #${ctx.user.id} with ${validated.length} attachment(s). Review in /admin.`,
        });
      } catch {
        // ignore
      }

      // Email confirmations — fail-safe (skip if SMTP not configured)
      const recipientEmail = payload.email ?? ctx.user.email ?? null;
      const storyMail = await emailStoryReceived({ to: recipientEmail, storyId });
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "story_submitted",
        targetType: "story",
        targetId: storyId,
        ipHash,
        metadata: { email: storyMail.sent ? "email_sent" : `email_skipped:${(storyMail as any).reason ?? "unknown"}` },
      });
      if (validated.length > 0) {
        await emailFilesReceived({
          to: recipientEmail,
          storyId,
          fileCount: validated.length,
        });
      }
      return { id: storyId };
    }),

  /** Public list of approved + permitted stories (light fields only) */
  listApproved: publicProcedure.query(async () => {
    const rows = await db.listStoriesByStatus("approved");
    return rows
      .filter((s) => s.publicPermission)
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        alias: s.alias || "Anonymous submitter",
        court: s.court,
        judge: s.judge,
        charges: s.charges,
        custodyDays: s.custodyDays,
        stillPending: s.stillPending,
        mainIssue: s.mainIssue,
        summary: s.summary?.slice(0, 320) || null,
        createdAt: s.createdAt,
        featured: s.featured,
      }));
  }),

  /** The Church Record */
  featured: publicProcedure.query(async () => db.getFeaturedStory() ?? null),

  /** Public detail by slug */
  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const s = await db.getStoryBySlug(input.slug);
    if (!s || s.status !== "approved" || !s.publicPermission) return null;
    return s;
  }),

  /* Admin operations */
  adminList: adminProcedure
    .input(
      z
        .object({
          status: z.enum(["pending", "approved", "rejected", "needs_changes", "all"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      if (!input?.status || input.status === "all") return db.listAllStories();
      return db.listStoriesByStatus(input.status);
    }),
  adminGet: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) =>
    db.getStoryById(input.id),
  ),
  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          status: z.enum(["pending", "approved", "rejected", "needs_changes"]).optional(),
          reviewerNote: z.string().optional(),
          featured: z.boolean().optional(),
          slug: z.string().optional(),
          mainIssue: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: any = { ...input.patch };
      if (patch.status === "approved" && !patch.slug) {
        const story = await db.getStoryById(input.id);
        const base = slugify(story?.mainIssue || story?.alias || `story-${input.id}`);
        patch.slug = `${base}-${input.id}`;
      }
      await db.updateStory(input.id, patch);

      // Resolve recipient + send decision email first; then audit decision with email outcome.
      let emailOutcome: string | null = null;
      if (patch.status && patch.status !== "pending") {
        emailOutcome = "email_skipped:no_recipient";
        try {
          const story = await db.getStoryById(input.id);
          let recipient: string | null = story?.email ?? null;
          if (!recipient && story?.ownerUserId) {
            const ownerUser = await db.getUserById(story.ownerUserId);
            recipient = ownerUser?.email ?? null;
          }
          if (recipient) {
            const r = await emailStoryDecision({
              to: recipient,
              storyId: input.id,
              decision:
                patch.status === "approved"
                  ? "approved"
                  : patch.status === "rejected"
                    ? "rejected"
                    : "changes_requested",
            });
            emailOutcome = r.sent ? "email_sent" : `email_skipped:${(r as any).reason}`;
          }
        } catch (e) {
          console.warn("[story.adminUpdate] decision email failed", e);
          emailOutcome = "email_skipped:exception";
        }
      }

      if (patch.status === "approved") {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "story_approved",
          targetType: "story",
          targetId: input.id,
          metadata: emailOutcome ? { email: emailOutcome } : undefined,
        });
      } else if (patch.status === "rejected") {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "story_rejected",
          targetType: "story",
          targetId: input.id,
          metadata: { reviewerNote: patch.reviewerNote, email: emailOutcome ?? undefined },
        });
      } else if (patch.status === "needs_changes") {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "story_changes_requested",
          targetType: "story",
          targetId: input.id,
          metadata: { reviewerNote: patch.reviewerNote, email: emailOutcome ?? undefined },
        });
      }
      return { ok: true };
    }),
});

/* =============== Documents router =============== */
type DocumentWithFileUrl = { fileKey?: string | null; fileUrl?: string | null };

function storageProxyUrlForKey(fileKey?: string | null): string | null {
  if (!fileKey) return null;
  const encodedKey = fileKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/manus-storage/${encodedKey}`;
}

function withSameOriginDocumentUrl<T extends DocumentWithFileUrl>(doc: T): T {
  const proxyUrl = storageProxyUrlForKey(doc.fileKey);
  if (!proxyUrl) return doc;
  return { ...doc, fileUrl: proxyUrl };
}

const documentRouter = router({
  listPublic: publicProcedure
    .input(
      z
        .object({
          q: z.string().optional(),
          sourceType: z.string().optional(),
          caseTag: z.string().optional(),
          recordStatus: z.string().optional(),
          violationTagSlug: z.string().optional(),
          sortBy: z.enum(["date_desc", "date_asc"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rows = await db.listPublicDocuments({
        q: input?.q,
        sourceType: input?.sourceType,
        caseTag: input?.caseTag,
        recordStatus: input?.recordStatus,
        violationTagSlug: input?.violationTagSlug,
        sortBy: input?.sortBy,
      });
      return rows.map(withSameOriginDocumentUrl);
    }),
  filterMeta: publicProcedure.query(async () => db.getDocumentFilterMeta()),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const d = await db.getDocumentById(input.id);
    if (!d) return null;
    if (!(d.publicStatus && d.reviewStatus === "approved")) return null;
    return withSameOriginDocumentUrl(d);
  }),
  relatedEvents: publicProcedure
    .input(z.object({ docId: z.number() }))
    .query(async ({ input }) => {
      // Only return related events for publicly accessible documents
      const d = await db.getDocumentById(input.docId);
      if (!d || !(d.publicStatus && d.reviewStatus === "approved")) return [];
      return db.getRelatedTimelineEvents(input.docId);
    }),

  /* Admin */
  adminList: adminProcedure
    .input(
      z
        .object({
          visibility: z
            .enum([
              "private_admin_only",
              "pending_review",
              "needs_redaction",
              "public_preview",
              "receipts_only",
              "goblin_allowed",
              "rejected",
            ])
            .optional(),
          aiPolicy: z.enum(["no_ai_processing", "goblin_allowed"]).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rows = await db.listAllDocuments({ visibility: input?.visibility, aiPolicy: input?.aiPolicy });
      return rows.map(withSameOriginDocumentUrl);
    }),
  adminCounts: adminProcedure.query(async () => db.documentVisibilityCounts()),
  adminGet: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const d = await db.getDocumentById(input.id);
    return d ? withSameOriginDocumentUrl(d) : null;
  }),
  adminUpload: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        sourceType: z
          .enum([
            "court_order",
            "motion",
            "email",
            "transcript",
            "warrant",
            "public_records_response",
            "audio",
            "video",
            "image",
            "jail_record",
            "risk_notice",
            "other",
          ])
          .default("other"),
        caseNumber: z.string().optional(),
        documentDate: isoDate,
        actorNames: z.string().optional(),
        issueTags: z.array(z.string()).optional(),
        storyId: z.number().optional(),
        filename: z.string(),
        mimeType: z.string(),
        dataBase64: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // v3: even admin uploads must pass validateUpload
      const buffer = decodeBase64Strict(input.dataBase64);
      const v = validateUpload({
        filename: input.filename,
        mimeType: input.mimeType,
        buffer,
      });
      const { key, url } = await storagePut(
        `evidence/${v.storageFilename}`,
        v.buffer,
        v.mime,
      );
      const id = await db.insertDocument({
        title: input.title,
        description: input.description,
        fileKey: key,
        fileUrl: url,
        mimeType: v.mime,
        fileSize: v.size,
        sourceType: input.sourceType,
        caseNumber: input.caseNumber,
        documentDate: input.documentDate ?? undefined,
        actorNames: input.actorNames,
        issueTags: input.issueTags,
        storyId: input.storyId,
        publicStatus: false,
        reviewStatus: "pending",
        visibility: "pending_review",
        aiPolicy: "no_ai_processing",
        uploadedBy: ctx.user.id,
      });
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_uploaded",
        targetType: "document",
        targetId: id,
        metadata: { filename: v.filename, mime: v.mime, size: v.size },
      });
      return { id };
    }),
  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          sourceType: z
            .enum([
              "court_order",
              "motion",
              "email",
              "transcript",
              "warrant",
              "public_records_response",
              "audio",
              "video",
              "image",
              "jail_record",
              "risk_notice",
              "other",
            ])
            .optional(),
          caseNumber: z.string().optional(),
          documentDate: isoDate,
          actorNames: z.string().optional(),
          issueTags: z.array(z.string()).optional(),
          publicStatus: z.boolean().optional(),
          reviewStatus: z.enum(["pending", "approved", "rejected"]).optional(),
          redactionStatus: z.enum(["unverified", "verified", "needs_redaction"]).optional(),
          visibility: z
            .enum([
              "private_admin_only",
              "pending_review",
              "needs_redaction",
              "public_preview",
              "receipts_only",
              "goblin_allowed",
              "rejected",
            ])
            .optional(),
          aiPolicy: z.enum(["no_ai_processing", "goblin_allowed"]).optional(),
          aiSummary: z.string().optional(),
          aiTags: z.array(z.string()).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch: any = { ...input.patch };
      if (patch.documentDate === null) delete patch.documentDate;

      // Sync legacy publicStatus + reviewStatus with the new visibility state
      // so existing public-facing queries keep working.
      if (patch.visibility) {
        switch (patch.visibility) {
          case "public_preview":
          case "receipts_only":
          case "goblin_allowed":
            patch.reviewStatus = "approved";
            patch.publicStatus = patch.visibility === "public_preview";
            break;
          case "private_admin_only":
          case "pending_review":
          case "needs_redaction":
            patch.reviewStatus = patch.reviewStatus ?? "pending";
            patch.publicStatus = false;
            break;
          case "rejected":
            patch.reviewStatus = "rejected";
            patch.publicStatus = false;
            break;
        }
      }
      await db.updateDocument(input.id, patch);

      if (patch.visibility) {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "visibility_changed",
          targetType: "document",
          targetId: input.id,
          metadata: { visibility: patch.visibility },
        });
      }
      if (patch.aiPolicy) {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "ai_policy_changed",
          targetType: "document",
          targetId: input.id,
          metadata: { aiPolicy: patch.aiPolicy },
        });
      }
      // Send decision email first, attach outcome to the audit entry below
      let docEmailOutcome: string | null = null;
      if (patch.reviewStatus === "approved" || patch.reviewStatus === "rejected") {
        docEmailOutcome = "email_skipped:no_recipient";
        try {
          const docNow = await db.getDocumentById(input.id);
          if (docNow?.uploadedBy) {
            const uploader = await db.getUserById(docNow.uploadedBy);
            if (uploader?.email) {
              const r = await emailDocumentDecision({
                to: uploader.email,
                documentId: input.id,
                decision: patch.reviewStatus,
              });
              docEmailOutcome = r.sent ? "email_sent" : `email_skipped:${(r as any).reason}`;
            }
          }
        } catch (e) {
          console.warn("[document.adminUpdate] decision email failed", e);
          docEmailOutcome = "email_skipped:exception";
        }
      }
      if (patch.reviewStatus === "approved" && !patch.visibility) {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "document_approved",
          targetType: "document",
          targetId: input.id,
          metadata: docEmailOutcome ? { email: docEmailOutcome } : undefined,
        });
      }
      if (patch.reviewStatus === "rejected" && !patch.visibility) {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "document_rejected",
          targetType: "document",
          targetId: input.id,
          metadata: docEmailOutcome ? { email: docEmailOutcome } : undefined,
        });
      }
      return { ok: true };
    }),
});

/* =============== Timeline router =============== */
const TIMELINE_CATEGORIES = [
  "state_case",
  "federal_case",
  "custody",
  "motion",
  "warrant",
  "competency",
  "public_records",
  "communications",
  "election_accountability",
  "other",
] as const;

const timelineRouter = router({
  listPublic: publicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          storyId: z.number().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) =>
      db.listPublicTimeline({ category: input?.category, storyId: input?.storyId }),
    ),

  adminList: adminProcedure.query(async () => db.listAllTimelineEvents()),
  adminCreate: adminProcedure
    .input(
      z.object({
        eventDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
        title: z.string().min(1),
        summary: z.string().optional(),
        caseNumber: z.string().optional(),
        storyId: z.number().optional(),
        category: z.enum(TIMELINE_CATEGORIES).default("other"),
        issueTags: z.array(z.string()).optional(),
        actors: z.array(z.string()).optional(),
        status: z.enum(["confirmed", "alleged", "needs_review"]).default("needs_review"),
        sourceDocuments: z.array(z.number()).optional(),
        publicStatus: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.insertTimelineEvent(input);
      return { id };
    }),
  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          eventDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)).optional(),
          title: z.string().optional(),
          summary: z.string().optional(),
          caseNumber: z.string().optional(),
          category: z.enum(TIMELINE_CATEGORIES).optional(),
          issueTags: z.array(z.string()).optional(),
          actors: z.array(z.string()).optional(),
          status: z.enum(["confirmed", "alleged", "needs_review"]).optional(),
          sourceDocuments: z.array(z.number()).optional(),
          publicStatus: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await db.updateTimelineEvent(input.id, input.patch as any);
      return { ok: true };
    }),
  adminDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteTimelineEvent(input.id);
    return { ok: true };
  }),
});

/* =============== Actors router =============== */
const actorRouter = router({
  listPublic: publicProcedure.query(async () => db.listPublicActors()),
  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) =>
    db.getActorBySlug(input.slug),
  ),
  adminList: adminProcedure.query(async () => db.listAllActors()),
  dossier: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => db.getActorDossier(input.name)),
  adminCreate: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        slug: z.string().optional(),
        role: z.string().optional(),
        agency: z.string().optional(),
        bio: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(["documented", "alleged", "needs_review"]).default("documented"),
        publicStatus: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = input.slug || slugify(input.name);
      const id = await db.insertActor({ ...input, slug });
      return { id, slug };
    }),
  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          name: z.string().optional(),
          role: z.string().optional(),
          agency: z.string().optional(),
          bio: z.string().optional(),
          notes: z.string().optional(),
          status: z.enum(["documented", "alleged", "needs_review"]).optional(),
          publicStatus: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await db.updateActor(input.id, input.patch);
      return { ok: true };
    }),
    adminDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteActor(input.id);
    return { ok: true };
  }),
  /** Get cached news for an actor — auto-refreshes if stale (6h TTL) */
  news: publicProcedure
    .input(z.object({ actorId: z.number(), actorName: z.string() }))
    .query(async ({ input }) => {
      const items = await newsFetcher.getActorNews(input.actorId, input.actorName);
      return { items, count: items.length };
    }),
  /** Admin: force-refresh news cache for an actor */
  refreshNews: adminProcedure
    .input(z.object({ actorId: z.number(), actorName: z.string() }))
    .mutation(async ({ input }) => {
      const inserted = await newsFetcher.refreshActorNews(input.actorId, input.actorName, true);
      return { inserted, ok: true };
    }),
});
/* =============== Public Records Requests router =============== */
const PRR_STATUS = [
  "draft",
  "sent",
  "awaiting_response",
  "overdue",
  "partial_response",
  "denied",
  "produced",
  "appealed",
  "closed",
] as const;

const prrStatusHistoryEntry = z.object({
  date: z.string().optional(),
  status: z.enum(PRR_STATUS),
  note: z.string().optional(),
});

const prrRouter = router({
  listPublic: publicProcedure.query(async () => db.listPublicPRRs()),
  adminList: adminProcedure.query(async () => db.listAllPRRs()),
  adminCreate: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        agency: z.string().min(1),
        description: z.string().optional(),
        dateSent: isoDate,
        deadline: isoDate,
        status: z.enum(PRR_STATUS).default("sent"),
        responseSummary: z.string().optional(),
        legalBasisForDenial: z.string().optional(),
        statusHistory: z.array(prrStatusHistoryEntry).optional(),
        publicStatus: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.insertPRR({
        ...input,
        dateSent: input.dateSent ?? undefined,
        deadline: input.deadline ?? undefined,
      });
      return { id };
    }),
  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          title: z.string().optional(),
          agency: z.string().optional(),
          description: z.string().optional(),
          dateSent: isoDate,
          deadline: isoDate,
          status: z.enum(PRR_STATUS).optional(),
          responseSummary: z.string().optional(),
          legalBasisForDenial: z.string().optional(),
          statusHistory: z.array(prrStatusHistoryEntry).optional(),
          publicStatus: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const patch: any = { ...input.patch };
      if (patch.dateSent === null) delete patch.dateSent;
      if (patch.deadline === null) delete patch.deadline;
      await db.updatePRR(input.id, patch);
      return { ok: true };
    }),
  adminDelete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deletePRR(input.id);
    return { ok: true };
  }),
});

/* =============== Patterns router =============== */
const patternRouter = router({
  metrics: publicProcedure.query(async () => db.getPatternMetrics()),
  siteStats: publicProcedure.query(async () => db.getSiteStats()),
  liveActivity: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(30).optional() }).optional())
    .query(async ({ input }) => {
      const db2 = await (db as any).getDb?.() ?? null;
      // Use raw db helper to get recent sanitized audit events
      const result = await db.listAuditLog({ limit: input?.limit ?? 15 });
      const rows = result.rows;
      const ACTION_LABELS: Record<string, string> = {
        document_ingested: "Document ingested by Goblin pipeline",
        document_approved: "Document approved and published",
        document_uploaded: "New document uploaded to archive",
        story_submitted: "New case submission received",
        story_approved: "Case submission approved",
        review_request_submitted: "Review request submitted",
        review_request_resolved: "Review request resolved",
        inline_edit: "Archive entry updated",
        visibility_changed: "Document visibility updated",
      };
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        label: ACTION_LABELS[r.action] ?? r.action.replace(/_/g, " "),
        targetType: r.targetType,
        targetId: r.targetId,
        createdAt: r.createdAt,
      }));
    }),

  tagDetail: publicProcedure
    .input(z.object({ slug: z.string().min(1).max(120) }))
    .query(async ({ input }) => {
      const result = await db.getViolationTagDetail(input.slug);
      if (!result) return null;
      // Rewrite file URLs to same-origin proxy paths
      return {
        tag: result.tag,
        entries: result.entries.map((e) => ({
          ...e,
          docFileUrl: storageProxyUrlForKey(e.docFileUrl?.replace(/^\/manus-storage\//, '')) ?? e.docFileUrl,
        })),
      };
    }),
});

/* =============== Search + Case Report =============== */
const searchRouter = router({
  global: publicProcedure
    .input(z.object({ q: z.string().min(1).max(200), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      if (!input.q.trim()) return { documents: [], actors: [], timeline: [], violations: [] };
      return db.globalSearch(input.q, input.limit ?? 20);
    }),
  caseReport: publicProcedure
    .input(z.object({ storyId: z.number().int().positive() }))
    .query(async ({ input }) => {
      return db.getCaseReport(input.storyId);
    }),
});

/* =============== Docket Goblin (advisory only) =============== */
const docketGoblinRouter = router({
  /**
   * Generate draft tags + summary for a document or story.
   * Always advisory: result is stored in agent_tasks; never auto-applied.
   */
  draftForDocument: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      const taskId = await db.insertAgentTask({
        taskType: "summarize_document",
        status: "pending",
        inputDocumentId: input.documentId,
      });

      const systemPrompt = `You are "Docket Goblin," a careful legal-archive librarian for The Reno Record. You ONLY draft tags and summaries. You never claim facts as proven; you describe what a document appears to be based on the metadata provided. You return strict JSON. Never publish, never assert guilt, never assert misconduct as fact.`;

      const userPrompt = `Draft a neutral, factual 2-4 sentence summary and 4-8 issue tags for this document.

Title: ${doc.title}
Source type: ${doc.sourceType}
Case number: ${doc.caseNumber ?? "(unknown)"}
Document date: ${doc.documentDate ? new Date(doc.documentDate).toISOString().slice(0, 10) : "(unknown)"}
Actor names: ${doc.actorNames ?? "(unknown)"}
Existing description: ${doc.description ?? "(none)"}
MIME: ${doc.mimeType ?? "(unknown)"}

Summary should describe the apparent nature of the document and what category of due-process or procedural issue it likely relates to. Tags should be short kebab-case strings drawn from this vocabulary when applicable: speedy-trial, faretta, self-representation, competency, no-bail-warrant, missing-discovery, ignored-motion, public-defender, prosecutorial-conduct, judicial-nonfeasance, pretrial-detention, family-harm, public-records, retaliation, custody, federal, state, communications, election-accountability. Add additional tags only if clearly warranted.`;

      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "docket_goblin_doc_draft",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  warnings: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "tags", "warnings"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = result.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? content : JSON.stringify(content);
        let parsed: { summary: string; tags: string[]; warnings: string[] };
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { summary: text.slice(0, 800), tags: [], warnings: ["Non-JSON response."] };
        }
        // Store advisory output. Do NOT modify document.publicStatus or reviewStatus here.
        await (await db.getDb())!
          .update(await import("../drizzle/schema").then((m) => m.agentTasks))
          .set({ status: "completed", outputJson: parsed as any })
          .where(
            (await import("drizzle-orm")).eq(
              (await import("../drizzle/schema")).agentTasks.id,
              taskId,
            ),
          );
        return { taskId, draft: parsed };
      } catch (e: any) {
        console.error("[DocketGoblin] failed", e);
        await (await db.getDb())!
          .update((await import("../drizzle/schema")).agentTasks)
          .set({ status: "failed", reviewNote: String(e?.message || e) })
          .where(
            (await import("drizzle-orm")).eq(
              (await import("../drizzle/schema")).agentTasks.id,
              taskId,
            ),
          );
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Docket Goblin failed" });
      }
    }),

  /**
   * Apply an advisory draft to a document. Admin-only and explicit.
   * This still does not change publicStatus — only writes draft text/tags to ai_summary/ai_tags.
   */
  applyDraftToDocument: adminProcedure
    .input(
      z.object({
        documentId: z.number(),
        summary: z.string(),
        tags: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      await db.updateDocument(input.documentId, {
        aiSummary: input.summary,
        aiTags: input.tags,
      });
      return { ok: true };
    }),

  draftForStory: adminProcedure
    .input(z.object({ storyId: z.number() }))
    .mutation(async ({ input }) => {
      const s = await db.getStoryById(input.storyId);
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Story not found" });
      const systemPrompt = `You are "Docket Goblin," a careful legal-archive librarian for The Reno Record. You ONLY draft tags, summaries, and a candidate slug. You never publish anything yourself. You never claim facts as proven; you describe what was reported by the submitter. Return strict JSON.`;
      const userPrompt = `Draft a neutral 3-6 sentence summary describing what the submitter reports, plus 4-10 issue tags (kebab-case) and a short URL-safe slug. Use this vocabulary where applicable: speedy-trial, faretta, self-representation, competency, no-bail-warrant, missing-discovery, ignored-motion, public-defender, prosecutorial-conduct, judicial-nonfeasance, pretrial-detention, family-harm, public-records, retaliation.

Reported main issue: ${s.mainIssue ?? "(none)"}
Court / dept: ${s.court ?? "(unknown)"} / ${s.department ?? "(unknown)"}
Judge: ${s.judge ?? "(unknown)"}
Defense: ${s.defenseAttorney ?? "(unknown)"}
Custody days: ${s.custodyDays ?? "(unknown)"}
Pending: ${s.stillPending ? "yes" : "no"}
Trial held: ${s.trialHeld ? "yes" : "no"}
Self-rep requested: ${s.askedSelfRep ? "yes" : "no"} | Faretta handled: ${s.farettaHandled ? "yes" : "no"}
Competency raised: ${s.competencyRaised ? "yes" : "no"}
Filings blocked: ${s.filingsBlocked ? "yes" : "no"}
Discovery missing: ${s.discoveryMissing ? "yes" : "no"}
Submitter narrative: ${s.summary ?? ""}`;
      const taskId = await db.insertAgentTask({
        taskType: "summarize_story",
        status: "pending",
        inputStoryId: input.storyId,
      });
      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "docket_goblin_story_draft",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  tags: { type: "array", items: { type: "string" } },
                  slug: { type: "string" },
                  warnings: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "tags", "slug", "warnings"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = result.choices?.[0]?.message?.content;
        const text = typeof content === "string" ? content : JSON.stringify(content);
        let parsed: { summary: string; tags: string[]; slug: string; warnings: string[] };
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { summary: text.slice(0, 1000), tags: [], slug: "", warnings: ["Non-JSON."] };
        }
        await (await db.getDb())!
          .update((await import("../drizzle/schema")).agentTasks)
          .set({ status: "completed", outputJson: parsed as any })
          .where(
            (await import("drizzle-orm")).eq(
              (await import("../drizzle/schema")).agentTasks.id,
              taskId,
            ),
          );
        return { taskId, draft: parsed };
      } catch (e: any) {
        await (await db.getDb())!
          .update((await import("../drizzle/schema")).agentTasks)
          .set({ status: "failed", reviewNote: String(e?.message || e) })
          .where(
            (await import("drizzle-orm")).eq(
              (await import("../drizzle/schema")).agentTasks.id,
              taskId,
            ),
          );
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Docket Goblin failed" });
      }
    }),

  listForDocument: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => db.listAgentTasksForDocument(input.documentId)),
  listForStory: adminProcedure
    .input(z.object({ storyId: z.number() }))
    .query(async ({ input }) => db.listAgentTasksForStory(input.storyId)),

  /* ===== Chat: Docket Goblin (admin-only) ===== */
  history: adminProcedure.query(async ({ ctx }) => {
    const session = await db.getOrCreateLatestChatSession(ctx.user.id);
    const messages = await db.listChatMessages(session.id);
    return { sessionId: session.id, messages };
  }),

  send: adminProcedure
    .input(z.object({ message: z.string().min(1).max(8000) }))
    .mutation(async ({ ctx, input }) => {
      const session = await db.getOrCreateLatestChatSession(ctx.user.id);
      await db.appendChatMessage({
        sessionId: session.id,
        role: "user",
        content: input.message,
      });
      const prior = await db.listChatMessages(session.id);
      const archive = await db.getArchiveContextForLLM();
      const archiveStr = buildArchiveContextString(archive);
      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: GOBLIN_SYSTEM_PROMPT },
            { role: "system", content: archiveStr },
            ...prior.slice(-30).map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
          ],
        });
        const content = result.choices?.[0]?.message?.content;
        const text =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .map((p: any) => (p?.type === "text" ? p.text : ""))
                  .join("")
              : "(no response)";
        await db.appendChatMessage({
          sessionId: session.id,
          role: "assistant",
          content: text,
        });
        return { sessionId: session.id, reply: text };
      } catch (e: any) {
        const errText = `Docket Goblin had a problem: ${e?.message || e}`;
        await db.appendChatMessage({
          sessionId: session.id,
          role: "assistant",
          content: errText,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: errText });
      }
    }),

  resetChat: adminProcedure.mutation(async ({ ctx }) => {
    const newId = await db.insertChatSession({ userId: ctx.user.id, title: "Docket Goblin chat" });
    return { sessionId: newId };
  }),

  /* ===== Auto-ingest a single uploaded file =====
     SAFETY: creates a pending document (publicStatus=false, reviewStatus=pending) plus an ingest_jobs row
     with the structured draft. NEVER publishes. Admin must approve in the moderation queue. */
  ingest: adminProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        dataBase64: z.string(),
        storyId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // v3: validate before allocating an ingest job row
      let v;
      try {
        const buffer = decodeBase64Strict(input.dataBase64);
        v = validateUpload({
          filename: input.filename,
          mimeType: input.mimeType,
          buffer,
        });
      } catch (e: any) {
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "upload_rejected",
          targetType: "ingest",
          metadata: {
            filename: input.filename,
            mimeType: input.mimeType,
            reason: e?.message ?? String(e),
          },
        });
        throw e;
      }

      // Stripe gating: check Goblin credits before proceeding
      const ingestingUser = await db.getUserById(ctx.user.id);
      if (ingestingUser && !hasGoblinCredits(ingestingUser, 10)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Insufficient Goblin credits. Upgrade to Goblin Pro or purchase a credit pack to continue.",
        });
      }
      // Rate-limit Goblin ingest per user (30 / 24h).
      await checkRateLimit({
        userId: ctx.user.id,
        action: "document_ingested",
        windowMs: 24 * 60 * 60 * 1000,
        max: 30,
      });

      const fileSize = v.size;

      // Single shared code path (admin + public REST ingest both call this).
      try {
        const result = await runGoblinPipeline({
          filename: v.filename,
          storageFilename: v.storageFilename,
          mimeType: v.mime,
          buffer: v.buffer,
          fileSize,
          storyId: input.storyId ?? null,
          actor: { userId: ctx.user.id, role: ctx.user.role, source: "goblin" },
        });
        return {
          jobId: result.jobId,
          documentId: result.documentId,
          draft: result.draft,
          proposedActors: result.proposedActors,
          verifiability: result.verifiability,
        };
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Ingest failed: ${e?.message || e}`,
        });
      }
    }),

  ingestList: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => db.listIngestJobs({ status: input?.status })),

  /** Approve an ingest job's drafted document + (optionally) create the proposed timeline event.
   * This is the ONLY path that can publish — admin-explicit. */
  approveIngest: adminProcedure
    .input(
      z.object({
        jobId: z.number(),
        approveDocument: z.boolean().default(true),
        publishDocument: z.boolean().default(true),
        createTimelineEvent: z.boolean().default(true),
        publishTimelineEvent: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const job = await db.getIngestJob(input.jobId);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Ingest job not found" });
      if (!job.documentId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ingest has no document yet" });

      if (input.approveDocument) {
        const visibility = input.publishDocument ? "public_preview" : "private_admin_only";
        await db.updateDocument(job.documentId, {
          reviewStatus: "approved",
          publicStatus: input.publishDocument,
          visibility,
        });
        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "document_approved",
          targetType: "document",
          targetId: job.documentId,
          metadata: { via: "approveIngest", visibility },
        });
      }

      let timelineEventId: number | null = job.timelineEventId ?? null;
      const draft: any = job.draftJson;
      if (input.createTimelineEvent && draft?.proposedTimeline && !timelineEventId) {
        timelineEventId = await db.insertTimelineEvent({
          eventDate: new Date(draft.proposedTimeline.eventDate),
          title: draft.proposedTimeline.title,
          summary: draft.proposedTimeline.summary,
          category: draft.proposedTimeline.category,
          status: draft.proposedTimeline.status,
          caseNumber: draft.caseNumber || null,
          storyId: job.storyId ?? undefined,
          sourceDocuments: [job.documentId],
          publicStatus: input.publishTimelineEvent,
        });
      }

       // ── v4.0: Write structured actor-document links from draft.actors ──
      if (draft?.actors?.length) {
        const actorMatches = await db.findActorIdsByNames(
          (draft.actors as any[]).map((a: any) => a.name),
        );
        const nameToId = new Map(actorMatches.map((a) => [a.name.toLowerCase(), a.id]));
        for (const draftActor of draft.actors as any[]) {
          const actorId = nameToId.get(draftActor.name.toLowerCase());
          if (!actorId) continue;
          const confidenceScore =
            draftActor.confidence === "high" ? 90 :
            draftActor.confidence === "medium" ? 70 : 50;
          try {
            await db.addActorDocumentLink({
              actorId,
              documentId: job.documentId,
              role: draftActor.role ?? draftActor.category ?? null,
              confidence: confidenceScore,
              extractedFrom: draftActor.mentionContext?.slice(0, 295) ?? null,
              addedBy: "goblin",
              addedByUserId: ctx.user.id,
            });
          } catch {
            // Duplicate link — skip silently
          }
        }
      }

      // ── v4.0: Map patternSignals to violation tags (require sourceQuote) ──
      if (draft?.patternSignals?.length || draft?.allegations?.length) {
        const allTags = await db.listViolationTags();
        const tagsBySlug = new Map(allTags.map((t) => [t.slug, t]));

        // Map patternSignals by tag slug match
        for (const signal of (draft.patternSignals ?? []) as any[]) {
          const tagSlug = signal.tag?.toLowerCase().replace(/-/g, "_");
          const tag = tagsBySlug.get(tagSlug);
          if (!tag) continue;
          const sourceQuote = signal.description?.slice(0, 2000);
          if (!sourceQuote || sourceQuote.length < 5) continue;
          const confidenceScore = signal.severity === "high" ? 80 : signal.severity === "medium" ? 65 : 50;
          try {
            await db.addDocumentViolationTag({
              documentId: job.documentId,
              violationTagId: tag.id,
              sourceQuote,
              sourceCitation: `Docket Goblin analysis — pattern signal: ${signal.label}`,
              confidence: confidenceScore,
              addedBy: "goblin",
              addedByUserId: ctx.user.id,
            });
          } catch {
            // Duplicate tag — skip silently
          }
        }
      }

      await db.updateIngestJob(input.jobId, {
        status: "approved",
        timelineEventId: timelineEventId ?? undefined,
      });
      return { ok: true, documentId: job.documentId, timelineEventId };
    }),
});
/* =============== User role management (audited) =============== */
const userRouter = router({
  adminList: adminProcedure.query(async () => db.listUsers()),
  adminListWithCounts: adminProcedure.query(async () => db.listUsersWithCounts()),
  setRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const target = await db.getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      // Cannot demote yourself — prevents lockout
      if (target.id === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role.",
        });
      }
      const previousRole = target.role;
      await db.setUserRole(input.userId, input.role);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "admin_role_changed",
        targetType: "user",
        targetId: input.userId,
        metadata: { from: previousRole, to: input.role, targetEmail: target.email ?? null },
      });
      return { ok: true };
    }),
});

/* =============== Audit log router =============== */
const auditRouter = router({
  list: adminProcedure
    .input(
      z
        .object({
          actorUserId: z.number().optional(),
          action: z.string().optional(),
          targetType: z.string().optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
          q: z.string().optional(),
          limit: z.number().int().min(1).max(500).optional(),
          offset: z.number().int().min(0).optional(),
        })
        .default({}),
    )
    .query(async ({ input }) => db.listAuditLog(input ?? {})),
  exportCsv: adminProcedure
    .input(
      z
        .object({
          actorUserId: z.number().optional(),
          action: z.string().optional(),
          targetType: z.string().optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
          q: z.string().optional(),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const rows = await db.exportAuditLog(input ?? {});
      // Return rows; the client serializes to CSV. (Keeps streaming simple via tRPC.)
      return rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        actorUserId: r.actorUserId,
        actorRole: r.actorRole,
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId,
        metadata: r.metadata ?? null,
        ipHash: r.ipHash,
      }));
    }),
});

/* =============== Review Requests router =============== */
const reviewRequestRouter = router({
  /** Submitter files a request against their own approved record */
  submit: protectedProcedure
    .input(
      z.object({
        targetType: z.enum(["story", "document"]),
        targetId: z.number(),
        requestType: z.enum(["removal", "correction", "redaction", "privacy_concern", "legal_safety_concern"]),
        reason: z.string().min(10).max(2000),
        explanation: z.string().max(4000).optional(),
        correctionText: z.string().max(4000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the record belongs to this user
      if (input.targetType === "story") {
        const story = await db.getStoryById(input.targetId);
        if (!story) throw new TRPCError({ code: "NOT_FOUND" });
        if (story.ownerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You can only request review of records you submitted." });
        if (story.status !== "approved" || !story.publicPermission) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved public records can be flagged for review. Pending records can be deleted directly." });
        }
      } else {
        const doc = await db.getDocumentById(input.targetId);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
        // uploadedBy or ownerUserId via storyId
        const isOwner = doc.uploadedBy === ctx.user.id;
        if (!isOwner) throw new TRPCError({ code: "FORBIDDEN", message: "You can only request review of documents you uploaded." });
        if (!doc.publicStatus || doc.reviewStatus !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved public documents can be flagged for review." });
        }
      }
      const id = await db.createReviewRequest({
        requestorUserId: ctx.user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        requestType: input.requestType,
        reason: input.reason,
        explanation: input.explanation ?? null,
        correctionText: input.correctionText ?? null,
      });
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "review_request_submitted",
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: { requestType: input.requestType, requestId: id },
      });
      return { id };
    }),

  /** User sees their own requests */
  myRequests: protectedProcedure.query(async ({ ctx }) =>
    db.listReviewRequestsByUser(ctx.user.id),
  ),

  /** Admin list with optional filters */
  adminList: adminProcedure
    .input(
      z.object({
        status: z.string().optional(),
        requestType: z.string().optional(),
        targetType: z.string().optional(),
      }).default({}),
    )
    .query(async ({ input }) => db.listReviewRequests(input)),

  /** Admin resolves a request — 7 possible actions */
  adminResolve: adminProcedure
    .input(
      z.object({
        id: z.number(),
        resolution: z.enum([
          "keep_public",
          "redact",
          "correct_metadata",
          "hide_temporarily",
          "move_to_private",
          "reject_request",
          "remove_from_public_view",
        ]),
        editorialNote: z.string().max(2000).optional(),
        correctionNote: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const req = await db.getReviewRequestById(input.id);
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });

      // Map resolution to status
      const statusMap: Record<string, string> = {
        keep_public: "denied",
        reject_request: "denied",
        redact: "resolved_redaction",
        correct_metadata: "resolved_correction",
        hide_temporarily: "approved",
        move_to_private: "approved",
        remove_from_public_view: "resolved_removal",
      };
      const newStatus = statusMap[input.resolution] as any;

      await db.updateReviewRequest(input.id, {
        status: newStatus,
        editorialNote: input.editorialNote ?? null,
        resolvedBy: ctx.user.id,
        resolvedAt: new Date(),
      });

      // Apply the resolution to the underlying record
      if (input.resolution === "move_to_private" || input.resolution === "hide_temporarily") {
        if (req.targetType === "story") {
          await db.updateStory(req.targetId, { publicPermission: false } as any);
        } else {
          await db.updateDocument(req.targetId, { publicStatus: false, visibility: "private_admin_only" } as any);
        }
      } else if (input.resolution === "remove_from_public_view") {
        if (req.targetType === "story") {
          await db.updateStory(req.targetId, { publicPermission: false } as any);
        } else {
          await db.updateDocument(req.targetId, { publicStatus: false, visibility: "private_admin_only" } as any);
        }
      } else if (input.resolution === "correct_metadata" && input.correctionNote) {
        if (req.targetType === "story") {
          await db.updateStory(req.targetId, { correctionNote: input.correctionNote } as any);
        } else {
          await db.updateDocument(req.targetId, { correctionNote: input.correctionNote } as any);
        }
      } else if (input.resolution === "redact") {
        if (req.targetType === "document") {
          await db.updateDocument(req.targetId, { visibility: "needs_redaction" } as any);
        }
      }

      // Apply editorial note to the record
      if (input.editorialNote) {
        if (req.targetType === "story") {
          await db.updateStory(req.targetId, { editorialNote: input.editorialNote } as any);
        } else {
          await db.updateDocument(req.targetId, { editorialNote: input.editorialNote } as any);
        }
      }

      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "review_request_resolved",
        targetType: req.targetType,
        targetId: req.targetId,
        metadata: { resolution: input.resolution, requestId: input.id, editorialNote: input.editorialNote ?? null },
      });
      return { ok: true };
    }),
});

/* =============== User self-service delete (pending items only) =============== */
const userDataRouter = router({
  /** Delete a pending story the user owns */
  deleteMyStory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const story = await db.getStoryById(input.id);
      if (!story) throw new TRPCError({ code: "NOT_FOUND" });
      if (story.ownerUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (story.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approved or rejected records cannot be deleted directly. Use the review request process.",
        });
      }
      await db.hardDeleteStory(input.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "story_hard_deleted",
        targetType: "story",
        targetId: input.id,
        metadata: { reason: "user_self_delete_pending" },
      });
      return { ok: true };
    }),

  /** Delete a pending document the user owns */
  deleteMyDocument: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await db.getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      if (doc.uploadedBy !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (doc.reviewStatus !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Approved or rejected documents cannot be deleted directly. Use the review request process.",
        });
      }
      await db.hardDeleteDocument(input.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_hard_deleted",
        targetType: "document",
        targetId: input.id,
        metadata: { reason: "user_self_delete_pending" },
      });
      return { ok: true };
    }),

  /** User's own submissions (for profile page) */
  myStories: protectedProcedure.query(async ({ ctx }) => db.listStoriesByOwner(ctx.user.id)),
  myDocuments: protectedProcedure.query(async ({ ctx }) => db.listDocumentsByOwner(ctx.user.id)),
});

/* =============== Admin full-edit + soft/hard delete =============== */
const adminEditRouter = router({
  /** Full edit of any story field — audited with old/new values */
  editStory: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          alias: z.string().optional(),
          court: z.string().optional(),
          judge: z.string().optional(),
          prosecutor: z.string().optional(),
          defenseAttorney: z.string().optional(),
          charges: z.string().optional(),
          summary: z.string().optional(),
          mainIssue: z.string().optional(),
          reviewerNote: z.string().optional(),
          editorialNote: z.string().optional(),
          correctionNote: z.string().optional(),
          featured: z.boolean().optional(),
          slug: z.string().optional(),
          status: z.enum(["pending", "approved", "rejected", "needs_changes"]).optional(),
          publicPermission: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await db.getStoryById(input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateStory(input.id, input.patch as any);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "story_edited",
        targetType: "story",
        targetId: input.id,
        metadata: { fields: Object.keys(input.patch), before: Object.fromEntries(Object.keys(input.patch).map(k => [k, (before as any)[k]])) },
      });
      return { ok: true };
    }),

  /** Full edit of any document field */
  editDocument: adminProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          title: z.string().optional(),
          description: z.string().optional(),
          sourceType: z.string().optional(),
          caseNumber: z.string().optional(),
          actorNames: z.string().optional(),
          editorialNote: z.string().optional(),
          correctionNote: z.string().optional(),
          visibility: z.string().optional(),
          aiPolicy: z.string().optional(),
          publicStatus: z.boolean().optional(),
          reviewStatus: z.string().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const before = await db.getDocumentById(input.id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateDocument(input.id, input.patch as any);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_edited",
        targetType: "document",
        targetId: input.id,
        metadata: { fields: Object.keys(input.patch), before: Object.fromEntries(Object.keys(input.patch).map(k => [k, (before as any)[k]])) },
      });
      return { ok: true };
    }),

  /** Soft-delete a story (hides from public, retains in DB) */
  softDeleteStory: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.softDeleteStory(input.id, ctx.user.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "story_soft_deleted",
        targetType: "story",
        targetId: input.id,
      });
      return { ok: true };
    }),

  /** Hard-delete a story — requires confirmation phrase */
  hardDeleteStory: adminProcedure
    .input(z.object({ id: z.number(), confirmPhrase: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmPhrase !== "PERMANENTLY DELETE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmation phrase incorrect. Type PERMANENTLY DELETE to confirm." });
      }
      await db.hardDeleteStory(input.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "story_hard_deleted",
        targetType: "story",
        targetId: input.id,
        metadata: { reason: "admin_hard_delete" },
      });
      return { ok: true };
    }),

  /** Soft-delete a document */
  softDeleteDocument: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.softDeleteDocument(input.id, ctx.user.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_soft_deleted",
        targetType: "document",
        targetId: input.id,
      });
      return { ok: true };
    }),

  /** Hard-delete a document — requires confirmation phrase */
  hardDeleteDocument: adminProcedure
    .input(z.object({ id: z.number(), confirmPhrase: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.confirmPhrase !== "PERMANENTLY DELETE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Confirmation phrase incorrect. Type PERMANENTLY DELETE to confirm." });
      }
      await db.hardDeleteDocument(input.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_hard_deleted",
        targetType: "document",
        targetId: input.id,
        metadata: { reason: "admin_hard_delete" },
      });
      return { ok: true };
    }),

  /** Inline edit — generic field-level edit for any record type, audited */
  inlineEdit: adminProcedure
    .input(
      z.object({
        recordType: z.enum(["story", "document", "timeline_event", "actor", "prr"]),
        recordId: z.number(),
        field: z.string(),
        oldValue: z.unknown(),
        newValue: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch = { [input.field]: input.newValue };
      switch (input.recordType) {
        case "story":
          await db.updateStory(input.recordId, patch as any);
          break;
        case "document":
          await db.updateDocument(input.recordId, patch as any);
          break;
        case "timeline_event":
          await db.updateTimelineEvent(input.recordId, patch as any);
          break;
        case "actor":
          await db.updateActor(input.recordId, patch as any);
          break;
        case "prr":
          await db.updatePrr(input.recordId, patch as any);
          break;
      }
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "inline_edit",
        targetType: input.recordType,
        targetId: input.recordId,
        metadata: { field: input.field, oldValue: input.oldValue, newValue: input.newValue },
      });
      return { ok: true };
    }),
});

/* =============== Document admin counts =============== */
// Mounted into documentRouter via patch below; declared early so it sees auditRouter scope

/* =============== Root =============== */

/* ========== Agency Router (v4.0) ========== */
const agencyRouter = router({
  list: publicProcedure.query(async () => {
    return db.listAgencies({ publicOnly: true });
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const agency = await db.getAgencyBySlug(input.slug);
      if (!agency) throw new TRPCError({ code: "NOT_FOUND" });
      const [actors, docCount] = await Promise.all([
        db.getAgencyActors(agency.id),
        db.getAgencyDocumentCount(agency.id),
      ]);
      return { agency, actors, docCount };
    }),

  adminCreate: adminProcedure
    .input(
      z.object({
        name: z.string().min(2).max(300),
        slug: z.string().min(2).max(200),
        agencyType: z.enum([
          "court", "prosecutor", "law_enforcement", "public_defender",
          "government_department", "oversight_body", "municipality",
          "state_agency", "federal_agency", "other",
        ]),
        jurisdictionName: z.string().optional(),
        jurisdictionType: z.enum(["county", "city", "state", "federal", "multi_jurisdictional", "other"]).optional(),
        state: z.string().optional(),
        county: z.string().optional(),
        city: z.string().optional(),
        parentAgencyId: z.number().optional(),
        websiteUrl: z.string().url().optional().or(z.literal("")),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.createAgency(input);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "agency", targetId: 0, metadata: { action: "create", name: input.name } });
      return { success: true };
    }),

  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2).max(300).optional(),
        agencyType: z.enum([
          "court", "prosecutor", "law_enforcement", "public_defender",
          "government_department", "oversight_body", "municipality",
          "state_agency", "federal_agency", "other",
        ]).optional(),
        websiteUrl: z.string().optional(),
        notes: z.string().optional(),
        publicStatus: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateAgency(id, data);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "agency", targetId: id, metadata: { action: "update", ...data } });
      return { success: true };
    }),

  addActorRole: adminProcedure
    .input(
      z.object({
        actorId: z.number(),
        agencyId: z.number(),
        title: z.string().min(1).max(200),
        isCurrent: z.boolean().default(false),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.addActorAgencyRole(input);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "actor_agency_role", targetId: input.actorId, metadata: { agencyId: input.agencyId, title: input.title } });
      return { success: true };
    }),
});

/* ========== Violation Tag Router (v4.0) ========== */
const violationTagRouter = router({
  list: publicProcedure.query(async () => {
    return db.listViolationTags();
  }),

  getDocumentTags: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.getDocumentViolationTags(input.documentId);
    }),

  addToDocument: adminProcedure
    .input(
      z.object({
        documentId: z.number(),
        violationTagId: z.number(),
        sourceQuote: z.string().min(5),
        sourceCitation: z.string().optional(),
        confidence: z.number().min(0).max(100).default(100),
        addedBy: z.enum(["human", "goblin"]).default("human"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await db.addDocumentViolationTag({ ...input, addedByUserId: ctx.user.id });
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "document_violation_tag", targetId: input.documentId, metadata: { action: "tag_added", violationTagId: input.violationTagId, confidence: input.confidence } });
      return result;
    }),

  removeFromDocument: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.removeDocumentViolationTag(input.id);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "document_violation_tag", targetId: input.id, metadata: { action: "tag_removed" } });
      return { success: true };
    }),

  adminCreate: adminProcedure
    .input(
      z.object({
        slug: z.string().min(2).max(120),
        label: z.string().min(2).max(200),
        description: z.string().optional(),
        category: z.enum([
          "constitutional", "procedural", "discovery", "judicial_conduct",
          "prosecutorial_conduct", "law_enforcement", "public_records", "civil_rights", "other",
        ]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.createViolationTag(input);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "violation_tag", targetId: 0, metadata: { action: "create", slug: input.slug } });
      return { success: true };
    }),
});

/* ========== Actor Link Router (v4.0) ========== */
const actorLinkRouter = router({
  getDocumentLinks: publicProcedure
    .input(z.object({ actorId: z.number() }))
    .query(async ({ input }) => {
      return db.getActorDocumentLinks(input.actorId);
    }),

  getDocumentActors: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.getDocumentActorLinks(input.documentId);
    }),

  getTimelineLinks: publicProcedure
    .input(z.object({ actorId: z.number() }))
    .query(async ({ input }) => {
      return db.getActorTimelineLinks(input.actorId);
    }),

  getAgencyRoles: publicProcedure
    .input(z.object({ actorId: z.number() }))
    .query(async ({ input }) => {
      return db.getActorAgencyRoles(input.actorId);
    }),

  addDocumentLink: adminProcedure
    .input(
      z.object({
        actorId: z.number(),
        documentId: z.number(),
        role: z.string().optional(),
        confidence: z.number().min(0).max(100).default(100),
        extractedFrom: z.string().optional(),
        addedBy: z.enum(["human", "goblin"]).default("human"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.addActorDocumentLink({ ...input, addedByUserId: ctx.user.id });
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "actor_document_link", targetId: input.actorId, metadata: { action: "link_added", documentId: input.documentId, role: input.role } });
      return { success: true };
    }),

  removeDocumentLink: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.removeActorDocumentLink(input.id);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "actor_document_link", targetId: input.id, metadata: { action: "link_removed" } });
      return { success: true };
    }),

  addTimelineLink: adminProcedure
    .input(
      z.object({
        actorId: z.number(),
        timelineEventId: z.number(),
        role: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db.addActorTimelineLink(input);
      await writeAudit({ actorUserId: ctx.user.id, actorRole: ctx.user.role, action: "inline_edit", targetType: "actor_timeline_link", targetId: input.actorId, metadata: { action: "timeline_link_added", timelineEventId: input.timelineEventId } });
      return { success: true };
    }),
});

/* ========== Billing Router ========== */
const billingRouter = router({
  tiers: publicProcedure.query(() => TIERS),
  creditPacks: publicProcedure.query(() => CREDIT_PACKS),
  mySubscription: protectedProcedure.query(async ({ ctx }) => {
    const userRow = await db.getUserById(ctx.user.id);
    if (!userRow) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      tier: userRow.subscriptionTier ?? "free",
      tierLabel: tierLabel(userRow.subscriptionTier ?? "free"),
      status: userRow.subscriptionStatus ?? "none",
      goblinCredits: userRow.goblinCredits ?? 0,
      goblinFreeRemaining: freeGoblinRemaining(userRow),
      hasReceipts: hasTier(userRow, "receipts"),
      hasGoblinPro: hasTier(userRow, "goblin_pro"),
      stripeCustomerId: userRow.stripeCustomerId ?? null,
    };
  }),
  createCheckout: protectedProcedure
    .input(
      z.object({
        tierSlug: z.enum(["receipts", "goblin_pro", "founding", "founders_circle"]),
        origin: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userRow = await db.getUserById(ctx.user.id);
      if (!userRow) throw new TRPCError({ code: "NOT_FOUND" });
      const url = await createSubscriptionCheckoutSession({
        userId: ctx.user.id,
        userEmail: userRow.email ?? "",
        userName: userRow.name ?? "Anonymous",
        tierSlug: input.tierSlug,
        origin: input.origin,
      });
      return { url };
    }),
  createCreditPackCheckout: protectedProcedure
    .input(
      z.object({
        packId: z.string(),
        origin: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userRow = await db.getUserById(ctx.user.id);
      if (!userRow) throw new TRPCError({ code: "NOT_FOUND" });
      const url = await createCreditPackCheckoutSession({
        userId: ctx.user.id,
        userEmail: userRow.email ?? "",
        userName: userRow.name ?? "Anonymous",
        packId: input.packId,
        origin: input.origin,
      });
      return { url };
    }),
  billingPortal: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const userRow = await db.getUserById(ctx.user.id);
      if (!userRow?.stripeCustomerId)
        throw new TRPCError({ code: "BAD_REQUEST", message: "No billing account found" });
      const url = await getCustomerPortalUrl(userRow.stripeCustomerId, input.origin);
      return { url };
    }),
});

/* ========== Judicial Pattern Router (v6.0) ========== */
const judicialPatternRouter = router({
  /** Public: list all public judicial cases */
  list: publicProcedure
    .input(
      z.object({
        judge: z.string().optional(),
        proSe: z.boolean().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }).optional(),
    )
    .query(async ({ input }) =>
      db.listJudicialCases({ ...input, publicOnly: true }),
    ),

  /** Public: aggregate metrics for the pattern dashboard */
  metrics: publicProcedure
    .input(z.object({ judge: z.string().optional() }).optional())
    .query(async ({ input }) =>
      db.getJudicialPatternMetrics(input?.judge),
    ),

  /** Public: boilerplate phrases (flagged, min 5 occurrences) */
  boilerplate: publicProcedure
    .input(
      z.object({
        judge: z.string().optional(),
        flaggedOnly: z.boolean().optional(),
        minOccurrences: z.number().int().min(1).optional(),
      }).optional(),
    )
    .query(async ({ input }) =>
      db.listBoilerplatePhrases({ ...input, flaggedOnly: input?.flaggedOnly ?? true }),
    ),

  /** Admin: add a judicial case to the corpus */
  adminIngest: adminProcedure
    .input(
      z.object({
        caseNumber: z.string().max(120),
        judgeName: z.string().max(200),
        department: z.string().max(60).optional(),
        caseType: z.enum([
          "criminal_felony",
          "criminal_misdemeanor",
          "civil",
          "family",
          "small_claims",
          "other",
        ]).optional(),
        proSeFlag: z.boolean().optional(),
        representedFlag: z.boolean().optional(),
        filingDate: isoDate,
        dispositionDate: isoDate,
        dispositionType: z.enum([
          "convicted",
          "acquitted",
          "dismissed_with_prejudice",
          "dismissed_without_prejudice",
          "settled",
          "transferred",
          "pending",
          "other",
        ]).optional(),
        rulingText: z.string().optional(),
        timeToRulingMinutes: z.number().int().optional(),
        dataSource: z.enum(["npra_response", "manual_download", "public_portal", "goblin_ingest"]).optional(),
        notes: z.string().optional(),
        publicStatus: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.insertJudicialCase({
        caseNumber: input.caseNumber,
        judgeName: input.judgeName,
        department: input.department,
        caseType: input.caseType ?? "other",
        proSeFlag: input.proSeFlag ?? false,
        representedFlag: input.representedFlag ?? false,
        filingDate: input.filingDate ?? undefined,
        dispositionDate: input.dispositionDate ?? undefined,
        dispositionType: input.dispositionType ?? "pending",
        rulingText: input.rulingText,
        timeToRulingMinutes: input.timeToRulingMinutes,
        dataSource: input.dataSource ?? "manual_download",
        notes: input.notes,
        publicStatus: input.publicStatus ?? false,
      });
      return { id };
    }),

  /** Admin: update a judicial case */
  adminUpdate: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        patch: z.object({
          publicStatus: z.boolean().optional(),
          boilerplateScore: z.number().int().min(0).max(100).optional(),
          ingestStatus: z.enum(["pending", "text_extracted", "boilerplate_scored", "complete", "failed"]).optional(),
          notes: z.string().optional(),
          rulingText: z.string().optional(),
          timeToRulingMinutes: z.number().int().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await db.updateJudicialCase(input.id, input.patch);
      return { success: true };
    }),
});

const auditRequestRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(200),
        email: z.string().email().max(320),
        caseNumber: z.string().max(160).optional(),
        court: z.string().max(240).optional(),
        jurisdiction: z.string().max(160).optional(),
        caseType: z.enum(["criminal", "civil", "family", "administrative", "other"]).default("criminal"),
        description: z.string().min(20).max(10000),
        objectives: z.string().max(5000).optional(),
        budget: z.enum(["under_500", "500_2000", "2000_5000", "5000_plus", "discuss"]).default("discuss"),
      }),
    )
    .mutation(async ({ input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const schema = await import("../drizzle/schema");
      await drizzleDb.insert(schema.auditRequests).values({
        name: input.name,
        email: input.email,
        caseNumber: input.caseNumber,
        court: input.court,
        jurisdiction: input.jurisdiction,
        caseType: input.caseType,
        description: input.description,
        objectives: input.objectives,
        budget: input.budget,
        status: "new",
      });
      await notifyOwner({
        title: "New Case Audit Request",
        content: `Name: ${input.name}\nEmail: ${input.email}\nCase: ${input.caseNumber ?? "N/A"}\nCourt: ${input.court ?? "N/A"}\nBudget: ${input.budget}\n\n${input.description.slice(0, 500)}`,
      });
      return { success: true };
    }),
});

/* ========== Leaderboard Router (v6.2) ========== */
const leaderboardRouter = router({
  /** Public: actor violation density leaderboard */
  actorViolations: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => db.getActorViolationLeaderboard(input?.limit ?? 20)),

  /** Public: auditor XP leaderboard */
  auditors: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
    .query(async ({ input }) => db.getAuditorLeaderboard(input?.limit ?? 20)),
});

/* =============== Operator platform (v7.0 Artificially Educated) =============== */
const projectStatusEnum = z.enum(["live", "in_development", "beta", "concept", "archived"]);
const buildLogCategoryEnum = z.enum([
  "ai_automation",
  "ai_agents",
  "systems_architecture",
  "legal_tech",
  "data_pipeline",
  "web_platform",
  "infrastructure",
  "other",
]);

const operatorRouter = router({
  // ---- Public reads ----
  profile: publicProcedure.query(async () => db.getOperatorProfile()),
  buildLog: publicProcedure.query(async () => db.listBuildLog()),
  projects: publicProcedure.query(async () => db.listProjects()),
  projectBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const p = await db.getProjectBySlug(input.slug);
      if (!p || !p.publicStatus) return null;
      return p;
    }),

  // ---- Admin: profile ----
  adminProfile: adminProcedure.query(async () => db.getOperatorProfile()),
  updateProfile: adminProcedure
    .input(
      z.object({
        brand: z.string().max(160).optional(),
        fullName: z.string().max(200).optional(),
        roleTitle: z.string().max(240).nullish(),
        tagline: z.string().max(400).nullish(),
        thesis: z.string().nullish(),
        bioMarkdown: z.string().nullish(),
        location: z.string().max(160).nullish(),
        links: z.array(z.object({ label: z.string(), url: z.string(), icon: z.string().optional() })).nullish(),
        avatarKey: z.string().max(400).nullish(),
        heroImageKey: z.string().max(400).nullish(),
      }),
    )
    .mutation(async ({ input }) => db.upsertOperatorProfile(input as any)),

  // ---- Admin: build log ----
  adminBuildLog: adminProcedure.query(async () => db.listBuildLog({ includeHidden: true })),
  createBuildLog: adminProcedure
    .input(
      z.object({
        title: z.string().min(1).max(280),
        category: buildLogCategoryEnum.default("other"),
        summary: z.string().max(600).nullish(),
        detailMarkdown: z.string().nullish(),
        outcome: z.string().max(400).nullish(),
        eventDate: isoDate,
        featured: z.boolean().default(false),
        publicStatus: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const id = await db.insertBuildLogEntry(input as any);
      return { id };
    }),
  updateBuildLog: adminProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(280).optional(),
        category: buildLogCategoryEnum.optional(),
        summary: z.string().max(600).nullish(),
        detailMarkdown: z.string().nullish(),
        outcome: z.string().max(400).nullish(),
        eventDate: isoDate,
        featured: z.boolean().optional(),
        publicStatus: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateBuildLogEntry(id, patch as any);
      return { success: true } as const;
    }),
  deleteBuildLog: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteBuildLogEntry(input.id);
      return { success: true } as const;
    }),

  // ---- Admin: projects ----
  adminProjects: adminProcedure.query(async () => db.listProjects({ includeHidden: true })),
  createProject: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        slug: z.string().max(160).optional(),
        tagline: z.string().max(400).nullish(),
        description: z.string().nullish(),
        status: projectStatusEnum.default("concept"),
        role: z.string().max(240).nullish(),
        techStack: z.array(z.string()).nullish(),
        liveUrl: z.string().max(600).nullish(),
        repoUrl: z.string().max(600).nullish(),
        thumbnailKey: z.string().max(400).nullish(),
        screenshots: z.array(z.object({ key: z.string(), caption: z.string().optional() })).nullish(),
        parentBrand: z.string().max(200).nullish(),
        featured: z.boolean().default(false),
        internalPath: z.string().max(300).nullish(),
        publicStatus: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = (input.slug && input.slug.length ? input.slug : slugify(input.name)) || slugify(input.name);
      const id = await db.insertProject({ ...input, slug } as any);
      return { id, slug };
    }),
  updateProject: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(200).optional(),
        slug: z.string().max(160).optional(),
        tagline: z.string().max(400).nullish(),
        description: z.string().nullish(),
        status: projectStatusEnum.optional(),
        role: z.string().max(240).nullish(),
        techStack: z.array(z.string()).nullish(),
        liveUrl: z.string().max(600).nullish(),
        repoUrl: z.string().max(600).nullish(),
        thumbnailKey: z.string().max(400).nullish(),
        screenshots: z.array(z.object({ key: z.string(), caption: z.string().optional() })).nullish(),
        parentBrand: z.string().max(200).nullish(),
        featured: z.boolean().optional(),
        internalPath: z.string().max(300).nullish(),
        publicStatus: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      await db.updateProject(id, patch as any);
      return { success: true } as const;
    }),
  deleteProject: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteProject(input.id);
      return { success: true } as const;
    }),
});

/* =============== v7.1 Evidence Engine: classification, versions, packages =============== */
const recordStatusEnum = z.enum([
  "on_record_state",
  "on_record_federal",
  "supporting",
  "unfiled_not_on_record",
  "unclassified",
]);

const evidenceEngineRouter = router({
  /** Public: filing packages grouped for the archive (only on-record buckets shown publicly). */
  listPackages: publicProcedure
    .input(z.object({ recordStatus: recordStatusEnum.optional() }).optional())
    .query(async ({ input }) => {
      return db.listFilingPackages(input?.recordStatus ? { recordStatus: input.recordStatus } : undefined);
    }),

  /** Admin: documents flagged by QC as needing human review (date or classification). */
  reviewQueue: adminProcedure.query(async () => {
    return db.listDocumentsNeedingReview();
  }),

  /** Admin: manually set/override a document's classification + date. Snapshots a new version. */
  setClassification: adminProcedure
    .input(
      z.object({
        documentId: z.number(),
        recordStatus: recordStatusEnum.optional(),
        filingStampDate: z.string().nullish(), // ISO date or null
        dateSource: z.enum(["filing_stamp", "file_metadata", "inferred", "undated"]).optional(),
        clearDateReview: z.boolean().optional(),
        clearClassificationReview: z.boolean().optional(),
        note: z.string().max(600).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      const patch: any = { recordStatusSource: "admin" };
      if (input.recordStatus) {
        patch.recordStatus = input.recordStatus;
        patch.recordStatusConfidence = 100;
        patch.needsClassificationReview = false;
        // keep legacy caseTag aligned
        if (input.recordStatus === "on_record_federal") patch.caseTag = "federal";
        else if (input.recordStatus === "on_record_state") patch.caseTag = "state";
      }
      if (input.filingStampDate !== undefined) {
        const d = input.filingStampDate ? new Date(input.filingStampDate) : null;
        patch.filingStampDate = d ?? undefined;
        patch.dateSource = input.dateSource ?? (d ? "filing_stamp" : "undated");
        patch.dateConfidence = d ? 100 : 0;
        patch.needsDateReview = false;
        if (d) patch.documentDate = d;
      }
      if (input.clearDateReview) patch.needsDateReview = false;
      if (input.clearClassificationReview) patch.needsClassificationReview = false;

      await db.updateDocument(input.documentId, patch);
      const versionNo = await db.snapshotDocumentVersion({
        documentId: input.documentId,
        changeNote: input.note || "Admin classification override",
        changedBy: ctx.user.id,
        changedBySource: "admin",
      });
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_edited",
        targetType: "document",
        targetId: input.documentId,
        metadata: { phase: "manual_classification", patch, versionNo },
      });
      return { success: true, versionNo } as const;
    }),

  /** Admin: re-run Goblin classification on a single existing document. */
  reclassify: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      // Pull text from the stored file if we have it; else use title + description.
      let text = [doc.title, doc.description, doc.aiSummary].filter(Boolean).join("\n\n");
      try {
        if (doc.fileKey && doc.mimeType) {
          const { storageGetSignedUrl } = await import("./storage");
          const signedUrl = await storageGetSignedUrl(doc.fileKey).catch(() => null);
          if (signedUrl) {
            const resp = await fetch(signedUrl).catch(() => null);
            if (resp && resp.ok) {
              const bytes = Buffer.from(await resp.arrayBuffer());
              const extracted = await extractText(bytes, doc.mimeType);
              if (extracted && extracted.length > text.length) text = extracted;
            }
          }
        }
      } catch (e) {
        console.error("[reclassify] text fetch failed, using metadata:", e);
      }
      const classification = await classifyDocument({
        filename: doc.title,
        mimeType: doc.mimeType || "application/octet-stream",
        text,
      });
      const qc = qcReview(classification);
      const legacyCaseTag =
        qc.recordStatus === "on_record_federal"
          ? "federal"
          : qc.recordStatus === "on_record_state"
          ? "state"
          : undefined;
      let filingPackageId: number | undefined;
      if (
        (qc.recordStatus === "on_record_state" || qc.recordStatus === "on_record_federal") &&
        (qc.docketEntryNo || qc.caseNumber)
      ) {
        filingPackageId = await db.findOrCreateFilingPackage({
          docketEntryNo: qc.docketEntryNo,
          title: qc.docketEntryNo ? `${qc.caseNumber ?? "Case"} — ${qc.docketEntryNo}` : doc.title,
          recordStatus: qc.recordStatus,
          caseNumber: qc.caseNumber,
          filedDate: qc.filingStampDate ? new Date(qc.filingStampDate) : null,
        });
      }
      await db.updateDocument(input.documentId, {
        filingStampDate: qc.filingStampDate ? new Date(qc.filingStampDate) : undefined,
        dateSource: qc.dateSource,
        dateConfidence: qc.dateConfidence,
        needsDateReview: qc.needsDateReview,
        dateSourceQuote: qc.dateSourceQuote ?? undefined,
        recordStatus: qc.recordStatus,
        recordStatusConfidence: qc.recordStatusConfidence,
        recordStatusSource: qc.recordStatusSource,
        recordStatusReason: qc.recordStatusReason ?? undefined,
        needsClassificationReview: qc.needsClassificationReview,
        filingPackageId,
        ...(legacyCaseTag ? { caseTag: legacyCaseTag as any } : {}),
        ...(qc.dateSource === "filing_stamp" && qc.filingStampDate
          ? { documentDate: new Date(qc.filingStampDate) }
          : {}),
      });
      const versionNo = await db.snapshotDocumentVersion({
        documentId: input.documentId,
        changeNote: "Goblin reclassification",
        changedBy: ctx.user.id,
        changedBySource: "goblin",
      });
      return { success: true, qc, versionNo } as const;
    }),

  /** Admin: batch (re)classify documents. Processes a bounded slice per call to stay
   *  under the serverless request timeout; returns a cursor for the next slice. */
  batchClassify: adminProcedure
    .input(
      z.object({
        onlyUnclassified: z.boolean().default(true),
        limit: z.number().int().min(1).max(15).default(8),
        afterId: z.number().int().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const targets = await db.listDocumentsForClassification({
        onlyUnclassified: input.onlyUnclassified,
        limit: input.limit,
        afterId: input.afterId,
      });
      const results: Array<{ id: number; recordStatus: string; dateSource: string; flagged: boolean }> = [];
      let lastId = input.afterId;
      for (const doc of targets) {
        lastId = doc.id;
        try {
          let text = [doc.title, doc.description, doc.aiSummary].filter(Boolean).join("\n\n");
          if (doc.fileKey && doc.mimeType) {
            const { storageGetSignedUrl } = await import("./storage");
            const signedUrl = await storageGetSignedUrl(doc.fileKey).catch(() => null);
            if (signedUrl) {
              const resp = await fetch(signedUrl).catch(() => null);
              if (resp && resp.ok) {
                const bytes = Buffer.from(await resp.arrayBuffer());
                const extracted = await extractText(bytes, doc.mimeType).catch(() => "");
                if (extracted && extracted.length > text.length) text = extracted;
              }
            }
          }
          const classification = await classifyDocument({
            filename: doc.title,
            mimeType: doc.mimeType || "application/octet-stream",
            text,
          });
          const qc = qcReview(classification);
          const legacyCaseTag =
            qc.recordStatus === "on_record_federal"
              ? "federal"
              : qc.recordStatus === "on_record_state"
              ? "state"
              : undefined;
          let filingPackageId: number | undefined;
          if (
            (qc.recordStatus === "on_record_state" || qc.recordStatus === "on_record_federal") &&
            (qc.docketEntryNo || qc.caseNumber)
          ) {
            filingPackageId = await db.findOrCreateFilingPackage({
              docketEntryNo: qc.docketEntryNo,
              title: qc.docketEntryNo ? `${qc.caseNumber ?? "Case"} — ${qc.docketEntryNo}` : doc.title,
              recordStatus: qc.recordStatus,
              caseNumber: qc.caseNumber,
              filedDate: qc.filingStampDate ? new Date(qc.filingStampDate) : null,
            });
          }
          await db.updateDocument(doc.id, {
            filingStampDate: qc.filingStampDate ? new Date(qc.filingStampDate) : undefined,
            dateSource: qc.dateSource,
            dateConfidence: qc.dateConfidence,
            needsDateReview: qc.needsDateReview,
            dateSourceQuote: qc.dateSourceQuote ?? undefined,
            recordStatus: qc.recordStatus,
            recordStatusConfidence: qc.recordStatusConfidence,
            recordStatusSource: qc.recordStatusSource,
            recordStatusReason: qc.recordStatusReason ?? undefined,
            needsClassificationReview: qc.needsClassificationReview,
            filingPackageId,
            ...(legacyCaseTag ? { caseTag: legacyCaseTag as any } : {}),
            ...(qc.dateSource === "filing_stamp" && qc.filingStampDate
              ? { documentDate: new Date(qc.filingStampDate) }
              : {}),
          });
          await db.snapshotDocumentVersion({
            documentId: doc.id,
            changeNote: "Batch classification backfill",
            changedBy: ctx.user.id,
            changedBySource: "goblin",
          });
          results.push({
            id: doc.id,
            recordStatus: qc.recordStatus,
            dateSource: qc.dateSource,
            flagged: qc.needsDateReview || qc.needsClassificationReview,
          });
        } catch (e) {
          console.error(`[batchClassify] doc ${doc.id} failed:`, e);
          results.push({ id: doc.id, recordStatus: "error", dateSource: "error", flagged: true });
        }
      }
      return {
        processed: results.length,
        results,
        nextAfterId: targets.length === input.limit ? lastId : null,
        done: targets.length < input.limit,
      } as const;
    }),

  /** Admin: version history for a document. */
  versions: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return db.listDocumentVersions(input.documentId);
    }),

  /** Admin: a single version snapshot. */
  version: adminProcedure
    .input(z.object({ documentId: z.number(), versionNo: z.number() }))
    .query(async ({ input }) => {
      const v = await db.getDocumentVersion(input.documentId, input.versionNo);
      if (!v) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      return v;
    }),

  /** Admin: restore a document to a prior version (append-only; never destroys history). */
  restoreVersion: adminProcedure
    .input(z.object({ documentId: z.number(), versionNo: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const res = await db.restoreDocumentVersion({
        documentId: input.documentId,
        versionNo: input.versionNo,
        changedBy: ctx.user.id,
      });
      if (!res) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "document_edited",
        targetType: "document",
        targetId: input.documentId,
        metadata: { phase: "restore_version", ...res },
      });
            return { success: true, ...res } as const;
    }),

  /**
   * Admin: non-destructive AI suggestion for a document's date and record status.
   * Runs classifyDocument + qcReview but does NOT write to the database.
   * Returns the suggestion for the admin to accept, edit, or dismiss in the Review Queue UI.
   */
  suggestDocumentMetadata: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Best available text: stored metadata first, then try fetching from storage
      let text = [doc.title, doc.description, doc.aiSummary].filter(Boolean).join("\n\n");
      let textSource: "storage" | "metadata" = "metadata";
      try {
        if (doc.fileKey && doc.mimeType) {
          const { storageGetSignedUrl } = await import("./storage");
          const signedUrl = await storageGetSignedUrl(doc.fileKey).catch(() => null);
          if (signedUrl) {
            const resp = await fetch(signedUrl).catch(() => null);
            if (resp && resp.ok) {
              const bytes = Buffer.from(await resp.arrayBuffer());
              const extracted = await extractText(bytes, doc.mimeType).catch(() => "");
              if (extracted && extracted.length > text.length) {
                text = extracted;
                textSource = "storage";
              }
            }
          }
        }
      } catch (e) {
        console.error("[suggestDocumentMetadata] storage fetch failed, using metadata:", e);
      }

      const classification = await classifyDocument({
        filename: doc.title,
        mimeType: doc.mimeType || "application/octet-stream",
        text,
      });
      const qc = qcReview(classification);

      const confidenceLabel = (n: number) =>
        n >= 80 ? ("high" as const) : n >= 50 ? ("medium" as const) : ("low" as const);

      return {
        documentId: input.documentId,
        // Date suggestion
        suggestedDate: qc.filingStampDate,
        dateSource: qc.dateSource,
        dateConfidence: qc.dateConfidence,
        dateConfidenceLabel: confidenceLabel(qc.dateConfidence),
        dateSourceQuote: qc.dateSourceQuote,
        // Record status suggestion
        suggestedRecordStatus: qc.recordStatus,
        recordStatusConfidence: qc.recordStatusConfidence,
        recordStatusConfidenceLabel: confidenceLabel(qc.recordStatusConfidence),
        recordStatusReason: qc.recordStatusReason,
        // Supplementary
        docketEntryNo: qc.docketEntryNo,
        caseNumber: qc.caseNumber,
        qcNotes: qc.qcNotes,
        textSource,
        // Advisory flag — admin still decides
        autoAcceptRecommended: !qc.needsDateReview && !qc.needsClassificationReview,
      } as const;
    }),
});
/* =============== Public API Keys (admin CRUD) ===============
   Keys are shown ONCE at creation. Only the sha256 hash + prefix are stored. */
const apiKeyRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db.listApiKeys();
    // Never return the hash to the client.
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      keyPrefix: r.keyPrefix,
      scope: r.scope,
      lastUsedAt: r.lastUsedAt,
      useCount: r.useCount,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
    }));
  }),

  create: adminProcedure
    .input(
      z.object({
        label: z.string().min(1).max(160),
        scope: z.enum(["read", "ingest"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prefix = input.scope === "ingest" ? "rr_ingest_" : "rr_live_";
      const rawKey = prefix + crypto.randomBytes(32).toString("hex");
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const keyPrefix = rawKey.slice(0, 16);
      const id = await db.createApiKey({
        label: input.label,
        keyHash,
        keyPrefix,
        scope: input.scope,
        createdBy: ctx.user.id,
      });
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "admin_role_changed",
        targetType: "api_key",
        targetId: id,
        metadata: { event: "api_key_created", label: input.label, scope: input.scope, keyPrefix },
      });
      // rawKey is returned exactly once and never persisted in plaintext.
      return { id, rawKey, keyPrefix, scope: input.scope, label: input.label };
    }),

  revoke: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.revokeApiKey(input.id);
      await writeAudit({
        actorUserId: ctx.user.id,
        actorRole: ctx.user.role,
        action: "admin_role_changed",
        targetType: "api_key",
        targetId: input.id,
        metadata: { event: "api_key_revoked" },
      });
      return { success: true } as const;
    }),
});

/* =============== Predicate router =============== */
const predicateRouter = router({
  generateReport: adminProcedure
    .input(z.object({ storyId: z.number() }))
    .mutation(async ({ input }) => {
      const findings = await analyzePredicates(input.storyId);
      // Determine next report version
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const [versionRow] = await drizzleDb
        .select({ maxVersion: sql<number>`COALESCE(MAX(${predicateFindings.reportVersion}), 0)` })
        .from(predicateFindings)
        .where(eq(predicateFindings.storyId, input.storyId));
      const nextVersion = (versionRow?.maxVersion ?? 0) + 1;
      await persistPredicateFindings(input.storyId, findings, nextVersion);
      const notLocated = findings.filter((f) => f.predicateStatus === "not_located").length;
      const partial = findings.filter((f) => f.predicateStatus === "partial").length;
      const contradicted = findings.filter((f) => f.predicateStatus === "contradicted").length;
      return {
        total: findings.length,
        notLocated,
        partial,
        contradicted,
        reportVersion: nextVersion,
      };
    }),

  getReport: publicProcedure
    .input(
      z.object({
        storyId: z.number(),
        statusFilter: z.enum(["located", "partial", "contradicted", "not_located", "off_record", "needs_review"]).optional(),
        severityFilter: z.enum(["liberty", "counsel", "procedural", "administrative"]).optional(),
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const conditions = [eq(predicateFindings.storyId, input.storyId)];
      if (input.statusFilter) conditions.push(eq(predicateFindings.predicateStatus, input.statusFilter));
      if (input.severityFilter) conditions.push(eq(predicateFindings.severityCategory, input.severityFilter));
      const rows = await drizzleDb
        .select()
        .from(predicateFindings)
        .where(and(...conditions))
        .orderBy(desc(predicateFindings.severityScore), asc(predicateFindings.eventDate))
        .limit(input.limit)
        .offset(input.offset);
      return rows;
    }),

  getReportStats: publicProcedure
    .input(z.object({ storyId: z.number() }))
    .query(async ({ input }) => {
      const drizzleDb = await db.getDb();
      if (!drizzleDb) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const rows = await drizzleDb
        .select()
        .from(predicateFindings)
        .where(eq(predicateFindings.storyId, input.storyId));
      if (rows.length === 0) return null;
      const byStatus: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.predicateStatus] = (byStatus[r.predicateStatus] ?? 0) + 1;
        bySeverity[r.severityCategory] = (bySeverity[r.severityCategory] ?? 0) + 1;
      }
      const generatedAt = rows.reduce((latest, r) => {
        return r.generatedAt > latest ? r.generatedAt : latest;
      }, rows[0].generatedAt);
      return {
        total: rows.length,
        byStatus,
        bySeverity,
        generatedAt,
        reportVersion: rows[0].reportVersion,
      };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  story: storyRouter,
  document: documentRouter,
  timeline: timelineRouter,
  actor: actorRouter,
  prr: prrRouter,
  patterns: patternRouter,
  docketGoblin: docketGoblinRouter,
  user: userRouter,
  audit: auditRouter,
  reviewRequest: reviewRequestRouter,
  userData: userDataRouter,
  adminEdit: adminEditRouter,
  agency: agencyRouter,
  violationTag: violationTagRouter,
  actorLink: actorLinkRouter,
  billing: billingRouter,
  judicialPattern: judicialPatternRouter,
  auditRequest: auditRequestRouter,
  leaderboard: leaderboardRouter,
  operator: operatorRouter,
  evidenceEngine: evidenceEngineRouter,
  apiKey: apiKeyRouter,
  search: searchRouter,
  predicate: predicateRouter,
});

export type AppRouter = typeof appRouter;
