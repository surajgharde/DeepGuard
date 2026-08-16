import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { Footer } from "@/components/Footer";
import { NavBar } from "@/components/NavBar";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: {
    default: "DeepGuard — Multimodal Deepfake Detection",
    template: "%s · DeepGuard",
  },
  description:
    "Multimodal deepfake detection combining visual, audio and lip-sync branches with a fusion classifier.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#090c13" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored palette before first paint — no theme flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-on-accent"
            >
              Skip to content
            </a>

            <div className="flex min-h-screen flex-col">
              <NavBar />
              <main
                id="main"
                className="mx-auto w-full max-w-content flex-1 px-5 py-9 sm:px-8 sm:py-14"
              >
                {children}
              </main>
              <Footer />
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
