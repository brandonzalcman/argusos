import type { Meta, StoryObj } from "@storybook/react-vite";
import { Star } from "lucide-react";
import { tones } from "../tokens.js";
import type { BadgeVariant } from "./badge.js";
import { Badge, StatusDot, StatusPill, statusLevels } from "./badge.js";

const variants: readonly BadgeVariant[] = ["subtle", "outline", "solid"];

const meta = {
  title: "Data/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "Sample badge", tone: "neutral", variant: "subtle", size: "md" },
  argTypes: {
    tone: { control: "select", options: tones },
    variant: { control: "inline-radio", options: variants },
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  render: (args) => (
    <div className="grid gap-3">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          {tones.map((tone) => (
            <Badge key={tone} {...args} tone={tone} variant={variant}>
              {tone}
            </Badge>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge {...args} size="sm" icon={<Star />}>
        Small
      </Badge>
      <Badge {...args} size="md" icon={<Star />}>
        Medium
      </Badge>
    </div>
  ),
};

export const StatusPills: Story = {
  render: () => (
    <div className="grid gap-3">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-2">
          {statusLevels.map((status) => (
            <StatusPill key={status} status={status} variant={variant} />
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {statusLevels.map((status) => (
          <StatusPill key={status} status={status} size="sm" />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status="critical" attention />
        <StatusPill status="high" label="Custom label" />
      </div>
    </div>
  ),
};

export const StatusDots: Story = {
  render: () => (
    <div className="grid gap-2">
      {tones.map((tone) => (
        <StatusDot key={tone} tone={tone} label={`Tone: ${tone}`} />
      ))}
      <StatusDot tone="critical" label="Pulsing sample" pulse />
      <StatusDot tone="success" label="Label hidden visually" showLabel={false} />
    </div>
  ),
};

export const Dark: Story = { ...StatusPills, globals: { theme: "dark" } };
export const Compact: Story = { ...Tones, globals: { density: "compact" } };
export const HighContrast: Story = { ...StatusPills, globals: { theme: "high-contrast" } };
