import { Button, cn, Panel, Tabs, TabsContent, TabsList, TabsTrigger } from "@argus/ui";
import { Bug, CircleAlert, Eraser, Info, OctagonAlert, TriangleAlert } from "@argus/ui/icons";
import type { ReactElement, ReactNode } from "react";
import type { ConsoleEntry, ConsoleLevel } from "./console-model.js";
import type { EditorProblem, ProblemArea } from "./editor-model.js";

const levelMeta: Readonly<
  Record<ConsoleLevel, { icon: ReactNode; label: string; className: string }>
> = {
  log: { icon: <Info />, label: "Log", className: "text-fg" },
  info: { icon: <Info />, label: "Info", className: "text-info" },
  debug: { icon: <Bug />, label: "Debug", className: "text-fg-muted" },
  warn: { icon: <TriangleAlert />, label: "Warning", className: "text-warning" },
  error: { icon: <OctagonAlert />, label: "Error", className: "text-critical" },
};

export interface ConsolePanelProps {
  readonly entries: readonly ConsoleEntry[];
  readonly problems: readonly EditorProblem[];
  readonly tab: "console" | "problems";
  readonly onTabChange: (tab: "console" | "problems") => void;
  readonly onClear: () => void;
  /** Move the editor cursor to a source location. */
  readonly onJumpToSource: (
    line: number | null,
    column: number | null,
    from: number | null,
  ) => void;
  /** Open the editor tab an area-level problem belongs to. */
  readonly onOpenArea: (area: ProblemArea) => void;
}

function LocationLink({
  line,
  column,
  onJump,
}: {
  readonly line: number;
  readonly column: number | null;
  readonly onJump: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onJump}
      className="shrink-0 rounded-sm font-mono text-accent-text underline underline-offset-2 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-focus"
      aria-label={`Go to line ${line}${column ? `, column ${column}` : ""} in the source`}
    >
      {line}:{column ?? 1}
    </button>
  );
}

/** Console (runtime events) and Problems (compile, props, capabilities) below the preview. */
export function ConsolePanel({
  entries,
  problems,
  tab,
  onTabChange,
  onClear,
  onJumpToSource,
  onOpenArea,
}: ConsolePanelProps): ReactElement {
  const errorCount = problems.filter((p) => p.severity === "error").length;
  return (
    <Panel
      title="Console and problems"
      headingLevel={2}
      actions={
        <Button
          size="sm"
          variant="ghost"
          leadingIcon={<Eraser />}
          onClick={onClear}
          disabled={entries.length === 0}
        >
          Clear console
        </Button>
      }
      bodyClassName="p-0"
    >
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as "console" | "problems")}>
        <TabsList aria-label="Console or problems" className="px-3">
          <TabsTrigger value="console" count={entries.length}>
            Console
          </TabsTrigger>
          <TabsTrigger value="problems" count={problems.length}>
            Problems
          </TabsTrigger>
        </TabsList>
        <TabsContent value="console">
          <div
            className="max-h-56 overflow-auto"
            // Live region so new runtime messages are announced politely.
            role="log"
            aria-live="polite"
            aria-label="Preview console"
          >
            {entries.length === 0 ? (
              <p className="p-3 text-sm text-fg-muted">
                Nothing logged yet. Runtime messages, errors and <code>console.log</code> output
                from the preview appear here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map((entry) => {
                  const meta = levelMeta[entry.level];
                  return (
                    <li key={entry.id} className="flex items-start gap-2 px-3 py-1.5 text-sm">
                      <span className={cn("mt-0.5 size-4 shrink-0 [&>svg]:size-4", meta.className)}>
                        {meta.icon}
                        <span className="sr-only">{meta.label}: </span>
                      </span>
                      <span className={cn("min-w-0 flex-1 break-words font-mono", meta.className)}>
                        {entry.text}
                      </span>
                      {entry.line !== null ? (
                        <LocationLink
                          line={entry.line}
                          column={entry.column}
                          onJump={() => onJumpToSource(entry.line, entry.column, null)}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="problems">
          <div className="max-h-56 overflow-auto">
            {problems.length === 0 ? (
              <p className="p-3 text-sm text-fg-muted">
                No problems found in the source, props or capabilities.
              </p>
            ) : (
              <>
                <p className="sr-only" aria-live="polite">
                  {errorCount} error{errorCount === 1 ? "" : "s"}
                </p>
                <ul className="divide-y divide-border">
                  {problems.map((problem) => (
                    <li key={problem.id} className="flex items-start gap-2 px-3 py-1.5 text-sm">
                      {problem.severity === "error" ? (
                        <CircleAlert
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-critical"
                        />
                      ) : (
                        <TriangleAlert
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-warning"
                        />
                      )}
                      <span className="min-w-0 flex-1 break-words">
                        <span className="sr-only">
                          {problem.severity === "error" ? "Error" : "Warning"}:{" "}
                        </span>
                        {problem.message}
                      </span>
                      {problem.area === "source" && problem.line !== null ? (
                        <LocationLink
                          line={problem.line}
                          column={problem.column}
                          onJump={() => onJumpToSource(problem.line, problem.column, problem.from)}
                        />
                      ) : problem.area === "source" ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-sm text-accent-text underline underline-offset-2"
                          onClick={() => onJumpToSource(null, null, problem.from)}
                        >
                          Open source
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="shrink-0 rounded-sm text-accent-text underline underline-offset-2"
                          onClick={() => onOpenArea(problem.area)}
                        >
                          Open {problem.area === "definition" ? "definition" : problem.area}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Panel>
  );
}
