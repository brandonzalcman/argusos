import { motion, useReducedMotion } from "motion/react";
import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn.js";

export interface FlashOnChangeProps {
  /** Any serializable value; when it changes (after first render) the wrapper flashes. */
  readonly value: unknown;
  readonly children: ReactNode;
  readonly className?: string;
  /** Inline wrapper for single values; block for rows/cards. */
  readonly as?: "span" | "div";
}

/**
 * Briefly tints content when a live value changes, so operators notice updates without layout
 * shift. With reduced motion, the tint appears and fades without animation.
 */
export function FlashOnChange({
  value,
  children,
  className,
  as = "span",
}: FlashOnChangeProps): ReactElement {
  const previous = useRef(value);
  const [flashKey, setFlashKey] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!Object.is(previous.current, value)) {
      previous.current = value;
      setFlashKey((key) => key + 1);
    }
  }, [value]);

  const Component = as === "div" ? motion.div : motion.span;
  return (
    <Component
      key={flashKey}
      className={cn("rounded-sm", as === "span" && "inline-block", className)}
      initial={flashKey === 0 ? false : { backgroundColor: "var(--argus-color-info-subtle)" }}
      animate={{ backgroundColor: "rgba(0,0,0,0)" }}
      transition={{ duration: reduced ? 0 : 1.2, delay: reduced ? 1 : 0.2, ease: "easeOut" }}
    >
      {children}
    </Component>
  );
}
