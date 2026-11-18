import { describe, it } from "vitest";

describe("API request authentication", () => {
  it.todo(
    "derives tenant and position only from verified Better Auth or scoped API-key credentials",
  );
  it.todo("rejects expired, revoked, disabled, and cross-tenant sessions without row enumeration");
  it.todo("revalidates active incident access and keeps live and exercise contexts separate");
  it.todo(
    "propagates request, user, position, tenant, and incident attribution to immutable audit records",
  );
  it.todo("requires MFA and session policy for privileged administration operations");
});
