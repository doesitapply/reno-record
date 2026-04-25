import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ScrollText, Shield } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/the-church-record", label: "The Church Record" },
  { href: "/timeline", label: "Timeline" },
  { href: "/evidence", label: "Evidence" },
  { href: "/public-records", label: "Public Records" },
  { href: "/actors", label: "Actors" },
  { href: "/election", label: "Election" },
  { href: "/patterns", label: "Patterns" },
];

function GoblinMark({ className }: { className?: string }) {
  // Minimalist sigil: serif R with file-tab + amber stamp underline
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="3" y="6" width="28" height="30" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M31 6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <text
        x="9"
        y="28"
        fontFamily="Fraunces, serif"
        fontWeight="700"
        fontSize="20"
        fill="currentColor"
      >
        R
      </text>
      <rect x="6" y="32" width="22" height="2" fill="var(--amber)" />
    </svg>
  );
}

export default function SiteShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top utility bar */}
      <div className="border-b border-border bg-foreground text-background">
        <div className="container flex items-center justify-between py-1.5 text-[11px] font-mono uppercase tracking-[0.18em]">
          <span className="opacity-80">Washoe County · Public Accountability Archive</span>
          <span className="hidden sm:inline opacity-60">Receipts for Due Process</span>
        </div>
      </div>

      {/* Masthead */}
      <header className="border-b border-border bg-background">
        <div className="container flex items-center justify-between gap-6 py-5">
          <Link href="/" className="flex items-center gap-3 group">
            <GoblinMark className="h-9 w-9 text-foreground group-hover:text-[var(--navy)] transition-colors" />
            <div className="leading-tight">
              <div className="display-serif text-[1.55rem] font-bold">The Reno Record</div>
              <div className="eyebrow !text-[0.62rem] mt-0.5">Receipts for Due Process</div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? location === "/"
                  : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium tracking-tight rounded-sm transition-colors",
                    active
                      ? "text-foreground bg-[var(--amber-soft)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            {isAdmin && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="gap-1.5 border-foreground/20 bg-background">
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Button>
              </Link>
            )}
            <Link href="/submit">
              <Button size="sm" className="bg-foreground text-background hover:bg-[var(--navy)] gap-1.5">
                <ScrollText className="h-3.5 w-3.5" /> Submit Your Story
              </Button>
            </Link>
          </div>

          <button
            className="lg:hidden p-2 -mr-2"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="lg:hidden border-t border-border">
            <nav className="container py-3 flex flex-col gap-0.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm border-b border-border/60 last:border-0"
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex gap-2 pt-3">
                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full">Admin</Button>
                  </Link>
                )}
                <Link href="/submit" onClick={() => setOpen(false)} className="flex-1">
                  <Button className="w-full bg-foreground text-background">Submit Your Story</Button>
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="mt-24 border-t border-border bg-foreground text-background">
        <div className="container py-12 grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <GoblinMark className="h-9 w-9 text-background" />
              <div>
                <div className="display-serif text-xl">The Reno Record</div>
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] opacity-70">
                  Receipts for Due Process
                </div>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed opacity-80 max-w-md">
              A public-interest documentation project. Submitted allegations are reviewed before
              publication. This site does not provide legal advice and does not endorse candidates.
            </p>
          </div>
          <div>
            <div className="eyebrow !text-background/70 mb-3">Archive</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/the-church-record" className="opacity-90 hover:opacity-100">The Church Record</Link></li>
              <li><Link href="/timeline" className="opacity-90 hover:opacity-100">Timeline</Link></li>
              <li><Link href="/evidence" className="opacity-90 hover:opacity-100">Evidence Archive</Link></li>
              <li><Link href="/public-records" className="opacity-90 hover:opacity-100">Public Records Tracker</Link></li>
            </ul>
          </div>
          <div>
            <div className="eyebrow !text-background/70 mb-3">Participate</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/submit" className="opacity-90 hover:opacity-100">Submit Your Story</Link></li>
              <li><Link href="/patterns" className="opacity-90 hover:opacity-100">Pattern Dashboard</Link></li>
              <li><Link href="/election" className="opacity-90 hover:opacity-100">Election &amp; Accountability</Link></li>
              <li><Link href="/privacy" className="opacity-90 hover:opacity-100">Privacy &amp; Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-background/15">
          <div className="container py-4 text-[11px] font-mono uppercase tracking-[0.2em] opacity-60 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} The Reno Record</span>
            <span>One case is a complaint. Ten is a pattern. A hundred is a system.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
