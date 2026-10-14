-- Lock down Supabase's auto-generated Data API (PostgREST).
--
-- Supabase exposes every table in the public schema over its REST/GraphQL
-- API to anyone holding the project's public "anon" key. This application
-- never uses that API: it connects through Prisma as the table OWNER, and
-- owners bypass row-level security. Enabling RLS with no policies therefore
-- denies all rows to the anon/authenticated API roles while leaving the app
-- untouched. Harmless on plain Postgres (local dev, CI).
--
-- Every future migration that creates a table must also enable RLS on it;
-- tests/integration/rls.test.ts fails if any table is missing it.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
