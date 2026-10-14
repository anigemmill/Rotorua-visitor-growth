// Destination reference data (Rotorua): the destination row, experience
// categories and tracked AI-discovery prompts. Structural only — no
// observations. See docs/ARCHITECTURE.md §1.

import type { PrismaClient } from "../../generated/prisma";
import { rotorua } from "../../config/destinations/rotorua";

export async function seedDestination(prisma: PrismaClient) {
  const destination = await prisma.destination.upsert({
    where: { slug: rotorua.slug },
    update: { name: rotorua.name, country: rotorua.country, lat: rotorua.lat, lng: rotorua.lng },
    create: { slug: rotorua.slug, name: rotorua.name, country: rotorua.country, lat: rotorua.lat, lng: rotorua.lng },
  });
  for (const category of rotorua.experienceCategories) {
    await prisma.experienceCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }
  for (const prompt of rotorua.trackedPrompts) {
    const existing = await prisma.trackedPrompt.findFirst({ where: { destinationId: destination.id, prompt: prompt.prompt } });
    if (!existing) {
      await prisma.trackedPrompt.create({ data: { destinationId: destination.id, prompt: prompt.prompt, category: prompt.category } });
    }
  }
  return { destination, categories: rotorua.experienceCategories.length, prompts: rotorua.trackedPrompts.length };
}
