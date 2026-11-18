import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  documentation: [
    "index",
    {
      type: "category",
      label: "Foundations",
      items: ["architecture", "local-development", "metadata-versioning", "security-and-audit"],
    },
    {
      type: "category",
      label: "Runtime design",
      items: ["realtime-and-events", "board-implementation", "field-type-implementation"],
    },
    {
      type: "category",
      label: "Extensibility",
      items: ["workflow-implementation", "plugin-implementation"],
    },
    {
      type: "category",
      label: "Delivery",
      items: ["deployment", "roadmap"],
    },
  ],
};

export default sidebars;
