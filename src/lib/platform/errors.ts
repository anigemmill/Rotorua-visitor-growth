// Typed domain errors. Services throw these; the web layer (server actions,
// route handlers, pages) maps them to user-facing messages or HTTP status
// codes. Messages are written to be safe to show to the customer — never put
// secrets, SQL or another tenant's identifiers in them.

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Caller is not signed in, or the session is invalid/expired. */
export class UnauthenticatedError extends DomainError {}

/** Caller is signed in but lacks the role/permission for this action. */
export class ForbiddenError extends DomainError {}

/**
 * Resource does not exist *or the caller may not know it exists*. Cross-
 * tenant lookups deliberately raise this rather than ForbiddenError so an
 * attacker cannot probe for other organisations' ids or slugs.
 */
export class NotFoundError extends DomainError {}

/** Input failed validation. */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {}
  ) {
    super(message);
  }
}

/** Licence does not permit this action (no licence, read-only, missing feature). */
export class EntitlementError extends DomainError {}

/** A plan limit (brands, users, integrations…) would be exceeded. */
export class LimitExceededError extends EntitlementError {
  constructor(
    public readonly limit: string,
    public readonly max: number
  ) {
    super(`Your plan allows up to ${max} ${limit}. Contact us to raise this limit.`);
  }
}

export class RateLimitedError extends DomainError {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many attempts. Please wait a few minutes and try again.");
  }
}

export class ConflictError extends DomainError {}
