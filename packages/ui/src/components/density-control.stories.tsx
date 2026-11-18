import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { Density } from "../tokens.js";
import { DensityControl } from "./density-control.js";

const meta = {
  title: "Preferences/DensityControl",
  component: DensityControl,
  tags: ["autodocs"],
  args: { value: "comfortable", onChange: () => undefined },
} satisfies Meta<typeof DensityControl>;

export default meta;
type Story = StoryObj<typeof meta>;

function Controlled(props: {
  readonly iconOnly?: boolean;
  readonly hideLabel?: boolean;
  readonly initial?: Density;
}) {
  const [value, setValue] = useState<Density>(props.initial ?? "comfortable");
  return (
    <DensityControl
      value={value}
      onChange={setValue}
      {...(props.iconOnly === undefined ? {} : { iconOnly: props.iconOnly })}
      {...(props.hideLabel === undefined ? {} : { hideLabel: props.hideLabel })}
    />
  );
}

export const Default: Story = { render: () => <Controlled /> };
export const CompactSelected: Story = { render: () => <Controlled initial="compact" /> };
export const IconOnly: Story = { render: () => <Controlled iconOnly hideLabel /> };
export const Dark: Story = { ...Default, globals: { theme: "dark" } };
export const Compact: Story = { ...CompactSelected, globals: { density: "compact" } };
export const HighContrast: Story = { ...Default, globals: { theme: "high-contrast" } };
