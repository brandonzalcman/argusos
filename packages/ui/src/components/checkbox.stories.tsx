import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Checkbox, type CheckedState } from "./checkbox.js";

const meta = {
  title: "Forms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { label: "Sample option", description: "Placeholder helper text." },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" checked="indeterminate" />
      <Checkbox label="Required" required />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled and checked" disabled defaultChecked />
      <Checkbox aria-label="Checkbox without visible label" />
    </div>
  ),
};

function ControlledCheckbox() {
  const [checked, setChecked] = useState<CheckedState>(false);
  return <Checkbox label="Controlled option" checked={checked} onCheckedChange={setChecked} />;
}

export const Controlled: Story = { render: () => <ControlledCheckbox /> };
export const Dark: Story = { ...States, globals: { theme: "dark" } };
export const Compact: Story = { ...States, globals: { density: "compact" } };
export const HighContrast: Story = { ...States, globals: { theme: "high-contrast" } };
