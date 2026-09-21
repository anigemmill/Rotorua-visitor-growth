# Connector status

Honesty note, per the brief's "never build fake integrations" rule.

| Connector | API | Verified in this build? |
|---|---|---|
| Weather (`src/lib/connectors/weather.ts`) | Open-Meteo (`api.open-meteo.com`) | **No.** Code-complete against the real API contract, but this development sandbox's outbound network policy only allowlists a small set of hosts (npm, PyPI, api.anthropic.com, etc.) and returned `403` on every attempt to reach `api.open-meteo.com` during this build. |
| Public holidays (`src/lib/connectors/holidays.ts`) | Nager.Date (`date.nager.at`) | **No.** Same reason — `date.nager.at` is not on this sandbox's outbound allowlist. |

Both are free, keyless, well-documented public APIs. Nothing about them
requires credentials this project lacks — only outbound network access this
particular build sandbox didn't grant.

**To verify:** deploy the app (or run `npm run connectors:run` / call
`POST /api/connectors/run`) somewhere with normal outbound HTTPS. Each
connector reports `{ ok: false, error: "..." }` on failure rather than
writing invented rows, so a failed run is safe and visible — check the
Data Governance screen's `DataSource.connectorStatus` field (`CONNECTED` vs
`ERROR`) after running.

Do not mark these connectors "working" in any user-facing copy until they've
actually been run successfully outside this sandbox.
