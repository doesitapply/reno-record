import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq, gt, sql } from "drizzle-orm";
import { getDb } from "./db";
import { auditLog, type InsertAuditLog } from "../drizzle/schema";

/**
 * v3 Upload Guard — server-side defenses for any file accepted from clients.
 *
 * Rules enforced:
 *  - Hard size cap: 15 MB per file
 *  - MIME allow-list (extension + claimed mime + magic-byte sniff must agree)
 *  - Reject filenames with shell/path tricks
 *  - Per-user rate limits (auditLog-backed; no in-memory state)
 *  - Every accept/reject decision is auditable
 */

export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_FILES_PER_SUBMISSION = 10;

/** Allow-list keyed by canonical mime; values describe magic-byte signatures. */
type Sig = { offset: number; bytes: number[] };
type Entry = {
  mime: string;
  ext: string[];
  /** at least one signature must match (some formats have multiple) */
  signatures: Sig[] | "text"; // "text" = printable-ish UTF-8 sniff
};

const ALLOWED: Entry[] = [
  // Documents
  {
    mime: "application/pdf",
    ext: ["pdf"],
    signatures: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  },
  {
    mime: "text/plain",
    ext: ["txt"],
    signatures: "text",
  },
  {
    mime: "text/markdown",
    ext: ["md", "markdown"],
    signatures: "text",
  },
  // Word
  {
    mime: "application/msword",
    ext: ["doc"],
    signatures: [
      { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
    ],
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ["docx"],
    signatures: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK zip
  },
  // Images
  {
    mime: "image/png",
    ext: ["png"],
    signatures: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    mime: "image/jpeg",
    ext: ["jpg", "jpeg"],
    signatures: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    mime: "image/webp",
    ext: ["webp"],
    signatures: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF
  },
  {
    mime: "image/gif",
    ext: ["gif"],
    signatures: [
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
      { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
    ],
  },
  // Audio
  {
    mime: "audio/mpeg",
    ext: ["mp3"],
    signatures: [
      { offset: 0, bytes: [0x49, 0x44, 0x33] }, // ID3
      { offset: 0, bytes: [0xff, 0xfb] },
      { offset: 0, bytes: [0xff, 0xf3] },
      { offset: 0, bytes: [0xff, 0xf2] },
    ],
  },
  {
    mime: "audio/wav",
    ext: ["wav"],
    signatures: [{ offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }],
  },
  // Video
  {
    mime: "video/mp4",
    ext: ["mp4", "m4v", "m4a"],
    signatures: [{ offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }], // ftyp at offset 4
  },
  {
    mime: "video/webm",
    ext: ["webm"],
    signatures: [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }],
  },
];

export function getExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i + 1).toLowerCase();
}

function sniffMatches(buf: Buffer, sig: Sig): boolean {
  if (buf.length < sig.offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    if (buf[sig.offset + i] !== sig.bytes[i]) return false;
  }
  return true;
}

function looksLikeText(buf: Buffer): boolean {
  if (buf.length === 0) return true;
  // Reject if NULL bytes appear in the first 4KB — strongly suggests binary.
  const len = Math.min(buf.length, 4096);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return false;
  }
  let printable = 0;
  for (let i = 0; i < len; i++) {
    const b = buf[i]!;
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) {
      printable++;
    }
  }
  return printable / len > 0.9;
}

const SAFE_FILENAME_RE = /^[A-Za-z0-9._\-() \[\]]+$/;

export interface ValidatedUpload {
  filename: string;
  mime: string;
  ext: string;
  buffer: Buffer;
  size: number;
}

/**
 * Throws TRPCError on rejection. Returns a sanitized result on accept.
 */
export function validateUpload(args: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}): ValidatedUpload {
  const filename = (args.filename || "").trim();
  if (!filename) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Filename required",
    });
  }
  if (filename.length > 240) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Filename too long",
    });
  }
  if (!SAFE_FILENAME_RE.test(filename) || filename.includes("..")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Filename contains unsupported characters. Use letters, numbers, dot, dash, underscore, parentheses, brackets, and spaces only.",
    });
  }

  const size = args.buffer.byteLength;
  if (size === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Empty file" });
  }
  if (size > MAX_FILE_BYTES) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: `File exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB limit`,
    });
  }

  const ext = getExt(filename);
  const mime = (args.mimeType || "").toLowerCase().trim();

  // Find allow-list entry by either mime or ext, then verify the OTHER agrees.
  const candidates = ALLOWED.filter(
    (e) => e.mime === mime || e.ext.includes(ext),
  );
  if (candidates.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `File type not allowed (.${ext} / ${mime}). Allowed: PDF, TXT, MD, DOC, DOCX, PNG, JPG, WEBP, GIF, MP3, WAV, MP4, WEBM`,
    });
  }
  const entry = candidates.find(
    (e) => e.ext.includes(ext) && (mime === "" || mime === e.mime),
  );
  if (!entry) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Mismatch between filename extension (.${ext}) and content type (${mime}).`,
    });
  }

  // Magic byte sniff
  if (entry.signatures === "text") {
    if (!looksLikeText(args.buffer)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "File claims to be text but contains binary data. Rejected.",
      });
    }
  } else {
    const ok = entry.signatures.some((sig) => sniffMatches(args.buffer, sig));
    if (!ok) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `File contents do not match a valid ${entry.mime} signature. This rejects renamed-extension files.`,
      });
    }
  }

  return {
    filename,
    mime: entry.mime,
    ext,
    buffer: args.buffer,
    size,
  };
}

/* ============= Rate limiting (auditLog-backed) ============= */

export async function checkRateLimit(args: {
  userId: number;
  action: InsertAuditLog["action"];
  windowMs: number;
  max: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return; // fail-open in dev only
  const since = new Date(Date.now() - args.windowMs);
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(auditLog)
    .where(
      sql`${auditLog.actorUserId} = ${args.userId} AND ${auditLog.action} = ${args.action} AND ${auditLog.createdAt} > ${since}`,
    );
  const count = Number(rows[0]?.c ?? 0);
  if (count >= args.max) {
    await writeAudit({
      actorUserId: args.userId,
      action: "rate_limit_triggered",
      metadata: {
        limitedAction: args.action,
        max: args.max,
        windowMs: args.windowMs,
      },
    });
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit reached for this action. Try again later.`,
    });
  }
}

/* ============= Audit log writer ============= */

export function hashIp(ip: string | undefined | null): string | null {
  if (!ip) return null;
  return crypto
    .createHash("sha256")
    .update(`reno-record::${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export async function writeAudit(entry: {
  actorUserId?: number | null;
  actorRole?: string | null;
  action: InsertAuditLog["action"];
  targetType?: string | null;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLog).values({
      actorUserId: entry.actorUserId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      ipHash: entry.ipHash ?? null,
    });
  } catch (e) {
    console.warn("[audit] failed to write entry:", e);
  }
}

/** Decode a base64 string into a Buffer with a hard size guard before allocating. */
export function decodeBase64Strict(b64: string): Buffer {
  // 4 base64 chars = 3 bytes; estimate before allocating
  const estimate = Math.floor((b64.length * 3) / 4);
  if (estimate > MAX_FILE_BYTES + 1024) {
    throw new TRPCError({
      code: "PAYLOAD_TOO_LARGE",
      message: "Encoded payload exceeds size cap",
    });
  }
  return Buffer.from(b64, "base64");
}

// suppress unused import (keeps drizzle eq/gt imports for future use)
void eq;
void gt;
