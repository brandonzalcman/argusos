import type { Position } from "geojson";

export type DistanceUnit = "meter" | "kilometer" | "foot" | "mile" | "nautical-mile";
export type AreaUnit = "square-meter" | "square-kilometer" | "hectare" | "acre";

export interface DistanceMeasurement {
  readonly kind: "distance";
  readonly value: number;
  readonly unit: DistanceUnit;
}

export interface AreaMeasurement {
  readonly kind: "area";
  readonly value: number;
  readonly unit: AreaUnit;
}

export type Measurement = DistanceMeasurement | AreaMeasurement;

export interface MeasurementPort {
  readonly measureDistance: (
    coordinates: readonly Position[],
    unit: DistanceUnit,
  ) => DistanceMeasurement;
  readonly measureArea: (ring: readonly Position[], unit: AreaUnit) => AreaMeasurement;
  readonly format: (measurement: Measurement) => string;
}

function measurementNotImplemented(method: string): never {
  throw new Error(`TODO(implementation): MeasurementPort.${method}`);
}

/**
 * TODO(implementation): calculate geodesic distance/area and locale-aware accessible labels.
 * Input: validated coordinates/rings and an explicit output unit.
 * Output: a throwing port; future output is a finite measurement and formatted label.
 * Errors: all methods throw TODO(implementation); future errors reject malformed/invalid geometry.
 * Depends on: a vetted geodesic geometry library and localization/number formatting.
 * Measurement is local and ephemeral; no coordinates or operational geometry are transmitted.
 */
export function createMeasurementPortStub(): MeasurementPort {
  return {
    measureDistance: () => measurementNotImplemented("measureDistance"),
    measureArea: () => measurementNotImplemented("measureArea"),
    format: () => measurementNotImplemented("format"),
  };
}
