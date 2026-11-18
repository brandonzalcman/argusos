import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConflictBanner } from "./conflict-banner.js";

const meta = {
  title: "Realtime/ConflictBanner",
  component: ConflictBanner,
  tags: ["autodocs"],
  args: {
    recordLabel: "Sample record",
    fields: [
      {
        fieldId: "sample-field",
        fieldLabel: "Sample field",
        localValue: "Local sample value",
        serverValue: "Server sample value",
      },
    ],
    onReview: () => undefined,
    onKeepMine: () => undefined,
    onKeepTheirs: () => undefined,
  },
} satisfies Meta<typeof ConflictBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MultipleFields: Story = {
  args: {
    fields: [
      {
        fieldId: "f1",
        fieldLabel: "Sample field A",
        localValue: "Local A",
        serverValue: "Server A",
      },
      {
        fieldId: "f2",
        fieldLabel: "Sample field B",
        localValue: "Local B",
        serverValue: "Server B",
      },
    ],
  },
};

export const WithoutActions: Story = {
  render: (args) => <ConflictBanner recordLabel={args.recordLabel} fields={args.fields} />,
};

export const Dark: Story = { globals: { theme: "dark" } };
export const Compact: Story = { globals: { density: "compact" } };
export const HighContrast: Story = { globals: { theme: "high-contrast" } };
