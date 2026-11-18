import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { StatusPill } from "./badge.js";
import { Button } from "./button.js";
import { PageHeader } from "./page-header.js";

const meta = {
  title: "Layout/PageHeader",
  component: PageHeader,
  tags: ["autodocs"],
  args: { title: "Sample page", description: "A neutral placeholder description for this page." },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Full: Story = {
  args: {
    eyebrow: "Sample section",
    breadcrumbs: [
      { label: "Home", link: <a href="#home">Home</a> },
      { label: "Section", link: <a href="#section">Section</a> },
      { label: "Sample page" },
    ],
    actions: (
      <Button variant="primary" leadingIcon={<Plus aria-hidden="true" />}>
        New record
      </Button>
    ),
    meta: <StatusPill status="info" size="sm" label="Placeholder meta" />,
  },
};

export const TitleOnly: Story = { args: { description: undefined } };
export const Dark: Story = { ...Full, globals: { theme: "dark" } };
export const Compact: Story = { ...Full, globals: { density: "compact" } };
export const HighContrast: Story = { ...Full, globals: { theme: "high-contrast" } };
