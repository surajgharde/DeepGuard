"use client";

import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

/**
 * Segmented light / dark / system control. Renders a neutral placeholder until
 * mounted so the server and client markup agree.
 */
export function ThemeToggle(): JSX.Element {
  const { preference, setPreference } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="flex items-center gap-0.5 rounded-xl border border-line bg-panel p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = mounted && preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option.label} theme`}
            title={`${option.label} theme`}
            onClick={() => setPreference(option.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ease-out ${
              active
                ? "bg-accent/10 text-accent shadow-soft"
                : "text-faint hover:bg-panel2 hover:text-fg"
            }`}
          >
            <Icon name={option.icon} className="h-[15px] w-[15px]" weight={1.9} />
          </button>
        );
      })}
    </div>
  );
}
