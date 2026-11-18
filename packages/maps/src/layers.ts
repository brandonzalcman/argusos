import type { LayerSpecification } from "maplibre-gl";
import type { MapAuditContext, MapSecurityScope } from "./contracts.js";

export interface MapLibreLayerDefinition {
  /** ID of the shared @argus/schema map layer from which this renderer layer was compiled. */
  readonly definitionId: string;
  readonly id: string;
  readonly sourceId: string;
  readonly scope: MapSecurityScope;
  readonly audit: MapAuditContext;
  readonly visible: boolean;
  readonly specification: LayerSpecification;
}

export interface MapLayerPort {
  readonly upsert: (definition: MapLibreLayerDefinition) => void;
  readonly setVisibility: (layerId: string, visible: boolean, scope: MapSecurityScope) => void;
  readonly remove: (layerId: string, scope: MapSecurityScope) => void;
}

function layerNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): MapLayerPort.${method}`);
}

/**
 * TODO(implementation): validate, order, and synchronize MapLibre layers with scoped sources.
 * Input: versioned layer specifications, visibility, and tenant/incident security context.
 * Output: a throwing port; future implementations maintain layer lifecycle without data fetches.
 * Errors: all methods throw TODO(implementation); future errors reject invalid source/layer policy.
 * Depends on: MapAdapter, MapSourcePort, authorized style expressions, and field-level redaction.
 * Hidden sensitive attributes must be removed server-side, not merely hidden with paint properties.
 */
export function createMapLayerPortStub(): MapLayerPort {
  return {
    upsert: () => layerNotImplemented("upsert"),
    setVisibility: () => layerNotImplemented("setVisibility"),
    remove: () => layerNotImplemented("remove"),
  };
}
