import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn.js";
import { focusRing } from "../lib/focus.js";

export interface NewRowsIndicatorProps {
  readonly count: number;
  readonly noun?: string;
  readonly onShowNewRows?: () => void;
  readonly className?: string;
}

/**
 * Announces buffered rows without moving the current list beneath the operator.
 * Input: a non-negative pending count, domain-neutral noun, and optional reveal callback.
 * Output: nothing at zero, otherwise a status pill (a button when `onShowNewRows` is given).
 * Errors: callback errors propagate; negative counts are treated as unavailable and render nothing.
 * Depends on: the host's scoped live-query buffer, which must filter unauthorized rows first.
 */
export function NewRowsIndicator({
  count,
  noun = "rows",
  onShowNewRows,
  className,
}: NewRowsIndicatorProps): ReactElement {
  const visible = Number.isFinite(count) && count > 0;
  const label = `${Math.floor(count)} new ${noun}`;
  const pillClasses = cn(
    "inline-flex h-7 items-center gap-1.5 rounded-full bg-accent px-3 text-sm font-medium text-on-accent shadow-md",
    focusRing,
  );
  let content: ReactNode = null;
  if (visible) {
    content = onShowNewRows ? (
      <button
        type="button"
        onClick={onShowNewRows}
        className={cn(pillClasses, "hover:bg-accent-hover")}
      >
        <ArrowUp aria-hidden="true" className="size-3.5" />
        {label}
      </button>
    ) : (
      <span className={pillClasses}>{label}</span>
    );
  }
  return (
    <div role="status" aria-live="polite" className={cn("flex justify-center", className)}>
      <AnimatePresence initial={false}>
        {visible ? (
          <motion.div
            key="pill"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            {content}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
