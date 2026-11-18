import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./button.js";

/*
 * Story conventions for @argus/ui (follow in every *.stories.tsx):
 * - One `meta` per component, title "<Group>/<Component>", tags ["autodocs"].
 * - Cover: Default, each variant/size, Loading, Disabled, Empty/Error where relevant,
 *   Dark (`globals: { theme: "dark" }`) and Compact (`globals: { density: "compact" }`).
 * - Content is neutral sample copy, never realistic operational data.
 */
const meta = {
  title: "Actions/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Save changes", variant: "secondary", size: "md" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "ghost", "danger", "link"],
    },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} variant="primary" leadingIcon={<Plus aria-hidden="true" />}>
        New record
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="danger" leadingIcon={<Trash2 aria-hidden="true" />}>
        Delete
      </Button>
      <Button {...args} variant="link">
        Link
      </Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const Loading: Story = { args: { loading: true, variant: "primary", children: "Saving" } };
export const Disabled: Story = { args: { disabled: true } };
export const Dark: Story = { ...Variants, globals: { theme: "dark" } };
export const Compact: Story = { ...Sizes, globals: { density: "compact" } };
export const HighContrast: Story = { ...Variants, globals: { theme: "high-contrast" } };
