import { rotorua } from "./rotorua";
import type { DestinationConfig } from "./types";

export type { DestinationConfig } from "./types";

const registry: Record<string, DestinationConfig> = {
  [rotorua.slug]: rotorua,
};

// Single-destination MVP: env var selects the active destination so the
// rest of the app never hardcodes "rotorua" outside this module.
const ACTIVE_DESTINATION_SLUG = process.env.ACTIVE_DESTINATION ?? "rotorua";

export function getActiveDestinationConfig(): DestinationConfig {
  const config = registry[ACTIVE_DESTINATION_SLUG];
  if (!config) {
    throw new Error(
      `No destination config registered for slug "${ACTIVE_DESTINATION_SLUG}"`
    );
  }
  return config;
}

export function getAllDestinationConfigs(): DestinationConfig[] {
  return Object.values(registry);
}
