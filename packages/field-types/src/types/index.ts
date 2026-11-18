import type { CoreFieldTypeId, LaterFieldTypeId } from "@argus/schema";
import type { AnyFieldTypePlugin } from "../contract.js";
import { attachmentFieldTypePlugin } from "./attachment.js";
import { autoNumberFieldTypePlugin } from "./auto-number.js";
import { booleanFieldTypePlugin } from "./boolean.js";
import { currencyFieldTypePlugin } from "./currency.js";
import { dateFieldTypePlugin } from "./date.js";
import { dateTimeFieldTypePlugin } from "./date-time.js";
import { durationFieldTypePlugin } from "./duration.js";
import { emailFieldTypePlugin } from "./email.js";
import { formulaFieldTypePlugin } from "./formula.js";
import { jsonFieldTypePlugin } from "./json.js";
import { linkToRecordFieldTypePlugin } from "./link-to-record.js";
import { locationFieldTypePlugin } from "./location.js";
import { longTextFieldTypePlugin } from "./long-text.js";
import { lookupFieldTypePlugin } from "./lookup.js";
import { multiSelectFieldTypePlugin } from "./multi-select.js";
import { numberFieldTypePlugin } from "./number.js";
import { percentFieldTypePlugin } from "./percent.js";
import { phoneFieldTypePlugin } from "./phone.js";
import { positionFieldTypePlugin } from "./position.js";
import { rollupFieldTypePlugin } from "./rollup.js";
import { signatureFieldTypePlugin } from "./signature.js";
import { singleSelectFieldTypePlugin } from "./single-select.js";
import { statusFieldTypePlugin } from "./status.js";
import { textFieldTypePlugin } from "./text.js";
import { urlFieldTypePlugin } from "./url.js";
import { userFieldTypePlugin } from "./user.js";

/** Core plugin union preserving each module's exact field definition and behavior parameter types. */
export type CoreFieldTypePlugin = Extract<AnyFieldTypePlugin, { id: CoreFieldTypeId }>;
/** Later plugin union preserving each module's exact field definition and behavior parameter types. */
export type LaterFieldTypePlugin = Extract<AnyFieldTypePlugin, { id: LaterFieldTypeId }>;

export * from "./attachment.js";
export * from "./auto-number.js";
export * from "./boolean.js";
export * from "./currency.js";
export * from "./date.js";
export * from "./date-time.js";
export * from "./duration.js";
export * from "./email.js";
export * from "./formula.js";
export * from "./json.js";
export * from "./link-to-record.js";
export * from "./location.js";
export * from "./long-text.js";
export * from "./lookup.js";
export * from "./multi-select.js";
export * from "./number.js";
export * from "./percent.js";
export * from "./phone.js";
export * from "./position.js";
export * from "./rollup.js";
export * from "./signature.js";
export * from "./single-select.js";
export * from "./status.js";
export * from "./text.js";
export * from "./url.js";
export * from "./user.js";

/** The exact twelve Phase 1 core plugins, in product plan section 5.3 order. */
export const coreFieldTypePlugins = [
  textFieldTypePlugin,
  longTextFieldTypePlugin,
  numberFieldTypePlugin,
  currencyFieldTypePlugin,
  percentFieldTypePlugin,
  dateFieldTypePlugin,
  dateTimeFieldTypePlugin,
  durationFieldTypePlugin,
  booleanFieldTypePlugin,
  singleSelectFieldTypePlugin,
  multiSelectFieldTypePlugin,
  userFieldTypePlugin,
] as const;

/** Later field-type contracts, excluded from the Phase 1 core implementation set. */
export const laterFieldTypePlugins = [
  positionFieldTypePlugin,
  linkToRecordFieldTypePlugin,
  attachmentFieldTypePlugin,
  locationFieldTypePlugin,
  phoneFieldTypePlugin,
  emailFieldTypePlugin,
  urlFieldTypePlugin,
  statusFieldTypePlugin,
  formulaFieldTypePlugin,
  rollupFieldTypePlugin,
  lookupFieldTypePlugin,
  autoNumberFieldTypePlugin,
  signatureFieldTypePlugin,
  jsonFieldTypePlugin,
] as const;

/** Complete deterministic registry input containing all 26 plan section 5.3 field types. */
export const allFieldTypePlugins = [...coreFieldTypePlugins, ...laterFieldTypePlugins] as const;
