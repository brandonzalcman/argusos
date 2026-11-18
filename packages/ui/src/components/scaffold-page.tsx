import { CircleDashed, Construction } from "lucide-react";
import { type ReactElement, type ReactNode, useId } from "react";
import { PageContainer } from "./app-shell.js";
import { Badge } from "./badge.js";
import { PageHeader } from "./page-header.js";

export interface ScaffoldPageProps {
  readonly title: string;
  readonly description: string;
  readonly implementationOrder: readonly string[];
  /** Section label above the title, e.g. "Operate". */
  readonly eyebrow?: string;
  /** Decorative icon representing the route. */
  readonly icon?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * Gives every unfinished route a clean, explicitly labelled placeholder.
 * Input: route purpose, ordered next work, and optional scaffold-only supporting content.
 * Output: a page header, a "not built yet" notice and the implementation checklist; never
 * simulated operational data.
 * Errors: none beyond supplied React content errors.
 * Depends on: owning packages for future behavior and authorization-aware route loaders.
 */
export function ScaffoldPage({
  title,
  description,
  implementationOrder,
  eyebrow,
  icon,
  children,
}: ScaffoldPageProps): ReactElement {
  const checklistId = useId();
  return (
    <PageContainer>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        meta={
          <Badge tone="neutral" variant="outline" icon={<CircleDashed />} role="status">
            Scaffold only — no operational data is loaded
          </Badge>
        }
      />
      <div className="grid items-start gap-(--argus-gap) lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong/50 bg-surface px-6 py-14 text-center">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg-muted shadow-sm [&_svg]:size-6"
          >
            {icon ?? <Construction />}
          </span>
          <h2 className="text-lg font-semibold text-fg">{title} isn’t built yet</h2>
          <p className="max-w-md text-base text-fg-muted text-pretty">
            This route is wired into navigation, permissions and layout. Its live data and controls
            arrive in a later slice — nothing here is real operational information.
          </p>
        </section>
        <section
          aria-labelledby={checklistId}
          className="rounded-lg border border-border bg-surface p-(--argus-panel-p) shadow-sm"
        >
          <h2
            id={checklistId}
            className="text-xs font-semibold tracking-wider text-fg-muted uppercase"
          >
            Implementation handoff
          </h2>
          <ol className="mt-3 grid gap-3">
            {implementationOrder.map((step, index) => (
              <li key={step} className="flex gap-3 text-base text-fg">
                <span
                  aria-hidden="true"
                  className="flex size-5.5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-sunken font-mono text-xs text-fg-muted"
                >
                  {index + 1}
                </span>
                <span className="text-pretty">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {children}
    </PageContainer>
  );
}
