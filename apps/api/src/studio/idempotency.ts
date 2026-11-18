import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Transaction } from "../db/transaction.js";
import { apiError } from "../errors.js";
import { idempotencyKeys } from "../persistence/system-schema.js";

/** Deterministic JSON: object keys sorted recursively, `undefined` members dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, member]) => member !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`);
  return `{${entries.join(",")}}`;
}

/** SHA-256 (hex) of the canonical JSON of the input without its idempotency key. */
export function requestHash(input: { readonly idempotencyKey: string }): string {
  const { idempotencyKey: _ignored, ...rest } = input;
  return createHash("sha256").update(canonicalJson(rest)).digest("hex");
}

export type IdempotencyClaim =
  | { readonly replay: true; readonly response: unknown }
  | { readonly replay: false };

export interface IdempotencyScope {
  readonly tenantId: string;
  readonly userId: string;
}

/**
 * Claim `(tenant, user, key)` inside the mutation's transaction. The row is inserted first with a
 * placeholder response (so a concurrent request with the same key waits on the unique index and then
 * sees the committed row) and completed by {@link completeIdempotency} before commit. A failing
 * mutation rolls the claim back with everything else.
 */
export async function claimIdempotency(
  tx: Transaction,
  scope: IdempotencyScope,
  request: { readonly key: string; readonly operation: string; readonly hash: string },
): Promise<IdempotencyClaim> {
  const inserted = await tx
    .insert(idempotencyKeys)
    .values({
      tenantId: scope.tenantId,
      userId: scope.userId,
      key: request.key,
      operation: request.operation,
      requestHash: request.hash,
      response: {},
    })
    .onConflictDoNothing({
      target: [idempotencyKeys.tenantId, idempotencyKeys.userId, idempotencyKeys.key],
    })
    .returning({ id: idempotencyKeys.id });
  if (inserted.length > 0) return { replay: false };

  const [existing] = await tx
    .select({
      operation: idempotencyKeys.operation,
      requestHash: idempotencyKeys.requestHash,
      response: idempotencyKeys.response,
    })
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.tenantId, scope.tenantId),
        eq(idempotencyKeys.userId, scope.userId),
        eq(idempotencyKeys.key, request.key),
      ),
    )
    .limit(1);
  if (
    existing === undefined ||
    existing.operation !== request.operation ||
    existing.requestHash !== request.hash
  ) {
    throw apiError(
      "validation-failed",
      "The idempotency key was already used with different input.",
      {
        fieldErrors: { idempotencyKey: ["Idempotency key reused with different input."] },
      },
    );
  }
  return { replay: true, response: existing.response };
}

export async function completeIdempotency(
  tx: Transaction,
  scope: IdempotencyScope,
  key: string,
  response: unknown,
): Promise<void> {
  await tx
    .update(idempotencyKeys)
    .set({ response })
    .where(
      and(
        eq(idempotencyKeys.tenantId, scope.tenantId),
        eq(idempotencyKeys.userId, scope.userId),
        eq(idempotencyKeys.key, key),
      ),
    );
}
