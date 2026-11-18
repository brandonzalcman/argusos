# @argus/maps

MapLibre/Martin integration contracts only. All factories are throwing `TODO(implementation)` stubs and no style, tile, feed, or other network call is made.

## Implementation order

1. Define the same-origin authorized map proxy, endpoint allowlists, CSP, credential handling, and scoped request transformation. The adapter already accepts the shared `@argus/schema` map definition and operation context.
2. Implement the MapLibre lifecycle adapter, then inline GeoJSON sources, layers, and incident-switch cleanup. Remove unauthorized properties server-side.
3. Implement Martin/PostGIS tile plans with tenant/incident authorization and field allowlists; never put credentials or sensitive attributes in URLs.
4. Add external WMS/WFS/GeoJSON/ArcGIS/KML/feed adapters through the source contract, with health and freshness metadata.
5. Add accessible drawing, audited optimistic PostGIS commits, geodesic measurement, annotations, print, and performance instrumentation.

`unsafeMap` is an explicit escape hatch for MapLibre-only features; it does not relax source, layer, tenant, incident, or field-security obligations.
