import { createMapLibreAdapter, type MapAdapter, type MapLibreAdapterOptions } from "@argus/maps";
import type { MapDefinition } from "@argus/schema";
import { type RefObject, useEffect, useState } from "react";
import { useActiveScope } from "../live-data/active-scope.js";
import { initialCamera } from "./layers.js";
import { mapAudit, toMapSecurityScope, useMapSession } from "./map-security-scope.js";

export type MapRendererState =
  | { readonly status: "idle" }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "ready"; readonly adapter: MapAdapter };

/** Style with no sources or layers, so creating the map triggers no tile, glyph or sprite request. */
const blankStyle: MapLibreAdapterOptions["style"] = { version: 8, sources: {}, layers: [] };

/**
 * Creates and owns the MapLibre adapter for a definition, behind the scope check.
 * Input: the container ref, the active definition (null when none exists) and nothing else; scope
 * and session come from providers.
 * Output: idle without a definition; unavailable with a reason when scope/session/renderer is
 * missing (including the adapter still being a TODO stub); ready with the adapter otherwise.
 * Errors: adapter construction errors are caught and reported as unavailable.
 * Depends on: @argus/maps createMapLibreAdapter, useActiveScope, useMapSession.
 * TODO(implementation): supply an authorized style via the style proxy instead of blankStyle.
 */
export function useMapAdapter(
  containerRef: RefObject<HTMLElement | null>,
  definition: MapDefinition | null,
): MapRendererState {
  const scope = useActiveScope();
  const session = useMapSession();
  const [state, setState] = useState<MapRendererState>({ status: "idle" });

  useEffect(() => {
    const container = containerRef.current;
    if (definition === null || container === null) {
      setState({ status: "idle" });
      return;
    }
    const requestId = crypto.randomUUID();
    const securityScope = toMapSecurityScope(scope, session, requestId);
    if (securityScope === null) {
      setState({
        status: "unavailable",
        reason: "Map renderer is off: no authenticated scope and session are available.",
      });
      return;
    }
    let adapter: MapAdapter | undefined;
    try {
      adapter = createMapLibreAdapter({
        container,
        definition,
        scope: securityScope,
        audit: mapAudit(definition.version, requestId),
        style: blankStyle,
        initialCamera: initialCamera(definition),
      });
      setState({ status: "ready", adapter });
    } catch (error) {
      setState({
        status: "unavailable",
        reason: `Map renderer is not available: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }
    return () => adapter?.destroy();
  }, [containerRef, definition, scope, session]);

  return state;
}
