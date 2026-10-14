import { describe, expect, it } from "vitest";
import { retiredTourismPlans, tourismPlans } from "../../prisma/catalogue/tourism";
import { limitFor, mergeEntitlements } from "@/lib/platform/entitlements";

// Guards the commercial configuration itself (decision of 2026-10-14).
describe("tourism catalogue", () => {
  const byKey = Object.fromEntries(tourismPlans.map((p) => [p.key, mergeEntitlements(p.entitlements, null)]));

  it("every plan, including retired ones, has valid entitlements and an AI allowance", () => {
    for (const p of [...tourismPlans, ...retiredTourismPlans]) {
      const e = mergeEntitlements(p.entitlements, null);
      expect(e.ai?.monthlyAllowanceUsd).toBeGreaterThan(0);
    }
  });

  it("matches the agreed limits", () => {
    const s = byKey["tourism-starter"];
    const p = byKey["tourism-professional"];
    expect([limitFor(s, "brands"), limitFor(s, "users"), limitFor(s, "integrations"), limitFor(s, "historyDays")]).toEqual([1, 2, 3, 90]);
    expect([limitFor(p, "brands"), limitFor(p, "users"), limitFor(p, "integrations"), limitFor(p, "historyDays")]).toEqual([3, 5, 6, 365]);
    expect(s.reporting.cadences).toEqual(["weekly"]);
    expect(p.reporting.cadences).toEqual(["daily", "weekly"]);
    expect(limitFor(s, "customWorkflows")).toBe(0);
    expect(limitFor(p, "customWorkflows")).toBeGreaterThan(0);
    expect([s.support.tier, p.support.tier, byKey["tourism-enterprise"].support.tier]).toEqual(["standard", "priority", "dedicated"]);
  });

  it("uses the indicative NZD prices", () => {
    const price = Object.fromEntries(tourismPlans.map((p) => [p.key, p.priceCents]));
    expect(price).toEqual({ "tourism-starter": 29900, "tourism-professional": 69900, "tourism-enterprise": null });
    expect(tourismPlans.every((p) => p.currency === "NZD")).toBe(true);
  });
});
