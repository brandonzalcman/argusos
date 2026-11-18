import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  type LucideIcon,
  Map as MapIcon,
  Megaphone,
  Newspaper,
  Siren,
} from "@argus/ui/icons";
import type { ReactElement } from "react";

/**
 * Lucide icon names a page may use. Unknown names fall back to the generic page icon (see
 * PageDefinition.icon). TODO(implementation): full icon picker over the whole Lucide set.
 */
const knownIcons: Readonly<Record<string, LucideIcon>> = {
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  "layout-dashboard": LayoutDashboard,
  "layout-grid": LayoutGrid,
  link: Link2,
  map: MapIcon,
  megaphone: Megaphone,
  newspaper: Newspaper,
  siren: Siren,
};

export const knownPageIconNames: readonly string[] = Object.keys(knownIcons);

export function PageIcon({
  name,
  className,
}: {
  readonly name: string | null;
  readonly className?: string;
}): ReactElement {
  const Icon = (name ? knownIcons[name] : undefined) ?? FileText;
  return <Icon aria-hidden="true" className={className ?? "size-4"} />;
}
