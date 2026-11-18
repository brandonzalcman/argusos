import { ScaffoldPage } from "@argus/ui";
import { Puzzle } from "@argus/ui/icons";
import type { ReactElement } from "react";

// TODO(implementation): wave w2d replaces this with the custom component editor.

/** `/studio/components/$componentId` — TSX editor, props, capabilities and sandboxed preview. */
export function ComponentEditorPage(): ReactElement {
  return (
    <ScaffoldPage
      eyebrow="Dev mode"
      title="Component editor"
      icon={<Puzzle />}
      description="Write a custom interface component in TSX and preview it in the secure sandbox."
      implementationOrder={[
        "Load the component draft through StudioPort.",
        "Edit source with @argus/code-editor and preview with the @argus/sdk SandboxFrame.",
      ]}
    />
  );
}
