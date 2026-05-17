/**
 * /api/file-proxy/* — server-side streaming proxy for evidence files.
 *
 * Unlike /manus-storage/ (which issues a 307 redirect to CloudFront on the
 * deployed platform), this endpoint always fetches the S3 object server-side
 * and streams the bytes back to the browser with the correct Content-Type.
 *
 * This is required for inline embedding (iframe / object / audio / video)
 * because browsers refuse to embed cross-origin 307-redirected CloudFront
 * signed URLs — they return AccessDenied XML instead.
 *
 * Usage:  GET /api/file-proxy/<storage-key>
 * e.g.:   /api/file-proxy/evidence/doc_abc123.pdf
 */
import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { ENV } from "./_core/env";

const PASS_HEADERS = [
  "content-type",
  "content-length",
  "etag",
  "last-modified",
  "accept-ranges",
] as const;

function fallbackMime(key: string) {
  const k = key.toLowerCase().split("?")[0];
  if (k.endsWith(".pdf")) return "application/pdf";
  if (k.endsWith(".png")) return "image/png";
  if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
  if (k.endsWith(".webp")) return "image/webp";
  if (k.endsWith(".gif")) return "image/gif";
  if (k.endsWith(".mp3")) return "audio/mpeg";
  if (k.endsWith(".wav")) return "audio/wav";
  if (k.endsWith(".ogg")) return "audio/ogg";
  if (k.endsWith(".mp4")) return "video/mp4";
  if (k.endsWith(".webm")) return "video/webm";
  if (k.endsWith(".mov")) return "video/quicktime";
  if (k.endsWith(".txt") || k.endsWith(".md")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function safeFilename(key: string) {
  return (key.split("/").pop() || "evidence").replace(/[\r\n"]/g, "_");
}

async function getPresignedGetUrl(key: string): Promise<string> {
  const base = (ENV.forgeApiUrl || "").replace(/\/+$/, "");
  const url = new URL(`${base}/v1/storage/presign/get`);
  url.searchParams.set("path", key);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`presign failed: ${resp.status} ${body}`);
  }
  const { url: signedUrl } = (await resp.json()) as { url?: string };
  if (!signedUrl) throw new Error("presign returned empty URL");
  return signedUrl;
}

async function handleFileProxy(req: Request, res: Response) {
  // Decode the key from the wildcard segment
  const rawKey = ((req.params as Record<string, string>)[0] || "")
    .split("/")
    .map((seg) => decodeURIComponent(seg))
    .join("/")
    .replace(/^\/+/, "");

  if (!rawKey || rawKey.includes("..") || rawKey.includes("\\")) {
    res.status(400).send("Invalid key");
    return;
  }

  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    res.status(500).send("Storage proxy not configured");
    return;
  }

  try {
    const signedUrl = await getPresignedGetUrl(rawKey);

    // Fetch from S3 server-side — never redirect the browser
    const upstream = await fetch(signedUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
    });

    if (!upstream.ok) {
      console.error(`[FileProxy] upstream ${upstream.status} for key: ${rawKey}`);
      res.status(upstream.status === 404 ? 404 : 502).send(
        upstream.status === 404 ? "File not found" : "Storage error",
      );
      return;
    }

    // Pass through safe headers
    for (const h of PASS_HEADERS) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    // Ensure content-type is set
    if (!res.getHeader("content-type")) {
      res.setHeader("content-type", fallbackMime(rawKey));
    }

    // Inline display with caching
    res.setHeader("cache-control", "private, max-age=300");
    res.setHeader("content-disposition", `inline; filename="${safeFilename(rawKey)}"`);
    res.setHeader("x-content-type-options", "nosniff");

    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }

    if (!upstream.body) {
      res.status(502).send("Empty response from storage");
      return;
    }

    res.status(200);
    Readable.fromWeb(upstream.body as any).pipe(res);
  } catch (err) {
    console.error("[FileProxy] error:", err);
    res.status(502).send("File proxy error");
  }
}

export function registerFileProxy(app: Express) {
  app.head("/api/file-proxy/*", handleFileProxy);
  app.get("/api/file-proxy/*", handleFileProxy);
}
