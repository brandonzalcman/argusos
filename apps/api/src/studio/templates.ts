import type {
  BlockType,
  StudioCreateTemplate,
  StudioDefinitionKind,
  StudioDocument,
} from "@argus/schema";
import { apiError } from "../errors.js";
import { slugFromKey } from "./mapping.js";

export interface StarterDocumentInput {
  readonly kind: StudioDefinitionKind;
  readonly key: string;
  readonly name: string;
  readonly template: StudioCreateTemplate;
}

/** Placeholder metadata; the service overwrites every server-owned field when it stores a document. */
const PLACEHOLDER_ID = "00000000-0000-4000-8000-000000000000";
const PLACEHOLDER_TIME = "1970-01-01T00:00:00.000Z";
const placeholderMetadata = {
  id: PLACEHOLDER_ID,
  tenantId: PLACEHOLDER_ID,
  version: 1,
  lifecycle: "draft" as const,
  changeSummary: null,
  createdAt: PLACEHOLDER_TIME,
  createdBy: PLACEHOLDER_ID,
  createdPositionId: PLACEHOLDER_ID,
  publishedAt: null,
  publishedBy: null,
};
const openAccess = { positionIds: [], visibilityRule: null };

const BLANK_COMPONENT_SOURCE = `// STARTER: a blank custom component. Replace this with your own implementation.
// Runs only inside the sandboxed iframe; data access goes through the @argus/component-sdk bridge.
import { Card, Heading, Stack, Text, useProps } from "@argus/component-sdk";

type Props = { title?: string };

export default function Component() {
  const { title } = useProps<Props>();
  return (
    <Card>
      <Stack gap={2}>
        <Heading level={3}>{title || "Custom component"}</Heading>
        <Text tone="muted">Starter component. Edit the source to build your own.</Text>
      </Stack>
    </Card>
  );
}
`;

function ejectedSource(blockType: BlockType): string {
  const label = `Ejected from ${blockType} — starter, not the built-in implementation`;
  return `// ${label}.
// It does not reproduce the built-in block; it is an editable starting point for your own component.
import { Card, Heading, Stack, Text, useProps } from "@argus/component-sdk";

type Props = { title?: string };

export default function Component() {
  const { title } = useProps<Props>();
  return (
    <Card>
      <Stack gap={2}>
        <Heading level={3}>{title || ${JSON.stringify(blockType)}}</Heading>
        <Text tone="muted">${label}.</Text>
      </Stack>
    </Card>
  );
}
`;
}

/**
 * Starter document for a create template (Decision 9). `duplicate` is resolved by the caller (it
 * needs the database) with {@link duplicateDocument}.
 * Errors: validation-failed for blank board / mismatched templates; `unavailable` (not retryable)
 * carrying a `TODO(implementation)` message for from-table.
 */
export function createStarterDocument(input: StarterDocumentInput): StudioDocument {
  const { kind, key, name, template } = input;
  switch (template.type) {
    case "from-table":
      throw apiError(
        "unavailable",
        "TODO(implementation): from-table template requires the table catalog",
        { retryable: false },
      );
    case "duplicate":
      throw new Error("createStarterDocument: duplicate templates are resolved by the service");
    case "eject-block":
      if (kind !== "component") {
        throw apiError("validation-failed", "Only components can be created by ejecting a block.", {
          fieldErrors: { template: ["eject-block is only valid for components."] },
        });
      }
      if (template.blockType === "custom-component") {
        throw apiError("validation-failed", "A custom component cannot be ejected again.", {
          fieldErrors: { template: ["custom-component cannot be ejected."] },
        });
      }
      return {
        kind: "component",
        definition: {
          ...placeholderMetadata,
          key,
          name,
          description: null,
          language: "tsx",
          source: ejectedSource(template.blockType),
          props: [],
          capabilities: [],
          ejectedFrom: template.blockType,
          sdkVersion: 1,
        },
      };
    case "blank":
      break;
  }
  switch (kind) {
    case "board":
      throw apiError(
        "validation-failed",
        "A board cannot start blank: it needs at least one table data source and one view. Create it from a table or duplicate an existing board.",
        {
          fieldErrors: {
            template: ["Blank boards are not supported; a board needs a table source."],
          },
        },
      );
    case "page":
      return {
        kind: "page",
        definition: {
          ...placeholderMetadata,
          key,
          slug: slugFromKey(key),
          title: name,
          description: null,
          icon: null,
          dataSources: [],
          blocks: [],
          layouts: [{ breakpoint: "desktop", items: [] }],
          homepageForPositionIds: [],
          access: openAccess,
        },
      };
    case "component":
      return {
        kind: "component",
        definition: {
          ...placeholderMetadata,
          key,
          name,
          description: null,
          language: "tsx",
          source: BLANK_COMPONENT_SOURCE,
          props: [],
          capabilities: [],
          ejectedFrom: null,
          sdkVersion: 1,
        },
      };
  }
}

/**
 * Copy of a source document under a new key and name. A duplicated page does not inherit the
 * homepage claims of its source (one position cannot have two homepages).
 */
export function duplicateDocument(
  source: StudioDocument,
  target: { readonly key: string; readonly name: string },
): StudioDocument {
  switch (source.kind) {
    case "board":
      return {
        kind: "board",
        bundle: {
          ...source.bundle,
          definition: { ...source.bundle.definition, key: target.key, name: target.name },
        },
      };
    case "page":
      return {
        kind: "page",
        definition: {
          ...source.definition,
          key: target.key,
          title: target.name,
          slug: slugFromKey(target.key),
          homepageForPositionIds: [],
        },
      };
    case "component":
      return {
        kind: "component",
        definition: { ...source.definition, key: target.key, name: target.name },
      };
  }
}
