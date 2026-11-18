import type { AuthorizedMapEndpoint, MapAuditContext, MapSecurityScope } from "./contracts.js";

export interface MartinTileSourceRequest {
  readonly scope: MapSecurityScope;
  readonly audit: MapAuditContext;
  readonly tableId: string;
  readonly endpoint: AuthorizedMapEndpoint;
  readonly allowedProperties: readonly string[];
}

export interface TileSourcePlan {
  readonly sourceId: string;
  readonly tileUrlTemplate: string;
  readonly scope: MapSecurityScope;
  readonly definitionVersion: number;
}

export interface TileSourcePort {
  readonly createMartinSource: (request: MartinTileSourceRequest) => TileSourcePlan;
}

/**
 * TODO(implementation): build tenant/incident-bound Martin tile templates via an authorized proxy.
 * Input: table identity, scoped audit/version metadata, allowlisted properties, and endpoint data.
 * Output: never returns in the scaffold; future output is a credential-free tile source plan.
 * Errors: always throws TODO(implementation); future errors reject cross-scope or sensitive fields.
 * Depends on: Martin/PostGIS authorization, RLS-compatible tile queries, and URL/origin validation.
 * This function does not fetch tiles. Credentials must never be interpolated into tile URL templates.
 */
export function createMartinTileSource(_request: MartinTileSourceRequest): TileSourcePlan {
  throw new Error("TODO(implementation): createMartinTileSource");
}

/**
 * TODO(implementation): expose Martin source planning behind the map source integration port.
 * Input: none at construction; callers supply a fully scoped MartinTileSourceRequest.
 * Output: a port delegating to the throwing source-planning stub.
 * Errors: createMartinSource throws TODO(implementation) and performs no network request.
 * Depends on: createMartinTileSource and the authorized tile proxy contract.
 */
export function createTileSourcePortStub(): TileSourcePort {
  return { createMartinSource: createMartinTileSource };
}
