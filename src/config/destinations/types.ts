export interface DestinationExperienceCategory {
  slug: string;
  name: string;
  description: string;
}

export interface DestinationTrackedPrompt {
  prompt: string;
  category: string;
}

export interface DestinationConfig {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  experienceCategories: DestinationExperienceCategory[];
  trackedPrompts: DestinationTrackedPrompt[];
  strategyReferences: string[];
}
