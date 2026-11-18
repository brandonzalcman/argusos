# @argus/code-editor

Accessible CodeMirror 6 editor for the dev-mode builder: board/page JSON definitions, CEL
expressions and custom TSX components. Themed entirely from `@argus/ui` CSS variables.

## Usage

```tsx
import { CodeEditor, issuesToDiagnostics, type CodeEditorHandle } from "@argus/code-editor";

function DefinitionEditor({ text, setText, issues, save }: Props) {
  const ref = useRef<CodeEditorHandle>(null);
  return (
    <CodeEditor
      ref={ref}
      aria-label="Board definition (JSON)"
      language="json"
      value={text}
      onChange={setText}
      onSave={save}
      diagnostics={issuesToDiagnostics(text, issues)}
      minHeight="16rem"
      maxHeight="40rem"
    />
  );
}
```

- `language`: `"json" | "tsx" | "cel" | "text"`. For `cel`, pass `celIdentifiers={["record.status", "user.position.name"]}` to
  drive autocomplete (built-ins such as `now()` and `size()` are always offered).
- Controlled: the document is replaced only when `value` differs from it, so the caret does not jump
  while typing. Programmatic replacement does not call `onChange`.
- `ref` exposes `{ focus(), setSelection(from, to), view }` (the raw `EditorView`, or `null` when unmounted).
- `readOnly` keeps the editor focusable and selectable (it sets CodeMirror state read-only, not `contenteditable=false`).

### Helpers

| Export | Purpose |
| --- | --- |
| `jsonPathToRange(text, path)` | Range of the value at a Zod-style path; tolerant scanner, works on half-typed JSON. `null` if absent. |
| `issuesToDiagnostics(text, issues)` | `DefinitionIssue[]` to `EditorDiagnostic[]`. Missing keys highlight the nearest existing ancestor; unresolvable ones land at 0..0. |
| `zodIssuesToDefinitionIssues(error)` | Zod-shaped error to `DefinitionIssue[]` (severity `error`). |
| `formatJson(value)` / `parseJsonSafe(text)` | 2-space stringify; non-throwing parse returning `{ ok, value }` or `{ ok: false, message, offset }`. |
| `tokenizeCel`, `cel()`, `celCompletions()` | CEL tokenizer, language support and completion source. |

## Accessibility

- **Name it.** `aria-label` (or `aria-labelledby` pointing at a visible label) is required. It is applied to the
  editable element (`role="textbox"`, `aria-multiline="true"`, `aria-readonly` when read-only).
- **Tab indents, so there is a keyboard trap to escape.** Press **Escape, then Tab** (within 2 seconds) to move
  focus to the next control, or Shift+Tab after Escape to go back. Ctrl+M (Alt+Shift+M on macOS) toggles Tab-focus mode
  persistently. This is CodeMirror 6's built-in behaviour (`view` 6.43); we also bind `indentWithTab`. Surface this
  hint near the editor in the host UI (for example help text referenced by `aria-describedby` on the wrapper).
- Diagnostics are exposed through CodeMirror's lint gutter and tooltips, and use different line styles per severity
  (wavy for error/warning, dotted for info), so meaning does not rely on colour alone.
- Ctrl/Cmd+S calls `onSave` and suppresses the browser's save dialog; Ctrl/Cmd+F opens search.
- Focus shows a 2px `--argus-color-focus` outline.

## Theming

`argusEditorTheme` (chrome + syntax colours) is included automatically. It uses only these variables, so light,
dark and high-contrast follow the page: `--argus-color-surface`, `-surface-sunken`, `-surface-raised`, `-fg`,
`-fg-muted`, `-border`, `-border-strong`, `-accent`, `-accent-text`, `-accent-subtle`, `-focus`, `-info`, `-success`,
`-warning`, `-high`, `-critical` (and `-subtle` variants), `--argus-font-mono`, `--argus-radius-*`.
The host app must load `@argus/ui` tokens. Selection highlights are `color-mix()` of `--argus-color-accent`
with transparency (no new palette colours).

## Testing

Vitest runs in a node environment, so helpers and the CEL tokenizer are tested directly. Component behaviour
(controlled value, Esc+Tab, onSave) is listed as `it.todo` pending a DOM/browser test setup.
