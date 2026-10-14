// Claude API list prices used for metering, in micro-USD per million tokens.
// Source: Anthropic's published API list prices as of 2026-10-06. Re-verify
// against Anthropic's pricing page
// before launch and whenever Anthropic changes prices; add a new row with a
// new effectiveFrom rather than editing an old one, so past usage keeps the
// price it was charged at.
//
// Assumptions to verify:
//   - Cache writes are priced at 1.25x input (5-minute cache).
//   - Haiku 5.5 cache-read price assumed at 0.1x input. Its listed prices
//     apply to prompts up to 100K tokens; longer prompts cost more ($0.50 /
//     $2.50) and are not modelled here — avoid them or add a tiered rate.
//   - The Batch API discount is 50% on all token types.

const usd = (dollarsPerMTok: number) => Math.round(dollarsPerMTok * 1_000_000);
const SOURCE = "Anthropic list price, cached 2026-10-06";
const FROM = new Date("2026-10-01T00:00:00Z");

export const modelRates = [
  { model: "claude-opus-5-5", input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  { model: "claude-sonnet-5-5", input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  { model: "claude-haiku-5-5", input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
].map((r) => ({
  provider: "anthropic",
  model: r.model,
  inputMicrosPerMTok: usd(r.input),
  outputMicrosPerMTok: usd(r.output),
  cacheReadMicrosPerMTok: usd(r.cacheRead),
  cacheWriteMicrosPerMTok: usd(r.cacheWrite),
  batchDiscountPercent: 50,
  effectiveFrom: FROM,
  source: SOURCE,
}));
