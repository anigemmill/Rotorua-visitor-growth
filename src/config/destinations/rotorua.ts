// Destination-specific configuration for Rotorua, New Zealand.
//
// This file is the ONLY place Rotorua-specific facts should live. Every
// engine and dashboard section under src/lib/engine and src/app reads its
// subject destination from this config (or a future sibling file), never
// from hardcoded strings — that's what makes a second destination a config
// addition rather than a fork. See docs/ARCHITECTURE.md.

import type { DestinationConfig } from "./types";

export const rotorua: DestinationConfig = {
  slug: "rotorua",
  name: "Rotorua",
  country: "New Zealand",
  lat: -38.1368,
  lng: 176.2497,

  // Reference categories the Experience/Product-Gap engines classify against.
  // These are structural/reference data (a taxonomy), not observations —
  // they carry no visitor numbers.
  experienceCategories: [
    { slug: "geothermal", name: "Geothermal", description: "Hot springs, mud pools, geysers, spa & wellness geothermal experiences" },
    { slug: "maori-culture", name: "Māori Culture", description: "Cultural performances, marae visits, hangi, storytelling" },
    { slug: "adventure", name: "Adventure", description: "Mountain biking, ziplining, luge, white-water rafting" },
    { slug: "nature", name: "Nature", description: "Redwoods, lakes, walking and forest experiences" },
    { slug: "wellness", name: "Wellness", description: "Spa, thermal bathing, retreats" },
    { slug: "food-beverage", name: "Food & Beverage", description: "Restaurants, cafes, breweries, food experiences" },
    { slug: "events", name: "Events", description: "Festivals, sporting events, conferences" },
    { slug: "family", name: "Family", description: "Family-oriented attractions and activities" },
    { slug: "retail", name: "Retail", description: "Shopping and artisan/craft retail" },
    { slug: "nightlife-evening", name: "Nightlife & Evening", description: "Evening dining, entertainment, bars" },
  ],

  // The AI Destination Discovery Engine's tracked prompt bank — the exact
  // questions the brief specifies plus a couple of Rotorua-relevant variants.
  // Adding/removing prompts here changes what gets tracked without touching
  // engine code.
  trackedPrompts: [
    { prompt: "Best places to visit in New Zealand", category: "general" },
    { prompt: "Best things to do in Rotorua", category: "general" },
    { prompt: "Best New Zealand destinations for adventure", category: "adventure" },
    { prompt: "Best family destinations in New Zealand", category: "family" },
    { prompt: "Best Māori cultural experiences in New Zealand", category: "cultural" },
    { prompt: "Best geothermal experiences", category: "cultural" },
    { prompt: "Best wellness destinations in New Zealand", category: "wellness" },
    { prompt: "Where should I go between Auckland and Taupō?", category: "itinerary" },
    { prompt: "How long should I spend in Rotorua?", category: "itinerary" },
  ],

  // Free-text pointer to the destination's own published strategy, so
  // engines/recommendations can be checked against it rather than optimising
  // for volume alone (brief: "Never assume more visitors = better outcome").
  strategyReferences: [
    "RotoruaNZ Destination Management Plan (import via Data Governance once obtained)",
  ],
};
