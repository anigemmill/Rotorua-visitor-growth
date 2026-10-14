# Dependency security review — 2026-10-13

Scope: every finding reported by `npm audit` on the Phase 1 tree. The
original report showed 11 (1 critical); adding Vitest raised it to 14 (3
critical, 10 high, 1 moderate) before this review.

**Result:** 0 vulnerabilities in production dependencies
(`npm audit --omit=dev`), 0 critical anywhere. 5 high-severity entries
remain, all one development-only chain with no published fix (§3).

CI enforces this: the pipeline fails on any critical finding, and on any
high or critical finding in production dependencies (see `.github/workflows/ci.yml`).

## 1. Findings, paths, exploitability and fixes

| Package (path) | Severity | Advisory | Exploitable here before the fix? | Fix applied |
|---|---|---|---|---|
| `next` 16.3.5 (direct) | critical | [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) RCE in `next/og` `ImageResponse` | No — the app does not import `next/og` | **next 16.3.8** (patch release in the same minor; advisory range is 16.0.0–16.3.7). 16.4.0 was not needed. |
| `next` | high | [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) SSRF in Image Optimization | Low — `/_next/image` exists, but no `remotePatterns` are configured | same |
| `next` | high | [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676), [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) SSG/ISR cache poisoning (self-hosted) | Low — every app route is dynamic; we will self-host, so patched | same |
| `next` | — | [GHSA-3w37-wq28-93x7](https://github.com/advisories/GHSA-3w37-wq28-93x7) `use cache` + Draft Mode leak; [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) metadata image routes; [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv) dev-server MCP endpoint | No — features unused / development server only | same |
| `sharp` 0.35.4 (via `next`) | high | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) librsvg | Low — SVG optimisation is off by default | **sharp 0.35.5** (within Next's `^0.35.4` range) |
| `source-map-js` 1.2.1 (via `postcss`, Tailwind) | high | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) event-loop DoS | No — build-time only, on our own sources | **1.2.2** |
| `tinypool` 1.1.1 (via `vitest` 3) | critical | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) prototype pollution → RCE | No — test runner only, never deployed | Removed: **vitest 4.1.11** has no tinypool dependency |
| `vitest` 3.2.x / `@vitest/mocker` (direct, dev) | critical / moderate | Path traversal in mocker; file read when Vitest UI server is listening | No — dev only; UI server never run | **vitest 4.1.11** (above the affected `<=4.1.10`). Vitest 5 was not required. |
| `deepmerge-ts` 7.1.5 (via `prisma` → `@prisma/config`) | high | [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) stack exhaustion merging recursive objects | No — only merges our own Prisma config, in the CLI | npm `overrides` → **deepmerge-ts ^8.0.2**. `npm audit fix --force` proposed *downgrading* Prisma to 6.12.0, and every Prisma release up to 8.1.0-dev is in the affected range, so the override is the least disruptive fix. Verified: `prisma generate`, `validate`, `migrate deploy` and seeding all work. |
| `prisma` CLI | — | (as above) | — | Moved from `dependencies` to `devDependencies`: it's build/deploy tooling, not runtime |

## 2. Regression testing after the changes

Clean `npm ci` (npm 10) → `prisma generate` → 72 unit/integration tests →
ESLint → `tsc --noEmit` → `next build` → browser smoke test. All passed.

Tooling note: npm 10.9's resolver crashes (`Cannot read properties of null
(reading 'edgesOut')`) when it computes the Vitest 4 peer set. The lockfile
was resolved with npm 11 and verified with `npm ci` on npm 10, which is what
CI runs.

## 3. Remaining exposure (reviewed exception)

| Chain | Severity | Why it remains | Exposure | Mitigation / exit |
|---|---|---|---|---|
| `braces` ≤3.0.3 ← `micromatch` ← `fast-glob` 3.3.1 ← `@next/eslint-plugin-next` ← `eslint-config-next` (5 audit entries) | high ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack-exhaustion DoS from deeply nested patterns) | No fixed `braces` has been published (3.0.3 is the latest and is affected); the only `npm audit` "fix" is downgrading to Next 14's ESLint config | **None in production**: ESLint only, on developer machines and in CI, with glob patterns that we write. Not in the deployed bundle (`npm audit --omit=dev` is clean). | Accepted as a dev-only exception. CI ignores high-severity findings in dev-only dependencies but still fails on any critical. Dependabot will open a PR once a fixed `braces` or `fast-glob` is published. Review again by 2026-11-13. |

## 4. Policy going forward

- CI fails on any **critical** finding, and on any **high or critical** in
  production dependencies.
- Weekly Dependabot PRs for npm and GitHub Actions.
- No `npm audit fix --force`. Each major upgrade gets its own PR with the full test suite.
- Any exception is recorded in this file with an expiry date.
