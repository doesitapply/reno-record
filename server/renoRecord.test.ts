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
    const caller = appRouter.createCaller(makeCtx(undefined));

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
