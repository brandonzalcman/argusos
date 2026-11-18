import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, FileText, Home, Settings } from "lucide-react";
import { AppShell, PageContainer } from "./app-shell.js";
import { ConnectionIndicator } from "./connection-indicator.js";
import { PageHeader } from "./page-header.js";
import { Sidebar, SidebarItem, SidebarSection } from "./sidebar.js";
import { EmptyState } from "./states.js";
import { TopBar, type TopBarProps } from "./top-bar.js";

function SampleSidebar() {
  return (
    <Sidebar brand="Sample brand">
      <SidebarSection title="Section one">
        <SidebarItem icon={<Home />} label="Overview">
          <a href="#overview" aria-current="page">
            Overview
          </a>
        </SidebarItem>
        <SidebarItem icon={<FileText />} label="Records" badge="3">
          <a href="#records">Records</a>
        </SidebarItem>
      </SidebarSection>
      <SidebarSection title="Section two">
        <SidebarItem icon={<Bell />} label="Notifications">
          <a href="#notifications">Notifications</a>
        </SidebarItem>
        <SidebarItem icon={<Settings />} label="Settings">
          <a href="#settings">Settings</a>
        </SidebarItem>
      </SidebarSection>
    </Sidebar>
  );
}

function SampleShell(props: {
  readonly topBar: TopBarProps;
  readonly collapsed?: boolean;
  readonly empty?: boolean;
}) {
  return (
    <AppShell
      sidebar={<SampleSidebar />}
      topBar={<TopBar {...props.topBar} />}
      {...(props.collapsed === undefined ? {} : { defaultSidebarCollapsed: props.collapsed })}
    >
      <PageContainer>
        <PageHeader
          title="Sample page"
          description="Scaffold placeholder content inside the shell."
        />
        {props.empty ? (
          <EmptyState title="Nothing here yet" description="Placeholder empty state." />
        ) : null}
      </PageContainer>
    </AppShell>
  );
}

const noContext: TopBarProps = {
  activeIncidentLabel: null,
  incidentLevel: null,
  operationalPeriodLabel: null,
  positionLabel: null,
  connection: (
    <ConnectionIndicator variant="pill" state="offline" stateDetail="Sync has not been connected" />
  ),
};

const sampleContext: TopBarProps = {
  activeIncidentLabel: "Exercise ALPHA (training)",
  incidentLevel: { label: "Level 0 (training)", status: "info" },
  operationalPeriodLabel: "Period 0 (sample)",
  positionLabel: "Sample position",
  connection: <ConnectionIndicator variant="pill" state="live" />,
  onOpenCommandPalette: () => undefined,
};

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  tags: ["autodocs"],
  args: { sidebar: null, topBar: null, children: null },
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 520 } } },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <SampleShell topBar={noContext} empty /> };
export const WithSampleContext: Story = { render: () => <SampleShell topBar={sampleContext} /> };
export const CollapsedSidebar: Story = {
  render: () => <SampleShell topBar={sampleContext} collapsed />,
};
export const Dark: Story = { ...WithSampleContext, globals: { theme: "dark" } };
export const Compact: Story = { ...WithSampleContext, globals: { density: "compact" } };
export const HighContrast: Story = { ...WithSampleContext, globals: { theme: "high-contrast" } };
