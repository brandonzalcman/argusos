import type { FieldTypeId, FilterOperator } from "@argus/schema";
import type {
  FieldFormulaMetadata,
  FieldLocationMetadata,
  FieldTypePlugin,
  PostgresDataType,
} from "./contract.js";

/** Declarative metadata accepted by the scaffold factory; behavioral ports are deliberately left unimplemented. */
export interface ScaffoldFieldTypeSpec<TId extends FieldTypeId> {
  id: TId;
  displayName: string;
  description: string;
  release: "core" | "later";
  postgresType: PostgresDataType;
  filterOperators: readonly FilterOperator[];
  formula: FieldFormulaMetadata | null;
  location: FieldLocationMetadata | null;
}

/**
 * TODO(implementation): replace the named field-type behavior with its module-specific implementation.
 * Input: stable behavior name. Output: never. Errors: always throws TODO(implementation).
 * Depends on the owning field-type module for a later implementation.
 */
function unimplemented(behavior: string): never {
  throw new Error(`TODO(implementation): field-type ${behavior}`);
}

/**
 * Declares a field-type plugin while making every behavioral gap fail explicitly.
 * Input: metadata, PostgreSQL affinity, filters and formula/location capabilities. Output: a typed plugin whose
 * planning, validation, import and export methods throw. Errors: duplicate IDs are handled by the registry.
 * Depends on host component resolvers and future module implementations; this factory performs no validation,
 * SQL generation, rendering, I/O or business logic.
 */
export function createScaffoldFieldTypePlugin<const TId extends FieldTypeId>(
  spec: ScaffoldFieldTypeSpec<TId>,
): FieldTypePlugin<TId> {
  return {
    id: spec.id,
    metadata: {
      id: spec.id,
      displayName: spec.displayName,
      description: spec.description,
      release: spec.release,
      planSection: "5.3",
    },
    postgres: {
      dataType: spec.postgresType,
      planColumn: () => unimplemented(`${spec.id}.postgres.planColumn`),
    },
    validator: {
      createValidator: () => unimplemented(`${spec.id}.validator.createValidator`),
    },
    components: {
      gridCell: {
        componentKey: `field.${spec.id}.grid-cell`,
        slot: "grid-cell",
        runtime: "host",
      },
      formInput: {
        componentKey: `field.${spec.id}.form-input`,
        slot: "form-input",
        runtime: "host",
      },
    },
    filters: spec.filterOperators.map((operator) => ({ operator })),
    importExport: {
      parseImport: () => unimplemented(`${spec.id}.importExport.parseImport`),
      formatExport: () => unimplemented(`${spec.id}.importExport.formatExport`),
    },
    formula: spec.formula,
    location: spec.location,
  };
}
