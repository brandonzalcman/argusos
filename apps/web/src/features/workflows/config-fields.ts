import type { StepType, TriggerType } from "./graph.js";

export type FieldKind =
  | "text"
  | "textarea"
  | "cel"
  | "cel-nullable"
  | "number"
  | "select"
  | "id"
  | "id-list";

export interface FieldDescriptor {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly help?: string;
  readonly options?: readonly string[];
}

export const RETRY_FIELDS: readonly FieldDescriptor[] = [
  { key: "maximumAttempts", label: "Maximum attempts", kind: "number" },
  { key: "backoffSeconds", label: "Backoff (seconds)", kind: "number" },
];

const cel = (key: string, label: string, nullable = false): FieldDescriptor => ({
  key,
  label,
  kind: nullable ? "cel-nullable" : "cel",
  help: "CEL expression; evaluated by the server, never interpolated into SQL.",
});

export const STEP_FIELDS: Readonly<Record<StepType, readonly FieldDescriptor[]>> = {
  condition: [cel("expression", "Condition expression")],
  "create-record": [
    { key: "tableId", label: "Table ID", kind: "id" },
    cel("valuesExpression", "Values expression"),
  ],
  "update-record": [
    { key: "tableId", label: "Table ID", kind: "id" },
    cel("recordIdExpression", "Record ID expression"),
    cel("valuesExpression", "Values expression"),
  ],
  "assign-to-position": [
    cel("positionIdExpression", "Position ID expression"),
    cel("recordIdExpression", "Record ID expression"),
  ],
  "send-alert": [
    { key: "alertDefinitionId", label: "Alert definition ID", kind: "id" },
    cel("inputExpression", "Input expression (optional)", true),
  ],
  "call-webhook": [
    { key: "url", label: "URL", kind: "text" },
    { key: "method", label: "Method", kind: "select", options: ["POST", "PUT", "PATCH"] },
    cel("bodyExpression", "Body expression (optional)", true),
  ],
  wait: [{ key: "durationSeconds", label: "Duration (seconds)", kind: "number" }],
  approval: [
    {
      key: "approverPositionIds",
      label: "Approver position IDs",
      kind: "id-list",
      help: "Comma-separated position IDs.",
    },
    { key: "instructions", label: "Instructions", kind: "textarea" },
  ],
  escalate: [
    cel("deadlineExpression", "Deadline expression"),
    {
      key: "targetPositionIds",
      label: "Escalation target position IDs",
      kind: "id-list",
      help: "Comma-separated position IDs.",
    },
  ],
  "plugin-action": [
    { key: "pluginId", label: "Plugin ID", kind: "id" },
    { key: "actionKey", label: "Action key", kind: "text" },
    cel("inputExpression", "Input expression (optional)", true),
  ],
};

export const TRIGGER_FIELDS: Readonly<Record<TriggerType, readonly FieldDescriptor[]>> = {
  "record-created": [{ key: "tableId", label: "Table ID", kind: "id" }],
  "record-updated": [
    { key: "tableId", label: "Table ID", kind: "id" },
    {
      key: "fieldIds",
      label: "Watched field IDs",
      kind: "id-list",
      help: "Comma-separated field IDs.",
    },
  ],
  schedule: [
    { key: "cron", label: "Cron expression", kind: "text" },
    { key: "timeZone", label: "Time zone (IANA)", kind: "text" },
  ],
  "incident-activated": [],
  "incident-escalated": [],
  "inbound-webhook": [{ key: "endpointKey", label: "Endpoint key", kind: "text" }],
  "form-submitted": [{ key: "viewId", label: "Input view ID", kind: "id" }],
  "button-clicked": [
    { key: "boardId", label: "Board ID", kind: "id" },
    { key: "blockId", label: "Block ID", kind: "id" },
  ],
};
