import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";

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
  /** Public submission */
  submit: publicProcedure
    .input(
      z.object({
        submitterName: z.string().max(200).optional(),
        alias: z.string().max(120).optional(),
        email: z.string().email().max(320),
        phone: z.string().max(60).optional(),
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
          .max(15)
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!input.publicPermission || !input.redactionConfirmed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Both confirmation checkboxes must be agreed to.",
        });
      }
      const { attachments, ...payload } = input;
      const storyId = await db.insertStory({
        ...payload,
        dateCaseStarted: payload.dateCaseStarted ?? undefined,
      });

      // Upload attachments and create pending documents
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          try {
            const buffer = Buffer.from(att.dataBase64, "base64");
            const safeName = att.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
            const { key, url } = await storagePut(
              `submissions/story-${storyId}/${safeName}`,
              buffer,
              att.mimeType || "application/octet-stream",
            );
            await db.insertDocument({
              title: att.filename,
              fileKey: key,
              fileUrl: url,
              mimeType: att.mimeType,
              fileSize: buffer.length,
              sourceType: "other",
              storyId,
              publicStatus: false,
              reviewStatus: "pending",
              redactionStatus: "unverified",
            });
          } catch (e) {
            console.error("[story.submit] attachment failed", e);
          }
        }
      }

      // Best-effort owner notification
      try {
        await notifyOwner({
          title: "New Reno Record submission",
          content: `A new story has been submitted (id ${storyId}). Review in /admin/queue.`,
        });
      } catch (e) {
        // ignore
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
    .mutation(async ({ input }) => {
      const patch: any = { ...input.patch };
      // If approving and no slug, generate one
      if (patch.status === "approved" && !patch.slug) {
        const story = await db.getStoryById(input.id);
        const base = slugify(story?.mainIssue || story?.alias || `story-${input.id}`);
        patch.slug = `${base}-${input.id}`;
      }
      await db.updateStory(input.id, patch);
      return { ok: true };
    }),
});

/* =============== Documents router =============== */
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
    .query(async ({ input }) =>
      db.listPublicDocuments({ q: input?.q, sourceType: input?.sourceType }),
    ),
  byId: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const d = await db.getDocumentById(input.id);
    if (!d) return null;
    if (!(d.publicStatus && d.reviewStatus === "approved")) return null;
    return d;
  }),

  /* Admin */
  adminList: adminProcedure.query(async () => db.listAllDocuments()),
  adminGet: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) =>
    db.getDocumentById(input.id),
  ),
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
      const buffer = Buffer.from(input.dataBase64, "base64");
      const safeName = input.filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const { key, url } = await storagePut(
        `evidence/${safeName}`,
        buffer,
        input.mimeType || "application/octet-stream",
      );
      const id = await db.insertDocument({
        title: input.title,
        description: input.description,
        fileKey: key,
        fileUrl: url,
        mimeType: input.mimeType,
        fileSize: buffer.length,
        sourceType: input.sourceType,
        caseNumber: input.caseNumber,
        documentDate: input.documentDate ?? undefined,
        actorNames: input.actorNames,
        issueTags: input.issueTags,
        storyId: input.storyId,
        publicStatus: false,
        reviewStatus: "pending",
        uploadedBy: ctx.user.id,
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
          aiSummary: z.string().optional(),
          aiTags: z.array(z.string()).optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const patch: any = { ...input.patch };
      if (patch.documentDate === null) delete patch.documentDate;
      await db.updateDocument(input.id, patch);
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
  adminList: adminProcedure.query(async () => db.listPublicActors()),
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
});

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
});

export type AppRouter = typeof appRouter;
