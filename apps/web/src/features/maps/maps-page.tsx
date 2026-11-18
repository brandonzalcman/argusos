import type { MapDefinition } from "@argus/schema";
import { Checkbox, EmptyState, PageContainer, PageHeader, Panel } from "@argus/ui";
import { type ReactElement, useRef, useState } from "react";
import { useFeatureSources } from "../live-data/feature-sources.js";
import { LiveStatus } from "../live-data/live-status.js";
import { QueryBoundary } from "../live-data/query-boundary.js";
import { useScopedLiveQuery } from "../live-data/use-scoped-live-query.js";
import { initialCamera, layerSourceLabels, panelOrder, visibleLayerIds } from "./layers.js";
import type { MapsSource } from "./maps-source.js";
import { useMapAdapter } from "./use-map-adapter.js";

export interface MapsPageProps {
  readonly source?: MapsSource;
}

/**
 * Maps: a MapLibre container, layer panel and an empty state until a definition exists.
 * Input: optional source override; defaults to the injected FeatureSources maps port.
 * Output: the map region and layer panel for the first authorized map definition.
 * Errors: load failures render the error state with retry; the renderer reports itself unavailable
 * (never a blank canvas) when scope, session or the adapter is missing.
 * Depends on: MapsSource and @argus/maps createMapLibreAdapter via useMapAdapter.
 */
export function MapsPage({ source: sourceOverride }: MapsPageProps): ReactElement {
  const injected = useFeatureSources().maps;
  const source = sourceOverride ?? injected;
  const { state, isLive } = useScopedLiveQuery<MapDefinition>({
    queryKey: ["maps"],
    tableId: "maps",
    requiredPermissions: ["map:read"],
    load: source.listMaps,
  });
  return (
    <PageContainer width="wide">
      <PageHeader
        title="Maps"
        description="Operational layers for the active incident."
        meta={<LiveStatus isLive={isLive} />}
      />
      <QueryBoundary
        state={state}
        label="maps"
        empty={{
          title: "No map published",
          description:
            "No map has been published for this incident yet. Layers appear here once a map definition exists.",
        }}
      >
        {(maps) => <MapWorkspace definition={maps[0] as MapDefinition} />}
      </QueryBoundary>
    </PageContainer>
  );
}

function MapWorkspace({ definition }: { readonly definition: MapDefinition }): ReactElement {
  const [overrides, setOverrides] = useState<Readonly<Record<string, boolean>>>({});
  const visible = visibleLayerIds(definition, overrides);
  return (
    <div className="grid gap-(--argus-gap) lg:grid-cols-[minmax(0,1fr)_18rem]">
      <MapContainer definition={definition} visible={visible} />
      <LayerPanel
        definition={definition}
        visible={visible}
        onToggle={(layerId, next) => setOverrides({ ...overrides, [layerId]: next })}
      />
    </div>
  );
}

function MapContainer({
  definition,
  visible,
}: {
  readonly definition: MapDefinition;
  readonly visible: readonly string[];
}): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderer = useMapAdapter(containerRef, definition);
  const camera = initialCamera(definition);
  return (
    <Panel title={definition.name} flush>
      <section aria-label="Operational map" className="relative">
        <div
          ref={containerRef}
          data-map-container=""
          data-camera={JSON.stringify(camera)}
          className="h-[28rem] w-full bg-surface-sunken"
        />
        {renderer.status === "ready" ? null : (
          <div className="absolute inset-0 grid place-items-center p-4">
            <EmptyState
              size="inline"
              title="Map renderer not connected"
              description={
                renderer.status === "unavailable"
                  ? `${renderer.reason} (${visible.length} of ${definition.layers.length} layers selected.)`
                  : "Starting the map renderer."
              }
            />
          </div>
        )}
      </section>
    </Panel>
  );
}

function LayerPanel({
  definition,
  visible,
  onToggle,
}: {
  readonly definition: MapDefinition;
  readonly visible: readonly string[];
  readonly onToggle: (layerId: string, visible: boolean) => void;
}): ReactElement {
  return (
    <Panel title="Layers" headingLevel={2}>
      {definition.layers.length === 0 ? (
        <p className="text-fg-muted">This map has no layers yet.</p>
      ) : (
        <ul className="grid gap-2">
          {panelOrder(definition.layers).map((layer) => (
            <li key={layer.id}>
              <Checkbox
                label={layer.name}
                description={layerSourceLabels[layer.source.type]}
                checked={visible.includes(layer.id)}
                onCheckedChange={(checked) => onToggle(layer.id, checked === true)}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
