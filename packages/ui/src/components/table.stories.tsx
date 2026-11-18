import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StatusPill } from "./badge.js";
import { Button } from "./button.js";
import { EmptyState, ErrorState, Skeleton, SkeletonGroup } from "./states.js";
import {
  type SortDirection,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableStateRow,
} from "./table.js";

const rows = [
  { id: "SAMPLE-001", name: "Sample record A", status: "ok", count: 12 },
  { id: "SAMPLE-002", name: "Sample record B", status: "medium", count: 7 },
  { id: "SAMPLE-003", name: "Sample record C", status: "stale", count: 0 },
] as const;

function Head(props: { readonly sort?: SortDirection; readonly onSort?: () => void }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead
          {...(props.onSort ? { onSort: props.onSort } : {})}
          {...(props.sort ? { sort: props.sort } : {})}
        >
          Name
        </TableHead>
        <TableHead>ID</TableHead>
        <TableHead align="end">Count</TableHead>
      </TableRow>
    </TableHeader>
  );
}

const meta = {
  title: "Data/Table",
  component: Table,
  tags: ["autodocs"],
  render: (args) => (
    <TableContainer>
      <Table {...args}>
        <TableCaption className="sr-only">Sample records</TableCaption>
        <Head />
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <StatusPill status={row.status} size="sm" />
              </TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell mono muted>
                {row.id}
              </TableCell>
              <TableCell align="end">{row.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  ),
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RowStates: Story = {
  render: () => (
    <TableContainer>
      <Table aria-label="Row state examples">
        <Head />
        <TableBody>
          <TableRow interactive>
            <TableCell>Interactive</TableCell>
            <TableCell>Sample record A</TableCell>
            <TableCell mono>SAMPLE-001</TableCell>
            <TableCell align="end">1</TableCell>
          </TableRow>
          <TableRow selected>
            <TableCell>Selected</TableCell>
            <TableCell>Sample record B</TableCell>
            <TableCell mono>SAMPLE-002</TableCell>
            <TableCell align="end">2</TableCell>
          </TableRow>
          <TableRow highlighted>
            <TableCell>Highlighted</TableCell>
            <TableCell>Sample record C</TableCell>
            <TableCell mono>SAMPLE-003</TableCell>
            <TableCell align="end">3</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

function SortableTable() {
  const [sort, setSort] = useState<SortDirection>("ascending");
  const ordered = sort === "descending" ? [...rows].reverse() : rows;
  return (
    <TableContainer>
      <Table aria-label="Sortable sample records">
        <Head
          sort={sort}
          onSort={() => setSort(sort === "ascending" ? "descending" : "ascending")}
        />
        <TableBody>
          {ordered.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <StatusPill status={row.status} size="sm" />
              </TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell mono>{row.id}</TableCell>
              <TableCell align="end">{row.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export const Sortable: Story = { render: () => <SortableTable /> };

export const Loading: Story = {
  render: () => (
    <TableContainer>
      <Table aria-label="Loading sample records" aria-busy="true">
        <Head />
        <TableBody>
          <TableStateRow colSpan={4}>
            <SkeletonGroup label="Loading rows">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="mt-2 h-6 w-full" />
              <Skeleton className="mt-2 h-6 w-full" />
            </SkeletonGroup>
          </TableStateRow>
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const Empty: Story = {
  render: () => (
    <TableContainer>
      <Table aria-label="Empty sample records">
        <Head />
        <TableBody>
          <TableStateRow colSpan={4}>
            <EmptyState
              title="No records yet"
              description="Placeholder empty state for a table."
              action={<Button variant="primary">Add record</Button>}
            />
          </TableStateRow>
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const ErrorRow: Story = {
  render: () => (
    <TableContainer>
      <Table aria-label="Failed sample records">
        <Head />
        <TableBody>
          <TableStateRow colSpan={4}>
            <ErrorState
              title="Could not load records"
              description="Placeholder error message."
              onRetry={() => undefined}
            />
          </TableStateRow>
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const ScrollingMaxHeight: Story = {
  render: () => (
    <TableContainer maxHeight="12rem">
      <Table aria-label="Long sample records">
        <Head />
        <TableBody>
          {Array.from({ length: 20 }, (_, index) => (
            <TableRow key={`row-${index + 1}`}>
              <TableCell>Row</TableCell>
              <TableCell>Sample record {index + 1}</TableCell>
              <TableCell mono>SAMPLE-{String(index + 1).padStart(3, "0")}</TableCell>
              <TableCell align="end">{index}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
export const Compact: Story = { ...Default, globals: { density: "compact" } };
export const HighContrast: Story = { ...Default, globals: { theme: "high-contrast" } };
