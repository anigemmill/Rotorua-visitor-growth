import { describe, expect, it } from "vitest";
import {
  hasFeature,
  limitFor,
  mergeEntitlements,
  resolveAccess,
  withinLimit,
  type LicenseLike,
} from "@/lib/platform/entitlements";

const NOW = new Date("2026-10-13T00:00:00Z");
const day = 24 * 3600 * 1000;
const at = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * day);
const lic = (p: Partial<LicenseLike>): LicenseLike => ({
  status: "ACTIVE",
  trialEndsAt: null,
  currentPeriodEnd: null,
  graceDays: 7,
  ...p,
});

describe("resolveAccess", () => {
  it("no licence → none", () => {
    expect(resolveAccess(null, NOW).mode).toBe("none");
  });
  it("suspended → none regardless of dates", () => {
    expect(resolveAccess(lic({ status: "SUSPENDED", currentPeriodEnd: at(100) }), NOW).mode).toBe("none");
  });
  it("trial active vs ended vs missing end date", () => {
    expect(resolveAccess(lic({ status: "TRIALING", trialEndsAt: at(1) }), NOW).mode).toBe("full");
    expect(resolveAccess(lic({ status: "TRIALING", trialEndsAt: at(-1) }), NOW).mode).toBe("read_only");
    expect(resolveAccess(lic({ status: "TRIALING", trialEndsAt: null }), NOW).mode).toBe("read_only");
  });
  it("active: open-ended, in period, in grace, after grace", () => {
    expect(resolveAccess(lic({}), NOW).mode).toBe("full");
    expect(resolveAccess(lic({ currentPeriodEnd: at(5) }), NOW).mode).toBe("full");
    const grace = resolveAccess(lic({ currentPeriodEnd: at(-3) }), NOW);
    expect(grace).toMatchObject({ mode: "full", inGracePeriod: true });
    expect(resolveAccess(lic({ currentPeriodEnd: at(-8) }), NOW).mode).toBe("read_only");
  });
  it("past due: grace then read-only", () => {
    expect(resolveAccess(lic({ status: "PAST_DUE", currentPeriodEnd: at(-2) }), NOW)).toMatchObject({
      mode: "full",
      inGracePeriod: true,
    });
    expect(resolveAccess(lic({ status: "PAST_DUE", currentPeriodEnd: at(-30) }), NOW).mode).toBe("read_only");
    expect(resolveAccess(lic({ status: "PAST_DUE", currentPeriodEnd: null }), NOW).mode).toBe("read_only");
  });
  it("cancelled keeps access to end of paid period only", () => {
    expect(resolveAccess(lic({ status: "CANCELLED", currentPeriodEnd: at(10) }), NOW).mode).toBe("full");
    expect(resolveAccess(lic({ status: "CANCELLED", currentPeriodEnd: at(-1) }), NOW).mode).toBe("read_only");
  });
  it("expired → read-only", () => {
    expect(resolveAccess(lic({ status: "EXPIRED" }), NOW).mode).toBe("read_only");
  });
});

describe("entitlements", () => {
  const plan = { features: { "integrations.ga4": true }, limits: { brands: 2, users: null } };

  it("merges overrides over plan", () => {
    const e = mergeEntitlements(plan, { limits: { brands: 5 }, features: { "integrations.meta_ads": true } });
    expect(limitFor(e, "brands")).toBe(5);
    expect(hasFeature(e, "integrations.ga4")).toBe(true);
    expect(hasFeature(e, "integrations.meta_ads")).toBe(true);
  });
  it("unmentioned features are off and unmentioned limits are zero", () => {
    const e = mergeEntitlements(plan, null);
    expect(hasFeature(e, "reports.commercial")).toBe(false);
    expect(limitFor(e, "integrations")).toBe(0);
    expect(withinLimit(e, "integrations", 0)).toBe(false);
  });
  it("null limit means unlimited", () => {
    const e = mergeEntitlements(plan, null);
    expect(withinLimit(e, "users", 10_000)).toBe(true);
  });
  it("enforces limits at the boundary", () => {
    const e = mergeEntitlements(plan, null);
    expect(withinLimit(e, "brands", 1)).toBe(true);
    expect(withinLimit(e, "brands", 2)).toBe(false);
  });
  it("rejects malformed plan configuration rather than guessing", () => {
    expect(() => mergeEntitlements({ limits: { brands: -1 } }, null)).toThrow();
    expect(() => mergeEntitlements({ features: { "not.a.feature": true } }, null)).toThrow();
  });
});
