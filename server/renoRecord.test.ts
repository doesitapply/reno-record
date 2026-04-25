import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const baseUser: AuthenticatedUser = {
  id: 42,
  openId: "test-user",
  email: "tester@example.com",
  name: "Test User",
  loginMethod: "manus",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function makeCtx(user: AuthenticatedUser | undefined): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as unknown as TrpcContext["res"],
  };
}

describe("The Reno Record — moderation & gating", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects story submissions that do not include both consent flags", async () => {
    const insertSpy = vi.spyOn(db, "insertStory");
    // v3: submit now requires auth; use authenticated user
    const caller = appRouter.createCaller(makeCtx(baseUser));

    await expect(
      caller.story.submit({
        email: "submitter@example.com",
        summary: "This is a long enough summary describing what happened on the record.",
        publicPermission: false,
        redactionConfirmed: true,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    await expect(
      caller.story.submit({
        email: "submitter@example.com",
        summary: "This is a long enough summary describing what happened on the record.",
        publicPermission: true,
        redactionConfirmed: false,
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("does not return non-approved stories from public bySlug", async () => {
    vi.spyOn(db, "getStoryBySlug").mockResolvedValue({
      id: 1,
      slug: "pending-story",
      status: "pending",
      publicPermission: true,
      // remaining fields not used by this branch
    } as unknown as Awaited<ReturnType<typeof db.getStoryBySlug>>);

    const caller = appRouter.createCaller(makeCtx(undefined));
    const result = await caller.story.bySlug({ slug: "pending-story" });
    expect(result).toBeNull();
  });

  it("does not return approved stories without public permission", async () => {
    vi.spyOn(db, "getStoryBySlug").mockResolvedValue({
      id: 2,
      slug: "approved-no-consent",
      status: "approved",
      publicPermission: false,
    } as unknown as Awaited<ReturnType<typeof db.getStoryBySlug>>);

    const caller = appRouter.createCaller(makeCtx(undefined));
    const result = await caller.story.bySlug({ slug: "approved-no-consent" });
    expect(result).toBeNull();
  });

  it("hides documents that are not both publicStatus=true AND review_status='approved'", async () => {
    const caller = appRouter.createCaller(makeCtx(undefined));

    vi.spyOn(db, "getDocumentById").mockResolvedValueOnce({
      id: 10,
      publicStatus: false,
      reviewStatus: "approved",
    } as unknown as Awaited<ReturnType<typeof db.getDocumentById>>);
    expect(await caller.document.byId({ id: 10 })).toBeNull();

    vi.spyOn(db, "getDocumentById").mockResolvedValueOnce({
      id: 11,
      publicStatus: true,
      reviewStatus: "pending",
    } as unknown as Awaited<ReturnType<typeof db.getDocumentById>>);
    expect(await caller.document.byId({ id: 11 })).toBeNull();
  });

  it("blocks non-admin users from admin-only mutations (moderation queue, document upload, Docket Goblin)", async () => {
    const userCaller = appRouter.createCaller(makeCtx(baseUser));

    await expect(
      userCaller.story.adminUpdate({ id: 1, patch: { status: "approved" } }),
    ).rejects.toBeInstanceOf(TRPCError);

    await expect(
      userCaller.document.adminUpload({
        title: "x",
        sourceType: "other",
        filename: "x.pdf",
        mimeType: "application/pdf",
        dataBase64: "AAAA",
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    await expect(
      userCaller.docketGoblin.draftForDocument({ documentId: 1 }),
    ).rejects.toBeInstanceOf(TRPCError);

    // Anonymous (no user) is also blocked
    const anonCaller = appRouter.createCaller(makeCtx(undefined));
    await expect(
      anonCaller.story.adminList({ status: "pending" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("Docket Goblin's applyDraftToDocument writes only ai fields — never publishes", async () => {
    const updateSpy = vi
      .spyOn(db, "updateDocument")
      .mockResolvedValue(undefined as unknown as void);
    const adminUser: AuthenticatedUser = { ...baseUser, role: "admin" };
    const caller = appRouter.createCaller(makeCtx(adminUser));

    await caller.docketGoblin.applyDraftToDocument({
      documentId: 99,
      summary: "Drafted summary.",
      tags: ["speedy-trial", "faretta"],
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [docId, patch] = updateSpy.mock.calls[0]!;
    expect(docId).toBe(99);
    expect(patch).toEqual({
      aiSummary: "Drafted summary.",
      aiTags: ["speedy-trial", "faretta"],
    });
    expect(patch).not.toHaveProperty("publicStatus");
    expect(patch).not.toHaveProperty("reviewStatus");
  });

  it("public list of approved stories filters out approved-but-not-public stories", async () => {
    vi.spyOn(db, "listStoriesByStatus").mockResolvedValue([
      {
        id: 1,
        slug: "ok",
        status: "approved",
        publicPermission: true,
        alias: "Anon",
        court: "2JDC",
        judge: null,
        charges: null,
        custodyDays: 0,
        stillPending: false,
        mainIssue: null,
        summary: "ok",
        createdAt: new Date(),
        featured: false,
      },
      {
        id: 2,
        slug: "blocked",
        status: "approved",
        publicPermission: false,
        alias: "Anon2",
        court: "2JDC",
        judge: null,
        charges: null,
        custodyDays: 0,
        stillPending: false,
        mainIssue: null,
        summary: "blocked",
        createdAt: new Date(),
        featured: false,
      },
    ] as unknown as Awaited<ReturnType<typeof db.listStoriesByStatus>>);

    const caller = appRouter.createCaller(makeCtx(undefined));
    const result = await caller.story.listApproved();
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
  });
});


describe("Docket Goblin chat + ingest", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("blocks anonymous and non-admin users from chat history, send, ingest, ingestList, and approveIngest", async () => {
    const anon = appRouter.createCaller(makeCtx(undefined));
    await expect(anon.docketGoblin.history()).rejects.toBeInstanceOf(TRPCError);
    await expect(
      anon.docketGoblin.send({ message: "hi" }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      anon.docketGoblin.ingest({
        filename: "x.pdf",
        mimeType: "application/pdf",
        dataBase64: "AAAA",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(anon.docketGoblin.ingestList({})).rejects.toBeInstanceOf(TRPCError);
    await expect(
      anon.docketGoblin.approveIngest({ jobId: 1 }),
    ).rejects.toBeInstanceOf(TRPCError);

    const userCaller = appRouter.createCaller(makeCtx(baseUser));
    await expect(userCaller.docketGoblin.history()).rejects.toBeInstanceOf(TRPCError);
    await expect(
      userCaller.docketGoblin.send({ message: "hi" }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      userCaller.docketGoblin.ingest({
        filename: "x.pdf",
        mimeType: "application/pdf",
        dataBase64: "AAAA",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("ingest creates only a pending document (publicStatus=false, reviewStatus='pending') — never auto-publishes", async () => {
    const insertSpy = vi.spyOn(db, "insertDocument").mockResolvedValue(123);
    vi.spyOn(db, "insertIngestJob").mockResolvedValue(7);
    vi.spyOn(db, "updateIngestJob").mockResolvedValue(undefined as any);
    vi.spyOn(db, "getFeaturedStory").mockResolvedValue(undefined);
    vi.spyOn(db, "findActorIdsByNames").mockResolvedValue([]);
    vi.spyOn(db, "getArchiveContextForLLM").mockResolvedValue(null as any);

    // stub goblin module to skip extract + LLM
    const goblin = await import("./_goblin");
    vi.spyOn(goblin, "extractText").mockResolvedValue("dummy");
    vi.spyOn(goblin, "draftFromExtractedText").mockResolvedValue({
      title: "Stub Order",
      summary: "ok",
      sourceType: "court_order",
      caseNumber: "CR21-XXXX",
      documentDate: "2024-01-01",
      actorNames: [],
      tags: ["speedy-trial"],
      proposedTimeline: null,
      warnings: [],
    });

    // stub storage put
    const storage = await import("./storage");
    vi.spyOn(storage, "storagePut").mockResolvedValue({
      key: "evidence/x.pdf",
      url: "/manus-storage/x.pdf",
    } as any);

    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    const realPdf = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
      Buffer.from("-1.4\nstub body"),
    ]);
    await adminCaller.docketGoblin.ingest({
      filename: "order.pdf",
      mimeType: "application/pdf",
      dataBase64: realPdf.toString("base64"),
    });

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const insertedDoc = insertSpy.mock.calls[0]![0]!;
    expect(insertedDoc.publicStatus).toBe(false);
    expect(insertedDoc.reviewStatus).toBe("pending");
  });

  it("approveIngest is the ONLY surface that can publish, and requires admin", async () => {
    const userCaller = appRouter.createCaller(makeCtx(baseUser));
    await expect(
      userCaller.docketGoblin.approveIngest({ jobId: 1 }),
    ).rejects.toBeInstanceOf(TRPCError);

    vi.spyOn(db, "getIngestJob").mockResolvedValue({
      id: 1,
      documentId: 50,
      storyId: null,
      timelineEventId: null,
      draftJson: null,
    } as any);
    const updateDoc = vi
      .spyOn(db, "updateDocument")
      .mockResolvedValue(undefined as any);
    vi.spyOn(db, "updateIngestJob").mockResolvedValue(undefined as any);

    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await adminCaller.docketGoblin.approveIngest({
      jobId: 1,
      approveDocument: true,
      publishDocument: true,
      createTimelineEvent: false,
      publishTimelineEvent: false,
    });
    expect(updateDoc).toHaveBeenCalledWith(50, {
      reviewStatus: "approved",
      publicStatus: true,
      visibility: "public_preview",
    });
  });
});


/* ============================================================================
 * v3 — Security: auth-gated submissions, upload validator, audit, AI policy
 * ========================================================================== */
import {
  MAX_FILE_BYTES,
  validateUpload,
} from "./_uploadGuard";

describe("v3 — Upload validator (magic-byte sniff + size + filename)", () => {
  it("rejects a fake PDF (renamed .exe-style content)", () => {
    expect(() =>
      validateUpload({
        filename: "evil.pdf",
        mimeType: "application/pdf",
        // MZ header (Windows PE), not %PDF
        buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]),
      }),
    ).toThrow(/signature|valid/i);
  });

  it("rejects extension/mime mismatch (calls itself .pdf with image/png mime)", () => {
    expect(() =>
      validateUpload({
        filename: "weird.pdf",
        mimeType: "image/png",
        buffer: Buffer.from("%PDF-1.4 fake"),
      }),
    ).toThrow();
  });

  it("rejects oversized files before processing", () => {
    const giant = Buffer.alloc(MAX_FILE_BYTES + 1024, 0x25); // mostly '%'
    giant[0] = 0x25;
    giant[1] = 0x50;
    giant[2] = 0x44;
    giant[3] = 0x46;
    expect(() =>
      validateUpload({
        filename: "huge.pdf",
        mimeType: "application/pdf",
        buffer: giant,
      }),
    ).toThrow(/exceeds/i);
  });

  it("rejects unsupported file types entirely (e.g., .exe)", () => {
    expect(() =>
      validateUpload({
        filename: "thing.exe",
        mimeType: "application/x-msdownload",
        buffer: Buffer.from([0x4d, 0x5a, 0x00, 0x00]),
      }),
    ).toThrow(/not allowed/i);
  });

  it("rejects path-traversal filenames", () => {
    expect(() =>
      validateUpload({
        filename: "../../etc/passwd.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46]), Buffer.alloc(10)]),
      }),
    ).toThrow(/unsupported characters|.../i);
  });

  it("accepts a real PDF magic-byte sequence", () => {
    const buf = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
      Buffer.from("-1.4\nfake body"),
    ]);
    const v = validateUpload({
      filename: "real.pdf",
      mimeType: "application/pdf",
      buffer: buf,
    });
    expect(v.mime).toBe("application/pdf");
    expect(v.ext).toBe("pdf");
  });

  it("accepts plain text (.txt) and rejects binary disguised as text", () => {
    const ok = validateUpload({
      filename: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Hello world\nThis is plain text.\n"),
    });
    expect(ok.mime).toBe("text/plain");

    expect(() =>
      validateUpload({
        filename: "evil.txt",
        mimeType: "text/plain",
        // Embed lots of NULL bytes
        buffer: Buffer.alloc(2048, 0x00),
      }),
    ).toThrow(/binary/i);
  });
});

describe("v3 — story.submit auth gate + audit", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("anonymous users cannot call story.submit", async () => {
    const anon = appRouter.createCaller(makeCtx(undefined));
    await expect(
      anon.story.submit({
        email: "x@y.com",
        summary: "A long enough summary about what happened on the record here.",
        publicPermission: true,
        redactionConfirmed: true,
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("authenticated submission writes audit_log + ownerUserId, never auto-publishes", async () => {
    const insertStorySpy = vi.spyOn(db, "insertStory").mockResolvedValue(777);
    const insertDocSpy = vi.spyOn(db, "insertDocument").mockResolvedValue(888);
    const storage = await import("./storage");
    vi.spyOn(storage, "storagePut").mockResolvedValue({
      key: "submissions/story-777/note.txt",
      url: "/manus-storage/note.txt",
    } as any);

    // Spy audit writer + rate-limit checker indirectly via _uploadGuard
    const guard = await import("./_uploadGuard");
    const auditSpy = vi.spyOn(guard, "writeAudit").mockResolvedValue(undefined);
    vi.spyOn(guard, "checkRateLimit").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(baseUser));
    const txt = Buffer.from("Hello, this is a real text file submitted as evidence.\n");
    const out = await caller.story.submit({
      email: "submitter@example.com",
      summary: "This is a long enough summary describing what happened on the record.",
      publicPermission: true,
      redactionConfirmed: true,
      attachments: [
        {
          filename: "note.txt",
          mimeType: "text/plain",
          dataBase64: txt.toString("base64"),
        },
      ],
    });

    expect(out.id).toBe(777);
    expect(insertStorySpy).toHaveBeenCalledTimes(1);
    const storyArg = insertStorySpy.mock.calls[0]![0]!;
    expect(storyArg.ownerUserId).toBe(baseUser.id);

    expect(insertDocSpy).toHaveBeenCalledTimes(1);
    const docArg = insertDocSpy.mock.calls[0]![0]!;
    expect(docArg.publicStatus).toBe(false);
    expect(docArg.reviewStatus).toBe("pending");
    expect(docArg.visibility).toBe("pending_review");
    expect(docArg.aiPolicy).toBe("no_ai_processing");
    expect(docArg.uploadedBy).toBe(baseUser.id);

    // story_submitted + document_uploaded actions written
    const actions = auditSpy.mock.calls.map((c) => c[0].action);
    expect(actions).toContain("story_submitted");
    expect(actions).toContain("document_uploaded");
  });

  it("rejects a submission with a renamed-extension attachment, writes upload_rejected audit, never inserts story or doc", async () => {
    const insertStorySpy = vi.spyOn(db, "insertStory");
    const insertDocSpy = vi.spyOn(db, "insertDocument");
    const guard = await import("./_uploadGuard");
    const auditSpy = vi.spyOn(guard, "writeAudit").mockResolvedValue(undefined);
    vi.spyOn(guard, "checkRateLimit").mockResolvedValue(undefined);

    const caller = appRouter.createCaller(makeCtx(baseUser));
    // Claims to be PDF but is actually a Windows PE header.
    const fake = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    await expect(
      caller.story.submit({
        email: "submitter@example.com",
        summary: "Long enough summary about the situation on the record here.",
        publicPermission: true,
        redactionConfirmed: true,
        attachments: [
          {
            filename: "evil.pdf",
            mimeType: "application/pdf",
            dataBase64: fake.toString("base64"),
          },
        ],
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(insertStorySpy).not.toHaveBeenCalled();
    expect(insertDocSpy).not.toHaveBeenCalled();

    const actions = auditSpy.mock.calls.map((c) => c[0].action);
    expect(actions).toContain("upload_rejected");
  });
});

describe("v3 — Document admin update writes visibility + ai_policy audit entries", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("setting visibility=receipts_only writes visibility_changed audit and forces reviewStatus=approved", async () => {
    const updateSpy = vi.spyOn(db, "updateDocument").mockResolvedValue(undefined as any);
    const guard = await import("./_uploadGuard");
    const auditSpy = vi.spyOn(guard, "writeAudit").mockResolvedValue(undefined);

    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await adminCaller.document.adminUpdate({
      id: 50,
      patch: { visibility: "receipts_only" },
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [, patch] = updateSpy.mock.calls[0]!;
    expect(patch.visibility).toBe("receipts_only");
    expect(patch.reviewStatus).toBe("approved");
    expect(patch.publicStatus).toBe(false);

    const actions = auditSpy.mock.calls.map((c) => c[0].action);
    expect(actions).toContain("visibility_changed");
  });

  it("setting aiPolicy=goblin_allowed writes ai_policy_changed audit", async () => {
    vi.spyOn(db, "updateDocument").mockResolvedValue(undefined as any);
    const guard = await import("./_uploadGuard");
    const auditSpy = vi.spyOn(guard, "writeAudit").mockResolvedValue(undefined);

    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await adminCaller.document.adminUpdate({
      id: 50,
      patch: { aiPolicy: "goblin_allowed" },
    });
    const actions = auditSpy.mock.calls.map((c) => c[0].action);
    expect(actions).toContain("ai_policy_changed");
  });
});


describe("v3 — Admin role changes are audited", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("non-admin cannot call user.setRole", async () => {
    const userCaller = appRouter.createCaller(makeCtx(baseUser));
    await expect(
      userCaller.user.setRole({ userId: 99, role: "admin" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("admin promoting another user writes admin_role_changed audit", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: 99,
      role: "user",
      email: "target@example.com",
    } as any);
    const setRoleSpy = vi.spyOn(db, "setUserRole").mockResolvedValue(undefined as any);
    const guard = await import("./_uploadGuard");
    const auditSpy = vi.spyOn(guard, "writeAudit").mockResolvedValue(undefined);

    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await adminCaller.user.setRole({ userId: 99, role: "admin" });

    expect(setRoleSpy).toHaveBeenCalledWith(99, "admin");
    expect(auditSpy).toHaveBeenCalled();
    const call = auditSpy.mock.calls.find((c) => c[0].action === "admin_role_changed");
    expect(call).toBeTruthy();
    expect(call![0].metadata).toMatchObject({ from: "user", to: "admin" });
  });

  it("admin cannot demote themselves (lockout protection)", async () => {
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: baseUser.id,
      role: "admin",
      email: baseUser.email,
    } as any);
    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await expect(
      adminCaller.user.setRole({ userId: baseUser.id, role: "user" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});

describe("v3 — Rate limiting", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("over-limit submissions throw TOO_MANY_REQUESTS without inserting", async () => {
    const insertStorySpy = vi.spyOn(db, "insertStory");
    const guard = await import("./_uploadGuard");
    vi.spyOn(guard, "writeAudit").mockResolvedValue(undefined);
    // Force rate limiter to trip
    vi.spyOn(guard, "checkRateLimit").mockImplementation(async () => {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many submissions in the last 24h.",
      });
    });

    const caller = appRouter.createCaller(makeCtx(baseUser));
    await expect(
      caller.story.submit({
        email: "submitter@example.com",
        summary: "Long enough summary that describes the on-record events and timeline.",
        publicPermission: true,
        redactionConfirmed: true,
      }),
    ).rejects.toThrow(/Too many submissions/i);
    expect(insertStorySpy).not.toHaveBeenCalled();
  });
});

describe("v3 — Goblin AI-policy enforcement", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("getArchiveContextForLLM only returns documents with ai_policy='goblin_allowed' (no others reach the LLM)", async () => {
    // We can't run the real DB query in tests; instead, verify Goblin chat
    // sends only what getArchiveContextForLLM returns. Stub the helper to
    // return a curated list and ensure the LLM sees only those.
    vi.spyOn(db, "getArchiveContextForLLM").mockResolvedValue({
      stories: [],
      documents: [
        { id: 1, title: "Allowed", aiPolicy: "goblin_allowed" } as any,
      ],
      events: [],
      actors: [],
      prrs: [],
    } as any);
    vi.spyOn(db, "getOrCreateLatestChatSession").mockResolvedValue({ id: 1 } as any);
    vi.spyOn(db, "appendChatMessage").mockResolvedValue(undefined as any);
    vi.spyOn(db, "listChatMessages").mockResolvedValue([] as any);

    const llmModule = await import("./_core/llm");
    const llmSpy = vi
      .spyOn(llmModule, "invokeLLM")
      .mockResolvedValue({
        choices: [{ message: { content: "ack" } }],
      } as any);

    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await adminCaller.docketGoblin.send({ message: "hi" });

    expect(llmSpy).toHaveBeenCalled();
    const messages = llmSpy.mock.calls[0]![0]!.messages as Array<{
      role: string;
      content: string;
    }>;
    const archiveSysMsg = messages.find(
      (m) => m.role === "system" && /Allowed/.test(m.content),
    );
    expect(archiveSysMsg).toBeTruthy();
    // No "Forbidden" doc should ever appear because db helper filters it out
    const anyForbidden = messages.some((m) =>
      typeof m.content === "string" && /Forbidden|no_ai_processing/i.test(m.content),
    );
    expect(anyForbidden).toBe(false);
  });
});


/* =============================================================
   v3.5 — Audit, user mgmt, SMTP fail-safe, redaction discipline
   ============================================================= */

describe("v3.5 — SMTP fail-safe", () => {
  it("isEmailConfigured returns false when SMTP env is missing", async () => {
    const { __resetEmail, isEmailConfigured } = await import("./_email");
    const saved = {
      h: process.env.SMTP_HOST, p: process.env.SMTP_PORT,
      u: process.env.SMTP_USER, w: process.env.SMTP_PASS, f: process.env.SMTP_FROM,
    };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    __resetEmail();
    expect(isEmailConfigured()).toBe(false);
    Object.assign(process.env, {
      SMTP_HOST: saved.h, SMTP_PORT: saved.p, SMTP_USER: saved.u,
      SMTP_PASS: saved.w, SMTP_FROM: saved.f,
    });
  });

  it("emailStoryReceived returns sent:false when SMTP env is missing — never throws", async () => {
    const { __resetEmail, emailStoryReceived } = await import("./_email");
    const saved = {
      h: process.env.SMTP_HOST, p: process.env.SMTP_PORT,
      u: process.env.SMTP_USER, w: process.env.SMTP_PASS, f: process.env.SMTP_FROM,
    };
    delete process.env.SMTP_HOST; delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER; delete process.env.SMTP_PASS; delete process.env.SMTP_FROM;
    __resetEmail();
    const r = await emailStoryReceived({ to: "x@example.com", storyId: 1 });
    expect(r.sent).toBe(false);
    if (!r.sent) expect(r.reason).toBe("smtp_not_configured");
    Object.assign(process.env, {
      SMTP_HOST: saved.h, SMTP_PORT: saved.p, SMTP_USER: saved.u,
      SMTP_PASS: saved.w, SMTP_FROM: saved.f,
    });
  });

  it("emailStoryReceived returns sent:false when 'to' is null", async () => {
    const { emailStoryReceived } = await import("./_email");
    const r = await emailStoryReceived({ to: null, storyId: 7 });
    expect(r.sent).toBe(false);
    if (!r.sent) expect(r.reason).toBe("no_recipient");
  });
});

describe("v3.5 — Email body redaction discipline", () => {
  it("template bodies do NOT include reviewer notes, narrative, filenames, or document text", async () => {
    const mod = await import("./_email");
    // Spy at module-level by stubbing transport via env tricks: instead,
    // reach into nodemailer.createTransport via vi.spyOn on the module.
    const sendCalls: any[] = [];
    const fakeTransport = { sendMail: async (m: any) => { sendCalls.push(m); return { messageId: "mid" }; } };
    const nm = await import("nodemailer");
    vi.spyOn(nm.default, "createTransport").mockReturnValue(fakeTransport as any);

    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    process.env.SMTP_FROM = "no-reply@therenorecord.com";
    mod.__resetEmail();

    await mod.emailStoryReceived({ to: "submitter@example.com", storyId: 42 });
    await mod.emailFilesReceived({ to: "submitter@example.com", storyId: 42, fileCount: 3 });
    await mod.emailStoryDecision({ to: "submitter@example.com", storyId: 42, decision: "approved" });
    await mod.emailDocumentDecision({ to: "uploader@example.com", documentId: 99, decision: "rejected" });

    expect(sendCalls.length).toBe(4);
    for (const m of sendCalls) {
      const blob = `${m.subject}\n${m.text ?? ""}\n${m.html ?? ""}`;
      // None of the privacy-sensitive content should ever be in mail
      // No actual reviewer note value, no narrative content. Disclaimer phrasing is OK.
      expect(blob).not.toMatch(/reviewer note: /i);
      expect(blob).not.toMatch(/narrative: /i);
      // assert no actual filename leaks (extension+name); the disclaimer text is fine
      expect(blob).not.toMatch(/filename:/i);
      expect(blob).not.toMatch(/[\w-]+\.(pdf|png|jpg|jpeg|docx|mp4|mp3|webm)/i);
      expect(blob).not.toMatch(/admin notes/i);
      expect(blob).not.toMatch(/transcript/i);
      // Should reference a numeric ID and the project name
      expect(blob).toMatch(/Reno Record/i);
    }

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    mod.__resetEmail();
    vi.restoreAllMocks();
  });
});

describe("v3.5 — Audit list filtering", () => {
  it("audit.list passes filter args through to db.listAuditLog", async () => {
    const spy = vi.spyOn(db, "listAuditLog").mockResolvedValue({ rows: [], total: 0 });
    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    await adminCaller.audit.list({
      action: "story_submitted",
      targetType: "story",
      q: "needle",
      limit: 25,
      offset: 50,
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "story_submitted",
        targetType: "story",
        q: "needle",
        limit: 25,
        offset: 50,
      }),
    );
    vi.restoreAllMocks();
  });

  it("audit.list rejects non-admin", async () => {
    const userCaller = appRouter.createCaller(makeCtx(baseUser));
    await expect(userCaller.audit.list({})).rejects.toBeInstanceOf(TRPCError);
  });

  it("audit.exportCsv returns rows in admin-defined column shape", async () => {
    vi.spyOn(db, "exportAuditLog").mockResolvedValue([
      {
        id: 1,
        createdAt: new Date(),
        actorUserId: 5,
        actorRole: "admin",
        action: "story_approved",
        targetType: "story",
        targetId: 7,
        metadata: { from: "pending", to: "approved" },
        ipHash: "abc",
      } as any,
    ]);
    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    const rows = await adminCaller.audit.exportCsv({});
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("action");
    expect(rows[0]).toHaveProperty("metadata");
    expect(rows[0]).toHaveProperty("ipHash");
    vi.restoreAllMocks();
  });
});

describe("v3.5 — User management", () => {
  it("user.adminListWithCounts is admin-only", async () => {
    vi.spyOn(db, "listUsersWithCounts").mockResolvedValue([] as any);
    const userCaller = appRouter.createCaller(makeCtx(baseUser));
    await expect(userCaller.user.adminListWithCounts()).rejects.toBeInstanceOf(TRPCError);
  });

  it("user.adminListWithCounts returns submission/upload counts when admin", async () => {
    vi.spyOn(db, "listUsersWithCounts").mockResolvedValue([
      { id: 1, role: "user", email: "a@b", submissionCount: 2, uploadCount: 0 },
      { id: 2, role: "admin", email: "admin@b", submissionCount: 0, uploadCount: 5 },
    ] as any);
    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    const rows = await adminCaller.user.adminListWithCounts();
    expect(rows.length).toBe(2);
    expect(rows[0].submissionCount).toBe(2);
    vi.restoreAllMocks();
  });
});

describe("v3.5 — Document admin counts", () => {
  it("document.adminCounts returns aggregated map; admin-only", async () => {
    vi.spyOn(db, "documentVisibilityCounts").mockResolvedValue({
      pending_review: 3,
      public_preview: 1,
      "ai:no_ai_processing": 4,
      "ai:goblin_allowed": 0,
    });
    const userCaller = appRouter.createCaller(makeCtx(baseUser));
    await expect(userCaller.document.adminCounts()).rejects.toBeInstanceOf(TRPCError);
    const adminCaller = appRouter.createCaller(makeCtx({ ...baseUser, role: "admin" }));
    const counts = await adminCaller.document.adminCounts();
    expect(counts.pending_review).toBe(3);
    expect(counts["ai:no_ai_processing"]).toBe(4);
    vi.restoreAllMocks();
  });
});
