import type { MapDefinition } from "@argus/schema";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type {
  MapAuditContext,
  MapBounds,
  MapPoint,
  MapSecurityScope,
  Unsubscribe,
} from "./contracts.js";

export interface MapLibreAdapterOptions {
  readonly container: HTMLElement;
  readonly definition: MapDefinition;
  readonly scope: MapSecurityScope;
  readonly audit: MapAuditContext;
  readonly style: StyleSpecification;
  readonly initialCamera: MapPoint;
  readonly maxBounds?: MapBounds;
}

export interface MapAdapter {
  readonly setCamera: (camera: MapPoint) => void;
  readonly fitBounds: (bounds: MapBounds) => void;
  readonly getCamera: () => MapPoint;
  readonly onIdle: (listener: () => void) => Unsubscribe;
  readonly destroy: () => void;
  /** Escape hatch for MapLibre APIs; callers remain responsible for scoped source/layer policy. */
  readonly unsafeMap: MapLibreMap;
}

/**
 * TODO(implementation): create and own a MapLibre instance with scoped request transformation.
 * Input: a DOM container, shared map definition, inline style/camera, and operation context.
 * Output: never returns in the scaffold; future output is a lifecycle-safe MapAdapter.
 * Errors: always throws TODO(implementation); future errors cover invalid styles and WebGL setup.
 * Depends on: maplibre-gl, authorized style/tile proxy, CSP, and map performance instrumentation.
 * No map, tile, style, glyph, sprite, or other network request is made by this stub.
 */
export function createMapLibreAdapter(_options: MapLibreAdapterOptions): MapAdapter {
  throw new Error("TODO(implementation): createMapLibreAdapter");
}
