import { describe, expect, it } from "vitest";
import { classifyUsage, costMicros, monthPeriod } from "@/lib/platform/usage";

const opus = {
  inputMicrosPerMTok: 4_000_000,
  outputMicrosPerMTok: 20_000_000,
  cacheReadMicrosPerMTok: 200_000,
  cacheWriteMicrosPerMTok: 5_000_000,
  batchDiscountPercent: 50,
};

describe("costMicros", () => {
  it("prices each token type", () => {
    // 1M input = $4, 100k output = $2, 1M cache read = $0.20, 100k cache write = $0.50
    expect(
      costMicros(opus, { inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 100_000 })
    ).toBe(6_700_000);
  });
  it("applies the batch discount", () => {
    expect(costMicros(opus, { inputTokens: 1_000_000, outputTokens: 0, isBatch: true })).toBe(2_000_000);
  });
  it("rounds up so metering never under-charges", () => {
    expect(costMicros(opus, { inputTokens: 1, outputTokens: 0 })).toBe(4);
    expect(costMicros({ ...opus, inputMicrosPerMTok: 100_000 }, { inputTokens: 1, outputTokens: 0 })).toBe(1);
  });
  it("rejects invalid token counts", () => {
    expect(() => costMicros(opus, { inputTokens: -1, outputTokens: 0 })).toThrow(RangeError);
    expect(() => costMicros(opus, { inputTokens: 1.5, outputTokens: 0 })).toThrow(RangeError);
  });
});

describe("classifyUsage", () => {
  const ai = { monthlyAllowanceUsd: 10, warnAtPercent: 80, hardLimitPercent: 110 };
  it("moves through ok → warning → limit_reached", () => {
    expect(classifyUsage(7_999_999, ai).state).toBe("ok");
    expect(classifyUsage(8_000_000, ai).state).toBe("warning");
    expect(classifyUsage(10_999_999, ai).state).toBe("warning");
    expect(classifyUsage(11_000_000, ai)).toMatchObject({ state: "limit_reached", hardLimitMicrosUsd: 11_000_000 });
  });
  it("reports no allowance when the plan has none", () => {
    expect(classifyUsage(0, null).state).toBe("no_allowance");
  });
});

describe("monthPeriod", () => {
  it("is the UTC calendar month", () => {
    const p = monthPeriod(new Date("2026-12-31T23:59:59Z"));
    expect(p.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(p.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
