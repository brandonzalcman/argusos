import {
  ArrowRight,
  CircleAlert,
  FileText,
  LoaderCircle,
  type LucideIcon,
  Search,
  Siren,
  UserRound,
  Zap,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/cn.js";
import {
  type CommandKind,
  type CommandPaletteItem,
  type CommandPaletteSource,
  flattenResults,
  moveActiveIndex,
  type SourceResult,
} from "../lib/command-model.js";
import { Kbd } from "./kbd.js";

export type {
  CommandKind,
  CommandPaletteItem,
  CommandPaletteSource,
} from "../lib/command-model.js";

const kindIcon: Readonly<Record<CommandKind, LucideIcon>> = {
  navigation: ArrowRight,
  record: FileText,
  incident: Siren,
  position: UserRound,
  action: Zap,
};

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Federated providers, searched in parallel; each failure is shown in its own group. */
  readonly sources: readonly CommandPaletteSource[];
  readonly onSelect: (item: CommandPaletteItem) => void;
  readonly placeholder?: string;
  /** Debounce before calling sources, in ms. */
  readonly debounceMs?: number;
}

/**
 * ⌘K / Ctrl+K palette (combobox + listbox pattern). Up/Down move, Enter runs, Escape closes.
 * Results come only from the supplied sources, which must return authorized items.
 */
export function CommandPalette({
  open,
  onOpenChange,
  sources,
  onSelect,
  placeholder = "Search boards, records, incidents, positions or actions…",
  debounceMs = 120,
}: CommandPaletteProps): ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Readonly<Record<string, SourceResult>>>({});
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({});
      return undefined;
    }
    const controller = new AbortController();
    setResults(
      Object.fromEntries(sources.map((source) => [source.id, { status: "loading" } as const])),
    );
    const timer = setTimeout(() => {
      for (const source of sources) {
        source
          .search(query, controller.signal)
          .then((items) => {
            if (!controller.signal.aborted) {
              setResults((current) => ({ ...current, [source.id]: { status: "ready", items } }));
            }
          })
          .catch((error: unknown) => {
            if (!controller.signal.aborted) {
              const message = error instanceof Error ? error.message : "Search failed";
              setResults((current) => ({ ...current, [source.id]: { status: "error", message } }));
            }
          });
      }
    }, debounceMs);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query, sources, debounceMs]);

  const flat = useMemo(() => flattenResults(sources, results), [sources, results]);
  useEffect(() => setActive(flat.length > 0 ? 0 : -1), [flat]);

  const optionId = (index: number): string => `${listId}-option-${index}`;
  const activeItem = active >= 0 ? flat[active] : undefined;
  const anyLoading = Object.values(results).some((result) => result.status === "loading");

  useEffect(() => {
    if (active < 0) {
      return;
    }
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item: CommandPaletteItem): void => {
    onOpenChange(false);
    onSelect(item);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        moveActiveIndex(current, event.key === "ArrowDown" ? 1 : -1, flat.length),
      );
    } else if (event.key === "Home" && event.ctrlKey) {
      setActive(flat.length > 0 ? 0 : -1);
    } else if (event.key === "End" && event.ctrlKey) {
      setActive(flat.length - 1);
    } else if (event.key === "Enter" && activeItem) {
      event.preventDefault();
      run(activeItem);
    }
  };

  let index = -1;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-(--argus-z-overlay) bg-overlay data-[state=open]:animate-argus-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed start-1/2 top-[12vh] z-(--argus-z-modal) flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rtl:translate-x-1/2",
            "rounded-lg border border-border bg-surface-raised text-fg shadow-lg outline-none",
            "data-[state=open]:animate-argus-pop-in",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            {anyLoading ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4.5 shrink-0 text-fg-subtle motion-safe:animate-spin"
              />
            ) : (
              <Search aria-hidden="true" className="size-4.5 shrink-0 text-fg-subtle" />
            )}
            <input
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeItem ? optionId(active) : undefined}
              aria-label="Search commands"
              value={query}
              placeholder={placeholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              className="h-13 min-w-0 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="min-h-0 flex-1 overflow-y-auto p-1.5"
          >
            {sources.map((source) => {
              const result = results[source.id];
              if (!result) {
                return null;
              }
              if (result.status === "ready" && result.items.length === 0) {
                return null;
              }
              return (
                // biome-ignore lint/a11y/useSemanticElements: listbox option groups must be role=group, not fieldset
                <div key={source.id} role="group" aria-label={source.label} className="pb-1">
                  <div
                    className="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase"
                    aria-hidden="true"
                  >
                    {source.label}
                  </div>
                  {result.status === "loading" ? (
                    <div className="px-2.5 py-2 text-sm text-fg-subtle">Searching…</div>
                  ) : null}
                  {result.status === "error" ? (
                    <div className="flex items-start gap-2 px-2.5 py-2 text-sm text-fg-muted">
                      <CircleAlert
                        aria-hidden="true"
                        className="mt-px size-4 shrink-0 text-warning"
                      />
                      <span>
                        {source.label} unavailable.{" "}
                        <span className="text-fg-subtle">{result.message}</span>
                      </span>
                    </div>
                  ) : null}
                  {result.status === "ready"
                    ? result.items.map((item) => {
                        index += 1;
                        const itemIndex = index;
                        const Icon = kindIcon[item.kind];
                        const selected = itemIndex === active;
                        return (
                          // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by the combobox input (activedescendant)
                          <div
                            key={`${source.id}:${item.id}`}
                            id={optionId(itemIndex)}
                            role="option"
                            tabIndex={-1}
                            aria-selected={selected}
                            data-index={itemIndex}
                            onMouseMove={() => setActive(itemIndex)}
                            onClick={() => run(item)}
                            className={cn(
                              "flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-base",
                              selected ? "bg-accent-subtle text-fg" : "text-fg",
                            )}
                          >
                            <Icon
                              aria-hidden="true"
                              className={cn(
                                "size-4 shrink-0",
                                selected ? "text-accent-text" : "text-fg-subtle",
                              )}
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {item.title}
                              {item.subtitle ? (
                                <span className="ms-2 text-sm text-fg-muted">{item.subtitle}</span>
                              ) : null}
                            </span>
                            {item.shortcut ? (
                              <span className="flex gap-0.5">
                                {item.shortcut.map((key) => (
                                  <Kbd key={key}>{key}</Kbd>
                                ))}
                              </span>
                            ) : null}
                          </div>
                        );
                      })
                    : null}
                </div>
              );
            })}
            {!anyLoading &&
            flat.length === 0 &&
            Object.values(results).every((r) => r.status !== "error") ? (
              <div className="px-4 py-10 text-center text-base text-fg-muted">
                {query ? <>No results for “{query}”</> : "Nothing to show yet"}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-2 text-xs text-fg-muted">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Enter</Kbd> to open
            </span>
            <span className="sr-only" aria-live="polite">
              {anyLoading ? "Searching" : `${flat.length} results`}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Binds ⌘K (macOS) / Ctrl+K globally to open the palette. Returns nothing; pass the setter.
 */
export function useCommandPaletteShortcut(
  setOpen: (update: (open: boolean) => boolean) => void,
): void {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((open) => !open);
      }
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
