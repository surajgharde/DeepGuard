import Link from "next/link";

import { Icon } from "@/components/Icon";

const LINKS = [
  { href: "/", label: "Analyze" },
  { href: "/history", label: "History" },
  { href: "/about", label: "Method" },
] as const;

export function Footer(): JSX.Element {
  return (
    <footer className="mt-16 border-t border-line bg-panel/40">
      <div className="mx-auto max-w-content px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-on-accent">
                <Icon name="shield-check" className="h-4 w-4" weight={2.2} />
              </span>
              <span className="text-sm font-semibold tracking-tight text-fg">DeepGuard</span>
            </div>
            <p className="text-xs leading-relaxed text-faint">
              Multimodal deepfake detection — visual, audio and lip-sync evidence fused into one
              interpretable verdict. MSc dissertation prototype.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2.5">
            <p className="section-title">Pages</p>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted transition-colors hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="max-w-xs space-y-2">
            <p className="section-title">Disclaimer</p>
            <p className="text-xs leading-relaxed text-faint">
              Results are indicative, not forensic proof. Read them alongside provenance and
              contextual evidence.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} DeepGuard · Research artefact</p>
          <p>Videos are processed by your own backend — nothing leaves the machine.</p>
        </div>
      </div>
    </footer>
  );
}
