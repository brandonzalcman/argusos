import type {
  CelExpression,
  FieldDefinition,
  FieldTypeId,
  FilterOperator,
  OperationContext,
  TableDefinition,
} from "@argus/schema";
import type { z } from "zod";

/** Database affinity only. DDL identifiers, defaults, constraints and SQL text are planned by @argus/ddl-engine. */
export type PostgresDataType =
  | "boolean"
  | "date"
  | "double-precision"
  | "integer"
  | "bigint"
  | "jsonb"
  | "numeric"
  | "text"
  | "timestamp-with-time-zone"
  | "interval"
  | "uuid"
  | "geometry"
  | "bytea";

/** Structured, injection-safe input to DDL planning; this contract never accepts executable SQL defaults. */
export interface PostgresColumnPlan {
  dataType: PostgresDataType;
  nullable: boolean;
  isArray: boolean;
  precision: number | null;
  scale: number | null;
  geometry: "point" | "linestring" | "polygon" | "geometry" | null;
  srid: 4326 | null;
  generatedExpression: CelExpression | null;
}

/** Narrows the persisted field definition to the configuration owned by one plugin ID. */
export type FieldDefinitionFor<TId extends FieldTypeId> = Extract<FieldDefinition, { type: TId }>;

/** Input to column planning. Tenant and definition versions make every plan auditable and reproducible. */
export interface PostgresColumnPlanningContext<TId extends FieldTypeId = FieldTypeId> {
  operation: OperationContext;
  table: TableDefinition;
  field: FieldDefinitionFor<TId>;
  expectedTableVersion: number;
}

/** PostgreSQL planning port. Implementations return data-only plans and never mutate the database. */
export interface FieldPostgresContract<TId extends FieldTypeId = FieldTypeId> {
  dataType: PostgresDataType;
  /**
   * Plans a physical column for a field revision.
   * Input: authorized table/field context. Output: structured DDL plan. Errors: incompatible config/type.
   * Depends on @argus/ddl-engine for safe SQL generation and tenant-scoped migration execution.
   */
  planColumn(context: PostgresColumnPlanningContext<TId>): PostgresColumnPlan;
}

/** Validation context for create, update and import. Actor and tenant scope always come from the server. */
export interface FieldValidationContext<TId extends FieldTypeId = FieldTypeId> {
  operation: OperationContext;
  table: TableDefinition;
  field: FieldDefinitionFor<TId>;
  mode: "create" | "update" | "import";
  existingValue: unknown;
}

/** Zod validator factory port. Validators are side-effect free and do not perform authorization lookups. */
export interface FieldValidatorContract<TId extends FieldTypeId = FieldTypeId> {
  /**
   * Creates the field's runtime Zod validator.
   * Input: field config and validation mode. Output: a Zod schema for the canonical field value.
   * Errors: unsupported config or cross-field references. Depends on @argus/schema and @argus/expr as declared.
   */
  createValidator(context: FieldValidationContext<TId>): z.ZodType<unknown>;
}

/** Framework-neutral grid cell props consumed by a host-provided renderer; no React type enters this package. */
export interface FieldGridCellProps<TId extends FieldTypeId = FieldTypeId> {
  value: unknown;
  field: FieldDefinitionFor<TId>;
  recordId: string;
  recordVersion: number;
  readOnly: boolean;
  /**
   * Requests an optimistic field commit.
   * Input: canonical next value and displayed record version. Output: none. Errors are surfaced by the host.
   * Depends on the host API for authorization, incident scope, audit and stale-version conflict handling.
   */
  onCommit(nextValue: unknown, expectedVersion: number): void;
}

/** Framework-neutral form input props. Labels and errors must remain accessible in the host design system. */
export interface FieldFormInputProps<TId extends FieldTypeId = FieldTypeId>
  extends FieldGridCellProps<TId> {
  inputId: string;
  label: string;
  description: string | null;
  errors: readonly string[];
  autoFocus: boolean;
}

/**
 * Opaque component slot resolved by the web/mobile host or sandbox bridge.
 * `types` is a compile-time-only witness and is absent at runtime; it does not reference React.
 */
export interface FieldComponentSlot<TProps> {
  componentKey: string;
  slot: "grid-cell" | "form-input";
  runtime: "host" | "sandboxed-iframe";
  types?: { props: TProps };
}

export interface FieldComponentContracts<TId extends FieldTypeId = FieldTypeId> {
  gridCell: FieldComponentSlot<FieldGridCellProps<TId>>;
  formInput: FieldComponentSlot<FieldFormInputProps<TId>>;
}

/** Filter declaration. Query compilation must bind values and re-check field read permission. */
export interface FieldFilterDefinition {
  operator: FilterOperator;
}

/** Canonical import parser/export formatter ports. Parsing is all-or-nothing per cell and reports source location. */
export interface FieldImportExportContract<TId extends FieldTypeId = FieldTypeId> {
  /**
   * Parses one imported cell into a canonical value.
   * Input: source text and validation context. Output: canonical unknown value validated by the plugin.
   * Errors: invalid or unsafe input. Depends on the import job for column mapping, dry runs and audit.
   */
  parseImport(input: string, context: FieldValidationContext<TId>): unknown;
  /**
   * Formats a canonical value without exposing hidden or raw sensitive data.
   * Input: permission-filtered value and context. Output: export-safe string.
   * Errors: unsupported value shape. Depends on the export job for encoding and audit.
   */
  formatExport(value: unknown, context: FieldValidationContext<TId>): string;
}

/** Formula capabilities consumed by @argus/expr; it does not evaluate expressions itself. */
export interface FieldFormulaMetadata {
  usableAsInput: boolean;
  validResult: boolean;
  deterministic: boolean;
}

/** PostGIS capabilities and renderer-independent spatial behavior. */
export interface FieldLocationMetadata {
  geometry: "point" | "linestring" | "polygon" | "geometry";
  supportsSpatialFilters: boolean;
  requiresSpatialIndex: boolean;
}

/** Release metadata differentiating the first twelve Phase 1 types from later plan section 5.3 types. */
export interface FieldTypeMetadata<TId extends FieldTypeId = FieldTypeId> {
  id: TId;
  displayName: string;
  description: string;
  release: "core" | "later";
  planSection: "5.3";
}

/** Complete extension contract for one field type module. All operations run within authorized tenant scope. */
export interface FieldTypePlugin<TId extends FieldTypeId = FieldTypeId> {
  id: TId;
  metadata: FieldTypeMetadata<TId>;
  postgres: FieldPostgresContract<TId>;
  validator: FieldValidatorContract<TId>;
  components: FieldComponentContracts<TId>;
  filters: readonly FieldFilterDefinition[];
  importExport: FieldImportExportContract<TId>;
  formula: FieldFormulaMetadata | null;
  location: FieldLocationMetadata | null;
}

/** Discriminated union of plugins without unsafe parameter widening across different field configurations. */
export type AnyFieldTypePlugin = {
  [TId in FieldTypeId]: FieldTypePlugin<TId>;
}[FieldTypeId];
