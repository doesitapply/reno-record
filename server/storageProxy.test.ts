import express from "express";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

function request(port: number, method: "GET" | "HEAD", path: string) {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ port, method, path, host: "127.0.0.1" }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}

async function withStorageProxyServer() {
  vi.resetModules();
  process.env.BUILT_IN_FORGE_API_URL = "https://forge.example.test";
  process.env.BUILT_IN_FORGE_API_KEY = "test-forge-key";

  const { registerStorageProxy } = await import("./_core/storageProxy");
  const app = express();
  registerStorageProxy(app);
  app.use("*", (_req, res) => res.status(200).type("html").send("<html>SPA fallback</html>"));

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server port");
  return { server, port: address.port };
}

describe("storage proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BUILT_IN_FORGE_API_URL;
    delete process.env.BUILT_IN_FORGE_API_KEY;
  });

  it("streams evidence files through the app domain with inline headers", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://signed.example.test/file.pdf" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response("%PDF-test", {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": "9",
            etag: "test-etag",
          },
        }),
      );

    const { server, port } = await withStorageProxyServer();
    try {
      const res = await request(port, "GET", "/manus-storage/evidence/test-file.pdf");

      expect(res.status).toBe(200);
      expect(res.body).toBe("%PDF-test");
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toBe('inline; filename="test-file.pdf"');
      expect(res.headers["cache-control"]).toContain("private");
      expect(fetchSpy).toHaveBeenLastCalledWith("https://signed.example.test/file.pdf", { method: "GET" });
    } finally {
      server.close();
    }
  });

  it("handles HEAD probes for inline viewers instead of returning SPA HTML", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://signed.example.test/file.pdf" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": "1234",
          },
        }),
      );

    const { server, port } = await withStorageProxyServer();
    try {
      const res = await request(port, "HEAD", "/manus-storage/evidence/test-file.pdf");

      expect(res.status).toBe(200);
      expect(res.body).toBe("");
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toBe('inline; filename="test-file.pdf"');
      expect(fetchSpy).toHaveBeenLastCalledWith("https://signed.example.test/file.pdf", { method: "HEAD" });
    } finally {
      server.close();
    }
  });
});
