import type { TableDefinition } from "@argus/schema";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageContainer,
  PageHeader,
  StatusPill,
} from "@argus/ui";
import { Pencil, Search, Table2 } from "@argus/ui/icons";
import { Link } from "@tanstack/react-router";
import { type ReactElement, useMemo, useState } from "react";
import { LoadError, LoadingSkeleton, SyncBadge } from "./states.js";
import { useTableCatalog } from "./use-live.js";

const scopeLabel: Readonly<Record<TableDefinition["incidentScope"], string>> = {
  incident: "Incident-scoped",
  global: "Global",
};

/**
 * Catalog of authorized tables from the live catalog subscription.
 * Input: none (tenant/incident scope is bound inside the data port).
 * Output: searchable list linking to the data grid and designer.
 * Errors: shown as an error state with retry; nothing is fabricated while the catalog is unavailable.
 * Depends on: TablesDataPort.subscribeCatalog. Hidden tables are simply absent from the list.
 */
export function TablesListPage(): ReactElement {
  const catalog = useTableCatalog();
  const [query, setQuery] = useState("");

  const tables = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const all = catalog.value ?? [];
    return needle
      ? all.filter(
          (t) =>
            t.name.toLocaleLowerCase().includes(needle) ||
            (t.description ?? "").toLocaleLowerCase().includes(needle),
        )
      : all;
  }, [catalog.value, query]);

  const ready = catalog.status === "ready";
  const total = catalog.value?.length ?? 0;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Tables"
        description="Live, user-built tables and their saved views."
        meta={<SyncBadge sync={catalog.sync} />}
      />

      {catalog.status === "loading" ? <LoadingSkeleton label="Loading tables" /> : null}
      {catalog.status === "error" ? (
        <LoadError
          title="Tables could not be loaded"
          error={catalog.error}
          onRetry={catalog.retry}
        />
      ) : null}

      {ready && total === 0 ? (
        <Card>
          <EmptyState
            size="page"
            icon={<Table2 />}
            title="No tables yet"
            description="Tables you are allowed to read appear here. Creating a table starts a draft in the designer and a DDL migration plan."
          />
          {/* TODO(implementation): "Create table" starts a draft with an initial create-table migration plan. */}
        </Card>
      ) : null}

      {ready && total > 0 ? (
        <>
          <div className="max-w-sm">
            <Field label="Search tables">
              <Input
                type="search"
                leadingIcon={<Search />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>
          </div>
          {tables.length === 0 ? (
            <p role="status" className="text-fg-muted">
              No tables match “{query}”.
            </p>
          ) : (
            <ul
              aria-label="Tables"
              className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-(--argus-gap) p-0"
            >
              {tables.map((table) => (
                <li key={table.id}>
                  <Card elevation="raised" className="grid h-full content-start gap-3 p-(--argus-panel-p)">
                    <div className="grid gap-1">
                      <h2 className="text-md font-semibold text-fg">
                        <Link
                          to="/tables/$tableId"
                          params={{ tableId: table.id }}
                          className="rounded-sm text-accent-text hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                        >
                          {table.name}
                        </Link>
                      </h2>
                      {table.description ? (
                        <p className="text-sm text-fg-muted">{table.description}</p>
                      ) : null}
                    </div>
                    <p className="m-0 flex flex-wrap items-center gap-2">
                      <Badge tone={table.incidentScope === "incident" ? "accent" : "neutral"}>
                        {scopeLabel[table.incidentScope]}
                      </Badge>
                      <Badge>{table.fields.length} fields</Badge>
                      <Badge variant="outline">
                        <span className="font-mono">v{table.version}</span>
                      </Badge>
                      {table.lifecycle === "published" ? (
                        <StatusPill status="ok" label="Published" size="sm" />
                      ) : (
                        <StatusPill status="medium" label={table.lifecycle} size="sm" />
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="primary" size="sm">
                        <Link to="/tables/$tableId" params={{ tableId: table.id }}>
                          <Table2 aria-hidden="true" className="size-4" /> Open data
                        </Link>
                      </Button>
                      <Button asChild variant="secondary" size="sm">
                        <Link to="/tables/$tableId/design" params={{ tableId: table.id }}>
                          <Pencil aria-hidden="true" className="size-4" /> Design
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </PageContainer>
  );
}
