export interface OpenApi31Document {
  readonly openapi: "3.1.0";
  readonly info: Readonly<Record<string, unknown>>;
  readonly paths: Readonly<Record<string, unknown>>;
  readonly components: Readonly<Record<string, unknown>>;
}

/**
 * TODO(implementation): generate the OpenAPI 3.1 integration document from route and Zod contracts.
 * Input: versioned REST route contracts and shared response/problem schemas.
 * Output: a deterministic OpenApi31Document with scoped security requirements and version headers.
 * Errors: throws for duplicate operation IDs, missing schemas, or inconsistent tenant/incident scope.
 * Depends on: REST_V1_ROUTES, Zod-to-JSON-Schema conversion, and API-key security scheme definitions.
 * Security: excludes internal-only procedures, secrets, sensitive field examples, and unreviewed endpoints.
 */
export function createOpenApiDocument(): OpenApi31Document {
  throw new Error("TODO(implementation): createOpenApiDocument");
}
