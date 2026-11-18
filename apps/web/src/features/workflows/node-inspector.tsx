import {
  type WorkflowEdge,
  type WorkflowStep,
  type WorkflowTrigger,
  workflowStepSchema,
  workflowTriggerSchema,
} from "@argus/schema";
import { Badge, Button, Field, Input, Panel, Select } from "@argus/ui";
import { Trash2 } from "@argus/ui/icons";
import type { ReactElement, ReactNode, Ref } from "react";
import { RETRY_FIELDS, STEP_FIELDS, TRIGGER_FIELDS } from "./config-fields.js";
import { ConfigForm, issuesToErrors } from "./config-form.js";
import {
  branchesFor,
  createTrigger,
  type EdgeBranch,
  STEP_TYPE_LABELS,
  TRIGGER_TYPE_LABELS,
  type TriggerType,
} from "./graph.js";
import { TRIGGER_NODE_ID } from "./graph-editor.js";

/** Sentinel for "no target": Radix Select items cannot use the empty string. */
const END_WORKFLOW = "__end__";

export interface NodeInspectorProps {
  readonly selectedId: string;
  readonly trigger: WorkflowTrigger;
  readonly steps: readonly WorkflowStep[];
  readonly edges: readonly WorkflowEdge[];
  readonly readOnly?: boolean;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onTriggerChange: (trigger: WorkflowTrigger) => void;
  readonly onStepChange: (step: WorkflowStep) => void;
  readonly onConnect: (stepId: string, branch: EdgeBranch, targetId: string | null) => void;
  readonly onRequestDelete: (stepId: string) => void;
}

/**
 * Configuration form for the selected trigger or step, validated inline by the @argus/schema Zod schemas.
 * Input: draft graph and selection. Output: change callbacks; validation never blocks typing.
 * Errors: schema issues render beside the field; the server re-validates on save.
 */
export function NodeInspector(props: NodeInspectorProps): ReactElement {
  const { selectedId, trigger, steps, readOnly = false, headingRef } = props;
  if (selectedId === TRIGGER_NODE_ID) {
    return <TriggerInspector {...props} trigger={trigger} headingRef={headingRef} />;
  }
  const step = steps.find((s) => s.id === selectedId);
  if (!step) {
    return (
      <InspectorPanel headingRef={headingRef} heading="Nothing selected">
        <p className="text-base text-fg-muted">Select a node in the graph to edit it.</p>
      </InspectorPanel>
    );
  }
  return <StepInspector {...props} step={step} readOnly={readOnly} />;
}

/** Panel shell; the inner h3 is the focus target when Enter/F2 is pressed on a graph node. */
function InspectorPanel({
  heading,
  headingRef,
  badge,
  children,
}: {
  readonly heading: string;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <Panel title="Node inspector" status={badge} bodyClassName="grid gap-4">
      <h3
        ref={headingRef}
        tabIndex={-1}
        className="rounded-sm text-base font-semibold text-fg focus-visible:outline-2 focus-visible:outline-focus"
      >
        {heading}
      </h3>
      {children}
    </Panel>
  );
}

function TriggerInspector({
  trigger,
  readOnly = false,
  headingRef,
  onTriggerChange,
}: NodeInspectorProps): ReactElement {
  const result = workflowTriggerSchema.safeParse(trigger);
  const errors = result.success ? {} : issuesToErrors(result.error.issues);
  const fields = TRIGGER_FIELDS[trigger.type];
  return (
    <InspectorPanel
      headingRef={headingRef}
      heading={`Trigger: ${TRIGGER_TYPE_LABELS[trigger.type]}`}
      badge={<Badge tone="accent">Trigger</Badge>}
    >
      <Field label="Trigger type">
        <Select
          disabled={readOnly}
          value={trigger.type}
          onValueChange={(next) => onTriggerChange(createTrigger(next as TriggerType))}
          options={(Object.keys(TRIGGER_TYPE_LABELS) as TriggerType[]).map((type) => ({
            value: type,
            label: TRIGGER_TYPE_LABELS[type],
          }))}
        />
      </Field>
      {fields.length === 0 ? (
        <p className="text-sm text-fg-muted">This trigger needs no configuration.</p>
      ) : (
        <ConfigForm
          formKey={`trigger-${trigger.type}`}
          fields={fields}
          value={trigger}
          errors={errors}
          readOnly={readOnly}
          onChange={(key, value) =>
            onTriggerChange({ ...trigger, [key]: value } as WorkflowTrigger)
          }
        />
      )}
    </InspectorPanel>
  );
}

function StepInspector({
  step,
  steps,
  edges,
  readOnly = false,
  headingRef,
  onStepChange,
  onConnect,
  onRequestDelete,
}: NodeInspectorProps & { readonly step: WorkflowStep }): ReactElement {
  const result = workflowStepSchema.safeParse(step);
  const errors = result.success ? {} : issuesToErrors(result.error.issues);
  const retryErrors: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith("retry.")) retryErrors[key.slice("retry.".length)] = message;
  }
  const others = steps.filter((s) => s.id !== step.id);
  return (
    <InspectorPanel
      headingRef={headingRef}
      heading={`${STEP_TYPE_LABELS[step.type]}: ${step.name}`}
      badge={<Badge tone="neutral">{STEP_TYPE_LABELS[step.type]}</Badge>}
    >
      <Field label="Step name" {...(errors.name ? { error: errors.name } : {})}>
        <Input
          key={step.id}
          readOnly={readOnly}
          defaultValue={step.name}
          onChange={(event) => onStepChange({ ...step, name: event.target.value })}
        />
      </Field>
      <ConfigForm
        formKey={step.id}
        fields={STEP_FIELDS[step.type]}
        value={step}
        errors={errors}
        readOnly={readOnly}
        onChange={(key, value) => onStepChange({ ...step, [key]: value } as WorkflowStep)}
      />
      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-semibold tracking-wider text-fg-muted uppercase">
          Retry policy
        </legend>
        <ConfigForm
          formKey={`${step.id}-retry`}
          fields={RETRY_FIELDS}
          value={step.retry}
          errors={retryErrors}
          readOnly={readOnly}
          onChange={(key, value) =>
            onStepChange({ ...step, retry: { ...step.retry, [key]: value } })
          }
        />
      </fieldset>
      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-semibold tracking-wider text-fg-muted uppercase">
          Connections
        </legend>
        {branchesFor(step.type).map((branch) => {
          const current = edges.find((e) => e.sourceStepId === step.id && e.branch === branch);
          return (
            <Field key={branch} label={`On “${branch}” go to`}>
              <Select
                disabled={readOnly}
                value={current?.targetStepId ?? END_WORKFLOW}
                onValueChange={(next) =>
                  onConnect(step.id, branch, next === END_WORKFLOW ? null : next)
                }
                options={[
                  { value: END_WORKFLOW, label: "End workflow" },
                  ...others.map((other) => ({ value: other.id, label: other.name })),
                ]}
              />
            </Field>
          );
        })}
      </fieldset>
      {readOnly ? null : (
        <div>
          <Button
            variant="danger"
            leadingIcon={<Trash2 aria-hidden="true" />}
            onClick={() => onRequestDelete(step.id)}
          >
            Delete step “{step.name}”
          </Button>
        </div>
      )}
    </InspectorPanel>
  );
}
