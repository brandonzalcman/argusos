import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ThemePreference } from "./preferences.js";
import { ThemeToggle } from "./theme-toggle.js";

const meta = {
  title: "Preferences/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
  args: { value: "light", onChange: () => undefined },
  argTypes: { value: { control: "select", options: ["system", "light", "dark", "high-contrast"] } },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: { readonly initial: ThemePreference }) {
  const [value, setValue] = useState<ThemePreference>(props.initial);
  return <ThemeToggle value={value} onChange={setValue} resolved="light" />;
}

export const Default: Story = { render: () => <Controlled initial="light" /> };
export const System: Story = { render: () => <Controlled initial="system" /> };
export const HighContrastSelected: Story = { render: () => <Controlled initial="high-contrast" /> };
export const Dark: Story = {
  render: () => <Controlled initial="dark" />,
  globals: { theme: "dark" },
};
export const Compact: Story = { ...Default, globals: { density: "compact" } };
export const HighContrast: Story = { ...HighContrastSelected, globals: { theme: "high-contrast" } };
