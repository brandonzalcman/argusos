import { EmptyState, ErrorState, SkeletonGroup, SkeletonText } from "@argus/ui";
import { Code2, Lock, Puzzle, SearchX } from "@argus/ui/icons";
import type { ReactElement } from "react";
import type { LoadFailure } from "./editor-model.js";

/** Loading skeleton for the whole editor (content, so a skeleton and not a spinner). */
export function EditorLoading(): ReactElement {
  return (
    <SkeletonGroup label="Loading component">
      <SkeletonText lines={3} />
      <SkeletonText lines={8} />
    </SkeletonGroup>
  );
}

export type EditorBlockedReason = "signed-out" | "no-access";

/** Signed out, or signed in without dev-mode access. Renders nothing about the component. */
export function EditorBlocked({ reason }: { readonly reason: EditorBlockedReason }): ReactElement {
  return reason === "signed-out" ? (
    <EmptyState
      size="page"
      icon={<Lock />}
      title="Sign in to edit components"
      description="Dev mode needs a signed-in position. Nothing about this component is shown until you sign in."
    />
  ) : (
    <EmptyState
      size="page"
      icon={<Lock />}
      title="Your position can't open dev mode"
      description="Ask an administrator to give your position the “view studio” permission."
    />
  );
}

export interface EditorLoadFailureProps {
  readonly failure: LoadFailure;
  readonly message: string;
  readonly onRetry: () => void;
  readonly retrying: boolean;
}

/** Not connected, not found, forbidden or a generic load error. */
export function EditorLoadFailure({
  failure,
  message,
  onRetry,
  retrying,
}: EditorLoadFailureProps): ReactElement {
  switch (failure) {
    case "not-connected":
      return (
        <EmptyState
          size="page"
          icon={<Code2 />}
          title="Studio isn't connected yet"
          description="Drafts, versions and publishing are stored by the API. It isn't connected in this build, so this component can't be loaded or saved."
        />
      );
    case "not-found":
      return (
        <EmptyState
          size="page"
          icon={<SearchX />}
          title="Component not found"
          description="It may have been archived, or you may not have access to it."
        />
      );
    case "forbidden":
      return (
        <EmptyState
          size="page"
          icon={<Lock />}
          title="You can't open this component"
          description="Your position doesn't have access to custom components."
        />
      );
    case "signed-out":
      return <EditorBlocked reason="signed-out" />;
    case "error":
      return (
        <ErrorState
          title="Couldn't load the component"
          description={message}
          onRetry={onRetry}
          retrying={retrying}
        />
      );
  }
}

export function MissingComponentId(): ReactElement {
  return (
    <EmptyState
      size="page"
      icon={<Puzzle />}
      title="No component selected"
      description="Open a component from the studio list."
    />
  );
}

/** Visible explanation for read-only mode. */
export function ReadOnlyNotice({ reason }: { readonly reason: string }): ReactElement {
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-md border border-border-strong bg-surface-sunken p-3 text-sm text-fg"
    >
      <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-muted" />
      <p>{reason}</p>
    </div>
  );
}
