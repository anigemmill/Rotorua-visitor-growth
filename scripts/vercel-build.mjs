// Vercel build entrypoint (package.json "vercel-build").
// Production deployments apply pending migrations first; if a migration
// fails, the build fails and the previous deployment stays live.
// Preview deployments never migrate.

import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const env = process.env.VERCEL_ENV ?? "development";

run("npx prisma generate");
if (env === "production") {
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    console.error("DATABASE_URL and DIRECT_URL must be set for production builds.");
    process.exit(1);
  }
  console.log("Applying database migrations (production)…");
  run("npx prisma migrate deploy");
} else {
  console.log(`Skipping migrations for VERCEL_ENV=${env}.`);
}
run("npx next build");
