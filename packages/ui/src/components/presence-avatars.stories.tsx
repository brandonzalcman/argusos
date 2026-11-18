import type { Meta, StoryObj } from "@storybook/react-vite";
import { PresenceAvatars, type PresencePerson } from "./presence-avatars.js";

const people: readonly PresencePerson[] = [
  { id: "p1", displayName: "Sample Person One", positionLabel: "Sample position" },
  { id: "p2", displayName: "Example Person Two" },
  { id: "p3", displayName: "Placeholder Three" },
  { id: "p4", displayName: "Demo Four" },
  { id: "p5", displayName: "Sample Five" },
  { id: "p6", displayName: "Example Six" },
];

const meta = {
  title: "Realtime/PresenceAvatars",
  component: PresenceAvatars,
  tags: ["autodocs"],
  args: { people: people.slice(0, 3) },
} satisfies Meta<typeof PresenceAvatars>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { people: [] } };
export const Overflow: Story = { args: { people, maxVisible: 3 } };
export const Dark: Story = { ...Overflow, globals: { theme: "dark" } };
export const Compact: Story = { ...Overflow, globals: { density: "compact" } };
export const HighContrast: Story = { ...Overflow, globals: { theme: "high-contrast" } };
