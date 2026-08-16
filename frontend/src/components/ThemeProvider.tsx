"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "deepguard-theme";

interface ThemeContextValue {
  /** What the user picked, including "system". */
  preference: ThemePreference;
  /** What is actually painted right now. */
  resolved: "light" | "dark";
  setPreference: (next: ThemePreference) => void;
  /** Cycles light → dark → system. */
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Runs before first paint (injected as a blocking inline script in layout.tsx)
 * so the correct palette is on <html> and there is no light-to-dark flash.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var stored=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
var system=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
var mode=stored==="light"||stored==="dark"?stored:system;
document.documentElement.classList.toggle("dark",mode==="dark");
document.documentElement.style.colorScheme=mode;
}catch(e){}})();`;

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(mode: "light" | "dark"): void {
  const root = document.documentElement;
  // Suppress colour transitions for one frame so the swap reads as instant.
  root.classList.add("theme-switching");
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  window.setTimeout(() => root.classList.remove("theme-switching"), 60);
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // Adopt whatever the pre-paint script already decided.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const next: ThemePreference =
      stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setPreferenceState(next);
    setResolved(next === "system" ? systemTheme() : next);
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => {
      const mode = query.matches ? "dark" : "light";
      setResolved(mode);
      apply(mode);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    const mode = next === "system" ? systemTheme() : next;
    setResolved(mode);
    apply(mode);
    if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const cycle = useCallback(() => {
    setPreference(preference === "light" ? "dark" : preference === "dark" ? "system" : "light");
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, cycle }),
    [preference, resolved, setPreference, cycle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}
