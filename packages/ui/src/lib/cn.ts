import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge configured for ArgusOS' custom type scale so `text-md` is treated as a size. */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl"],
    },
  },
});

/** Joins class names and lets later Tailwind utilities override earlier ones. */
export function cn(...inputs: readonly ClassValue[]): string {
  return merge(clsx(inputs));
}
