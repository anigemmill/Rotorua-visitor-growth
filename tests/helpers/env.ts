// Point every test at the dedicated test database. Never the dev database.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://app:app@localhost:5432/tourism_platform_test?schema=public";
// Fixed, test-only key ring (not a real secret).
process.env.CREDENTIAL_ENCRYPTION_KEYS =
  "1:" + Buffer.alloc(32, 1).toString("base64") + ",2:" + Buffer.alloc(32, 2).toString("base64");
