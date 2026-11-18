import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import {
  bracketMatching,
  codeFolding,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { type Diagnostic, lintGutter, lintKeymap, setDiagnostics } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { type Ref, useEffect, useImperativeHandle, useRef } from "react";
import { cel } from "./cel.js";
import type { EditorDiagnostic } from "./diagnostics.js";
import { argusEditorTheme } from "./theme.js";

export type EditorLanguage = "json" | "tsx" | "cel" | "text";

/** Minimal imperative handle; `view` is null before mount and after unmount. */
export interface CodeEditorHandle {
  focus(): void;
  setSelection(from: number, to: number): void;
  readonly view: EditorView | null;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: EditorLanguage;
  diagnostics?: readonly EditorDiagnostic[];
  readOnly?: boolean;
  /** Required accessible name. Provide `aria-labelledby` instead to reference a visible label. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  minHeight?: string;
  maxHeight?: string;
  /** Called on Ctrl/Cmd+S with the current document. */
  onSave?: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
  /** Fully qualified identifiers offered by CEL autocomplete (`record.status`, ...). */
  celIdentifiers?: readonly string[];
  ref?: Ref<CodeEditorHandle>;
}

/** Marks transactions that sync the `value` prop into the editor so they never echo to `onChange`. */
const externalChange = Annotation.define<boolean>();

function languageExtension(language: EditorLanguage, celIdentifiers: readonly string[]): Extension {
  switch (language) {
    case "json":
      return json();
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "cel":
      return cel(celIdentifiers);
    case "text":
      return [];
  }
}

function accessibilityExtension(props: {
  label?: string | undefined;
  labelledBy?: string | undefined;
  readOnly: boolean;
}): Extension {
  const attributes: Record<string, string> = { "aria-multiline": "true" };
  if (props.label) attributes["aria-label"] = props.label;
  if (props.labelledBy) attributes["aria-labelledby"] = props.labelledBy;
  if (props.readOnly) attributes["aria-readonly"] = "true";
  return [EditorView.contentAttributes.of(attributes), EditorState.readOnly.of(props.readOnly)];
}

function sizeExtension(minHeight?: string, maxHeight?: string): Extension {
  return EditorView.theme({
    "&": {
      ...(minHeight ? { minHeight } : {}),
      ...(maxHeight ? { maxHeight } : {}),
    },
  });
}

function toLintDiagnostics(
  diagnostics: readonly EditorDiagnostic[],
  docLength: number,
): Diagnostic[] {
  return diagnostics.map((item) => {
    const from = Math.max(0, Math.min(item.from, docLength));
    const to = Math.max(from, Math.min(item.to, docLength));
    return { from, to, severity: item.severity, message: item.message };
  });
}

/**
 * CodeMirror 6 editor themed from Argus tokens. Controlled: external `value` changes replace the
 * document only when they differ from it, so typing never moves the cursor.
 *
 * Keyboard: Tab indents. Press Escape, then Tab (within 2 seconds) to move focus out, or toggle
 * Tab-focus mode with Ctrl-M (Alt-Shift-M on macOS). Both are built into CodeMirror 6.
 */
export function CodeEditor(props: CodeEditorProps) {
  const {
    value,
    language,
    diagnostics,
    readOnly = false,
    minHeight,
    maxHeight,
    autoFocus = false,
    className,
    celIdentifiers,
    ref,
  } = props;
  const label = props["aria-label"];
  const labelledBy = props["aria-labelledby"];

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Latest callbacks, read from event handlers without recreating the editor.
  const callbacksRef = useRef({ onChange: props.onChange, onSave: props.onSave });
  callbacksRef.current = { onChange: props.onChange, onSave: props.onSave };

  const languageCompartment = useRef(new Compartment()).current;
  const a11yCompartment = useRef(new Compartment()).current;
  const sizeCompartment = useRef(new Compartment()).current;

  // Initial values captured once for view creation; later changes go through compartments.
  const initial = useRef({
    value,
    language,
    celIdentifiers,
    label,
    labelledBy,
    readOnly,
    minHeight,
    maxHeight,
    autoFocus,
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      setSelection: (from, to) => {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        view.dispatch({
          selection: { anchor: Math.min(from, length), head: Math.min(to, length) },
          scrollIntoView: true,
        });
      },
      get view() {
        return viewRef.current;
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const start = initial.current;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: start.value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          foldGutter(),
          codeFolding(),
          lintGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: (target) => {
                const onSave = callbacksRef.current.onSave;
                if (!onSave) return true; // still swallow the browser "Save page" dialog
                onSave(target.state.doc.toString());
                return true;
              },
            },
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap,
            // Tab indents. CodeMirror releases the trap on Escape then Tab (see component docs).
            indentWithTab,
          ]),
          EditorView.lineWrapping,
          argusEditorTheme,
          languageCompartment.of(languageExtension(start.language, start.celIdentifiers ?? [])),
          a11yCompartment.of(
            accessibilityExtension({
              label: start.label,
              labelledBy: start.labelledBy,
              readOnly: start.readOnly,
            }),
          ),
          sizeCompartment.of(sizeExtension(start.minHeight, start.maxHeight)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            if (update.transactions.some((tr) => tr.annotation(externalChange))) return;
            callbacksRef.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (start.autoFocus) view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Controlled value: replace only on a real difference, keeping the caret in range.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc;
    if (current.toString() === value) return;
    const head = Math.min(view.state.selection.main.head, value.length);
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: head },
      annotations: externalChange.of(true),
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: languageCompartment.reconfigure(languageExtension(language, celIdentifiers ?? [])),
    });
  }, [language, celIdentifiers, languageCompartment]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        a11yCompartment.reconfigure(accessibilityExtension({ label, labelledBy, readOnly })),
        sizeCompartment.reconfigure(sizeExtension(minHeight, maxHeight)),
      ],
    });
  }, [label, labelledBy, readOnly, minHeight, maxHeight, a11yCompartment, sizeCompartment]);

  // Runs after the value sync above (same commit, declaration order) so offsets match the document.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(
      setDiagnostics(view.state, toLintDiagnostics(diagnostics ?? [], view.state.doc.length)),
    );
  }, [diagnostics, value]);

  return <div ref={hostRef} className={className} data-argus-code-editor={language} />;
}
