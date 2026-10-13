import { execSync } from "node:child_process";

export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://app:app@localhost:5432/tourism_platform_test?schema=public";
  if (!/test/.test(url)) throw new Error("Refusing to run tests against a database whose name does not contain 'test'.");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
