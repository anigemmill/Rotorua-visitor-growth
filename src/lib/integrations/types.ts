// The contract every provider connector implements. Provider-specific code
// lives behind this interface so agents and workflows never depend on a
// provider's API shape — they read normalised observations from the shared
// data layer instead.
//
// Phase 1 ships the interface and the catalogue (registry.ts). Concrete
// connectors land from Phase 2 onwards (GA4, Search Console, website), each
// in src/lib/integrations/providers/<key>/.

import type { FeatureKey } from "@/lib/platform/entitlements";

export type ProviderKey =
  | "website"
  | "ga4"
  | "search_console"
  | "google_ads"
  | "meta_ads"
  | "instagram"
  | "facebook_pages"
  | "youtube"
  | "booking_rezdy"
  | "booking_csv";

export type AuthKind = "none" | "oauth2" | "api_key" | "file_upload";

export type ProviderAvailability =
  /** Customers can connect it today. */
  | "available"
  /** Designed, not built — shown in the catalogue with its planned phase. */
  | "planned";

export interface ProviderDefinition {
  key: ProviderKey;
  name: string;
  category: "website" | "analytics" | "search" | "advertising" | "social" | "booking";
  /** What the connection is for, in customer language. */
  purpose: string;
  /** Why it improves the ecosystem's output. */
  whyItMatters: string;
  /** Which agents consume its data (agent register keys). */
  usedBy: string[];
  auth: AuthKind;
  /** Exact scopes/permissions requested, shown before the customer connects. */
  permissions: string[];
  readOnly: boolean;
  feature: FeatureKey;
  availability: ProviderAvailability;
  plannedPhase: number;
  setupSteps: string[];
  limitations: string[];
  officialDocs: string[];
}

// ---------------------------------------------------------------------------
// Runtime connector contract (implemented from Phase 2)
// ---------------------------------------------------------------------------

export interface ExternalAccount {
  id: string;
  name: string;
  /** e.g. GA4 property time zone and currency — preserved, never normalised away. */
  attributes?: Record<string, string>;
}

export interface ValidationCheck {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface SyncWindow {
  from: Date;
  to: Date;
}

export interface SyncResult {
  rowsWritten: number;
  /** Opaque provider cursor for the next incremental sync. */
  cursor: string | null;
  /** Latest date the provider reports as complete (data freshness). */
  dataCompleteThrough: Date | null;
  warnings: string[];
}

export interface ConnectorContext {
  organizationId: string;
  connectionId: string;
  /** Decrypted only inside the connector, never logged or returned. */
  credentials: unknown;
  config: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Connector {
  definition: ProviderDefinition;
  /** OAuth: build the provider consent URL for a signed, single-use state value. */
  beginAuthorization?(input: { state: string; redirectUri: string }): URL;
  /** OAuth: exchange the code for tokens. Returns credentials to encrypt and store. */
  completeAuthorization?(input: { code: string; redirectUri: string }): Promise<{ credentials: unknown; scopesGranted: string[] }>;
  refreshCredentials?(ctx: ConnectorContext): Promise<unknown>;
  listAccounts(ctx: ConnectorContext): Promise<ExternalAccount[]>;
  /** Permission, data-availability and configuration checks (onboarding stage 4). */
  validate(ctx: ConnectorContext): Promise<ValidationCheck[]>;
  sync(ctx: ConnectorContext, window: SyncWindow, cursor: string | null): Promise<SyncResult>;
  /** Revoke tokens at the provider on disconnect. */
  revoke?(ctx: ConnectorContext): Promise<void>;
}

/** Errors connectors raise so the sync runner can decide retry vs. reconnect. */
export class ConnectorError extends Error {
  constructor(
    message: string,
    public readonly kind: "auth_revoked" | "permission_denied" | "rate_limited" | "quota_exhausted" | "transient" | "invalid_config",
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}
