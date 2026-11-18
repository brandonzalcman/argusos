import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import { TooltipProvider } from "../src/components/tooltip.js";
import "../src/styles.css";

/** Applies the toolbar theme/density globals to <html>, like UIPreferencesProvider does in apps. */
const withArgusTheme: Decorator = (Story, context) => {
  const mode = (context.globals.theme as string | undefined) ?? "light";
  const density = (context.globals.density as string | undefined) ?? "comfortable";
  useEffect(() => {
    document.documentElement.dataset.argusMode = mode;
    document.documentElement.dataset.argusDensity = density;
  }, [mode, density]);
  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-canvas p-6 text-fg">
        <Story />
      </div>
    </TooltipProvider>
  );
};

const preview: Preview = {
  decorators: [withArgusTheme],
  globalTypes: {
    theme: {
      description: "Theme mode",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "high-contrast", title: "High contrast" },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: "Density",
      toolbar: {
        title: "Density",
        icon: "component",
        items: [
          { value: "comfortable", title: "Comfortable" },
          { value: "compact", title: "Compact" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", density: "comfortable" },
  parameters: {
    layout: "fullscreen",
    a11y: { test: "error" },
    controls: { expanded: true },
  },
};

export default preview;
