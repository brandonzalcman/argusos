import type { Meta, StoryObj } from "@storybook/react-vite";
import { DensityControl } from "./density-control.js";
import { UIPreferencesProvider, useUIPreferences } from "./preferences.js";
import { ThemeToggle } from "./theme-toggle.js";

function PreferencesPanel() {
  const { theme, resolvedTheme, density, setTheme, setDensity } = useUIPreferences();
  return (
    <div className="grid max-w-md gap-4">
      <div className="flex items-center gap-3">
        <span className="text-base">Theme</span>
        <ThemeToggle value={theme} onChange={setTheme} resolved={resolvedTheme} />
      </div>
      <DensityControl value={density} onChange={setDensity} />
      <p className="font-mono text-sm text-fg-muted">
        theme={theme} resolved={resolvedTheme} density={density}
      </p>
    </div>
  );
}

const meta = {
  title: "Preferences/UIPreferencesProvider",
  component: UIPreferencesProvider,
  tags: ["autodocs"],
  args: { persist: false, defaultTheme: "system", defaultDensity: "comfortable", children: null },
  render: (args) => (
    <UIPreferencesProvider {...args}>
      <PreferencesPanel />
    </UIPreferencesProvider>
  ),
} satisfies Meta<typeof UIPreferencesProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const CompactDefault: Story = { args: { defaultDensity: "compact" } };
export const Dark: Story = { args: { defaultTheme: "dark" }, globals: { theme: "dark" } };
export const Compact: Story = {
  args: { defaultDensity: "compact" },
  globals: { density: "compact" },
};
export const HighContrast: Story = {
  args: { defaultTheme: "high-contrast" },
  globals: { theme: "high-contrast" },
};
