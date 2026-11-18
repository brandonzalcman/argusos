import { Contrast, Monitor, Moon, Sun } from "lucide-react";
import type { ReactElement } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.js";
import { IconButton } from "./icon-button.js";
import type { ThemePreference } from "./preferences.js";

export interface ThemeToggleProps {
  readonly value: ThemePreference;
  readonly onChange: (theme: ThemePreference) => void;
  /** The applied mode, used to choose the trigger icon when `value` is `system`. */
  readonly resolved?: "light" | "dark" | "high-contrast";
}

const options: readonly { value: ThemePreference; label: string; icon: ReactElement }[] = [
  { value: "system", label: "System", icon: <Monitor /> },
  { value: "light", label: "Light", icon: <Sun /> },
  { value: "dark", label: "Dark", icon: <Moon /> },
  { value: "high-contrast", label: "High contrast", icon: <Contrast /> },
];

const labels: Readonly<Record<ThemePreference, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
  "high-contrast": "High contrast",
};

/** Icon menu to choose System / Light / Dark / High contrast. Announces the current choice. */
export function ThemeToggle({ value, onChange, resolved }: ThemeToggleProps): ReactElement {
  const mode = value === "system" ? (resolved ?? "light") : value;
  const icon = mode === "dark" ? <Moon /> : mode === "high-contrast" ? <Contrast /> : <Sun />;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Theme: ${labels[value]}`} icon={icon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const match = options.find((option) => option.value === next);
            if (match) {
              onChange(match.value);
            }
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} icon={option.icon}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
