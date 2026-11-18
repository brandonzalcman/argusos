import { createScaffoldFieldTypePlugin } from "../scaffold.js";

/** Later PostGIS geometry field with spatial filter and GiST index requirements. */
export const locationFieldTypePlugin = createScaffoldFieldTypePlugin({
  id: "location",
  displayName: "Location",
  description: "SRID 4326 point, line, polygon or explicitly configured geometry.",
  release: "later",
  postgresType: "geometry",
  filterOperators: ["equals", "intersects", "within", "is-empty", "is-not-empty"],
  formula: { usableAsInput: true, validResult: true, deterministic: true },
  location: { geometry: "geometry", supportsSpatialFilters: true, requiresSpatialIndex: true },
});
