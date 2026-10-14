import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewRecord, scopedWhere, visibilityChangeError, type Actor } from "./authz";
import { toCsv } from "./csv";

const founder: Actor = { id: "f", role: "FOUNDER", operatorId: null };
const opA: Actor = { id: "a", role: "OPERATOR", operatorId: "A" };
const unlinked: Actor = { id: "u", role: "OPERATOR", operatorId: null };

test("staff see everything; operators see own non-internal, shared, or their initiatives", () => {
  assert.ok(canViewRecord(founder, { operatorId: "B", visibility: "INTERNAL" }));
  assert.ok(canViewRecord(opA, { operatorId: "A", visibility: "CONFIDENTIAL" }));
  assert.ok(!canViewRecord(opA, { operatorId: "A", visibility: "INTERNAL" }));
  assert.ok(!canViewRecord(opA, { operatorId: "B", visibility: "CONFIDENTIAL" }));
  assert.ok(canViewRecord(opA, { operatorId: "B", visibility: "COHORT" }));
  assert.ok(canViewRecord(opA, { operatorId: null, visibility: "CONFIDENTIAL", initiativeOperatorIds: ["A", "B"] }));
  assert.ok(!canViewRecord(unlinked, { operatorId: null, visibility: "COHORT" }));
});

test("scopedWhere never returns an empty filter for operators", () => {
  assert.deepEqual(scopedWhere(founder), {});
  assert.deepEqual(scopedWhere(unlinked), { id: "__none__" });
  const w = scopedWhere(opA, { hasInitiative: true }) as { OR: unknown[] };
  assert.equal(w.OR.length, 3);
});

test("consent and cultural review gate wider sharing", () => {
  const none = { consentCohortSharing: false, consentAggregate: false, consentCaseStudy: false };
  const all = { consentCohortSharing: true, consentAggregate: true, consentCaseStudy: true };
  assert.equal(visibilityChangeError("CONFIDENTIAL", none), null);
  assert.match(visibilityChangeError("COHORT", none)!, /not consented/);
  assert.match(visibilityChangeError("AGGREGATE_APPROVED", none)!, /aggregate/);
  assert.match(visibilityChangeError("PUBLIC_APPROVED", { ...all, consentCaseStudy: false })!, /case-study/);
  assert.equal(visibilityChangeError("PUBLIC_APPROVED", all), null);
  assert.match(visibilityChangeError("COHORT", all, "REQUIRED")!, /Cultural review/);
  assert.equal(visibilityChangeError("COHORT", null), null);
});

test("CSV export escapes quotes and neutralises formula injection", () => {
  const csv = toCsv([{ a: 'He said "hi"', b: "=HYPERLINK(evil)", c: -5, d: ["x", "y"], e: null }]);
  assert.equal(csv, 'a,b,c,d,e\r\n"He said ""hi""",\'=HYPERLINK(evil),-5,x; y,\r\n');
});
