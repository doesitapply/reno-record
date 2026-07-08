import { ReactNode, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu, X, ScrollText, Shield, LogIn, User, LogOut,
  ChevronDown, FileText, CreditCard, Search, FolderOpen,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

/* ─── Navigation structure ─────────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: "The Record",
    href: "/the-church-record",
    children: [
      { href: "/the-church-record", label: "The Church Record", sub: "Start here — full case overview" },
      { href: "/cases", label: "The Cases", sub: "CR23-0657 · 3:24-cv-00579" },
      { href: "/timeline", label: "Timeline", sub: "75 documented events, state + federal" },
      { href: "/evidence", label: "Evidence Archive", sub: "AI-ingested, violation-tagged docs" },
      { href: "/public-records", label: "Records Requests", sub: "NPRA filings and responses" },
    ],
  },
  {
    label: "The Actors",
    href: "/actors",
    children: [
      { href: "/actors", label: "Actor Dossiers", sub: "17 named individuals on record" },
      { href: "/agencies", label: "Agencies", sub: "Washoe County, DA, courts, PD" },
      { href: "/leaderboard", label: "Accountability Index", sub: "Actor heat scores and rankings" },
    ],
  },
  {
    label: "The Pattern",
    href: "/patterns",
    children: [
      { href: "/patterns", label: "Pattern Dashboard", sub: "137 violation signals across 14 tag types" },
      { href: "/accountability", label: "The Accountability Gap", sub: "Who failed — duty vs. documented record" },
      { href: "/case-intelligence", label: "Case Intelligence", sub: "Plain English + violations + immunity map" },
      { href: "/judicial-pattern", label: "Judicial Pattern Audit", sub: "Comparative corpus — Breslow docket" },
      { href: "/missing-predicate", label: "Missing Predicate Report", sub: "Official acts without locatable supporting documents" },
      { href: "/request-audit", label: "Request a Case Audit", sub: "Have this system analyze your case" },
    ],
  },
  {
    label: "The Operator",
    href: "/operator",
    children: [
      { href: "/operator", label: "Artificially Educated", sub: "Cameron Church — systems architect" },
      { href: "/projects", label: "Project Catalog", sub: "AI automation, agents, legal tech" },
      { href: "/api-surface-map", label: "API Surface Map", sub: "22 backend procedures without frontend UI" },
    ],
  },
];

/* ─── Logo mark ─────────────────────────────────────────────── */
function GoblinMark({ className }: { className?: string }) {
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
      <rect x="6" y="32" width="22" height="2" fill="var(--neon-gold)" />
    </svg>
  );
}

/* ─── Desktop nav section with dropdown ────────────────────── */
function NavSection({
  section,
  location,
}: {
  section: (typeof NAV_SECTIONS)[0];
  location: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = section.children.some(c => location.startsWith(c.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1 px-3 py-2 text-sm font-medium tracking-tight rounded-sm transition-colors",
          isActive
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary",
        )}
        aria-expanded={open}
      >
        {section.label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-popover border border-border rounded-sm shadow-lg z-50 py-1">
          {section.children.map(child => (
            <Link
              key={child.href}
              href={child.href}
              onClick={() => setOpen(false)}
              className={cn(
                "block px-3 py-2.5 transition-colors",
                location.startsWith(child.href)
                  ? "text-primary bg-primary/10"
                  : "text-popover-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <div className="text-sm font-medium">{child.label}</div>
              {(child as any).sub && (
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5 leading-tight">{(child as any).sub}</div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── User dropdown ─────────────────────────────────────────── */
function UserDropdown() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-border hover:border-primary/40 transition-colors text-sm"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold font-mono">
          {initials}
        </div>
        <span className="hidden sm:inline max-w-[100px] truncate text-sm">{user?.name || "Account"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-sm shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs font-mono text-muted-foreground truncate">{user?.email || user?.name}</div>
          </div>
          <Link href="/profile" onClick={() => setOpen(false)}>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-popover-foreground">
              <User className="h-3.5 w-3.5" /> My Profile
            </button>
          </Link>
          <Link href="/profile#submissions" onClick={() => setOpen(false)}>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-popover-foreground">
              <FileText className="h-3.5 w-3.5" /> My Submissions
            </button>
          </Link>
          <Link href="/billing" onClick={() => setOpen(false)}>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-popover-foreground">
              <CreditCard className="h-3.5 w-3.5" /> Billing &amp; Access
            </button>
          </Link>
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); logout.mutate(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main shell ─────────────────────────────────────────────── */
export default function SiteShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      {/* Utility bar */}
      <div className="border-b border-border/60 bg-card">
        <div className="container flex items-center justify-between py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          <span>Washoe County’s Finest · Documented For Posterity</span>
          <span className="hidden sm:inline">Patterns · Actors · Evidence</span>
        </div>
      </div>

      {/* Masthead */}
      <header className="border-b border-border bg-background sticky top-0 z-40 backdrop-blur-sm">
        <div className="container flex items-center justify-between gap-4 py-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <GoblinMark className="h-9 w-9 text-foreground group-hover:text-primary transition-colors" />
            <div className="leading-tight">
              <div className="display-serif text-[1.45rem] font-bold tracking-tight">The Reno Record</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                Washoe County · Accountability Archive
              </div>
            </div>
          </Link>

          {/* Desktop nav — 3 sections */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_SECTIONS.map(section => (
              <NavSection key={section.href} section={section} location={location} />
            ))}
            <Link
              href="/submit"
              className={cn(
                "px-3 py-2 text-sm font-medium tracking-tight rounded-sm transition-colors",
                location === "/submit"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              Submit
            </Link>
            <Link
              href="/pricing"
              className={cn(
                "px-3 py-2 text-sm font-medium tracking-tight rounded-sm transition-colors",
                location === "/pricing"
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              Pricing
            </Link>
          </nav>

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2">
            <Link href="/search">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground px-2">
                <Search className="h-4 w-4" />
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Admin
                  </Button>
                </Link>
                <Link href="/admin-hub">
                  <Button variant="outline" size="sm" className="gap-1.5 border-amber-800 text-amber-400 hover:bg-amber-950">
                    <FolderOpen className="h-3.5 w-3.5" /> Hub
                  </Button>
                </Link>
              </>
            )}
            {isAuthenticated ? (
              <>
                <Link href="/submit">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                    <ScrollText className="h-3.5 w-3.5" /> Submit
                  </Button>
                </Link>
                <UserDropdown />
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <LogIn className="h-3.5 w-3.5" /> Sign in
                  </Button>
                </a>
                <Link href="/submit">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
                    <ScrollText className="h-3.5 w-3.5" /> Submit
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              className="p-2 -mr-1"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border bg-card">
            <nav className="container py-3 flex flex-col gap-0.5">
              {isAuthenticated ? (
                <div className="flex items-center gap-2 py-2 border-b border-border mb-2">
                  <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold font-mono shrink-0">
                    {user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
                  </div>
                  <span className="text-sm font-medium truncate flex-1">{user?.name || "Account"}</span>
                </div>
              ) : (
                <a
                  href={getLoginUrl()}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 py-2.5 border-b border-border mb-2 text-sm font-medium"
                >
                  <LogIn className="h-4 w-4" /> Sign in to submit
                </a>
              )}

              {/* Sections */}
              {NAV_SECTIONS.map(section => (
                <div key={section.href}>
                  <div className="py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground px-1 mt-1">
                    {section.label}
                  </div>
                  {section.children.map(child => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block py-2 px-2 text-sm border-b border-border/40 last:border-0 rounded-sm transition-colors",
                        location.startsWith(child.href)
                          ? "text-primary"
                          : "text-foreground hover:text-primary",
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ))}

              <div className="border-t border-border mt-2 pt-2">
                <Link
                  href="/submit"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 px-2 text-sm border-b border-border/40"
                >
                  Submit Evidence
                </Link>
                <Link
                  href="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 px-2 text-sm border-b border-border/40"
                >
                  Pricing
                </Link>
              </div>

              {isAuthenticated && (
                <div className="border-t border-border mt-2 pt-2 flex flex-col gap-0.5">
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-2 px-2 text-sm">
                    <User className="h-3.5 w-3.5" /> My Profile
                  </Link>
                  <Link href="/billing" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-2 px-2 text-sm">
                    <CreditCard className="h-3.5 w-3.5" /> Billing &amp; Access
                  </Link>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                {isAdmin && (
                  <Link href="/admin" onClick={() => setMobileOpen(false)} className="flex-1">
                    <Button variant="outline" className="w-full gap-1.5"><Shield className="h-3.5 w-3.5" /> Admin</Button>
                  </Link>
                )}
                <Link href="/submit" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button className="w-full bg-primary text-primary-foreground gap-1.5">
                    <ScrollText className="h-3.5 w-3.5" /> Submit
                  </Button>
                </Link>
                {isAuthenticated && (
                  <button
                    onClick={() => { setMobileOpen(false); window.location.href = "/api/oauth/logout"; }}
                    className="px-3 py-2 border border-border rounded-sm text-sm text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="mt-24 border-t border-border bg-card">
        <div className="container py-12 grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <GoblinMark className="h-9 w-9 text-foreground" />
              <div>
                <div className="display-serif text-xl">The Reno Record</div>
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  Patterns · Actors · Evidence
                </div>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground max-w-md">
              A public-interest documentation project focused on misconduct patterns, responsible actors,
              source evidence, and public-records pressure. Submitted allegations are reviewed before
              publication; this site does not provide legal advice and does not endorse candidates.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Archive</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/patterns" className="text-muted-foreground hover:text-foreground transition-colors">Pattern Dashboard</Link></li>
              <li><Link href="/evidence" className="text-muted-foreground hover:text-foreground transition-colors">Evidence Archive</Link></li>
              <li><Link href="/actors" className="text-muted-foreground hover:text-foreground transition-colors">Actor Dossiers</Link></li>
              <li><Link href="/the-church-record" className="text-muted-foreground hover:text-foreground transition-colors">The Church Record</Link></li>
              <li><Link href="/operator" className="text-muted-foreground hover:text-foreground transition-colors">The Operator</Link></li>
              <li><Link href="/projects" className="text-muted-foreground hover:text-foreground transition-colors">Project Catalog</Link></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">Participate</div>
            <ul className="space-y-2 text-sm">
              <li><Link href="/submit" className="text-muted-foreground hover:text-foreground transition-colors">Submit Evidence</Link></li>
              <li><Link href="/public-records" className="text-muted-foreground hover:text-foreground transition-colors">Public Records</Link></li>
              <li><Link href="/election" className="text-muted-foreground hover:text-foreground transition-colors">Election &amp; Accountability</Link></li>
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy &amp; Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="container py-4 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} The Reno Record</span>
            <span>One receipt is a data point. Repetition becomes a pattern. Patterns demand exposure.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
