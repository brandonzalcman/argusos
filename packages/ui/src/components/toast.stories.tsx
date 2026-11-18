import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.js";
import { type ToastOptions, ToastProvider, useToast } from "./toast.js";

function ToastButtons(props: {
  readonly samples: readonly (ToastOptions & { readonly button: string })[];
}) {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      {props.samples.map(({ button, ...options }) => (
        <Button key={button} onClick={() => toast(options)}>
          {button}
        </Button>
      ))}
    </div>
  );
}

const meta: Meta<typeof ToastProvider> = {
  title: "Feedback/Toast",
  component: ToastProvider,
  tags: ["autodocs"],
  args: { children: null },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ToastButtons
      samples={[
        {
          button: "Show toast",
          title: "Sample notification",
          description: "Placeholder toast body.",
        },
      ]}
    />
  ),
};

export const Tones: Story = {
  render: () => (
    <ToastButtons
      samples={[
        { button: "Neutral", title: "Neutral sample", tone: "neutral" },
        { button: "Info", title: "Info sample", tone: "info" },
        { button: "Success", title: "Success sample", tone: "success" },
        { button: "Warning", title: "Warning sample", tone: "warning" },
        {
          button: "Critical",
          title: "Critical sample",
          description: "Stays until dismissed.",
          tone: "critical",
        },
      ]}
    />
  ),
};

export const WithUndoAction: Story = {
  render: () => (
    <ToastButtons
      samples={[
        {
          button: "Show toast with undo",
          title: "Sample item removed",
          tone: "success",
          action: { label: "Undo", altText: "Undo the sample removal", onAction: () => undefined },
        },
      ]}
    />
  ),
};

export const Dark: Story = { ...Tones, globals: { theme: "dark" } };
export const Compact: Story = { ...Tones, globals: { density: "compact" } };
export const HighContrast: Story = { ...Tones, globals: { theme: "high-contrast" } };
