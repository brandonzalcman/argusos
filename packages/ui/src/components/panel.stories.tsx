import type { Meta, StoryObj } from "@storybook/react-vite";
import { RefreshCw } from "lucide-react";
import { StatusPill } from "./badge.js";
import { IconButton } from "./icon-button.js";
import { Card, Panel } from "./panel.js";
import { EmptyState, ErrorState, SkeletonGroup, SkeletonText } from "./states.js";

const meta: Meta<typeof Panel> = {
  title: "Layout/Panel",
  component: Panel,
  tags: ["autodocs"],
  args: {
    title: "Sample panel",
    description: "A neutral placeholder description.",
    children: <p className="text-base">Sample panel body content.</p>,
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActionsStatusFooter: Story = {
  args: {
    actions: <IconButton label="Refresh" icon={<RefreshCw />} size="sm" />,
    status: <StatusPill status="ok" size="sm" label="Placeholder status" />,
    footer: <span className="text-sm text-fg-muted">Sample footer text</span>,
  },
};

export const Flush: Story = { args: { flush: true } };

export const Loading: Story = {
  args: {
    children: (
      <SkeletonGroup label="Loading panel">
        <SkeletonText lines={3} />
      </SkeletonGroup>
    ),
  },
};

export const Empty: Story = {
  args: { children: <EmptyState title="Nothing to show" description="Placeholder empty panel." /> },
};

export const ErrorPanel: Story = {
  args: {
    children: (
      <ErrorState
        title="Could not load panel"
        description="Placeholder error."
        onRetry={() => undefined}
      />
    ),
  },
};

export const Cards: Story = {
  render: () => (
    <div className="grid max-w-xl gap-3">
      <Card>Flat card with sample content.</Card>
      <Card elevation="raised">Raised card with sample content.</Card>
      <Card flush>Flush card without padding.</Card>
    </div>
  ),
};

export const Dark: Story = { ...WithActionsStatusFooter, globals: { theme: "dark" } };
export const Compact: Story = { ...WithActionsStatusFooter, globals: { density: "compact" } };
export const HighContrast: Story = {
  ...WithActionsStatusFooter,
  globals: { theme: "high-contrast" },
};
