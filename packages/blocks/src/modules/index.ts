import type { AnyBlockModule } from "../types.js";
import { attachmentGalleryBlock } from "./attachment-gallery.js";
import { boardEmbedBlock } from "./board-embed.js";
import { buttonBlock } from "./button.js";
import { chartBlock } from "./chart.js";
import { checklistBlock } from "./checklist.js";
import { commentsThreadBlock } from "./comments-thread.js";
import { countdownClockBlock } from "./countdown-clock.js";
import { customComponentBlock } from "./custom-component.js";
import { dividerBlock } from "./divider.js";
import { embedBlock } from "./embed.js";
import { fieldDisplayBlock } from "./field-display.js";
import { fieldInputBlock } from "./field-input.js";
import { imageBlock } from "./image.js";
import { linkListBlock } from "./link-list.js";
import { mapBlock } from "./map.js";
import { recordListBlock } from "./record-list.js";
import { relatedRecordsBlock } from "./related-records.js";
import { richTextBlock } from "./rich-text.js";
import { sectionAccordionBlock } from "./section-accordion.js";
import { statKpiBlock } from "./stat-kpi.js";
import { tabsBlock } from "./tabs.js";
import { timelineBlock } from "./timeline.js";
import { weatherBlock } from "./weather.js";

export { attachmentGalleryBlock } from "./attachment-gallery.js";
export { boardEmbedBlock } from "./board-embed.js";
export { buttonBlock } from "./button.js";
export { chartBlock } from "./chart.js";
export { checklistBlock } from "./checklist.js";
export { commentsThreadBlock } from "./comments-thread.js";
export { countdownClockBlock } from "./countdown-clock.js";
export { customComponentBlock } from "./custom-component.js";
export { dividerBlock } from "./divider.js";
export { embedBlock } from "./embed.js";
export { fieldDisplayBlock } from "./field-display.js";
export { fieldInputBlock } from "./field-input.js";
export { imageBlock } from "./image.js";
export { linkListBlock } from "./link-list.js";
export { mapBlock } from "./map.js";
export { recordListBlock } from "./record-list.js";
export { relatedRecordsBlock } from "./related-records.js";
export { richTextBlock } from "./rich-text.js";
export { sectionAccordionBlock } from "./section-accordion.js";
export { statKpiBlock } from "./stat-kpi.js";
export { tabsBlock } from "./tabs.js";
export { timelineBlock } from "./timeline.js";
export { weatherBlock } from "./weather.js";

/** Stable core catalog; module order is palette order, not operational priority. */
export const coreBlockModules = [
  fieldInputBlock,
  fieldDisplayBlock,
  recordListBlock,
  relatedRecordsBlock,
  statKpiBlock,
  chartBlock,
  mapBlock,
  timelineBlock,
  richTextBlock,
  imageBlock,
  buttonBlock,
  tabsBlock,
  sectionAccordionBlock,
  dividerBlock,
  embedBlock,
  commentsThreadBlock,
  checklistBlock,
  attachmentGalleryBlock,
  countdownClockBlock,
  weatherBlock,
  boardEmbedBlock,
  linkListBlock,
  customComponentBlock,
] satisfies readonly AnyBlockModule[];
