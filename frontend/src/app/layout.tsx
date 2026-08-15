import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";
import { NavBar } from "@/components/NavBar";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: {
    default: "DeepGuard — Multimodal Deepfake Detection",
    template: "%s · DeepGuard",
  },
  description:
    "Multimodal deepfake detection combining visual, audio and lip-sync branches with a fusion classifier.",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ToastProvider>
          <div className="flex min-h-screen flex-col">
            <NavBar />
            <main className="mx-auto w-full max-w-content flex-1 px-5 py-10 sm:px-8 sm:py-14">
              {children}
            </main>
            <footer className="border-t border-line/70">
              <div className="mx-auto flex max-w-content flex-col gap-2 px-5 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <p>DeepGuard · MSc dissertation prototype</p>
                <p>Research artefact — results are indicative, not forensic proof.</p>
              </div>
            </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
