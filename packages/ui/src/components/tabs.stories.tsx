import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./states.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs.js";

const meta: Meta<typeof Tabs> = {
  title: "Navigation/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  args: { defaultValue: "first" },
  render: (args) => (
    <Tabs {...args}>
      <TabsList aria-label="Sample sections">
        <TabsTrigger value="first">First</TabsTrigger>
        <TabsTrigger value="second" count={3}>
          Second
        </TabsTrigger>
        <TabsTrigger value="third">Third</TabsTrigger>
        <TabsTrigger value="fourth" disabled>
          Disabled
        </TabsTrigger>
      </TabsList>
      <TabsContent value="first" className="pt-4">
        <p className="text-base">Sample content for the first tab.</p>
      </TabsContent>
      <TabsContent value="second" className="pt-4">
        <p className="text-base">Sample content for the second tab.</p>
      </TabsContent>
      <TabsContent value="third" className="pt-4">
        <EmptyState title="Nothing here yet" description="Placeholder empty tab content." />
      </TabsContent>
    </Tabs>
  ),
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SecondSelected: Story = { args: { defaultValue: "second" } };
export const EmptyTab: Story = { args: { defaultValue: "third" } };
export const Dark: Story = { globals: { theme: "dark" } };
export const Compact: Story = { globals: { density: "compact" } };
export const HighContrast: Story = { globals: { theme: "high-contrast" } };
