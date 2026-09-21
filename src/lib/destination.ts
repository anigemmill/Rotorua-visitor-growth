import { prisma } from "@/lib/prisma";
import { getActiveDestinationConfig } from "@/config/destinations";

export async function getCurrentDestination() {
  const config = getActiveDestinationConfig();
  return prisma.destination.findUnique({ where: { slug: config.slug } });
}
