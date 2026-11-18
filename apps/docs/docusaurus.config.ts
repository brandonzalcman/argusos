import type { Options as PresetOptions, ThemeConfig } from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";

const config: Config = {
  title: "ArgusOS Scaffold Docs",
  tagline: "Implementation contracts and build order for a crisis management platform",
  url: "https://docs.argusos.invalid",
  baseUrl: "/",
  organizationName: "argusos",
  projectName: "argusos",
  trailingSlash: false,
  // Keep link diagnostics visible; repository directories use inline code instead of site links.
  onBrokenLinks: "warn",
  markdown: {
    format: "detect",
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },
  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
        },
        blog: false,
      } satisfies PresetOptions,
    ],
  ],
  themeConfig: {
    navbar: {
      title: "ArgusOS · scaffold",
      items: [
        { to: "/architecture", label: "Architecture", position: "left" },
        { to: "/local-development", label: "Develop", position: "left" },
        { to: "/roadmap", label: "Roadmap", position: "left" },
      ],
    },
    footer: {
      style: "dark",
      links: [],
      copyright: "ArgusOS implementation scaffold. No operational capability is claimed.",
    },
    colorMode: {
      respectPrefersColorScheme: true,
    },
  } satisfies ThemeConfig,
};

export default config;
