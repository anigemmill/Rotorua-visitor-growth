import "server-only";
import { prisma } from "@/lib/prisma";

export async function experimentOptions(excludeId?: string) {
  const rows = await prisma.experiment.findMany({ where: excludeId ? { id: { not: excludeId } } : {}, orderBy: { createdAt: "desc" }, select: { id: true, title: true } });
  return rows.map((r) => ({ value: r.id, label: r.title }));
}
