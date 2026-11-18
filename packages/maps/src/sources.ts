import type { GeoJsonObject } from "geojson";
import type { AuthorizedMapEndpoint, MapSecurityScope } from "./contracts.js";

interface MapSourceBase {
  readonly id: string;
  readonly scope: MapSecurityScope;
}

export interface InlineGeoJsonSource extends MapSourceBase {
  readonly type: "geojson-inline";
  readonly data: GeoJsonObject;
}

export interface RemoteGeoJsonSource extends MapSourceBase {
  readonly type: "geojson-remote";
  readonly endpoint: AuthorizedMapEndpoint;
}

export interface VectorTileSource extends MapSourceBase {
  readonly type: "vector-tiles";
  readonly endpoint: AuthorizedMapEndpoint;
}

export interface RasterTileSource extends MapSourceBase {
  readonly type: "raster-tiles";
  readonly endpoint: AuthorizedMapEndpoint;
}

export type MapSourceDefinition =
  | InlineGeoJsonSource
  | RemoteGeoJsonSource
  | VectorTileSource
  | RasterTileSource;

export interface MapSourcePort {
  readonly upsert: (definition: MapSourceDefinition) => void;
  readonly remove: (sourceId: string, scope: MapSecurityScope) => void;
}

function sourceNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): MapSourcePort.${method}`);
}

/**
 * TODO(implementation): map validated source definitions to MapLibre sources through safe requests.
 * Input: inline GeoJSON or allowlisted remote endpoints with tenant/incident scope.
 * Output: a port whose upsert/remove methods throw until a MapAdapter-backed implementation exists.
 * Errors: every method throws TODO(implementation); future errors reject origin/scope mismatches.
 * Depends on: MapAdapter, schema validation, feed authorization, and request auditing.
 * Implementations must not embed credentials in source URLs or fetch unauthorized geometries.
 */
export function createMapSourcePortStub(): MapSourcePort {
  return {
    upsert: () => sourceNotImplemented("upsert"),
    remove: () => sourceNotImplemented("remove"),
  };
}
