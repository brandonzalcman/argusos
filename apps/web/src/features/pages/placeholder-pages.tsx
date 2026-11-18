import { ScaffoldPage } from "@argus/ui";
import { FileText } from "@argus/ui/icons";
import type { ReactElement } from "react";

// TODO(implementation): wave w2c replaces these with the page runtime and the page builder.

/** `/p/$slug` — renders a published user-built page. */
export function PageRuntimePage(): ReactElement {
  return (
    <ScaffoldPage
      title="Page"
      icon={<FileText />}
      description="User-built pages composed of blocks render here at /p/<slug>."
      implementationOrder={[
        "Load the published page by slug through StudioPort.getPageBySlug.",
        "Render its responsive block layout with the shared board renderer.",
      ]}
    />
  );
}

/** `/studio/pages/$pageId` — page builder (design / code / preview). */
export function PageBuilderPage(): ReactElement {
  return (
    <ScaffoldPage
      eyebrow="Dev mode"
      title="Page builder"
      icon={<FileText />}
      description="Compose a page from blocks visually or edit its definition code."
      implementationOrder={[
        "Reuse the shared builder (palette, canvas, inspector) for page documents.",
        "Save drafts and publish through StudioPort.",
      ]}
    />
  );
}
