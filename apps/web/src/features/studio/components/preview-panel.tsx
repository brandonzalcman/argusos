import type { ComponentProp, PluginCapability } from "@argus/schema";
import { type HostBridgeServices, SandboxFrame, type SandboxFrameEvent } from "@argus/sdk/host";
import { Badge, Panel, StatusPill, useUIPreferences } from "@argus/ui";
import { type ReactElement, useMemo } from "react";
import { PREVIEW_DATA_NOT_CONNECTED } from "./console-model.js";

/**
 * Host services for the preview.
 *
 * TODO(implementation): read through a scoped data port instead of rejecting. @argus/blocks'
 * BoardDataPort is table/view oriented and board-scoped, so it doesn't fit single-record
 * `getRecord`/`subscribe` without a new port.
 * Input: tenant/incident/position scope + table, record and field selectors.
 * Output: authorized, field-redacted records (preview uses the editor's own session, never fakes).
 * Errors: reject with the safe "not connected" message until then.
 * Depends on: a record-level data port (ElectricSQL live query) and the studio session scope.
 */
export function createPreviewServices(onCall: (method: string) => void): HostBridgeServices {
  const reject = (method: string): never => {
    onCall(method);
    throw new Error(PREVIEW_DATA_NOT_CONNECTED);
  };
  return {
    getRecord: async () => reject("getRecord"),
    updateRecord: async () => reject("updateRecord"),
    subscribe: async () => reject("subscribe"),
  };
}

export interface PreviewPanelProps {
  readonly name: string;
  readonly componentKey: string;
  readonly version: number;
  readonly source: string;
  readonly props: Readonly<Record<string, unknown>>;
  readonly capabilities: readonly PluginCapability[];
  readonly declaredProps: readonly ComponentProp[];
  readonly services: HostBridgeServices;
  readonly onEvent: (event: SandboxFrameEvent) => void;
}

/** Live preview of the draft inside the sandbox iframe. Theme and density follow the app. */
export function PreviewPanel({
  name,
  componentKey,
  version,
  source,
  props,
  capabilities,
  services,
  onEvent,
}: PreviewPanelProps): ReactElement {
  const { resolvedTheme, density } = useUIPreferences();
  const granted = useMemo(() => capabilities.length, [capabilities]);
  return (
    <Panel
      title="Preview"
      description="Runs in the secure sandbox with the values from the Props tab."
      status={<StatusPill status="info" label="Sandboxed" variant="outline" size="sm" />}
      actions={
        <Badge tone="neutral" variant="outline">
          {resolvedTheme} · {density}
        </Badge>
      }
      bodyClassName="p-0"
    >
      <div className="min-h-40 bg-surface-sunken">
        <SandboxFrame
          title={`Preview of ${name}`}
          source={source}
          props={props}
          componentKey={componentKey}
          version={version}
          capabilities={capabilities}
          services={services}
          density={density}
          minHeight={160}
          maxHeight={900}
          onEvent={onEvent}
        />
      </div>
      <p className="border-t border-border px-3 py-2 text-sm text-fg-muted">
        {PREVIEW_DATA_NOT_CONNECTED} Record hooks report an error here.{" "}
        {granted === 0
          ? "No capabilities are declared, so data requests are denied."
          : `${granted} capabilit${granted === 1 ? "y" : "ies"} declared.`}
      </p>
    </Panel>
  );
}
