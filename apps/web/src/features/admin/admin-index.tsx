import { Card, PageContainer, PageHeader } from "@argus/ui";
import { ChevronRight, LayoutDashboard, ListTree, Palette } from "@argus/ui/icons";
import { Link } from "@tanstack/react-router";
import type { ReactElement, ReactNode } from "react";

interface Section {
  readonly to: "/admin/theme" | "/admin/menus" | "/admin/positions";
  readonly title: string;
  readonly description: string;
  readonly icon: ReactNode;
}

const SECTIONS: readonly Section[] = [
  {
    to: "/admin/theme",
    title: "Theme and terminology",
    description: "Tokens, density, contrast, logo and the words your organisation uses.",
    icon: <Palette />,
  },
  {
    to: "/admin/menus",
    title: "Menus",
    description:
      "Order the side menu, link boards, pages and workflows, and preview it per position.",
    icon: <ListTree />,
  },
  {
    to: "/admin/positions",
    title: "Position homepages",
    description: "Lay out each position homepage and preview what that position can see.",
    icon: <LayoutDashboard />,
  },
];

/**
 * Administration index linking to customization areas.
 * Input: none; links are static and reveal no tenant definitions.
 * Output: section cards; each destination enforces its own authorization and data states.
 */
export function AdminIndexScreen(): ReactElement {
  return (
    <PageContainer width="default">
      <PageHeader
        title="Administration"
        description="Versioned tenant customization and position homepage administration."
      />
      <nav aria-label="Administration sections">
        <ul className="grid gap-(--argus-gap) md:grid-cols-2 xl:grid-cols-3">
          {SECTIONS.map((section) => (
            <li key={section.to} className="contents">
              <Link
                to={section.to}
                className="group rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <Card
                  elevation="raised"
                  className="flex h-full items-start gap-3 group-hover:border-border-strong group-hover:bg-surface-hover"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-text [&_svg]:size-5"
                  >
                    {section.icon}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="text-md font-semibold text-fg">{section.title}</span>
                    <span className="text-base text-fg-muted">{section.description}</span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-fg-subtle rtl:rotate-180"
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PageContainer>
  );
}
