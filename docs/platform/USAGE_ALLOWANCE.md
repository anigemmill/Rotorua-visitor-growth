# AI usage allowance

Every licence carries a **monthly Claude API usage allowance**. It is never
unlimited: the entitlement schema requires a positive allowance and caps the
hard limit at 2× the allowance. Code: `src/lib/platform/usage.ts`. Prices:
`prisma/catalogue/model-rates.ts`. Plan values: `prisma/catalogue/tourism.ts`.

## Model

| Setting (per plan, overridable per licence) | Meaning |
|---|---|
| `ai.monthlyAllowanceUsd` | Provider cost included per UTC calendar month, in USD (the provider's billing currency) |
| `ai.warnAtPercent` (default 80) | Workspace banner, plus one `usage.ai_warning` audit event per period |
| `ai.hardLimitPercent` (100–200, default 100) | New AI work is refused once used + estimate would pass this; one `usage.ai_limit_reached` event per period |

Current planning values (assumptions, revisit with Phase 3 cost data):
Starter US$35 (hard limit 100%), Professional US$80 (110%), Enterprise
US$250 default, which must be set per agreement. Sized at ≈20% of plan
revenue at NZ$1 ≈ US$0.58.

## Metering

1. **Before a call:** `estimateCostMicros()` computes the worst case (all
   input uncached, full `max_tokens` output). `assertAiBudget()` then
   requires full licence access and an allowance, and refuses if used +
   estimate > hard limit.
2. **After a call:** `recordModelUsage()` writes a `UsageRecord` with the
   real token counts from `response.usage` (input, output, cache read, cache
   write, batch flag). Cost is computed from the `ModelRate` effective at
   that time, rounded up, in integer micro-USD.
3. **Idempotency:** the provider request id is the idempotency key, so
   retries and replays are never counted twice (unique constraint).
4. **Alerts:** `UsageAlert` (unique per organisation, period and level)
   makes the warning and limit events fire once per month.

Prices are versioned by `effectiveFrom`, so past usage keeps the price it
was charged at. Unknown models are refused (`ModelRateMissingError`), never
metered at zero.

## Controls

- **Customer:** usage meter (percentage only, no provider prices) on
  Licence & plan; banner at warning and at the limit.
- **Staff:** per-customer usage and state on the customer page; allowance
  and hard-limit override on the licence form (a top-up, audited); platform
  AI cost per customer this month on the admin overview.

## Known limits / next steps

- Two concurrent runs can each pass the pre-flight check. The Phase 3
  orchestrator will serialise AI work per organisation (Postgres advisory
  lock), so overshoot is bounded to one call's estimate.
- Haiku 5.5's higher long-prompt price tier (>100K tokens) isn't modelled.
- Email alerts to owners use the email service (added with the account
  security work).
- Selling extra AI usage as an add-on is a later commercial decision; the
  override field is the mechanism for it.
