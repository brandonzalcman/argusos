import type { MapPoint } from "@argus/maps";
import type { MapDefinition, MapLayerDefinition } from "@argus/schema";

/** Initial camera from the shared definition, expressed with the @argus/maps contract. */
export function initialCamera(definition: MapDefinition): MapPoint {
  return {
    longitude: definition.center[0],
    latitude: definition.center[1],
    zoom: definition.zoom,
    bearing: 0,
    pitch: 0,
  };
}

export const layerSourceLabels: Record<MapLayerDefinition["source"]["type"], string> = {
  "board-records": "Board records",
  "vector-tiles": "Vector tiles",
  wms: "WMS",
  wfs: "WFS",
  "arcgis-rest": "ArcGIS REST",
  kml: "KML",
  geojson: "GeoJSON",
  "live-feed": "Live feed",
};

/** Initial visibility from the definition, overridden by the viewer's local toggles. */
export function visibleLayerIds(
  definition: MapDefinition,
  overrides: Readonly<Record<string, boolean>>,
): readonly string[] {
  return definition.layers
    .filter((layer) => overrides[layer.id] ?? layer.visible)
    .map((layer) => layer.id);
}

/** Layers at the back of the list render first (bottom); the panel lists top layer first. */
export function panelOrder(layers: readonly MapLayerDefinition[]): readonly MapLayerDefinition[] {
  return [...layers].reverse();
}
