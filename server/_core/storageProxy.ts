import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { ENV } from "./env";

const PASS_THROUGH_HEADERS = [
  "content-type",
  "content-length",
  "etag",
  "last-modified",
  "accept-ranges",
] as const;

function normalizeStorageKey(rawKey: string) {
  const key = rawKey.replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\")) return null;
  return key;
}

function fallbackContentType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function inlineFilename(key: string) {
  const filename = key.split("/").pop() || "evidence";
  return filename.replace(/[\r\n"]/g, "_");
}

async function getSignedStorageUrl(key: string) {
  const forgeUrl = new URL(
    "v1/storage/presign/get",
    ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
  );
  forgeUrl.searchParams.set("path", key);

  const forgeResp = await fetch(forgeUrl, {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });

  if (!forgeResp.ok) {
    const body = await forgeResp.text().catch(() => "");
    throw new Error(`forge presign failed: ${forgeResp.status} ${body}`);
  }

  const { url } = (await forgeResp.json()) as { url?: string };
  if (!url) throw new Error("forge presign returned an empty URL");
  return url;
}

async function proxyStorageObject(req: Request, res: Response) {
  const key = normalizeStorageKey((req.params as Record<string, string>)[0] || "");
  if (!key) {
    res.status(400).send("Invalid storage key");
    return;
  }

  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }

  try {
    const signedUrl = await getSignedStorageUrl(key);
    const upstream = await fetch(signedUrl, { method: req.method === "HEAD" ? "HEAD" : "GET" });

    if (!upstream.ok) {
      console.error(`[StorageProxy] upstream error for ${key}: ${upstream.status}`);
      res.status(upstream.status === 404 ? 404 : 502).send(
        upstream.status === 404 ? "Evidence file not found" : "Storage backend error",
      );
      return;
    }

    for (const header of PASS_THROUGH_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (!res.getHeader("content-type")) {
      res.setHeader("content-type", fallbackContentType(key));
    }

    res.setHeader("cache-control", "private, max-age=300");
    res.setHeader("content-disposition", `inline; filename="${inlineFilename(key)}"`);
    res.setHeader("x-content-type-options", "nosniff");

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    if (!upstream.body) {
      res.status(502).send("Empty storage response");
      return;
    }

    res.status(200);
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (err) {
    console.error("[StorageProxy] failed:", err);
    res.status(502).send("Storage proxy error");
  }
}

export function registerStorageProxy(app: Express) {
  app.head("/manus-storage/*", proxyStorageObject);
  app.get("/manus-storage/*", proxyStorageObject);
}
