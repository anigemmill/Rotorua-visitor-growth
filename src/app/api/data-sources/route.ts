import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveDestinationConfig } from "@/config/destinations";

export async function GET() {
  const destinationConfig = getActiveDestinationConfig();
  const destination = await prisma.destination.findUnique({
    where: { slug: destinationConfig.slug },
  });
  if (!destination) {
    return NextResponse.json({ dataSources: [], importBatches: [] });
  }

  const [dataSources, importBatches] = await Promise.all([
    prisma.dataSource.findMany({
      where: { destinationId: destination.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.importBatch.findMany({
      where: { destinationId: destination.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { dataSource: true },
    }),
  ]);

  return NextResponse.json({ dataSources, importBatches });
}
