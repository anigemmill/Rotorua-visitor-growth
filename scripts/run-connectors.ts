// Manual connector runner: `npm run connectors:run`
// Fetches from live external APIs and writes governed rows. Never invents
// data on failure — reports the error and moves on. See
// docs/ARCHITECTURE.md §4 and docs/CONNECTOR_STATUS.md.

import { prisma } from "../src/lib/prisma";
import { connectors } from "../src/lib/connectors";
import { getActiveDestinationConfig } from "../src/config/destinations";

async function main() {
  const config = getActiveDestinationConfig();
  const destination = await prisma.destination.findUnique({ where: { slug: config.slug } });
  if (!destination) {
    console.error(`Destination "${config.slug}" not seeded. Run \`npm run db:seed\` first.`);
    process.exit(1);
  }

  const ctx = {
    destinationId: destination.id,
    destinationSlug: destination.slug,
    lat: destination.lat,
    lng: destination.lng,
  };

  for (const connector of connectors) {
    process.stdout.write(`Running ${connector.name}... `);
    const result = await connector.run(ctx);
    if (result.ok) {
      console.log(`OK — ${result.rowsWritten} row(s) written.`);
    } else {
      console.log(`FAILED — ${result.error}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
