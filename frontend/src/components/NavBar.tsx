"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Analyze", icon: "sparkle" },
  { href: "/history", label: "History", icon: "history" },
  { href: "/about", label: "Method", icon: "book" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavBar(): JSX.Element {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async (): Promise<void> => {
      try {
        const data = await getHealth();
        if (!cancelled) {
          setHealth(data);
          setOffline(false);
        }
      } catch {
        if (!cancelled) {
          setHealth(null);
          setOffline(true);
        }
      }
    };

    void check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b glass">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between gap-3 px-5 sm:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-lg"
          aria-label="DeepGuard home"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-on-accent shadow-soft transition-transform duration-300 ease-out group-hover:scale-105">
            <Icon name="shield-check" className="h-[18px] w-[18px]" weight={2.3} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-fg">DeepGuard</span>
            <span className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.16em] text-faint">
              Multimodal detection
            </span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 rounded-xl border border-line bg-panel shadow-soft" />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <StatusPill health={health} offline={offline} />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="btn-secondary h-9 w-9 !px-0 md:hidden"
          >
            <Icon name={menuOpen ? "close" : "menu"} className="h-[18px] w-[18px]" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-line bg-panel px-5 py-4 animate-fade-up md:hidden"
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                    active ? "bg-accent/10 text-accent" : "text-muted hover:bg-panel2 hover:text-fg"
                  }`}
                >
                  <Icon name={link.icon} className="h-[18px] w-[18px]" />
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-4 sm:hidden">
            <span className="text-xs text-faint">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}

function StatusPill({
  health,
  offline,
}: {
  health: HealthResponse | null;
  offline: boolean;
}): JSX.Element {
  const tone = offline
    ? { dot: "bg-fake", text: "text-fake", ring: "bg-fake/30" }
    : health?.models_loaded
      ? { dot: "bg-real", text: "text-real", ring: "bg-real/30" }
      : { dot: "bg-warn", text: "text-warn", ring: "bg-warn/30" };

  const short = offline ? "Offline" : health ? health.pipeline.name : "…";
  const full = offline
    ? "Backend unreachable — start the API on port 8000"
    : health
      ? `${health.pipeline.name} pipeline · ${health.models_loaded ? "models loaded" : "no models loaded"} · ${health.jobs_in_flight} in flight`
      : "Checking backend…";

  return (
    <span
      title={full}
      aria-label={full}
      className="flex items-center gap-2 rounded-xl border border-line bg-panel px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:py-2"
    >
      <span className="relative flex h-2 w-2">
        {!offline && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${tone.ring} animate-ping`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
      </span>
      <span className={`capitalize ${tone.text}`}>{short}</span>
    </span>
  );
}
