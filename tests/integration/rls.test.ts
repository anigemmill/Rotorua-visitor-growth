// Guards the Supabase Data API lockdown (prisma/migrations/*_enable_rls):
// every application table must have row-level security enabled, so a table
// added by a future migration without it fails CI.

import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";

after(() => prisma.$disconnect());

test("row-level security is enabled on every table", async () => {
  const rows = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relkind = 'r'`;
  assert.ok(rows.length > 50, "expected the application tables to exist");
  const missing = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
  assert.deepEqual(missing, [], `Tables without RLS: ${missing.join(", ")}`);
});
