import { ConnectionIndicator } from "@argus/ui";
import type { ReactElement } from "react";

/** Truthful freshness pill: "live" only while an Electric subscription is established. */
export function LiveStatus({ isLive }: { readonly isLive: boolean }): ReactElement {
  return (
    <ConnectionIndicator
      variant="pill"
      state={isLive ? "live" : "offline"}
      stateDetail={isLive ? "Updating live" : "Not receiving live updates; data may be stale"}
    />
  );
}
