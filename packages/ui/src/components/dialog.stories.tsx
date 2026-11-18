import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./button.js";
import { ConfirmDialog, Dialog, DialogClose, DialogContent } from "./dialog.js";
import { Field, Input } from "./field.js";
import { SkeletonGroup, SkeletonText } from "./states.js";

const meta = {
  title: "Overlays/Dialog",
  component: DialogContent,
  tags: ["autodocs"],
  args: {
    title: "Sample dialog",
    description: "Neutral placeholder description for the dialog.",
    size: "md",
    children: <p className="text-base">Sample dialog body content.</p>,
  },
  argTypes: { size: { control: "inline-radio", options: ["sm", "md", "lg", "xl"] } },
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
  render: (args) => (
    <Dialog defaultOpen>
      <DialogContent {...args} />
    </Dialog>
  ),
} satisfies Meta<typeof DialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <DialogClose asChild>
          <Button>Cancel</Button>
        </DialogClose>
        <Button variant="primary">Save</Button>
      </>
    ),
    children: (
      <Field label="Record name">
        <Input placeholder="Sample record" />
      </Field>
    ),
  },
};

export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const NoClose: Story = { args: { hideClose: true, preventOutsideClose: true } };

export const Loading: Story = {
  args: {
    children: (
      <SkeletonGroup label="Loading dialog content">
        <SkeletonText lines={3} />
      </SkeletonGroup>
    ),
  },
};

export const Dark: Story = { globals: { theme: "dark" } };
export const Compact: Story = { ...WithFooter, globals: { density: "compact" } };
export const HighContrast: Story = { ...WithFooter, globals: { theme: "high-contrast" } };

function ConfirmHarness(props: { readonly destructive: boolean; readonly delayMs: number }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Reopen dialog</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={props.destructive ? "Delete this item?" : "Confirm this action?"}
        description="This is a neutral sample confirmation."
        itemName="Sample record"
        confirmLabel={props.destructive ? "Delete" : "Confirm"}
        destructive={props.destructive}
        onConfirm={() => new Promise<void>((resolve) => setTimeout(resolve, props.delayMs))}
      />
    </>
  );
}

export const Confirm: Story = {
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
  render: () => <ConfirmHarness destructive={false} delayMs={0} />,
};

export const ConfirmDestructive: Story = {
  parameters: { docs: { story: { inline: false, iframeHeight: 420 } } },
  render: () => <ConfirmHarness destructive delayMs={1500} />,
};
