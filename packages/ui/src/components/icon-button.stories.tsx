import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Settings, Trash2 } from "lucide-react";
import { IconButton } from "./icon-button.js";

const meta = {
  title: "Actions/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  args: { label: "Add item", icon: <Plus />, variant: "ghost", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton {...args} variant="primary" label="Add item" icon={<Plus />} />
      <IconButton {...args} variant="secondary" label="Open settings" icon={<Settings />} />
      <IconButton {...args} variant="ghost" label="Add item" icon={<Plus />} />
      <IconButton {...args} variant="danger" label="Delete item" icon={<Trash2 />} />
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <IconButton {...args} size="sm" label="Small action" />
      <IconButton {...args} size="md" label="Medium action" />
      <IconButton {...args} size="lg" label="Large action" />
    </div>
  ),
};

export const WithShortcut: Story = { args: { label: "Add item", shortcut: ["Ctrl", "N"] } };
export const Disabled: Story = { args: { disabled: true } };
export const Dark: Story = { ...Variants, globals: { theme: "dark" } };
export const Compact: Story = { ...Sizes, globals: { density: "compact" } };
export const HighContrast: Story = { ...Variants, globals: { theme: "high-contrast" } };
