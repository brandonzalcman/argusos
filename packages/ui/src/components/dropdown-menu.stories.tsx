import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button.js";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  type DropdownMenuContentProps,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";

const meta = {
  title: "Overlays/DropdownMenu",
  component: DropdownMenuContent,
  tags: ["autodocs"],
  args: { side: "bottom", align: "start", children: null },
  argTypes: {
    side: { control: "inline-radio", options: ["top", "right", "bottom", "left"] },
    align: { control: "inline-radio", options: ["start", "center", "end"] },
  },
  parameters: { docs: { story: { inline: false, iframeHeight: 320 } } },
} satisfies Meta<typeof DropdownMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="min-h-72">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button>Actions</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...args}>
          <DropdownMenuLabel>Sample actions</DropdownMenuLabel>
          <DropdownMenuItem icon={<Pencil />} shortcut="E">
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Copy />}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem disabled>Unavailable action</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Trash2 />} destructive>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

function ChoicesMenu(props: { readonly args: DropdownMenuContentProps }) {
  const [checked, setChecked] = useState(true);
  const [choice, setChoice] = useState("one");
  return (
    <div className="min-h-72">
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button>Options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...props.args}>
          <DropdownMenuLabel>Toggles</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={checked} onCheckedChange={setChecked}>
            Sample toggle
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Choice</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={choice} onValueChange={setChoice}>
            <DropdownMenuRadioItem value="one">Option one</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="two">Option two</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Nested item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const Choices: Story = { render: (args) => <ChoicesMenu args={args} /> };

export const Closed: Story = {
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args}>
        <DropdownMenuItem>Sample item</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const Dark: Story = { ...Default, globals: { theme: "dark" } };
export const Compact: Story = { ...Default, globals: { density: "compact" } };
export const HighContrast: Story = { ...Default, globals: { theme: "high-contrast" } };
