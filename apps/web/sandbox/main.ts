import { startSandboxRuntime } from "@argus/sdk/sandbox-runtime";

// Runs inside the sandboxed iframe only. It waits for a `sandbox.load` message from the host.
startSandboxRuntime();
