// Envelope-ready encryption for integration credentials (OAuth refresh
// tokens, API keys). AES-256-GCM with:
//   - a random 96-bit IV per message,
//   - versioned keys so they can be rotated (decrypt with any listed key,
//     encrypt with the newest),
//   - additional authenticated data (AAD) binding the ciphertext to the row
//     it belongs to, so a ciphertext copied into another tenant's row fails
//     to decrypt instead of silently granting access.
//
// Format: v<keyVersion>.<iv b64url>.<tag b64url>.<ciphertext b64url>
//
// Production should source the key material from a KMS / secret manager
// (see docs/platform/SECURITY.md §Credential handling); this module only
// assumes it arrives via CREDENTIAL_ENCRYPTION_KEYS.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

type KeyRing = { current: number; keys: Map<number, Buffer> };

export class CredentialKeyError extends Error {}

export function parseKeyRing(raw: string | undefined): KeyRing {
  if (!raw) {
    throw new CredentialKeyError(
      "CREDENTIAL_ENCRYPTION_KEYS is not configured; integration credentials cannot be stored."
    );
  }
  const keys = new Map<number, Buffer>();
  for (const entry of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const idx = entry.indexOf(":");
    const version = Number(entry.slice(0, idx));
    const key = Buffer.from(entry.slice(idx + 1), "base64");
    if (idx < 1 || !Number.isInteger(version) || version < 1) {
      throw new CredentialKeyError("CREDENTIAL_ENCRYPTION_KEYS entries must look like '<version>:<base64 key>'.");
    }
    if (key.length !== 32) {
      throw new CredentialKeyError(`Credential key version ${version} must be 32 bytes.`);
    }
    keys.set(version, key);
  }
  if (keys.size === 0) throw new CredentialKeyError("CREDENTIAL_ENCRYPTION_KEYS contains no keys.");
  return { current: Math.max(...keys.keys()), keys };
}

function ring(): KeyRing {
  return parseKeyRing(env().CREDENTIAL_ENCRYPTION_KEYS);
}

export function encryptSecret(plaintext: string, aad: string, keyRing: KeyRing = ring()): string {
  const key = keyRing.keys.get(keyRing.current)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [`v${keyRing.current}`, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, aad: string, keyRing: KeyRing = ring()): string {
  const [ver, ivB64, tagB64, ctB64] = payload.split(".");
  const version = Number(ver?.slice(1));
  const key = keyRing.keys.get(version);
  if (!ver?.startsWith("v") || !key || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new CredentialKeyError("Credential ciphertext is malformed or uses an unknown key version.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** AAD for an integration connection's credentials. */
export function connectionAad(c: { id: string; organizationId: string; providerKey: string }): string {
  return `integration:${c.organizationId}:${c.id}:${c.providerKey}`;
}
