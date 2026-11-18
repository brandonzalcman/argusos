import type { Meta, StoryObj } from "@storybook/react-vite";
import { Construction } from "lucide-react";
import { ScaffoldPage } from "./scaffold-page.js";

const meta = {
  title: "Layout/ScaffoldPage",
  component: ScaffoldPage,
  tags: ["autodocs"],
  args: {
    title: "Route contract",
    description: "A clearly labelled placeholder with no operational data.",
    implementationOrder: ["Connect an authorized loader", "Replace this placeholder"],
  },
} satisfies Meta<typeof ScaffoldPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithEyebrowAndIcon: Story = {
  args: { eyebrow: "Sample section", icon: <Construction /> },
};
export const WithChildren: Story = {
  args: { children: <p className="text-base">Sample extra scaffold content.</p> },
};
export const Dark: Story = { ...WithEyebrowAndIcon, globals: { theme: "dark" } };
export const Compact: Story = { ...WithEyebrowAndIcon, globals: { density: "compact" } };
export const HighContrast: Story = { ...WithEyebrowAndIcon, globals: { theme: "high-contrast" } };
