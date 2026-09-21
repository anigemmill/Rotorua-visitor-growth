import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { runAIDiscovery } from "@/lib/engine/ai-discovery";
import { getActiveDestinationConfig } from "@/config/destinations";

export async function POST() {
  const session = await getSession();
  if (session.role !== "PARTNER" && session.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Running the AI Discovery Engine requires a PARTNER or ADMIN session." },
      { status: 403 }
    );
  }

  const config = getActiveDestinationConfig();
  const destination = await prisma.destination.findUnique({ where: { slug: config.slug } });
  if (!destination) {
    return NextResponse.json({ error: "Destination not seeded." }, { status: 500 });
  }

  const result = await runAIDiscovery(destination.id, destination.name);
  return NextResponse.json(result);
}
