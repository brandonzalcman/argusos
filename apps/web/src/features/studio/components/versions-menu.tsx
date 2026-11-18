import { CodeEditor } from "@argus/code-editor";
import type { StudioVersionSummary } from "@argus/schema";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SkeletonGroup,
  SkeletonText,
} from "@argus/ui";
import { History } from "@argus/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { type ReactElement, useState } from "react";
import { useStudioPort } from "../../../services/studio.js";
import { classifyStudioError } from "./editor-model.js";

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export interface VersionsMenuProps {
  readonly componentId: string;
}

/** Popover listing versions with a read-only "view" of each. Rollback is not wired yet. */
export function VersionsMenu({ componentId }: VersionsMenuProps): ReactElement {
  const studio = useStudioPort();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const versions = useQuery({
    queryKey: ["studio", "versions", "component", componentId],
    enabled: open,
    retry: false,
    queryFn: () => studio.listVersions({ kind: "component", id: componentId }),
  });

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button leadingIcon={<History />} aria-haspopup="dialog">
            Versions
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" aria-label="Version history" className="w-96 max-w-[90vw]">
          <VersionList
            loading={versions.isLoading}
            error={versions.error}
            items={versions.data}
            onRetry={() => void versions.refetch()}
            onView={(version) => {
              setOpen(false);
              setViewing(version);
            }}
          />
          {/* TODO(implementation): rollback via studio.rollback(restoreVersion, changeSummary).
              Input: a published version to restore. Output: a new published version.
              Errors: definition-version-conflict when the published version moved on.
              Depends on: publishDefinitions permission and a confirmation dialog. */}
          <p className="mt-2 text-xs text-fg-muted">Rollback isn't available here yet.</p>
        </PopoverContent>
      </Popover>
      <Dialog
        open={viewing !== null}
        onOpenChange={(next) => (next ? undefined : setViewing(null))}
      >
        {viewing !== null ? <VersionViewer componentId={componentId} version={viewing} /> : null}
      </Dialog>
    </>
  );
}

interface VersionListProps {
  readonly loading: boolean;
  readonly error: unknown;
  readonly items: readonly StudioVersionSummary[] | undefined;
  readonly onRetry: () => void;
  readonly onView: (version: number) => void;
}

function VersionList({ loading, error, items, onRetry, onView }: VersionListProps): ReactElement {
  if (loading) {
    return (
      <SkeletonGroup label="Loading versions">
        <SkeletonText lines={4} />
      </SkeletonGroup>
    );
  }
  if (error) {
    return classifyStudioError(error) === "not-connected" ? (
      <EmptyState size="inline" title="Studio isn't connected yet" />
    ) : (
      <ErrorState
        title="Couldn't load versions"
        description={error instanceof Error ? error.message : undefined}
        onRetry={onRetry}
      />
    );
  }
  if (!items || items.length === 0) {
    return <EmptyState size="inline" title="No versions yet" />;
  }
  const sorted = [...items].sort((a, b) => b.version - a.version);
  return (
    <ul className="grid max-h-72 gap-1 overflow-auto" aria-label="Versions">
      {sorted.map((item) => (
        <li
          key={item.version}
          className="flex items-start gap-2 rounded-sm border border-border p-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <strong className="font-mono">v{item.version}</strong>
              <Badge
                tone={item.lifecycle === "published" ? "success" : "neutral"}
                variant="outline"
              >
                {item.lifecycle}
              </Badge>
            </p>
            <p className="text-fg-muted">
              <time dateTime={item.createdAt}>{when(item.createdAt)}</time>
            </p>
            {item.changeSummary ? <p className="break-words">{item.changeSummary}</p> : null}
          </div>
          <Button size="sm" onClick={() => onView(item.version)}>
            View
            <span className="sr-only"> version {item.version}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}

function VersionViewer({
  componentId,
  version,
}: {
  readonly componentId: string;
  readonly version: number;
}): ReactElement {
  const studio = useStudioPort();
  const result = useQuery({
    queryKey: ["studio", "get", "component", componentId, version],
    retry: false,
    queryFn: () => studio.get({ kind: "component", id: componentId, revision: version }),
  });
  const document = result.data?.document;
  const definition = document?.kind === "component" ? document.definition : null;
  return (
    <DialogContent
      size="xl"
      title={`Version ${version} (read-only)`}
      description="A saved version of this component. Viewing doesn't change the draft."
    >
      {result.isLoading ? (
        <SkeletonGroup label="Loading version">
          <SkeletonText lines={8} />
        </SkeletonGroup>
      ) : definition ? (
        <div className="grid gap-2">
          <p className="text-sm text-fg-muted">
            {definition.props.length} prop{definition.props.length === 1 ? "" : "s"} ·{" "}
            {definition.capabilities.length} capabilit
            {definition.capabilities.length === 1 ? "y" : "ies"}
            {definition.changeSummary ? ` · ${definition.changeSummary}` : ""}
          </p>
          <CodeEditor
            value={definition.source}
            onChange={() => undefined}
            language="tsx"
            readOnly
            aria-label={`Source of version ${version}, read-only`}
            minHeight="16rem"
            maxHeight="60vh"
          />
        </div>
      ) : (
        <ErrorState
          title="Couldn't load this version"
          description={result.error instanceof Error ? result.error.message : "It doesn't exist."}
          onRetry={() => void result.refetch()}
        />
      )}
    </DialogContent>
  );
}
