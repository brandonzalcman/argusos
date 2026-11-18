import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { filterCommands } from "../lib/command-model.js";
import { Button } from "./button.js";
import {
  CommandPalette,
  type CommandPaletteItem,
  type CommandPaletteSource,
} from "./command-palette.js";

const navigationItems: readonly CommandPaletteItem[] = [
  {
    id: "nav-1",
    title: "Sample page one",
    kind: "navigation",
    targetId: "sample-1",
    shortcut: ["G", "1"],
  },
  {
    id: "nav-2",
    title: "Sample page two",
    kind: "navigation",
    targetId: "sample-2",
    subtitle: "Example section",
  },
];

const recordItems: readonly CommandPaletteItem[] = [
  {
    id: "rec-1",
    title: "Sample record A",
    kind: "record",
    targetId: "record-a",
    subtitle: "Example table",
  },
  {
    id: "rec-2",
    title: "Sample record B",
    kind: "record",
    targetId: "record-b",
    subtitle: "Example table",
  },
];

const staticSource = (
  id: string,
  label: string,
  items: readonly CommandPaletteItem[],
): CommandPaletteSource => ({
  id,
  label,
  search: (query) => Promise.resolve(filterCommands(items, query)),
});

const readySources: readonly CommandPaletteSource[] = [
  staticSource("navigation", "Navigation", navigationItems),
  staticSource("records", "Records", recordItems),
];

const failingSources: readonly CommandPaletteSource[] = [
  staticSource("navigation", "Navigation", navigationItems),
  {
    id: "records",
    label: "Records",
    search: () => Promise.reject(new Error("Sample source failure")),
  },
];

const loadingSources: readonly CommandPaletteSource[] = [
  {
    id: "records",
    label: "Records",
    search: () => new Promise<readonly CommandPaletteItem[]>(() => undefined),
  },
];

const emptySources: readonly CommandPaletteSource[] = [
  staticSource("navigation", "Navigation", []),
];

function PaletteHarness(props: { readonly sources: readonly CommandPaletteSource[] }) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="grid gap-3">
      <Button onClick={() => setOpen(true)}>Open command palette</Button>
      <p className="text-sm text-fg-muted">Last selected: {selected ?? "none"}</p>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        sources={props.sources}
        onSelect={(item) => setSelected(item.title)}
      />
    </div>
  );
}

const meta = {
  title: "Overlays/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSelect: () => undefined,
    sources: readySources,
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 480 } } },
  render: (args) => <PaletteHarness sources={args.sources} />,
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SourceError: Story = { args: { sources: failingSources } };
export const Loading: Story = { args: { sources: loadingSources } };
export const NoResults: Story = { args: { sources: emptySources } };
export const Dark: Story = { globals: { theme: "dark" } };
export const Compact: Story = { globals: { density: "compact" } };
export const HighContrast: Story = { globals: { theme: "high-contrast" } };
