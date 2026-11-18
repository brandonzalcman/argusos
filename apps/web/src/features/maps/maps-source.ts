import type { MapDefinition } from "@argus/schema";
import type { AppScope } from "../../services/contracts.js";

export interface MapsSource {
  /** Maps the caller's position may view; layer access is re-checked per layer server-side. */
  readonly listMaps: (scope: AppScope) => Promise<readonly MapDefinition[]>;
}

/**
 * TODO(implementation): list authorized map definitions and their layers.
 * Input: AppScope for the active tenant and incident.
 * Output: MapDefinition rows with only the layers the position may see.
 * Errors: rejects when unauthorized or out of scope.
 * Depends on: apps/api map routes, the `maps` Electric shape and Martin/PostGIS layer sources.
 */
export const mapsSourceStub: MapsSource = {
  listMaps: () => Promise.reject(new Error("TODO(implementation): MapsSource.listMaps")),
};
