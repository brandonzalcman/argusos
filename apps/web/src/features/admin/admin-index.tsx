import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { PageHeader } from "../workflows/status-views.js";

/**
 * Administration index linking to customization areas.
 * Input: none; links are static and reveal no tenant definitions.
 * Output: section cards; each destination enforces its own authorization and data states.
 */
export function AdminIndexScreen(): ReactElement {
  return (
    <article className="argus-stack">
      <PageHeader
        title="Administration"
        description="Versioned tenant customization and position homepage administration."
      />
      <nav aria-label="Administration sections">
        <ul style={{ listStyle: "none", padding: 0 }} className="argus-stack">
          <li className="argus-panel">
            <Link to="/admin/theme">Theme and terminology</Link>
            <p className="argus-muted">Tokens, density, contrast, logo and core terminology.</p>
          </li>
          <li className="argus-panel">
            <Link to="/admin/menus">Menus</Link>
            <p className="argus-muted">Order the side menu and preview it per position.</p>
          </li>
          <li className="argus-panel">
            <Link to="/admin/positions">Position homepages</Link>
            <p className="argus-muted">
              Lay out each position’s homepage and preview its visibility.
            </p>
          </li>
        </ul>
      </nav>
    </article>
  );
}
