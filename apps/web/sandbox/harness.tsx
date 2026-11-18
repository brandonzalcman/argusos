import { type HostBridgeServices, SandboxFrame, type SandboxFrameEvent } from "@argus/sdk/host";
import { useState } from "react";
import { createRoot } from "react-dom/client";

// Dev-only harness: deterministic stub services so the bridge can be exercised in a real browser.
// The records below are test fixtures, not operational data.
const services: HostBridgeServices = {
  async getRecord(_scope, selector) {
    if (selector.tableId !== "t-a") return null;
    return {
      id: selector.recordId,
      tableId: "t-a",
      incidentId: null,
      version: 1,
      values: { "f-1": "hello", "f-hidden": "SHOULD-NOT-LEAK" },
    };
  },
  async updateRecord(_scope, selector, values) {
    return {
      id: selector.recordId,
      tableId: selector.tableId,
      incidentId: null,
      version: 2,
      values,
    };
  },
  async subscribe(_scope, _selector, emit) {
    const timer = setTimeout(() => {
      void emit(
        {
          id: "r1",
          tableId: "t-a",
          incidentId: null,
          version: 1,
          values: { "f-1": "row one", "f-hidden": "SHOULD-NOT-LEAK" },
        },
        "1",
      );
    }, 20);
    return { subscriptionId: "sub-1", close: async () => clearTimeout(timer) };
  },
};

declare global {
  interface Window {
    __harness: { events: SandboxFrameEvent[]; set: (patch: Partial<State>) => void };
  }
}

interface State {
  source: string;
  props: Record<string, unknown>;
  tableId: string;
}

const events: SandboxFrameEvent[] = [];
let apply: (patch: Partial<State>) => void = () => undefined;
window.__harness = { events, set: (patch) => apply(patch) };

function App() {
  const [state, setState] = useState<State>({
    source: "export default () => null",
    props: {},
    tableId: "t-a",
  });
  apply = (patch) => setState((s) => ({ ...s, ...patch }));
  return (
    <SandboxFrame
      title="Harness component"
      componentKey="harness"
      version={1}
      source={state.source}
      props={state.props}
      capabilities={[
        { type: "read-records", tableIds: [state.tableId], fieldIds: ["f-1"] },
        { type: "subscribe-records", tableIds: [state.tableId], fieldIds: ["f-1"] },
      ]}
      services={services}
      heartbeatTimeoutMs={3000}
      loadDebounceMs={50}
      onEvent={(e) => events.push(e)}
    />
  );
}

createRoot(document.getElementById("app") as HTMLElement).render(<App />);
