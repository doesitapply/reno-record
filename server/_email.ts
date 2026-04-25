/**
 * SMTP / email helper for The Reno Record.
 *
 * Design principles:
 *  - Fail safe: if SMTP env is missing or unreachable, log "email skipped"
 *    and return { sent: false, reason: ... }. Never throw into the request.
 *  - Redaction-safe: templates never include the user's narrative text,
 *    file contents, or private metadata. Subject lines and bodies are
 *    intentionally generic. Specifics live in the admin queue, not in mail.
 *  - Single transport, lazy-initialized; tests can clear it via __resetEmail().
 */
import nodemailer, { type Transporter } from "nodemailer";

let _transport: Transporter | null = null;
let _initialized = false;

function smtpEnv() {
  return {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
    secure:
      process.env.SMTP_SECURE === "true" ||
      process.env.SMTP_SECURE === "1" ||
      undefined,
  };
}

export function isEmailConfigured() {
  const e = smtpEnv();
  return Boolean(e.host && e.port && e.user && e.pass && e.from);
}

function getTransport(): Transporter | null {
  if (_initialized) return _transport;
  _initialized = true;
  if (!isEmailConfigured()) {
    console.info("[email] SMTP env missing — email skipped at runtime");
    _transport = null;
    return null;
  }
  const e = smtpEnv();
  try {
    _transport = nodemailer.createTransport({
      host: e.host!,
      port: e.port!,
      secure: e.secure ?? e.port === 465,
      auth: { user: e.user!, pass: e.pass! },
    });
    return _transport;
  } catch (err) {
    console.warn("[email] failed to create SMTP transport — emails will be skipped", err);
    _transport = null;
    return null;
  }
}

// Test-only: lets vitest reset transport state between tests.
export function __resetEmail() {
  _transport = null;
  _initialized = false;
}

export type EmailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: string };

async function sendMail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailResult> {
  const t = getTransport();
  if (!t) return { sent: false, reason: "smtp_not_configured" };
  const e = smtpEnv();
  try {
    const info = await t.sendMail({
      from: e.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.warn("[email] send failed", err);
    return { sent: false, reason: "smtp_send_error" };
  }
}

/* ============================ Templates ============================
   Hard rule: never include the user's narrative, document text, file
   contents, or admin notes. Only neutral identifiers + status. */

export async function emailStoryReceived(opts: {
  to: string | null | undefined;
  storyId: number;
}): Promise<EmailResult> {
  if (!opts.to) return { sent: false, reason: "no_recipient" };
  return sendMail({
    to: opts.to,
    subject: "The Reno Record — submission received",
    text:
      `Your submission has been received and is queued for editorial review.\n\n` +
      `Reference: #${opts.storyId}\n\n` +
      `An admin will review the materials. You will receive a follow-up notice when a decision is made. ` +
      `For privacy, this email does not contain the contents of your submission.\n\n` +
      `— The Reno Record`,
  });
}

export async function emailFilesReceived(opts: {
  to: string | null | undefined;
  storyId: number;
  fileCount: number;
}): Promise<EmailResult> {
  if (!opts.to) return { sent: false, reason: "no_recipient" };
  return sendMail({
    to: opts.to,
    subject: "The Reno Record — files received",
    text:
      `${opts.fileCount} file(s) attached to submission #${opts.storyId} were received and stored securely.\n\n` +
      `Files are not public until an admin reviews them. ` +
      `For privacy, this email does not list filenames.\n\n` +
      `— The Reno Record`,
  });
}

export async function emailStoryDecision(opts: {
  to: string | null | undefined;
  storyId: number;
  decision: "approved" | "rejected" | "changes_requested";
}): Promise<EmailResult> {
  if (!opts.to) return { sent: false, reason: "no_recipient" };
  const verb =
    opts.decision === "approved"
      ? "has been approved"
      : opts.decision === "rejected"
        ? "was not accepted at this time"
        : "needs additional information";
  return sendMail({
    to: opts.to,
    subject: `The Reno Record — submission ${opts.decision.replace("_", " ")}`,
    text:
      `Submission #${opts.storyId} ${verb}.\n\n` +
      `For privacy, this email does not include reviewer notes or your submission contents. ` +
      `Sign in at the site to view the status and any next steps.\n\n` +
      `— The Reno Record`,
  });
}

export async function emailDocumentDecision(opts: {
  to: string | null | undefined;
  documentId: number;
  decision: "approved" | "rejected";
}): Promise<EmailResult> {
  if (!opts.to) return { sent: false, reason: "no_recipient" };
  const verb = opts.decision === "approved" ? "has been approved" : "was not accepted";
  return sendMail({
    to: opts.to,
    subject: `The Reno Record — document ${opts.decision}`,
    text:
      `Document #${opts.documentId} ${verb} by editorial review.\n\n` +
      `For privacy, this email does not include the document contents or reviewer notes.\n\n` +
      `— The Reno Record`,
  });
}
