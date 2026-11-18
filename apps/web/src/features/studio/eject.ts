import type { BlockDefinition, ComponentProp, CustomComponentDefinition } from "@argus/schema";
import { getBlockTemplate } from "@argus/sdk/templates";
import { useToast } from "@argus/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useStudioPort } from "../../services/studio.js";
import { isValidDefault } from "./components/props-model.js";
import { builderHref } from "./studio-links.js";

/** Marker the demo/backend placeholder template carries until a real block template is applied. */
const PLACEHOLDER_MARKER = "TODO(implementation): this is a placeholder";

/** True when a freshly created eject draft still holds the placeholder source. */
export function isPlaceholderSource(source: string): boolean {
  return source.includes(PLACEHOLDER_MARKER);
}

export type PropValues = Record<string, ComponentProp["defaultValue"]>;

function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, "").toLowerCase();
}

/**
 * Maps a block's config onto initial prop *values* for the new component block: a config entry
 * becomes a value when a declared prop has the same key (ignoring camelCase vs snake_case) and
 * the value suits the prop type. Everything else is dropped; nothing is invented.
 */
export function mapConfigToPropValues(
  config: Readonly<Record<string, unknown>>,
  props: readonly ComponentProp[],
): PropValues {
  const byKey = new Map<string, unknown>();
  for (const [key, value] of Object.entries(config)) byKey.set(normalizeKey(key), value);
  const values: PropValues = {};
  for (const prop of props) {
    const candidate = byKey.get(normalizeKey(prop.key));
    if (candidate === undefined || candidate === null) continue;
    if (typeof candidate === "object") continue;
    const typed = candidate as ComponentProp["defaultValue"];
    if (isValidDefault({ ...prop, defaultValue: typed })) values[prop.key] = typed;
  }
  return values;
}

/** Suggests a unique lower_snake_case component key for an ejected block. */
export function ejectedComponentKey(blockType: string, suffix: string): string {
  const base = blockType.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const safeSuffix = suffix.replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `eject_${base}_${safeSuffix}`.slice(0, 63);
}

export interface EjectResult {
  readonly componentId: string;
  /** Version of the draft that now holds the block's source (what the new block should pin). */
  readonly componentVersion: number;
  /** Initial prop values mapped from the block's config; the caller puts them in the new block. */
  readonly props: PropValues;
}

function randomSuffix(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return (uuid ?? `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replace(
    /-/g,
    "",
  );
}

/**
 * Returns a function that ejects a built-in block into a new custom component draft.
 *
 * Flow: `studio.create` (eject-block template) → when the created draft's source is still a
 * placeholder, overwrite source and props with `getBlockTemplate(block.type)` → resolve with the
 * component id and draft version. Resolves null (after a toast) when the studio can't create it.
 * UI-agnostic: no dialogs; callers confirm first. Needs ToastProvider and a router context.
 */
export function useEjectBlock(): (block: BlockDefinition) => Promise<EjectResult | null> {
  const studio = useStudioPort();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  return useCallback(
    async (block) => {
      try {
        const suffix = randomSuffix();
        const created = await studio.create({
          kind: "component",
          key: ejectedComponentKey(block.type, suffix),
          name: `${block.name} (custom code)`.slice(0, 200),
          template: { type: "eject-block", blockType: block.type },
          idempotencyKey: `eject-${block.id}-${suffix}`.slice(0, 200),
        });
        const template = getBlockTemplate(block.type);
        let version = created.version;
        let warning: string | null = null;

        const draft = await studio.get({
          kind: "component",
          id: created.id,
          revision: "draft",
        });
        if (draft && draft.document.kind === "component") {
          const definition = draft.document.definition;
          if (isPlaceholderSource(definition.source)) {
            const next: CustomComponentDefinition = {
              ...definition,
              source: template.source,
              props: template.props,
              ejectedFrom: definition.ejectedFrom ?? block.type,
            };
            try {
              const saved = await studio.saveDraft({
                id: created.id,
                baseVersion: draft.version,
                document: { kind: "component", definition: next },
              });
              version = saved.version;
            } catch (error) {
              version = draft.version;
              warning = `The block's source couldn't be copied (${
                error instanceof Error ? error.message : "unknown error"
              }). Open the component to add it.`;
            }
          } else {
            version = draft.version;
          }
        }

        await queryClient.invalidateQueries({ queryKey: ["studio", "list", "component"] });
        toast({
          title: warning ? "Component created with a warning" : "Component created",
          description: warning ?? `${block.name} is now editable code.`,
          tone: warning ? "warning" : "success",
          action: {
            label: "Edit component code",
            altText: `Edit component code for ${block.name}`,
            onAction: () => void navigate({ to: builderHref("component", created.id) }),
          },
        });
        return {
          componentId: created.id,
          componentVersion: version,
          props: mapConfigToPropValues(block.config as Record<string, unknown>, template.props),
        };
      } catch (error) {
        toast({
          title: "Couldn't create the component",
          description:
            error instanceof Error && error.message.startsWith("TODO(implementation)")
              ? "Studio isn't connected yet, so nothing was created."
              : error instanceof Error
                ? error.message
                : "Unknown error.",
          tone: "critical",
        });
        return null;
      }
    },
    [studio, queryClient, toast, navigate],
  );
}
