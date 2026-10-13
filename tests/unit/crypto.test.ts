import { describe, expect, it } from "vitest";
import { connectionAad, decryptSecret, encryptSecret, parseKeyRing } from "@/lib/platform/crypto";
import { hashPassword, verifyPassword } from "@/lib/platform/passwords";
import { generateToken, hashToken } from "@/lib/platform/tokens";

const k = (n: number) => Buffer.alloc(32, n).toString("base64");

describe("credential encryption", () => {
  const ring = parseKeyRing(`1:${k(1)},2:${k(2)}`);
  const aad = connectionAad({ id: "c1", organizationId: "o1", providerKey: "ga4" });

  it("round-trips and encrypts with the newest key", () => {
    const ct = encryptSecret("refresh-token-value", aad, ring);
    expect(ct.startsWith("v2.")).toBe(true);
    expect(ct).not.toContain("refresh-token-value");
    expect(decryptSecret(ct, aad, ring)).toBe("refresh-token-value");
  });
  it("uses a fresh IV every time", () => {
    expect(encryptSecret("x", aad, ring)).not.toBe(encryptSecret("x", aad, ring));
  });
  it("still decrypts data written with an older key after rotation", () => {
    const old = parseKeyRing(`1:${k(1)}`);
    const ct = encryptSecret("legacy", aad, old);
    expect(decryptSecret(ct, aad, ring)).toBe("legacy");
  });
  it("rejects ciphertext moved to another tenant's row (AAD mismatch)", () => {
    const ct = encryptSecret("secret", aad, ring);
    const otherAad = connectionAad({ id: "c1", organizationId: "o2", providerKey: "ga4" });
    expect(() => decryptSecret(ct, otherAad, ring)).toThrow();
  });
  it("rejects tampered ciphertext", () => {
    const ct = encryptSecret("secret", aad, ring);
    const parts = ct.split(".");
    const body = Buffer.from(parts[3], "base64url");
    body[0] ^= 0xff;
    parts[3] = body.toString("base64url");
    expect(() => decryptSecret(parts.join("."), aad, ring)).toThrow();
  });
  it("rejects unknown key versions and bad key material", () => {
    const ct = encryptSecret("secret", aad, ring);
    expect(() => decryptSecret(ct, aad, parseKeyRing(`1:${k(1)}`))).toThrow();
    expect(() => parseKeyRing(undefined)).toThrow();
    expect(() => parseKeyRing("1:c2hvcnQ=")).toThrow();
    expect(() => parseKeyRing(`x:${k(1)}`)).toThrow();
  });
});

describe("passwords and tokens", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("generates unguessable tokens and stores only hashes", () => {
    const t = generateToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toBe(t);
  });
});
