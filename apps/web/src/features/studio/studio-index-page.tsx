import type { StudioDefinitionKind, StudioDefinitionSummary } from "@argus/schema";
import {
  Button,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageContainer,
  PageHeader,
  SkeletonGroup,
  SkeletonText,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@argus/ui";
import {
  Code2,
  ExternalLink,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Puzzle,
  Search,
} from "@argus/ui/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactElement, type ReactNode, useState } from "react";
import { useStudioPort } from "../../services/studio.js";
import { CreateDefinitionDialog, type CreateDefinitionRequest } from "./create-definition-dialog.js";
import { useDevMode } from "./dev-mode.js";
import { useSessionSnapshot } from "./session.js";
import { builderHref, kindLabels, runtimeHref, statusLabel } from "./studio-links.js";

const kinds: readonly StudioDefinitionKind[] = ["board", "page", "component"];

const kindIcons: Readonly<Record<StudioDefinitionKind, ReactNode>> = {
  board: <LayoutGrid />,
  page: <FileText />,
  component: <Puzzle />,
};

const kindDescriptions: Readonly<Record<StudioDefinitionKind, string>> = {
  board: "Data-centric workspaces: table sources, views and blocks.",
  page: "Composable pages and position homepages built from blocks.",
  component: "Custom interface code that runs in the secure sandbox.",
};

/** True when an error comes from a disconnected stub port. */
export function isNotConnected(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("TODO(implementation)");
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `studio-${Date.now()}-${Math.random()}`;
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

function DefinitionList({ kind }: { readonly kind: StudioDefinitionKind }): ReactElement {
  const studio = useStudioPort();
  const { permissions } = useDevMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const labels = kindLabels[kind];

  const list = useQuery({
    queryKey: ["studio", "list", kind],
    queryFn: () => studio.list({ kind, search: null, cursor: null, limit: 200 }),
    retry: (count, error) => !isNotConnected(error) && count < 2,
  });

  const create = useMutation({
    mutationFn: (request: CreateDefinitionRequest) =>
      studio.create({ ...request, idempotencyKey: newIdempotencyKey() }),
    onSuccess: async (result, request) => {
      await queryClient.invalidateQueries({ queryKey: ["studio", "list", request.kind] });
      setCreating(false);
      void navigate({ to: builderHref(request.kind, result.id) });
    },
  });

  const canCreate = permissions.editDefinitions && (kind !== "component" || permissions.editCode);
  const items = (list.data?.items ?? []).filter((item) => {
    const q = search.trim().toLowerCase();
    return (
      q === "" ||
      item.name.toLowerCase().includes(q) ||
      item.key.includes(q) ||
      (item.slug ?? "").includes(q)
    );
  });

  let body: ReactNode;
  if (list.isLoading) {
    body = (
      <SkeletonGroup label={`Loading ${labels.plural.toLowerCase()}`} className="p-4">
        <SkeletonText lines={4} />
      </SkeletonGroup>
    );
  } else if (list.error) {
    body = isNotConnected(list.error) ? (
      <EmptyState
        icon={<Code2 />}
        title="Studio isn't connected yet"
        description="Drafts, versions and publishing are stored by the API. It isn't connected in this build, so nothing can be listed or saved."
      />
    ) : (
      <ErrorState
        title={`Couldn't load ${labels.plural.toLowerCase()}`}
        description={list.error.message}
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else if ((list.data?.items.length ?? 0) === 0) {
    body = (
      <EmptyState
        icon={kindIcons[kind]}
        title={`No ${labels.plural.toLowerCase()} yet`}
        description={kindDescriptions[kind]}
        action={
          canCreate ? (
            <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreating(true)}>
              New {labels.singular.toLowerCase()}
            </Button>
          ) : null
        }
      />
    );
  } else if (items.length === 0) {
    body = <EmptyState icon={<Search />} title={`No ${labels.plural.toLowerCase()} match “${search}”`} />;
  } else {
    body = (
      <TableContainer className="rounded-none border-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>{kind === "page" ? "URL" : "Key"}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead align="end">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <DefinitionRow key={item.id} item={item} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-xs">
          <Input
            aria-label={`Search ${labels.plural.toLowerCase()}`}
            placeholder={`Search ${labels.plural.toLowerCase()}…`}
            leadingIcon={<Search />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {canCreate ? (
          <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreating(true)}>
            New {labels.singular.toLowerCase()}
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-sm">{body}</div>
      <Dialog open={creating} onOpenChange={(open) => (create.isPending ? undefined : setCreating(open))}>
        {creating ? (
          <CreateDefinitionDialog
            kind={kind}
            existing={list.data?.items ?? []}
            pending={create.isPending}
            error={
              create.error
                ? isNotConnected(create.error)
                  ? "Studio isn't connected yet, so the draft can't be created."
                  : create.error.message
                : null
            }
            onSubmit={(request) => create.mutate(request)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}

function DefinitionRow({ item }: { readonly item: StudioDefinitionSummary }): ReactElement {
  const status = statusLabel(item);
  const runtime = runtimeHref(item);
  const editHref = builderHref(item.kind, item.id);
  return (
    <TableRow>
      <TableCell>
        <div className="grid gap-0.5">
          {item.permissions.edit ? (
            <Link to={editHref} className="font-medium text-fg hover:text-accent-text hover:underline">
              {item.name}
            </Link>
          ) : (
            <span className="font-medium text-fg">{item.name}</span>
          )}
          {item.description ? (
            <span className="line-clamp-1 text-sm text-fg-muted">{item.description}</span>
          ) : null}
        </div>
      </TableCell>
      <TableCell mono muted>
        {item.kind === "page" && item.slug ? `/p/${item.slug}` : item.key}
      </TableCell>
      <TableCell>
        <StatusPill status={status.status} label={status.label} size="sm" />
      </TableCell>
      <TableCell muted>
        <time dateTime={item.updatedAt}>{relative(item.updatedAt)}</time>
      </TableCell>
      <TableCell align="end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={`Actions for ${item.name}`} icon={<MoreHorizontal />} size="sm" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {item.permissions.edit ? (
              <DropdownMenuItem asChild>
                <Link to={editHref}>
                  <Pencil aria-hidden="true" />
                  Open in builder
                </Link>
              </DropdownMenuItem>
            ) : null}
            {runtime ? (
              <DropdownMenuItem asChild>
                <Link to={runtime}>
                  <ExternalLink aria-hidden="true" />
                  View published
                </Link>
              </DropdownMenuItem>
            ) : null}
            {/* TODO(implementation): duplicate and archive (with ConfirmDialog) via studio.create/archive. */}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/**
 * `/studio` — dev mode home: boards, pages and custom components with draft/published status.
 * Access requires StudioPermissions.viewStudio; the API re-checks every call.
 */
export function StudioIndexPage(): ReactElement {
  const { snapshot, loading } = useSessionSnapshot();
  const { available } = useDevMode();
  const [tab, setTab] = useState<StudioDefinitionKind>("board");

  let content: ReactNode;
  if (loading) {
    content = (
      <SkeletonGroup label="Loading session">
        <SkeletonText lines={3} />
      </SkeletonGroup>
    );
  } else if (!snapshot) {
    content = (
      <EmptyState
        size="page"
        icon={<Code2 />}
        title="Sign in to use dev mode"
        description="Dev mode lets authorised positions build boards, pages and custom components in the browser. Sign-in isn't connected in this build yet."
      />
    );
  } else if (!available) {
    content = (
      <EmptyState
        size="page"
        icon={<Code2 />}
        title="Dev mode isn't available for your position"
        description={`${snapshot.position.name} can't edit boards, pages or components. Ask an administrator for studio access.`}
      />
    );
  } else {
    content = (
      <Tabs value={tab} onValueChange={(value) => setTab(value as StudioDefinitionKind)}>
        <TabsList aria-label="Definition types">
          {kinds.map((kind) => (
            <TabsTrigger key={kind} value={kind}>
              <span aria-hidden="true" className="[&_svg]:size-4">
                {kindIcons[kind]}
              </span>
              {kindLabels[kind].plural}
            </TabsTrigger>
          ))}
        </TabsList>
        {kinds.map((kind) => (
          <TabsContent key={kind} value={kind}>
            <DefinitionList kind={kind} />
          </TabsContent>
        ))}
      </Tabs>
    );
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Dev mode"
        title="Studio"
        description="Build boards, pages and interface components visually, or edit their code. Everything is a draft until you publish."
      />
      {content}
    </PageContainer>
  );
}
