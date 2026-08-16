"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/Icon";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  push: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANTS: Record<
  ToastVariant,
  { icon: IconName; accent: string; iconBg: string; bar: string }
> = {
  success: { icon: "check", accent: "text-real", iconBg: "bg-real/10 text-real", bar: "bg-real" },
  error: { icon: "alert", accent: "text-fake", iconBg: "bg-fake/10 text-fake", bar: "bg-fake" },
  info: { icon: "info", accent: "text-accent", iconBg: "bg-accent/10 text-accent", bar: "bg-accent" },
};

const MAX_VISIBLE = 3;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId++;
      const durationMs = variant === "error" ? 7000 : 4500;
      setToasts((current) => [...current, { id, variant, message, durationMs }].slice(-MAX_VISIBLE));
      timers.current.set(id, window.setTimeout(() => dismiss(id), durationMs));
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message: string) => push(message, "success"),
      error: (message: string) => push(message, "error"),
      info: (message: string) => push(message, "info"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2.5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(24rem,calc(100vw-3rem))]"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const variant = VARIANTS[toast.variant];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto relative overflow-hidden rounded-2xl border border-line bg-panel shadow-pop animate-slide-in-right"
            >
              <div className="flex items-start gap-3 p-3.5 pr-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${variant.iconBg}`}
                >
                  <Icon name={variant.icon} className="h-4 w-4" weight={2.1} />
                </span>
                <p className="flex-1 pt-1 text-sm leading-snug text-fg">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="btn-icon h-7 w-7 shrink-0"
                  aria-label="Dismiss notification"
                >
                  <Icon name="close" className="h-3.5 w-3.5" weight={2.2} />
                </button>
              </div>
              {/* Countdown bar so the auto-dismiss is not a surprise. */}
              <span
                className={`absolute bottom-0 left-0 h-0.5 ${variant.bar}`}
                style={{
                  animation: `shrink-toast ${toast.durationMs}ms linear forwards`,
                }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
