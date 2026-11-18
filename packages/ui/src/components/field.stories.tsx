import type { Meta, StoryObj } from "@storybook/react-vite";
import { Search } from "lucide-react";
import { Field, Input, Textarea } from "./field.js";

const meta: Meta<typeof Field> = {
  title: "Forms/Field",
  component: Field,
  tags: ["autodocs"],
  args: {
    label: "Record name",
    description: "A short, neutral sample description.",
    children: <Input placeholder="Sample record" />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Required: Story = { args: { required: true } };
export const WithError: Story = { args: { error: "This value is required." } };
export const Disabled: Story = {
  args: { disabled: true, children: <Input defaultValue="Disabled sample" /> },
};
export const HiddenLabel: Story = { args: { hideLabel: true } };

export const Inputs: Story = {
  render: () => (
    <div className="grid max-w-md gap-4">
      <Field label="Plain input">
        <Input placeholder="Example value" />
      </Field>
      <Field label="With icon">
        <Input leadingIcon={<Search />} placeholder="Search examples" />
      </Field>
      <Field label="Monospace">
        <Input mono defaultValue="sample-id-0001" />
      </Field>
      <Field label="Read only">
        <Input readOnly defaultValue="Read-only sample" />
      </Field>
      <Field label="Invalid" error="Example validation message.">
        <Input defaultValue="Example value" />
      </Field>
      <Field label="Disabled" disabled>
        <Input defaultValue="Disabled sample" />
      </Field>
    </div>
  ),
};

export const TextArea: Story = {
  args: {
    label: "Notes",
    description: "Free text, placeholder only.",
    children: <Textarea placeholder="Example notes" />,
  },
};

export const TextAreaError: Story = {
  args: {
    label: "Notes",
    error: "Notes are too long.",
    children: <Textarea defaultValue="Example notes" />,
  },
};

export const Dark: Story = { ...Inputs, globals: { theme: "dark" } };
export const Compact: Story = { ...Inputs, globals: { density: "compact" } };
export const HighContrast: Story = { ...Inputs, globals: { theme: "high-contrast" } };
