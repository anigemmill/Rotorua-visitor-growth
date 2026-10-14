// Seeds ONLY structural/reference data: the destination row itself and its
// experience-category taxonomy and tracked AI-discovery prompts, all pulled
// from src/config/destinations/rotorua.ts. Deliberately seeds zero
// observation rows (no visitor counts, no spend figures, no capacity) — see
// docs/ARCHITECTURE.md §1 and the brief's "never invent tourism statistics"
// rule. Real observations only enter via a connector run or a manual
// import.

import { PrismaClient } from "../src/generated/prisma";
import { rotorua } from "../src/config/destinations/rotorua";
import { seedGrowthOs } from "./seed-growth-os";

const prisma = new PrismaClient();

async function main() {
  const destination = await prisma.destination.upsert({
    where: { slug: rotorua.slug },
    update: {
      name: rotorua.name,
      country: rotorua.country,
      lat: rotorua.lat,
      lng: rotorua.lng,
    },
    create: {
      slug: rotorua.slug,
      name: rotorua.name,
      country: rotorua.country,
      lat: rotorua.lat,
      lng: rotorua.lng,
    },
  });

  for (const category of rotorua.experienceCategories) {
    await prisma.experienceCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }

  for (const prompt of rotorua.trackedPrompts) {
    const existing = await prisma.trackedPrompt.findFirst({
      where: { destinationId: destination.id, prompt: prompt.prompt },
    });
    if (!existing) {
      await prisma.trackedPrompt.create({
        data: { destinationId: destination.id, prompt: prompt.prompt, category: prompt.category },
      });
    }
  }

  console.log(
    `Seeded destination "${destination.name}", ${rotorua.experienceCategories.length} experience categories, ${rotorua.trackedPrompts.length} tracked prompts.`
  );
  console.log("No observation data was seeded — see docs/ARCHITECTURE.md §1/§10 for how to add real data.");

  await seedGrowthOs(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
