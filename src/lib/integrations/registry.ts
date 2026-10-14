// Operator data-source registry (ported from the Tourism Growth Intelligence
// prototype). Single source of truth for every "connected / not connected"
// label in the operator intelligence views.
//
// Difference from the prototype: the presence of credentials NEVER marks a
// source CONNECTED. A source is CONNECTED for an operator only when an
// IntegrationConnection row records a tested sync. For the pilot, the
// default path for every source is manual export / import.

import type { IntegrationStatus } from "@/generated/prisma";

export interface IntegrationDefinition {
  key: string;
  name: string;
  description: string;
  defaultStatus: IntegrationStatus;
  pilotPath: string; // how we get this data in the pilot without an integration
  requiresForLive: string; // what a live integration would need
}

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  { key: "booking_system", name: "Booking system", description: "Bookings, revenue, lead time, cancellations.", defaultStatus: "MANUAL_IMPORT", pilotPath: "Monthly CSV export from Rezdy / FareHarbor / Little Hotelier / RMS etc., recorded as measurements.", requiresForLive: "Per-platform API access authorised by the operator; not in phase 1 scope." },
  { key: "enquiries", name: "Enquiries (email / forms)", description: "Enquiry volume, topics, response time.", defaultStatus: "MANUAL_IMPORT", pilotPath: "Weekly count + top topics reported by the operator or sampled by staff.", requiresForLive: "Mailbox/CRM access with operator consent." },
  { key: "google_analytics", name: "Google Analytics (GA4)", description: "Website traffic, referrals, conversions.", defaultStatus: "MANUAL_IMPORT", pilotPath: "Operator shares a monthly GA4 report or grants read-only viewer access.", requiresForLive: "Google OAuth app + operator authorisation." },
  { key: "google_search_console", name: "Google Search Console", description: "Search queries, clicks, impressions.", defaultStatus: "MANUAL_IMPORT", pilotPath: "Monthly export by operator or read-only access.", requiresForLive: "Google OAuth app + operator authorisation." },
  { key: "google_business_profile", name: "Google Business Profile", description: "Listing accuracy, calls, direction requests.", defaultStatus: "NOT_CONNECTED", pilotPath: "Staff review listing accuracy during assessment.", requiresForLive: "Google Business Profile API + authorisation." },
  { key: "reviews", name: "Reviews (Google / TripAdvisor)", description: "Ratings, review themes, response rate.", defaultStatus: "MANUAL_IMPORT", pilotPath: "Staff sample recent reviews monthly; themes recorded as signals.", requiresForLive: "Reviews provider API key (paid) or platform APIs." },
  { key: "social", name: "Social channels", description: "Engagement, mentions, content performance.", defaultStatus: "NOT_CONNECTED", pilotPath: "Operator reports headline numbers if relevant to their roadmap.", requiresForLive: "Meta / TikTok app review + business account authorisation." },
  { key: "ai_discovery", name: "AI answer checks", description: "How AI assistants describe the operator and Rotorua.", defaultStatus: "MANUAL_IMPORT", pilotPath: "Manual runs of the 'AI answer accuracy check' prompt template; results recorded as signals/measurements.", requiresForLive: "LLM API keys + scheduled runner + budget; see destination AI Discovery module." },
  { key: "email_marketing", name: "Email marketing", description: "List size, campaign performance.", defaultStatus: "NOT_CONNECTED", pilotPath: "Operator reports campaign results for experiments.", requiresForLive: "Mailchimp / Klaviyo API key with operator consent." },
];

export function definitionFor(key: string) {
  return INTEGRATION_REGISTRY.find((d) => d.key === key);
}

/** Effective status: a recorded connection row wins over the default. */
export function effectiveStatus(def: IntegrationDefinition, row?: { status: IntegrationStatus } | null): IntegrationStatus {
  return row?.status ?? def.defaultStatus;
}

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  CONNECTED: "Connected (tested)",
  NOT_CONNECTED: "Not connected",
  MANUAL_IMPORT: "Manual export / entry",
  REQUIRES_API: "Requires API access",
  REQUIRES_USER_AUTH: "Requires operator authorisation",
};
