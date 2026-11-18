import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button.js";
import { FlashOnChange } from "./flash-on-change.js";

const meta = {
  title: "Realtime/FlashOnChange",
  component: FlashOnChange,
  tags: ["autodocs"],
  args: { value: 0, children: "Sample value", as: "span" },
  argTypes: { as: { control: "inline-radio", options: ["span", "div"] } },
} satisfies Meta<typeof FlashOnChange>;

export default meta;
type Story = StoryObj<typeof meta>;

function Counter(props: { readonly block?: boolean }) {
  const [count, setCount] = useState(0);
  return (
    <div className="grid max-w-sm gap-3">
      <FlashOnChange value={count} as={props.block ? "div" : "span"}>
        <span className="font-mono tabular-nums">Sample counter: {count}</span>
      </FlashOnChange>
      <Button onClick={() => setCount((current) => current + 1)}>Increment value</Button>
    </div>
  );
}

export const Default: Story = {};
export const Inline: Story = { render: () => <Counter /> };
export const Block: Story = { render: () => <Counter block /> };
export const Dark: Story = { ...Inline, globals: { theme: "dark" } };
export const Compact: Story = { ...Inline, globals: { density: "compact" } };
export const HighContrast: Story = { ...Inline, globals: { theme: "high-contrast" } };
