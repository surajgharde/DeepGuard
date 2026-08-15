"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Analyze" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
] as const;

export function NavBar(): JSX.Element {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [offline, setOffline] = useState(false);

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

  const dotClass = offline ? "bg-fake" : health?.models_loaded ? "bg-real" : "bg-warn";
  const statusText = offline
    ? "API offline"
    : health
      ? `${health.pipeline.name} pipeline · ${health.models_loaded ? "models loaded" : "no models"}`
      : "checking…";

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent2 shadow-lg shadow-accent/20">
            <svg
              className="h-5 w-5 text-canvas"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-fg">DeepGuard</span>
            <span className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-faint">
              Multimodal detection
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-panel2 text-fg" : "text-muted hover:bg-panel hover:text-fg"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <span
            className="ml-1 hidden items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-muted md:flex"
            title={statusText}
          >
            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="tabular-nums">{statusText}</span>
          </span>
        </div>
      </nav>
    </header>
  );
}
