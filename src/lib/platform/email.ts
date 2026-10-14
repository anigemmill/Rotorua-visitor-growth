// Transactional email. One small interface, three transports:
//   ses    — Amazon SES v2 in the hosting region (production). Credentials
//            come from the runtime's IAM role, never from code or env files.
//   file   — writes each message as JSON to EMAIL_FILE_DIR (local dev, CI).
//   memory — appends to an in-process outbox (automated tests).
// Production refuses non-SES transports unless EMAIL_FILE_TRANSPORT_ALLOWED
// is set (used only by CI's production-build smoke test).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { env } from "./env";
import { generateToken } from "./tokens";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Message category, for logs and tests (never contains secrets). */
  tag: "verify_email" | "password_reset" | "password_changed" | "invitation";
}

export class EmailConfigError extends Error {}

/** In-memory outbox for tests. */
export const memoryOutbox: EmailMessage[] = [];

let sesClient: SESv2Client | null = null;

function transport(): "ses" | "file" | "memory" {
  const e = env();
  const t = e.EMAIL_TRANSPORT ?? (e.NODE_ENV === "test" ? "memory" : e.NODE_ENV === "production" ? "ses" : "file");
  if (e.NODE_ENV === "production" && t !== "ses" && e.EMAIL_FILE_TRANSPORT_ALLOWED !== "true") {
    throw new EmailConfigError("Production must send email through SES (EMAIL_TRANSPORT=ses).");
  }
  return t;
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const t = transport();
  if (t === "memory") {
    memoryOutbox.push(msg);
    return;
  }
  if (t === "file") {
    const dir = path.resolve(env().EMAIL_FILE_DIR ?? ".email-outbox");
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${msg.tag}-${generateToken(4)}.json`;
    await writeFile(path.join(dir, name), JSON.stringify(msg, null, 2), { mode: 0o600 });
    return;
  }
  const from = env().EMAIL_FROM;
  if (!from) throw new EmailConfigError("EMAIL_FROM is not configured.");
  sesClient ??= new SESv2Client({ region: env().SES_REGION });
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [msg.to] },
      Content: {
        Simple: {
          Subject: { Data: msg.subject, Charset: "UTF-8" },
          Body: { Text: { Data: msg.text, Charset: "UTF-8" }, Html: { Data: msg.html, Charset: "UTF-8" } },
        },
      },
      EmailTags: [{ Name: "category", Value: msg.tag }],
    })
  );
}

// ---------------------------------------------------------------------------
// Templates. Plain, link-first, no tracking pixels or third-party assets.
// ---------------------------------------------------------------------------

const PRODUCT = "Tourism Intelligence";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(paragraphs: string[], action?: { label: string; url: string }): { text: string; html: string } {
  const text = [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), `— ${PRODUCT}`].join("\n\n");
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#171717;max-width:560px;margin:0 auto;padding:24px">
${paragraphs.map((p) => `<p style="line-height:1.5">${escapeHtml(p)}</p>`).join("\n")}
${action ? `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#666">Or paste this link into your browser: ${escapeHtml(action.url)}</p>` : ""}
<p style="font-size:12px;color:#666">— ${PRODUCT}</p></body></html>`;
  return { text, html };
}

export function verificationEmail(to: string, name: string, url: string): EmailMessage {
  return {
    to,
    tag: "verify_email",
    subject: `Confirm your email for ${PRODUCT}`,
    ...layout(
      [`Hi ${name},`, "Please confirm this is your email address. The link expires in 24 hours.", "If you didn't create an account, you can ignore this email."],
      { label: "Confirm email address", url }
    ),
  };
}

export function passwordResetEmail(to: string, url: string): EmailMessage {
  return {
    to,
    tag: "password_reset",
    subject: `Reset your ${PRODUCT} password`,
    ...layout(
      ["Someone asked to reset the password for this account. The link expires in 30 minutes and can be used once.", "If this wasn't you, ignore this email — your password won't change."],
      { label: "Choose a new password", url }
    ),
  };
}

export function passwordChangedEmail(to: string): EmailMessage {
  return {
    to,
    tag: "password_changed",
    subject: `Your ${PRODUCT} password was changed`,
    ...layout([
      "The password for this account was just changed, and every session was signed out.",
      "If you didn't do this, reset your password immediately and contact support.",
    ]),
  };
}

export function invitationEmail(to: string, inviterName: string, orgName: string, role: string, url: string): EmailMessage {
  return {
    to,
    tag: "invitation",
    subject: `${inviterName} invited you to ${orgName} on ${PRODUCT}`,
    ...layout(
      [
        `${inviterName} has invited you to join the ${orgName} workspace as ${role}.`,
        "The invitation expires in 7 days. If you weren't expecting it, you can ignore this email.",
      ],
      { label: "View invitation", url }
    ),
  };
}

/** Absolute app URL for links in emails. */
export function appUrl(pathAndQuery: string): string {
  const base = env().APP_URL;
  if (!base) throw new EmailConfigError("APP_URL is not configured; email links cannot be built.");
  return new URL(pathAndQuery, base).toString();
}
