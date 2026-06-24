import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function publicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function adminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("operator router — public reads", () => {
  it("returns the operator profile with brand and name", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const profile = await caller.operator.profile();
    expect(profile).toBeTruthy();
    expect(profile?.brand).toBeTypeOf("string");
    expect(profile?.fullName).toBeTypeOf("string");
  });

  it("returns a build log array", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const log = await caller.operator.buildLog();
    expect(Array.isArray(log)).toBe(true);
  });

  it("returns only public projects and includes a flagship", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const projects = await caller.operator.projects();
    expect(Array.isArray(projects)).toBe(true);
    // every returned project must be public
    for (const p of projects) {
      expect(p.publicStatus).toBe(true);
    }
    // at least one flagship expected from seed
    expect(projects.some((p) => p.featured)).toBe(true);
  });

  it("returns null for a non-existent project slug", async () => {
    const caller = appRouter.createCaller(publicCtx());
    const result = await caller.operator.projectBySlug({ slug: "does-not-exist-xyz" });
    expect(result).toBeNull();
  });
});

describe("operator router — admin gating", () => {
  it("blocks anonymous users from admin project list", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(caller.operator.adminProjects()).rejects.toThrow();
  });

  it("blocks anonymous users from updating the profile", async () => {
    const caller = appRouter.createCaller(publicCtx());
    await expect(
      caller.operator.updateProfile({ tagline: "hijack attempt" }),
    ).rejects.toThrow();
  });

  it("allows an admin to read the admin project list", async () => {
    const caller = appRouter.createCaller(adminCtx());
    const projects = await caller.operator.adminProjects();
    expect(Array.isArray(projects)).toBe(true);
  });
});
