import { Badge } from "@argus/ui";
import { Circle, CircleCheck, CircleDot, OctagonAlert, TriangleAlert } from "@argus/ui/icons";
import type { ReactElement, ReactNode } from "react";

export type BadgeTone = "critical" | "warning" | "ok" | "info" | "neutral";

const tones: Record<
  BadgeTone,
  { tone: "critical" | "warning" | "success" | "info" | "neutral"; icon: ReactNode }
> = {
  critical: { tone: "critical", icon: <OctagonAlert /> },
  warning: { tone: "warning", icon: <TriangleAlert /> },
  ok: { tone: "success", icon: <CircleCheck /> },
  info: { tone: "info", icon: <CircleDot /> },
  neutral: { tone: "neutral", icon: <Circle /> },
};

/** Status is conveyed by icon shape and text as well as colour, never colour alone. */
export function StatusBadge({
  tone,
  label,
}: {
  readonly tone: BadgeTone;
  readonly label: string;
}): ReactElement {
  const meta = tones[tone];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {label}
    </Badge>
  );
}
