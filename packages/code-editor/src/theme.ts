import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * Editor chrome built only from `@argus/ui` CSS variables, so light, dark and high-contrast
 * themes apply without any JS. The host page must load `@argus/ui/tokens.css`.
 */
export const argusEditorChrome: Extension = EditorView.theme({
  "&": {
    color: "var(--argus-color-fg)",
    backgroundColor: "var(--argus-color-surface)",
    border: "1px solid var(--argus-color-border)",
    borderRadius: "var(--argus-radius-md)",
    fontSize: "0.875rem",
  },
  "&.cm-focused": {
    outline: "2px solid var(--argus-color-focus)",
    outlineOffset: "1px",
  },
  ".cm-scroller": {
    fontFamily: "var(--argus-font-mono)",
    lineHeight: "1.55",
    overflow: "auto",
  },
  ".cm-content": { caretColor: "var(--argus-color-fg)", padding: "0.5rem 0" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--argus-color-fg)",
    borderLeftWidth: "2px",
  },
  ".cm-line": { padding: "0 0.75rem" },
  ".cm-gutters": {
    backgroundColor: "var(--argus-color-surface-sunken)",
    color: "var(--argus-color-fg-muted)",
    borderRight: "1px solid var(--argus-color-border)",
  },
  ".cm-activeLine": { backgroundColor: "var(--argus-color-accent-subtle)" },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--argus-color-accent-subtle)",
    color: "var(--argus-color-fg)",
  },
  ".cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in srgb, var(--argus-color-accent) 28%, transparent)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--argus-color-accent) 36%, transparent)",
  },
  ".cm-matchingBracket, .cm-nonmatchingBracket": {
    outline: "1px solid var(--argus-color-border-strong)",
    backgroundColor: "transparent",
  },
  ".cm-nonmatchingBracket": { outlineColor: "var(--argus-color-critical)" },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--argus-color-surface-sunken)",
    color: "var(--argus-color-fg-muted)",
    border: "1px solid var(--argus-color-border)",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--argus-color-warning-subtle)",
    outline: "1px solid var(--argus-color-warning)",
  },
  ".cm-searchMatch-selected": { backgroundColor: "var(--argus-color-info-subtle)" },
  ".cm-panels": {
    backgroundColor: "var(--argus-color-surface-sunken)",
    color: "var(--argus-color-fg)",
    borderColor: "var(--argus-color-border)",
  },
  ".cm-panels input, .cm-panels button": {
    color: "var(--argus-color-fg)",
    backgroundColor: "var(--argus-color-surface)",
    border: "1px solid var(--argus-color-border-strong)",
    borderRadius: "var(--argus-radius-sm)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--argus-color-surface-raised)",
    color: "var(--argus-color-fg)",
    border: "1px solid var(--argus-color-border-strong)",
    borderRadius: "var(--argus-radius-sm)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--argus-color-accent-subtle)",
    color: "var(--argus-color-fg)",
    outline: "1px solid var(--argus-color-focus)",
  },
  ".cm-completionDetail": { color: "var(--argus-color-fg-muted)" },
  ".cm-diagnostic": { color: "var(--argus-color-fg)" },
  ".cm-diagnostic-error": { borderLeftColor: "var(--argus-color-critical)" },
  ".cm-diagnostic-warning": { borderLeftColor: "var(--argus-color-warning)" },
  ".cm-diagnostic-info": { borderLeftColor: "var(--argus-color-info)" },
  // Squiggles use text-decoration so the colour follows the active theme.
  ".cm-lintRange": { backgroundImage: "none", paddingBottom: "0" },
  ".cm-lintRange-error": {
    textDecoration: "underline wavy var(--argus-color-critical)",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    textDecoration: "underline wavy var(--argus-color-warning)",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-info": {
    textDecoration: "underline dotted var(--argus-color-info)",
    textUnderlineOffset: "3px",
  },
});

/** Token colours drawn exclusively from existing status/accent tokens (AA on `--argus-color-surface`). */
export const argusHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.modifier],
    color: "var(--argus-color-accent-text)",
  },
  {
    tag: [tags.string, tags.regexp, tags.special(tags.string)],
    color: "var(--argus-color-success)",
  },
  { tag: [tags.number, tags.integer, tags.float], color: "var(--argus-color-high)" },
  { tag: [tags.bool, tags.null, tags.atom], color: "var(--argus-color-warning)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--argus-color-info)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--argus-color-info)" },
  { tag: tags.function(tags.variableName), color: "var(--argus-color-accent-text)" },
  { tag: tags.function(tags.propertyName), color: "var(--argus-color-accent-text)" },
  { tag: [tags.variableName, tags.name], color: "var(--argus-color-fg)" },
  {
    tag: [tags.operator, tags.operatorKeyword, tags.punctuation, tags.bracket, tags.separator],
    color: "var(--argus-color-fg-muted)",
  },
  { tag: [tags.comment, tags.meta], color: "var(--argus-color-fg-muted)", fontStyle: "italic" },
  { tag: tags.invalid, color: "var(--argus-color-critical)" },
]);

/** Complete theme: chrome plus syntax colours. */
export const argusEditorTheme: Extension = [
  argusEditorChrome,
  syntaxHighlighting(argusHighlightStyle),
];
