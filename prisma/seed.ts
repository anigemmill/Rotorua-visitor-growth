// Seeds ONLY structural/reference data: the destination row itself and its
// experience-category taxonomy and tracked AI-discovery prompts, all pulled
// from src/config/destinations/rotorua.ts. Deliberately seeds zero
// observation rows (no visitor counts, no spend figures, no capacity) — see
// docs/ARCHITECTURE.md §1 and the brief's "never invent tourism statistics"
// rule. Real observations only enter via a connector run or a manual
// import.

import { PrismaClient } from "../src/generated/prisma";
import { rotorua } from "../src/config/destinations/rotorua";
import { retiredTourismPlans, tourismPlans, tourismProduct } from "./catalogue/tourism";

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

  await seedCatalogue();
}

// Licensed-platform catalogue (products, versions, plans). Upserts by key so
// re-running the seed applies edited commercial rules without touching
// licences already granted to customers.
async function seedCatalogue() {
  const { version, ...productData } = tourismProduct;
  const product = await prisma.product.upsert({
    where: { key: productData.key },
    update: productData,
    create: productData,
  });
  await prisma.productVersion.updateMany({ where: { productId: product.id }, data: { isCurrent: false } });
  await prisma.productVersion.upsert({
    where: { productId_version: { productId: product.id, version: version.version } },
    update: { releaseNotes: version.releaseNotes, isCurrent: true },
    create: { productId: product.id, ...version, isCurrent: true },
  });
  for (const plan of tourismPlans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { ...plan, productId: product.id },
      create: { ...plan, productId: product.id },
    });
  }
  for (const plan of retiredTourismPlans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: { ...plan, productId: product.id },
      create: { ...plan, productId: product.id },
    });
  }
  const known = [...tourismPlans, ...retiredTourismPlans].map((p) => p.key);
  const retired = await prisma.plan.updateMany({
    where: { productId: product.id, key: { notIn: known }, active: true },
    data: { active: false, isPublic: false },
  });
  console.log(
    `Seeded catalogue: ${product.name} with ${tourismPlans.length} plans` +
      (retired.count ? `; retired ${retired.count} plan(s) no longer in the catalogue.` : ".")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
