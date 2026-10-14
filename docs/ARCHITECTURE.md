> **Note (Oct 2026):** this document describes the destination-intelligence layer (now under `/destination`, staff-only, strategic priority NEXT). The operator pilot platform — Tourism AI Growth OS — is documented in [`GROWTH_OS.md`](GROWTH_OS.md). The dev role switcher described in §6 has been replaced by real authentication.

# Rotorua Visitor Growth & Flow Intelligence — Architecture

This document is written before the bulk of the code, per the project brief's
requirement to define the model before building. It covers the twelve design
points the brief asks for, then states the MVP boundary explicitly.

Rotorua is the **first configured destination**, not the only one the system
can support. Destination-specific facts (coordinates, experience categories,
tracked AI-discovery prompts, strategy references) live in
`src/config/destinations/*`. Everything under `src/lib/engine/*` is
destination-agnostic and reads its subject from that config, so a second
destination is a new config file, not a fork of the codebase.

---

## 1. Destination data model

The model separates **reference data** (things that don't change often:
destinations, experience categories, data sources, tracked prompts) from
**observations** (time-stamped facts: a visitor-spend figure, a weather
reading, an AI-visibility check result) and **derived intelligence**
(opportunities, gaps, campaigns — outputs of engines, always traceable back to
the observations that produced them).

Every observation row carries the seven governance fields the brief mandates:
`source`, `dataType`, `observedAt`/`recordedAt` (timestamp), `geography`,
`periodStart`/`periodEnd` (time period), `confidence`, `accessLevel`. These
are not bolted on — they are required, non-nullable columns on every fact
table (see schema, §2).

Categories, matching the brief's groupings:

- **Visitors** — `VisitorMetric` (volume, origin market, domestic/int'l,
  purpose, length of stay, spend, by period/geography)
- **Accommodation** — `AccommodationMetric` (capacity, occupancy, room
  nights, type, geography), `AccommodationProperty` (reference)
- **Experiences** — `Experience` (reference: attractions, activities,
  culture, adventure, wellness, food, events, retail, nature) +
  `ExperienceCategory`
- **Demand** — `DemandSignal` (search demand, AI queries, social
  conversation, traveller questions — generic shape so any demand source
  can feed it)
- **Conditions** — `WeatherObservation`, `WeatherForecast`, `PublicHoliday`,
  `TransportDisruption`
- **Capacity** — `CapacityRecord` (attraction/accommodation/transport/event
  capacity + verified availability, generic across capacity types)
- **AI discovery** — `TrackedPrompt` (reference), `AIVisibilityCheck`
  (observation: one run of one prompt against one AI system)
- **Events** — `DestinationEvent`
- **Business ecosystem** — `Business`, `BusinessContribution` (capacity/
  offers/availability a business opts to share — see §6 access levels)
- **Derived intelligence** — `MarketOpportunity`, `ProductGap`,
  `Partnership`, `Campaign`, `Itinerary`, `ScenarioQuery` (all reference the
  observation rows / sources used to produce them)
- **Governance** — `DataSource` (registry of every source: name, type,
  owner, licence, access level, connector status), `ImportBatch` (every
  manual upload, who did it, what source it claims, row count, validation
  result)

## 2. Database schema

Postgres via Prisma (`prisma/schema.prisma`). Design choices:

- `DataSource` is a first-class row, not a free-text field: every
  observation table has a `sourceId` FK. You cannot insert a metric without
  registering where it came from.
- `AccessLevel` enum: `PUBLIC`, `PARTNER`, `PRIVATE_BUSINESS`, `AGGREGATED`,
  `MODEL_INFERENCE` — stored per-row so the same table can hold a public
  RotoruaNZ figure and a private operator figure side by side, filtered at
  the query layer (§6).
- `Confidence` enum: `VERIFIED`, `HIGH`, `MEDIUM`, `LOW`, `MODELLED` — every
  inference-derived row must be `MODELLED` or lower, never `VERIFIED`.
- Geography is a free-text-but-constrained field (`geography`) plus optional
  `lat`/`lng` — Rotorua-scale destinations mostly need suburb/zone
  granularity, not a full GIS layer, at MVP.
- All derived-intelligence tables (`MarketOpportunity`, `ProductGap`, etc.)
  have a `dataNeeded String[]` column — the brief requires every opportunity
  to state what evidence is missing, so the schema makes that a required
  field, not an afterthought in prose.
- `ScenarioQuery` stores the question, and answer content is structured as
  `facts Json`, `evidence Json`, `inferences Json`, `hypotheses Json`,
  `recommendations Json` — four distinguishable buckets, matching the
  brief's mandatory labelling, rather than one opaque answer blob.

Full schema: `prisma/schema.prisma`.

## 3. Data-source architecture

Three kinds of source, handled differently:

1. **Connected (live) sources** — a connector module in
   `src/lib/connectors/*` calls an external API and writes rows tagged with
   that `DataSource`. MVP ships two real connectors:
   - **Weather** (Open-Meteo — free, keyless, no auth) —
     `src/lib/connectors/weather.ts`
   - **Public holidays** (Nager.Date — free, keyless) —
     `src/lib/connectors/holidays.ts`
   Both are genuine API integrations with real response parsing — not
   mocked — but this sandbox's network policy blocks arbitrary outbound
   hosts, so they could not be exercised live during this build (see
   `docs/CONNECTOR_STATUS.md`). They will work as soon as they run
   somewhere with normal outbound HTTPS.
2. **Manual-import sources** — anything gated behind credentials this
   project doesn't hold (RotoruaNZ internal data, MBIE, Stats NZ
   International Visitor Survey, accommodation-provider PMS exports,
   forward-booking data). These come in via the CSV import pipeline
   (§4), and are still governed exactly like a live connector: they still
   populate a `DataSource` row and require the seven governance fields —
   the operator supplies them at upload time.
3. **Not yet buildable** sources — anything needing paid API access or a
   scraping/ToS-sensitive integration this session has no authorisation or
   credentials for (Google Trends at scale, social listening, LLM-panel AI
   discovery testing beyond a manual/keyed run). These are modelled in the
   schema and stubbed in the UI with an honest "not connected" state —
   never faked.

## 4. Ingestion pipelines

- **Connector pipeline** (live sources): `connector.fetch() → validate →
  upsert DataSource → insert observation rows tagged with source + fetch
  timestamp`. Idempotent on `(sourceId, geography, periodStart, periodEnd,
  metric)` so re-running a fetch doesn't duplicate rows.
- **Import pipeline** (manual sources): `POST /api/import` accepts a CSV +
  a governance header (source name, data type, geography, time period,
  confidence, access level) supplied by the uploading operator. The row is
  parsed (`papaparse`), schema-validated (`zod`) per target table, and
  written inside a transaction alongside an `ImportBatch` audit row. Bad
  rows are rejected with a line-numbered report, not silently dropped or
  guessed at.
- Both pipelines are the *only* way data enters the observation tables —
  there is no seed data that pretends to be a real observation (§10).

## 5. AI agent architecture

"Agents" here means the analytical engines the brief lists (Demand,
AI Discovery, Market Opportunity, Journey, Length-of-Stay, Visitor Flow,
Demand/Capacity Matching, Weather, Events, Product Gap, Partnership,
Itinerary, Campaign, Scenario). Two architectural rules apply to all of
them:

- **An engine only reads from the observation tables and the DataSource
  registry.** It cannot invent a number to fill a gap; if the query
  returns nothing, the engine's output says so explicitly (`status:
  "insufficient_data"`, plus the `dataNeeded` list) rather than falling
  back to a plausible-looking guess.
- **An engine's output is always attributable.** Every generated insight
  references the observation row IDs / sourceIds it used, so a reviewer can
  click through from a strategic claim to the underlying evidence.

At MVP, two engines are implemented as running code because they're
tractable without external paid services:
- **Scenario Engine** (`src/lib/engine/scenario.ts`) — given a question,
  pulls the relevant observation rows from Postgres, and (if
  `ANTHROPIC_API_KEY` is configured) asks Claude to structure them into
  FACT / EVIDENCE / INFERENCE / HYPOTHESIS / RECOMMENDATION sections,
  under an explicit system prompt forbidding invented statistics. Without a
  key configured it still returns the raw grounded facts/evidence
  mechanically, just without LLM-authored inference/recommendation prose.
- **AI Discovery Engine** (`src/lib/engine/ai-discovery.ts`) — runs the
  destination's tracked prompt bank against a configured model and stores
  each response as an `AIVisibilityCheck` row (whether Rotorua is
  mentioned, position, competitors named, sources cited). This is a
  manually-triggered run (`npm run ai-discovery`) at MVP, not a continuous
  monitor — continuous scheduling is roadmap (§12).

Every other engine listed in the brief (Market Opportunity, Product Gap,
Visitor Flow, Demand/Capacity Matching, Partnership, Itinerary, Campaign,
Length-of-Stay, Journey) is schema-modelled and UI-stubbed with a clear
"needs observation data before it can produce output" state — building
their logic against zero real rows would mean shipping fabricated
strategic claims, which the brief explicitly forbids.

## 6. Permissions

Two orthogonal layers:

- **Row-level access, by data.** Every observation/derived row has
  `accessLevel`. The data-access layer (`src/lib/access.ts`) takes the
  requesting session's role and destination-partner relationships and
  filters queries accordingly — a `PRIVATE_BUSINESS` row belonging to
  Business A is never returned to Business B, only to Business A and to
  destination-admin roles, and only ever surfaces to competitors in
  `AGGREGATED` form.
- **Role, by user.** Roles: `PUBLIC` (unauthenticated dashboard viewer),
  `PARTNER` (RotoruaNZ / DMO staff — full read, can run engines and
  imports), `BUSINESS` (an operator — can read aggregated + their own
  private rows, can contribute via Business Ecosystem Mode), `ADMIN` (can
  manage sources, users, destination config).

MVP ships the access-level filtering logic and the schema for it fully
implemented and unit-testable, but **not** a production auth system —
there's no real login UI. `src/lib/session.ts` defines the role/session
shape and a development-only header-based role switcher, with a clear
`TODO(auth)` marking where NextAuth/Clerk/SSO integration replaces it
before any real deployment. Shipping a bespoke auth system wasn't in scope
for this pass and doing it half-way would be worse than being explicit
that it's next.

## 7. Dashboard architecture

Next.js App Router, one `DashboardShell` layout with section navigation
matching the brief's Command Centre list. Each section is a server
component that queries Postgres directly (no separate API layer needed for
reads within the app) and renders:
- real charts/tables when observation rows exist for the current
  destination, or
- an explicit "Awaiting data — needs: `<DataSource>` connected or
  imported" empty state, never placeholder numbers.

The Executive Overview (home) answers the brief's mandated question
directly: a "What's happening" strip (real counts: sources connected,
rows imported, last AI-discovery run, days of weather/holiday data held)
and a "What to do next" list sourced from any `MarketOpportunity` /
`ProductGap` rows that exist, or an honest "connect data to generate
recommendations" state if none do.

## 8. MVP definition

**In scope, working, and tested in this build:**
- Full governed data model (Prisma schema, migrated on Postgres)
- CSV import pipeline with governance capture + validation
- Two real API connectors (weather, holidays) — code-complete, contract-
  correct, not runnable end-to-end in this sandbox (§3, `CONNECTOR_STATUS.md`)
- Access-level filtering logic
- Scenario Engine (mechanical mode always; LLM mode if a key is supplied)
- AI Discovery Engine runner + storage + results view
- Command Centre dashboard shell covering every section in the brief, each
  reading real data or showing an honest empty state
- Data governance / import admin screen showing every registered
  `DataSource` and `ImportBatch`

**Explicitly out of scope for this pass** (see roadmap, §12): production
auth, continuous/scheduled connector runs, social/search-trend listening,
Market Opportunity / Product Gap / Visitor Flow / Partnership / Itinerary
/ Campaign engine *logic* (schema + stub UI only, pending real observation
data to reason over), business ecosystem contribution UI beyond the data
model.

## 9. External APIs

| API | Purpose | Auth | Status |
|---|---|---|---|
| Open-Meteo | weather now/forecast | none | connector built, untested here (network policy) |
| Nager.Date | NZ public holidays | none | connector built, untested here |
| Anthropic API | Scenario Engine structuring, AI-discovery test calls | `ANTHROPIC_API_KEY` | wired, optional at runtime |
| MBIE / Stats NZ (IVS, accommodation survey) | visitor & accommodation stats | data-sharing agreement | not available to this session — manual import target |
| RotoruaNZ internal systems | visitor spend, DMO research | partner access | not available to this session — manual import target |
| Google Trends / search demand | demand signal | unofficial/paid | roadmap |
| Social listening (Reddit/YouTube/etc.) | demand signal | paid tooling | roadmap |

## 10. Data sources requiring manual import

RotoruaNZ visitor spend & population reports, MBIE regional tourism
estimates, Stats NZ International Visitor Survey extracts, accommodation
occupancy/forward-booking exports from PMS systems, event calendars not
published via a public API, business-submitted capacity/offers. All of
these go through `POST /api/import` with mandatory governance metadata —
none are pre-seeded with invented numbers.

## 11. What can be built immediately vs. not

Buildable now, no external dependency blocking it: the entire data model,
import pipeline, access-control logic, dashboard shell, Scenario Engine's
mechanical mode, AI Discovery Engine's storage/runner (execution needs a
key + network at run time, not at build time).

Blocked on external access this session doesn't have: live connector
execution (sandbox network policy), any MBIE/Stats NZ/RotoruaNZ live feed
(no credentials), continuous AI-discovery monitoring (needs a scheduler +
sustained API budget), social/search demand listening (needs paid tooling
or scraping decisions out of scope here).

## 12. Roadmap

1. Wire real auth (NextAuth or destination SSO), replace the dev role
   switcher.
2. Get live network access to Open-Meteo/Nager.Date in the deployed
   environment and confirm the two connectors end-to-end; add a scheduler
   (cron) for periodic refresh.
3. Establish data-sharing access to RotoruaNZ / MBIE / Stats NZ so
   `VisitorMetric` and `AccommodationMetric` carry real observations
   instead of sitting empty pending manual import.
4. Once real observation data exists, build out the Market Opportunity,
   Product Gap, Visitor Flow, Demand/Capacity Matching, Partnership,
   Itinerary, and Campaign engine logic against it (schema is ready now;
   logic against zero rows would just be invented output).
5. Add search/social demand listening connectors.
6. Move AI Discovery from manual run to scheduled, multi-model, trend-
   tracked.
7. Business Ecosystem Mode contribution UI (businesses submitting their
   own capacity/offers through the app rather than import-only).
8. Action Layer: turn engine output into draft campaign/content briefs,
   with an explicit approval gate before anything that spends money,
   publishes, or touches another organisation's data.
9. Second destination: prove the `src/config/destinations` separation by
   configuring a second NZ destination without touching engine code.
