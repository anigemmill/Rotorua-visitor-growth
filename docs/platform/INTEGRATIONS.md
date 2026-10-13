# Integrations

Last researched: 2026-10-13. Provider requirements change often — **re-check
the official pages below immediately before implementing each connector**,
and record the date checked in the connector's README.

## 1. Connector framework

Contract: `src/lib/integrations/types.ts` (`Connector`). Catalogue:
`src/lib/integrations/registry.ts`. Lifecycle service:
`src/lib/platform/connections.ts`.

| Capability (brief §4C) | Where |
|---|---|
| Connection setup / authentication | `beginAuthorization` / `completeAuthorization` (OAuth) or encrypted API key |
| Permission validation | `validate()` → `ValidationCheck[]` (pass/warn/fail with customer-readable detail) |
| Account/property selection | `listAccounts()` |
| Initial import / incremental sync | `sync(window, cursor)` — initial import is a sync over the backfill window |
| Data freshness | `SyncResult.dataCompleteThrough`, stored on `SyncRun` |
| Error handling, rate limiting, quota | `ConnectorError.kind` (`auth_revoked`, `permission_denied`, `rate_limited`, `quota_exhausted`, `transient`, `invalid_config`) → runner decides retry/backoff vs. mark connection ERROR and ask the customer to reconnect |
| Token refresh | `refreshCredentials()`; new tokens re-encrypted |
| Disconnection / revocation | `revoke()` then `disconnectIntegration()` destroys ciphertext |
| Health monitoring, diagnostics | Connection status + last success/error; `SyncRun` history; admin Integration health page |

Rules: connectors never write agent findings and agents never call
providers; provider-native metric names, currencies, time zones and
attribution settings are preserved on every observation.

### Sync runner (Phase 2)

pg-boss queue; one job per (connection, window) with a **singleton key** so
duplicate schedules collapse; exponential backoff on `transient` /
`rate_limited`; per-provider concurrency caps to respect shared quotas; the
job re-checks the licence (`assertFeature`) and connection status before
running, so expired or disconnected tenants never sync.

## 2. Integration matrix

| # | Provider | Auth | Scopes / permissions | Access prerequisites | Phase | Status |
|---|---|---|---|---|---|---|
| 1 | Google Analytics 4 — Data API v1 (+ Admin API for account/property list) | OAuth 2.0 (web server flow) | `analytics.readonly` | Google Cloud project, OAuth consent screen. `analytics.readonly` is a **sensitive** scope → Google OAuth app verification before public launch (testing mode limited to 100 test users) | 2 | Designed |
| 2 | Google Search Console API | OAuth 2.0 | `webmasters.readonly` | Same Cloud project and consent screen; sensitive scope verification | 2 | Designed |
| 3 | Website + sitemaps + PageSpeed Insights API | None (public pages); PSI uses an API key | — | PSI API key (server-side). URL Inspection API only for verified, authorised Search Console properties (quota-limited) | 2 | Domain capture live; crawler Phase 2 |
| 4 | Google Ads API | OAuth 2.0 + developer token / Cloud-project access level | `adwords` (no read-only scope exists — we call reporting only) | See §3: access level now appears tied to the Cloud project; Basic/Standard access needs an application and review; manager (MCC) account for test accounts | 4 | Designed |
| 5 | Meta Marketing API (Insights) | Facebook Login for Business | `ads_read` | Meta app, Business Verification, App Review for `ads_read`; Marketing API Access Tier — "Limited Access" is development only, "Full Access" needed for live advertisers | 4 | Designed |
| 6a | Instagram API with Instagram Login | Business Login for Instagram | `instagram_business_basic`, `instagram_business_manage_insights` | App Review + Advanced access to serve accounts we don't own | 4 | Designed |
| 6b | Facebook Pages insights | Facebook Login | `pages_show_list`, `read_insights`, `pages_read_engagement` | App Review | 4 | Designed |
| 6c | YouTube Analytics + Data API | OAuth 2.0 | `yt-analytics.readonly`, `youtube.readonly` | Google verification (sensitive scopes); Data API quota is per project — request increase before scale | 4 | Designed |
| 7a | Rezdy Supplier API (proposed first booking provider) | API key | Supplier API key | Supplier's Rezdy plan must include API access (reportedly top tier — verify); staging environment with demo keys available | 5 | Provisional |
| 7b | Booking CSV import | File upload | — | None | 5 | Designed |

Excluded by design: private competitor analytics, unrestricted social
listening, any write/publish/bid/budget/price changes in the initial release.

## 3. Provider notes and open questions

**Google Analytics 4.** Report by date, landing page, session default
channel group, device category, country/region, plus engagement and key
event (conversion) metrics. Check property time zone and currency via the
Admin API and store them on the connection. Validation must detect missing
key events and `(not set)`-heavy dimensions and say so. Respect Data API
token quotas per property (core/realtime/funnel quotas); request
`returnPropertyQuota` and back off.
Docs: <https://developers.google.com/analytics/devguides/reporting/data/v1>,
<https://developers.google.com/analytics/devguides/reporting/data/v1/quotas>

**Search Console.** Search Analytics query by date/query/page/device/country,
`dataState` for fresh vs. final data. Treat as an aggregated, privacy-
filtered dataset (anonymised queries omitted; totals ≠ sum of rows). Daily
row limits per property.
Docs: <https://developers.google.com/webmaster-tools/v1/api_reference_index>,
<https://developers.google.com/webmaster-tools/limits>

**Website.** Sitemap protocol + robots.txt (RFC 9309); identifiable user
agent; per-host rate limit; DNS-resolve-then-block private/link-local/
metadata ranges on every request and redirect (SSRF); size and page caps
per plan.

**Google Ads.** Secondary sources report that from **September 2026**
developer tokens were sunset and API access levels now belong to the Google
Cloud project that issued the OAuth credentials, with newer API versions
returning `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` for test-level
projects. Google's own pages still describe Explorer/Basic/Standard access
levels and application review. **Blocker: confirm current access model on
Google's pages and apply early** — reviews have had backlogs.
Docs: <https://developers.google.com/google-ads/api/docs/api-policy/access-levels>,
<https://developers.google.com/google-ads/api/docs/first-call/dev-token>.
Secondary: [PPC Land](https://ppc.land/google-drops-developer-tokens-from-ads-api-access-decisions/),
[Relevant Audience](https://www.relevantaudience.com/google-ads-en/google-ads-api-developer-tokens-sunset-cloud-project-access/).

**Meta.** As of Meta's authorization doc (updated May 2026) the Ads
Management Standard Access feature is now the "Marketing API Access Tier",
with levels renamed to Limited Access (development only) and Full Access
(threshold reduced to 500 Marketing API calls in 15 days). `ads_read`
requires App Review. Preserve `action_attribution_windows` and
`use_unified_attribution_setting` on every Insights pull. Pin a Graph API
version and track Meta's two-year version deprecation schedule.
Docs: <https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization>,
<https://developers.secure.facebook.com/docs/marketing-apis/overview>,
<https://developers.facebook.com/docs/marketing-api/insights>

**Instagram.** `instagram_business_manage_insights` (introduced March 2025)
covers user and media insights on the Instagram Login path; Advanced access
needed for accounts we don't own. Several metrics were deprecated in 2025 —
use the current insights reference, never hard-code a metric list without
a test.
Docs: <https://developers.facebook.com/docs/instagram-platform/insights>,
<https://developers.facebook.com/blog/post/2025/03/24/user-and-media-insights-on-instagram-api-with-instagram-login/>

**Booking providers.** Candidates in the NZ/AU tourism market: Rezdy,
FareHarbor, Bókun, Checkfront, TrekkSoft. Recommendation: **Rezdy first**,
provisionally — strong NZ/AU operator presence, a documented Supplier REST
API (OpenAPI 3.0) and webhooks, and a staging environment. Concerns to
verify: the API key is reported to be passed as a query parameter
(log-redaction needed), and API access may be limited to higher Rezdy
plans. **Blocker: customer research** — ask the first 10 prospects which
booking system they use before building; ship CSV import first.
Docs: <https://developers.rezdy.com/rezdyapi/index-supplier.html>,
<https://developers.rezdy.com/rezdyapi/index-webhook.html>

Booking data rules: hash provider booking ids, no traveller names/emails/
phones by default, keep currency per row, and separate *attributed*
bookings (referral/campaign code present) from bookings merely observed in
the same period.

## 4. Credentials and approvals needed (owner: you)

| Item | Needed for | Lead time |
|---|---|---|
| Google Cloud project + OAuth consent screen (production) | GA4, Search Console, YouTube, Ads | Days; **sensitive-scope verification** weeks |
| Privacy policy + terms URLs on your domain, domain verification | All OAuth consent screens, Meta App Review | Before any verification |
| PageSpeed Insights API key | Website audits | Minutes |
| Google Ads API access approval for the Cloud project | Google Ads | Weeks (backlogs reported) |
| Meta app, Business Verification, App Review (`ads_read`, Instagram/Pages insights), Full Access tier | Meta, Instagram, Facebook | Weeks |
| Rezdy partner/staging access | Booking | Depends on Rezdy |
| Anthropic API key + organisation data-retention settings | Agents | Minutes; review terms |
| Stripe account | Billing | Days |
| Email provider (Postmark/SES/Resend) | Verification, reset, invites, reports | Days (domain DNS) |
