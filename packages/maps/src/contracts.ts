import type { OperationContext } from "@argus/schema";

/** Server-established scope attached to every source, layer, draw commit, and tile request. */
export type MapSecurityScope = OperationContext;

export interface MapAuditContext {
  readonly correlationId: string;
  readonly definitionVersion: number;
}

export interface MapPoint {
  readonly longitude: number;
  readonly latitude: number;
  readonly zoom: number;
  readonly bearing: number;
  readonly pitch: number;
}

export interface MapBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export type Unsubscribe = () => void;

/** Endpoint metadata contains no credentials; authentication is attached by an authorized proxy. */
export interface AuthorizedMapEndpoint {
  readonly endpointId: string;
  readonly url: string;
  readonly expectedOrigin: string;
}
