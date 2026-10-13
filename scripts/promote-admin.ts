// Grants a platform role to an existing user. There is deliberately no web
// UI or sign-up path that can create platform staff.
//
//   npm run admin:promote -- someone@example.com SUPER_ADMIN
//   npm run admin:promote -- someone@example.com SUPPORT
//   npm run admin:promote -- someone@example.com NONE     (revoke)

import { PrismaClient, type PlatformRole } from "../src/generated/prisma";

const prisma = new PrismaClient();
const ROLES: PlatformRole[] = ["NONE", "SUPPORT", "SUPER_ADMIN"];

async function main() {
  const [emailArg, roleArg = "SUPER_ADMIN"] = process.argv.slice(2);
  if (!emailArg || !ROLES.includes(roleArg as PlatformRole)) {
    console.error("Usage: npm run admin:promote -- <email> [NONE|SUPPORT|SUPER_ADMIN]");
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();
  const user = await prisma.user.update({ where: { email }, data: { platformRole: roleArg as PlatformRole } });
  // Force re-login so the new role applies to fresh sessions only.
  await prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.auditEvent.create({
    data: { actorEmail: "cli", action: "admin.platform_role_changed", targetType: "User", targetId: user.id, metadata: { role: roleArg } },
  });
  console.log(`${email} is now ${roleArg}. Their existing sessions were signed out.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
