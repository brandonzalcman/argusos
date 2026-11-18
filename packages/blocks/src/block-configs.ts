import { type BlockType, blockTypeSchema, type JsonValue } from "@argus/schema";

/** Runtime options come directly from the shared schema and cover every block in plan §6.2. */
export const blockKinds = blockTypeSchema.options;

/** Every block kind listed in product plan §6.2, owned by @argus/schema. */
export type BlockKind = BlockType;

export interface FieldInputBlockConfig {
  readonly fieldId: string;
  readonly label?: string;
  readonly required: boolean;
}

export interface FieldDisplayBlockConfig {
  readonly fieldId: string;
  readonly label?: string;
  readonly redactionBehavior: "hide" | "placeholder";
}

export interface RecordListBlockConfig {
  readonly tableId: string;
  readonly viewId?: string;
  readonly pageSize: number;
}

export interface RelatedRecordsBlockConfig {
  readonly relationId: string;
  readonly viewId?: string;
}

export interface StatKpiBlockConfig {
  readonly tableId: string;
  readonly aggregationDefinitionId: string;
  readonly label: string;
}

export interface ChartBlockConfig {
  readonly tableId: string;
  readonly chartDefinitionId: string;
}

export interface MapBlockConfig {
  readonly layerDefinitionIds: readonly string[];
  readonly initialViewportId?: string;
}

export interface TimelineBlockConfig {
  readonly tableId: string;
  readonly startFieldId: string;
  readonly endFieldId?: string;
}

export interface RichTextBlockConfig {
  /** Opaque rich-text document; implementations must sanitize it and never treat it as trusted HTML. */
  readonly contentDocument: unknown;
}

export interface ImageBlockConfig {
  readonly attachmentId: string;
  readonly altText: string;
}

export interface ButtonBlockConfig {
  readonly label: string;
  readonly actionDefinitionId: string;
  readonly confirmationRequired: boolean;
}

export interface BlockTab {
  readonly id: string;
  readonly label: string;
  readonly blockIds: readonly string[];
}

export interface TabsBlockConfig {
  readonly tabs: readonly BlockTab[];
}

export interface SectionAccordionBlockConfig {
  readonly title: string;
  readonly collapsible: boolean;
  readonly initiallyExpanded: boolean;
}

export interface DividerBlockConfig {
  readonly orientation: "horizontal" | "vertical";
}

export interface EmbedBlockConfig {
  readonly embedDefinitionId: string;
  /** Exact origin previously validated by an administrator; implementations must still sandbox it. */
  readonly allowlistedOrigin: string;
}

export interface CommentsThreadBlockConfig {
  readonly recordId: string;
}

export interface ChecklistBlockConfig {
  readonly checklistDefinitionId: string;
}

export interface AttachmentGalleryBlockConfig {
  readonly recordId: string;
  readonly fieldId: string;
}

export interface CountdownClockBlockConfig {
  readonly targetFieldId?: string;
  readonly timeZone: string;
}

export interface WeatherBlockConfig {
  readonly feedDefinitionId: string;
  readonly locationFieldId: string;
}

export interface BoardEmbedBlockConfig {
  /** Published board to embed; the viewer must also be authorized for it. */
  readonly boardId: string;
  /** Optional board view (tab) to open; null opens the default view. */
  readonly viewId?: string;
  readonly showHeader: boolean;
}

export interface LinkListItem {
  readonly label: string;
  readonly target:
    | { readonly type: "board"; readonly boardId: string }
    | { readonly type: "page"; readonly pageId: string }
    | { readonly type: "url"; readonly url: string };
  /** Lucide icon name; unknown names fall back to a generic link icon. */
  readonly icon?: string;
}

export interface LinkListBlockConfig {
  readonly title?: string;
  readonly links: readonly LinkListItem[];
  readonly layout: "list" | "grid";
}

/** Mirrors customComponentBlockConfigSchema in @argus/schema; runtime loads exactly componentVersion. */
export interface CustomComponentBlockConfig {
  readonly componentId: string;
  readonly componentVersion: number;
  readonly props: Readonly<Record<string, JsonValue>>;
}

/** Maps registry keys to their public configuration contracts without recreating board schemas. */
export interface BlockConfigByKind {
  readonly "field-input": FieldInputBlockConfig;
  readonly "field-display": FieldDisplayBlockConfig;
  readonly "record-list": RecordListBlockConfig;
  readonly "related-records": RelatedRecordsBlockConfig;
  readonly stat: StatKpiBlockConfig;
  readonly chart: ChartBlockConfig;
  readonly map: MapBlockConfig;
  readonly timeline: TimelineBlockConfig;
  readonly "rich-text": RichTextBlockConfig;
  readonly image: ImageBlockConfig;
  readonly button: ButtonBlockConfig;
  readonly tabs: TabsBlockConfig;
  readonly section: SectionAccordionBlockConfig;
  readonly divider: DividerBlockConfig;
  readonly embed: EmbedBlockConfig;
  readonly comments: CommentsThreadBlockConfig;
  readonly checklist: ChecklistBlockConfig;
  readonly "attachment-gallery": AttachmentGalleryBlockConfig;
  readonly countdown: CountdownClockBlockConfig;
  readonly weather: WeatherBlockConfig;
  readonly "board-embed": BoardEmbedBlockConfig;
  readonly "link-list": LinkListBlockConfig;
  readonly "custom-component": CustomComponentBlockConfig;
}
