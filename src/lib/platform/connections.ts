// Connection centre service: list, configure and disconnect a tenant's
// integrations. OAuth connect flows arrive with their connectors in Phase 2;
// this module already enforces the licence gates and lifecycle rules they
// will share.

import { isIP } from "node:net";
import * as z from "zod";
import { getProvider, PROVIDERS } from "@/lib/integrations/registry";
import type { ProviderDefinition } from "@/lib/integrations/types";
import { recordAudit } from "./audit";
import { fieldErrors } from "./auth";
import { EntitlementError, NotFoundError, ValidationError } from "./errors";
import { assertFeature, assertWithinLimit, getLicenseState } from "./licensing";
import { requirePermission, type OrgContext } from "./organizations";

/**
 * Normalises user input ("https://www.Example.co.nz/about") to a bare public
 * hostname ("www.example.co.nz"). Rejects IP literals, localhost and single-
 * label names — the crawler must only ever fetch public websites (SSRF).
 * The crawler re-checks resolved addresses at fetch time (Phase 2).
 */
export function normaliseDomain(input: string): string {
  const raw = input.trim();
  if (!raw) throw new ValidationError("Enter your website's domain.", { domain: ["Enter your website's domain."] });
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    throw new ValidationError("That doesn't look like a website address.", { domain: ["Enter a domain like example.co.nz."] });
  }
  host = host.replace(/\.$/, "");
  const bad =
    !host ||
    host.length > 253 ||
    isIP(host.replace(/^\[|\]$/g, "")) !== 0 ||
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !/^[a-z0-9.-]+$/.test(host) ||
    host.split(".").some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"));
  if (bad) {
    throw new ValidationError("Enter a public website domain.", { domain: ["Enter a public domain like example.co.nz."] });
  }
  return host;
}

export interface ConnectionCentreEntry {
  provider: ProviderDefinition;
  includedInPlan: boolean;
  connections: {
    id: string;
    status: string;
    externalAccountId: string;
    externalAccountName: string | null;
    connectedAt: Date | null;
    lastSuccessfulSyncAt: Date | null;
    lastErrorMessage: string | null;
  }[];
}

export async function getConnectionCentre(ctx: OrgContext): Promise<ConnectionCentreEntry[]> {
  const state = await getLicenseState(ctx.db);
  const rows = await ctx.db.integrationConnection.findMany({
    where: { status: { not: "REVOKED" } },
    orderBy: { createdAt: "asc" },
    // Never select credentialsCiphertext for display paths.
    select: {
      id: true,
      providerKey: true,
      status: true,
      externalAccountId: true,
      externalAccountName: true,
      connectedAt: true,
      lastSuccessfulSyncAt: true,
      lastErrorMessage: true,
    },
  });
  return PROVIDERS.map((provider) => ({
    provider,
    includedInPlan: state.entitlements.features[provider.feature] === true,
    connections: rows.filter((r) => r.providerKey === provider.key),
  }));
}

async function activeConnectionCount(ctx: OrgContext): Promise<number> {
  return ctx.db.integrationConnection.count({ where: { status: { not: "REVOKED" } } });
}

export const WebsiteConnectionSchema = z.object({ domain: z.string().max(2048) });

export async function connectWebsite(ctx: OrgContext, input: z.input<typeof WebsiteConnectionSchema>) {
  requirePermission(ctx, "integrations.manage");
  const parsed = WebsiteConnectionSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Please check the highlighted fields.", fieldErrors(parsed.error));
  const domain = normaliseDomain(parsed.data.domain);

  const state = await getLicenseState(ctx.db);
  assertFeature(state, "integrations.website");

  const existing = await ctx.db.integrationConnection.findFirst({
    where: { providerKey: "website", externalAccountId: domain },
  });
  if (existing && existing.status !== "REVOKED") return existing;
  assertWithinLimit(state, "integrations", await activeConnectionCount(ctx));

  const data = {
    status: "PENDING" as const,
    externalAccountName: domain,
    config: { domain, crawl: { respectRobots: true } },
    connectedById: ctx.user.id,
    connectedAt: new Date(),
    disconnectedAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
  };
  const connection = existing
    ? await ctx.db.integrationConnection.update({ where: { id: existing.id }, data })
    : await ctx.db.integrationConnection.create({
        data: { ...data, organizationId: ctx.organization.id, providerKey: "website", externalAccountId: domain, scopesGranted: [] },
      });

  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "integration.connected",
    targetType: "IntegrationConnection",
    targetId: connection.id,
    metadata: { provider: "website", domain },
  });
  return connection;
}

/**
 * Disconnects an integration: credentials are destroyed immediately and the
 * row is kept (status REVOKED) so history and audit stay intact. From Phase 2
 * the connector's revoke() is called first to revoke tokens at the provider.
 */
export async function disconnectIntegration(ctx: OrgContext, connectionId: string) {
  requirePermission(ctx, "integrations.manage");
  const connection = await ctx.db.integrationConnection.findFirst({ where: { id: connectionId } });
  if (!connection || connection.status === "REVOKED") throw new NotFoundError("Connection not found.");

  await ctx.db.integrationConnection.update({
    where: { id: connection.id },
    data: { status: "REVOKED", credentialsCiphertext: null, scopesGranted: [], disconnectedAt: new Date() },
  });
  await recordAudit({
    actor: ctx.actor,
    organizationId: ctx.organization.id,
    action: "integration.disconnected",
    targetType: "IntegrationConnection",
    targetId: connection.id,
    metadata: { provider: connection.providerKey },
  });
}

/** Guard used by future OAuth start routes. */
export function assertProviderConnectable(key: string): ProviderDefinition {
  const provider = getProvider(key);
  if (!provider) throw new NotFoundError("Unknown integration.");
  if (provider.availability !== "available") {
    throw new EntitlementError(`${provider.name} is not available to connect yet (planned for phase ${provider.plannedPhase}).`);
  }
  return provider;
}
