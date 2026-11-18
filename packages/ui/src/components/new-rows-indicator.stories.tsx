import type { Meta, StoryObj } from "@storybook/react-vite";
import { NewRowsIndicator } from "./new-rows-indicator.js";

const meta = {
  title: "Realtime/NewRowsIndicator",
  component: NewRowsIndicator,
  tags: ["autodocs"],
  args: { count: 3, noun: "rows" },
} satisfies Meta<typeof NewRowsIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithButton: Story = { args: { onShowNewRows: () => undefined } };
export const Singular: Story = { args: { count: 1, onShowNewRows: () => undefined } };
/** A count of 0 renders nothing, so layout never shifts. */
export const ZeroRendersNothing: Story = { args: { count: 0 } };
export const Dark: Story = { ...WithButton, globals: { theme: "dark" } };
export const Compact: Story = { ...WithButton, globals: { density: "compact" } };
export const HighContrast: Story = { ...WithButton, globals: { theme: "high-contrast" } };
