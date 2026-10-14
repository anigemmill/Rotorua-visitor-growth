import "server-only";
import { prisma } from "@/lib/prisma";

export async function opportunityOptions() {
  const rows = await prisma.opportunity.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true, operator: { select: { name: true } } },
  });
  return rows.map((r) => ({ value: r.id, label: `${r.title}${r.operator ? ` — ${r.operator.name}` : ""}` }));
}
