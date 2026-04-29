import { COOKIE_NAME } from "@shared/const";
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
} from "./_goblin";
import {
  MAX_FILES_PER_SUBMISSION,
  checkRateLimit,
  decodeBase64Strict,
  hashIp,
  validateUpload,
  writeAudit,
} from "./_uploadGuard";

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
            `submissions/story-${storyId}/${att.filename}`,
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
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const rows = await db.listPublicDocuments({ q: input?.q, sourceType: input?.sourceType });
      return rows.map(withSameOriginDocumentUrl);
    }),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const d = await db.getDocumentById(input.id);
    if (!d) return null;
    if (!(d.publicStatus && d.reviewStatus === "approved")) return null;
    return withSameOriginDocumentUrl(d);
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
        `evidence/${v.filename}`,
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

      // Rate-limit Goblin ingest per user (30 / 24h).
      await checkRateLimit({
        userId: ctx.user.id,
        action: "document_ingested",
        windowMs: 24 * 60 * 60 * 1000,
        max: 30,
      });

      const fileSize = v.size;

      const jobId = await db.insertIngestJob({
        userId: ctx.user.id,
        storyId: input.storyId ?? null,
        filename: v.filename,
        mimeType: v.mime,
        fileSize,
        status: "pending",
      });

      try {
        const { key, url } = await storagePut(
          `evidence/ingest-${jobId}-${v.filename}`,
          v.buffer,
          v.mime,
        );

        const extracted = await extractText(v.buffer, v.mime);
        await db.updateIngestJob(jobId, {
          status: "extracted",
          extractedText: extracted.slice(0, 60000) || null,
        });

        // 3) Ask Docket Goblin to draft structured metadata (uses archive context for consistency)
        const archive = await db.getArchiveContextForLLM();
        const archiveStr = buildArchiveContextString(archive);
        const draft = await draftFromExtractedText({
          filename: input.filename,
          mimeType: input.mimeType,
          text: extracted,
          archiveSummary: archiveStr,
        });

        // 4) Resolve story if not provided: if archive has a featured (Church Record) story, default to that.
        let storyId = input.storyId ?? null;
        if (!storyId) {
          const featured = await db.getFeaturedStory();
          if (featured) storyId = featured.id;
        }

        // 5) Create a pending document (NEVER public, NEVER approved automatically,
        //    NEVER goblin-readable until admin opts in).
        const documentId = await db.insertDocument({
          title: draft.title || v.filename,
          description: draft.summary,
          fileKey: key,
          fileUrl: url,
          mimeType: v.mime,
          fileSize,
          sourceType: draft.sourceType,
          caseNumber: draft.caseNumber || null,
          documentDate: draft.documentDate ? new Date(draft.documentDate) : undefined,
          actorNames: draft.actorNames.join(", "),
          issueTags: draft.tags,
          storyId: storyId ?? undefined,
          publicStatus: false, // hard guarantee
          reviewStatus: "pending", // hard guarantee
          visibility: "pending_review",
          aiPolicy: "no_ai_processing",
          uploadedBy: ctx.user.id,
          aiSummary: draft.summary,
          aiTags: draft.tags,
        });

        await writeAudit({
          actorUserId: ctx.user.id,
          actorRole: ctx.user.role,
          action: "document_ingested",
          targetType: "document",
          targetId: documentId,
          metadata: { filename: v.filename, jobId, storyId },
        });

        // 6) Find existing actor matches (proposal only — admin still approves).
        const proposed = await db.findActorIdsByNames(draft.actorNames);

        await db.updateIngestJob(jobId, {
          status: "drafted",
          documentId,
          draftJson: draft as any,
          proposedActors: proposed.map((p) => p.name),
          storyId: storyId ?? null,
        });

        return { jobId, documentId, draft, proposedActors: proposed };
      } catch (e: any) {
        await db.updateIngestJob(jobId, {
          status: "failed",
          error: String(e?.message || e),
        });
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

/* =============== Document admin counts =============== */
// Mounted into documentRouter via patch below; declared early so it sees auditRouter scope

/* =============== Root =============== */
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
});

export type AppRouter = typeof appRouter;
