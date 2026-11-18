import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Field } from "./field.js";
import { Select, type SelectOption, type SelectOptionGroup } from "./select.js";

const options: readonly SelectOption[] = [
  { value: "alpha", label: "Example option A" },
  { value: "beta", label: "Example option B" },
  { value: "gamma", label: "Example option C (unavailable)", disabled: true },
];

const grouped: readonly SelectOptionGroup[] = [
  {
    label: "Group one",
    options: [
      { value: "one-a", label: "Sample A" },
      { value: "one-b", label: "Sample B" },
    ],
  },
  { label: "Group two", options: [{ value: "two-a", label: "Sample C" }] },
];

const meta: Meta<typeof Select> = {
  title: "Forms/Select",
  component: Select,
  tags: ["autodocs"],
  args: { options, "aria-label": "Example select", placeholder: "Select an option" },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md"] } },
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { defaultValue: "alpha" } };
export const Grouped: Story = { args: { options: grouped } };
export const Small: Story = { args: { size: "sm" } };
export const Invalid: Story = { args: { invalid: true } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "alpha" } };
export const Empty: Story = { args: { options: [], placeholder: "No options available" } };

export const InField: Story = {
  render: (args) => (
    <Field label="Category" description="Placeholder description." error="Choose a category.">
      <Select {...args} />
    </Field>
  ),
};

function ControlledSelect(props: { readonly options: readonly SelectOption[] }) {
  const [value, setValue] = useState("beta");
  return (
    <div className="grid gap-2">
      <Select
        options={props.options}
        aria-label="Controlled select"
        value={value}
        onValueChange={setValue}
      />
      <p className="text-sm text-fg-muted">Selected value: {value}</p>
    </div>
  );
}

export const Controlled: Story = { render: () => <ControlledSelect options={options} /> };

export const Dark: Story = { args: { defaultValue: "alpha" }, globals: { theme: "dark" } };
export const Compact: Story = { args: { defaultValue: "alpha" }, globals: { density: "compact" } };
