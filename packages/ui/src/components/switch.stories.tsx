import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Switch } from "./switch.js";

const meta = {
  title: "Forms/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { label: "Sample setting", description: "Placeholder helper text." },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Switch label="Off" />
      <Switch label="On" defaultChecked />
      <Switch label="Disabled" disabled />
      <Switch label="Disabled and on" disabled defaultChecked />
      <Switch label="Without state label" showStateLabel={false} defaultChecked />
      <Switch aria-label="Switch without visible label" />
    </div>
  ),
};

function ControlledSwitch() {
  const [checked, setChecked] = useState(false);
  return <Switch label="Controlled setting" checked={checked} onCheckedChange={setChecked} />;
}

export const Controlled: Story = { render: () => <ControlledSwitch /> };
export const Dark: Story = { ...States, globals: { theme: "dark" } };
export const Compact: Story = { ...States, globals: { density: "compact" } };
export const HighContrast: Story = { ...States, globals: { theme: "high-contrast" } };
