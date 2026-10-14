"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireFounder } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { guarded } from "@/lib/actions";
import { f, parseForm, type ActionState } from "@/lib/forms";

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const founder = await requireFounder();
  const parsed = parseForm(
    z.object({
      name: f.str(), email: z.email({ error: "Enter a valid email" }).transform((e) => e.toLowerCase()),
      role: z.enum(["FOUNDER", "ADMIN", "OPERATOR"]), operatorId: f.optId(),
      password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
    }),
    fd
  );
  if (parsed.error) return parsed.error;
  const d = parsed.data;
  if (d.role === "OPERATOR" && !d.operatorId) return { error: "Operator users must be linked to their business." };
  if (d.role !== "OPERATOR" && d.operatorId) return { error: "Only operator users are linked to a business." };
  return guarded(async () => {
    const u = await prisma.user.create({ data: { name: d.name, email: d.email, role: d.role, operatorId: d.operatorId ?? null, passwordHash: await hashPassword(d.password) } });
    await audit(founder.id, "create", "user", u.id, `Created ${d.role} user ${d.email}`);
    revalidatePath("/settings/users");
    return { ok: `User created. Share the password with ${d.name} through a secure channel; they should change it on first use.` };
  });
}

export async function setUserActive(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const founder = await requireFounder();
  const active = fd.get("active") === "true";
  if (id === founder.id && !active) return { error: "You cannot deactivate your own account." };
  return guarded(async () => {
    await prisma.user.update({ where: { id }, data: { active } });
    if (!active) await prisma.authSession.deleteMany({ where: { userId: id } });
    await audit(founder.id, "update", "user", id, active ? "Reactivated user" : "Deactivated user and revoked sessions");
    revalidatePath("/settings/users");
    return { ok: active ? "Reactivated" : "Deactivated" };
  });
}

export async function resetPassword(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const founder = await requireFounder();
  const pw = String(fd.get("password") ?? "");
  if (pw.length < MIN_PASSWORD_LENGTH) return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  return guarded(async () => {
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw) } });
    await prisma.authSession.deleteMany({ where: { userId: id } });
    await audit(founder.id, "update", "user", id, "Password reset; sessions revoked");
    return { ok: "Password reset and existing sessions signed out." };
  });
}
