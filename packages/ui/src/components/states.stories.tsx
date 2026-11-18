import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderOpen } from "lucide-react";
import { Button } from "./button.js";
import { EmptyState, ErrorState, Skeleton, SkeletonGroup, SkeletonText } from "./states.js";

const meta = {
  title: "Feedback/States",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    title: "Nothing here yet",
    description: "Placeholder empty state description.",
    size: "inline",
  },
  argTypes: { size: { control: "inline-radio", options: ["inline", "page"] } },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyWithAction: Story = {
  args: {
    icon: <FolderOpen />,
    action: <Button variant="primary">Add record</Button>,
  },
};

export const EmptyPage: Story = { args: { size: "page" } };

export const ErrorInline: Story = {
  render: () => (
    <ErrorState
      title="Could not load data"
      description="Placeholder error description."
      onRetry={() => undefined}
      reference="REF-SAMPLE"
    />
  ),
};

export const ErrorRetrying: Story = {
  render: () => <ErrorState title="Could not load data" onRetry={() => undefined} retrying />,
};

export const ErrorPage: Story = {
  render: () => (
    <ErrorState
      size="page"
      title="Something went wrong"
      description="Placeholder error description."
      action={<Button>Go back</Button>}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <SkeletonGroup label="Loading sample block">
        <Skeleton className="h-24 w-full" />
      </SkeletonGroup>
      <SkeletonGroup label="Loading sample text">
        <SkeletonText lines={4} />
      </SkeletonGroup>
      <SkeletonGroup label="Loading sample avatar">
        <Skeleton shape="circle" className="size-10" />
      </SkeletonGroup>
    </div>
  ),
};

export const Dark: Story = { ...EmptyWithAction, globals: { theme: "dark" } };
export const Compact: Story = { ...EmptyWithAction, globals: { density: "compact" } };
export const HighContrast: Story = { ...ErrorInline, globals: { theme: "high-contrast" } };
