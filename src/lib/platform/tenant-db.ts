// Tenant-scoped Prisma client — defence in depth for tenant isolation.
//
// Every service that touches tenant-owned data is handed `tenantDb(orgId)`
// rather than the global client. The extension below rewrites each query on
// a tenant-owned model so that:
//   - reads, updates and deletes are filtered by organizationId,
//   - creates are stamped with organizationId,
//   - any attempt to name a *different* organisation throws immediately.
//
// So even a service bug that forgets a `where: { organizationId }` cannot
// read or write another tenant's rows. (Prisma's types still require
// organizationId on creates; callers pass ctx.organization.id and the
// extension verifies it matches.) Limits (documented in
// docs/platform/SECURITY.md): raw SQL ($queryRaw) bypasses the extension and
// must be reviewed by hand; Postgres row-level security is planned as a
// further layer in Phase 6.

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export class TenantIsolationError extends Error {
  constructor(message: string) {
    super(`Tenant isolation violation: ${message}`);
    this.name = "TenantIsolationError";
  }
}

/** Models whose rows belong to exactly one organisation, keyed by organizationId. */
export const TENANT_MODELS = new Set<string>([
  "Membership",
  "License",
  "BusinessProfile",
  "Brand",
  "IntegrationConnection",
  "AuditEvent",
]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

type Obj = Record<string, unknown>;

function scopeWhere(where: unknown, field: string, orgId: string, model: string): Obj {
  const w = (where ?? {}) as Obj;
  if (field in w && w[field] !== orgId) {
    throw new TenantIsolationError(`${model} query targets a different organisation.`);
  }
  return { ...w, [field]: orgId };
}

function stampData(data: unknown, orgId: string, model: string): Obj {
  const d = (data ?? {}) as Obj;
  if ("organizationId" in d && d.organizationId !== orgId) {
    throw new TenantIsolationError(`${model} write targets a different organisation.`);
  }
  if ("organization" in d) {
    throw new TenantIsolationError(`${model} writes may not set the organization relation directly.`);
  }
  return { ...d, organizationId: orgId };
}

function guardUpdateData(data: unknown, field: string, orgId: string, model: string): void {
  const d = (data ?? {}) as Obj;
  if ((field in d && d[field] !== orgId) || "organization" in d) {
    throw new TenantIsolationError(`${model} update may not move a row to another organisation.`);
  }
}

export function scopeArgs(model: string, operation: string, args: unknown, orgId: string): unknown {
  const a = { ...((args ?? {}) as Obj) };

  if (model === "Organization") {
    if (CREATE_OPS.has(operation) || operation === "upsert") {
      throw new TenantIsolationError("organisations cannot be created through a tenant-scoped client.");
    }
    if (WHERE_OPS.has(operation)) a.where = scopeWhere(a.where, "id", orgId, model);
    if (operation.startsWith("update")) guardUpdateData(a.data, "id", orgId, model);
    return a;
  }

  if (!TENANT_MODELS.has(model)) return args;

  if (WHERE_OPS.has(operation)) {
    a.where = scopeWhere(a.where, "organizationId", orgId, model);
    if (operation.startsWith("update")) guardUpdateData(a.data, "organizationId", orgId, model);
  } else if (operation === "create") {
    a.data = stampData(a.data, orgId, model);
  } else if (operation === "createMany" || operation === "createManyAndReturn") {
    a.data = Array.isArray(a.data)
      ? a.data.map((d) => stampData(d, orgId, model))
      : stampData(a.data, orgId, model);
  } else if (operation === "upsert") {
    a.where = scopeWhere(a.where, "organizationId", orgId, model);
    a.create = stampData(a.create, orgId, model);
    guardUpdateData(a.update, "organizationId", orgId, model);
  } else {
    throw new TenantIsolationError(`operation ${operation} on ${model} is not supported by the tenant client.`);
  }
  return a;
}

export function tenantDb(organizationId: string) {
  if (!organizationId) throw new TenantIsolationError("missing organisation id.");
  return prisma.$extends(
    Prisma.defineExtension({
      name: "tenant-scope",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            return query(scopeArgs(model, operation, args, organizationId) as typeof args);
          },
        },
      },
    })
  );
}

export type TenantDb = ReturnType<typeof tenantDb>;
