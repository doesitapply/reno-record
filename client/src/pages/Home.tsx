import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { ArrowRight, FileText, Users, TrendingUp, AlertTriangle, Clock, Scale } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/* ─── Neon accent line ───────────────────────────────────────── */
function NeonRule({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-px w-full", className)}
      style={{
        background: "linear-gradient(90deg, transparent 0%, var(--neon-gold) 40%, var(--neon-gold) 60%, transparent 100%)",
        boxShadow: "0 0 8px var(--neon-gold)",
      }}
    />
  );
}

/* ─── Violation badge ────────────────────────────────────────── */
function ViolationBadge({ label, cite }: { label: string; cite?: string }) {
  return (
    <div className="inline-flex flex-col gap-0.5 border border-primary/30 bg-primary/5 px-3 py-2 rounded-sm">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-primary">{label}</span>
      {cite && <span className="text-[10px] font-mono text-muted-foreground">{cite}</span>}
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────── */
function StatCard({
  value,
  label,
  sub,
  accent = false,
}: {
  value: string | number;
  label: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "border rounded-sm p-5 flex flex-col gap-1",
      accent ? "border-primary/40 bg-primary/5" : "border-border bg-card",
    )}>
      <div className={cn(
        "text-3xl font-bold font-mono tabular-nums",
        accent ? "text-primary" : "text-foreground",
      )}>
        {value}
      </div>
      <div className="text-sm font-medium text-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────── */
function SectionHeader({ eyebrow, headline, sub }: { eyebrow: string; headline: string; sub?: string }) {
  return (
    <div className="mb-8">
      <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary mb-2">{eyebrow}</div>
      <h2 className="display-serif text-2xl sm:text-3xl font-bold text-foreground">{headline}</h2>
      {sub && <p className="mt-2 text-muted-foreground text-sm max-w-xl">{sub}</p>}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function Home() {
  useSEO({
    title: "Home",
    description: "A public accountability archive documenting constitutional violations and institutional misconduct in Washoe County, Nevada.",
    canonicalPath: "/",
  });

  const { data: metrics } = trpc.patterns.metrics.useQuery();
  const { data: recentDocs } = trpc.document.listPublic.useQuery({ limit: 4 } as any);
  const { data: recentTimeline } = trpc.timeline.listPublic.useQuery(undefined);

  const docCount = (metrics?.submitted ?? 0) > 0 ? metrics!.submitted : "—";
  const actorCount = "—";
  const patternCount = (metrics?.speedyTrialIssues ?? 0) + (metrics?.farettaIssues ?? 0) + (metrics?.ignoredFilings ?? 0);

  return (
    <SiteShell>

      {/* ══════════════════════════════════════════════════════════
          HERO — single-screen gut punch
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, oklch(0.22 0.06 70 / 0.12) 0%, transparent 55%)",
        }}
      >
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Neon top rule */}
        <NeonRule className="absolute top-0 left-0 right-0" />

        <div className="container relative z-10 py-20 sm:py-28">
          <div className="max-w-3xl">

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-primary" />
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary">
                Washoe County · Nevada · Public Record
              </span>
            </div>

            {/* Headline */}
            <h1 className="display-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-foreground mb-6">
              They followed every rule.
              <br />
              <span
                className="text-primary"
                style={{ textShadow: "0 0 40px var(--neon-gold)" }}
              >
                The system didn't.
              </span>
            </h1>

            {/* Sub */}
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mb-4">
              The Reno Record is a public accountability archive documenting constitutional violations,
              procedural failures, and institutional misconduct in Washoe County courts and agencies.
              Every claim is source-cited. Every document is filed.
            </p>

            <p className="text-sm text-muted-foreground/70 mb-10 max-w-xl">
              This is not a complaint. This is a record.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link href="/the-church-record">
                <button
                  className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm transition-all"
                  style={{
                    background: "var(--neon-gold)",
                    color: "oklch(0.1 0.02 260)",
                    boxShadow: "0 0 20px oklch(0.82 0.19 72 / 0.4)",
                  }}
                >
                  Read the Record <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link href="/evidence">
                <button className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm border border-border hover:border-primary/60 transition-colors text-foreground hover:text-primary">
                  Browse Evidence <FileText className="h-4 w-4" />
                </button>
              </Link>
              <Link href="/patterns">
                <button className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-sm border border-border hover:border-primary/60 transition-colors text-foreground hover:text-primary">
                  View Patterns <TrendingUp className="h-4 w-4" />
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, var(--background))" }}
        />
      </section>

      {/* ══════════════════════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-border bg-card">
        <div className="container py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard value={docCount} label="Documents archived" accent />
            <StatCard value={actorCount} label="Named actors" />
            <StatCard value={patternCount > 0 ? patternCount : "—"} label="Misconduct signals" />
            <StatCard value="110+" label="Days pretrial custody" sub="No trial. No conviction." />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          THE CHURCH RECORD — anchor case
      ══════════════════════════════════════════════════════════ */}
      <section className="container py-20">
        <SectionHeader
          eyebrow="Anchor Case"
          headline="The Church Record"
          sub="A documented pattern of constitutional violations in a single Washoe County criminal case. Every entry is source-cited."
        />

        <div
          className="rounded-sm border overflow-hidden"
          style={{
            borderColor: "var(--neon-gold)",
            boxShadow: "0 0 40px oklch(0.82 0.19 72 / 0.08)",
          }}
        >
          {/* Case header */}
          <div
            className="px-6 py-5 border-b"
            style={{
              borderColor: "oklch(0.82 0.19 72 / 0.3)",
              background: "oklch(0.82 0.19 72 / 0.06)",
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary mb-1">
                  Case No. CR22-2227 · Washoe County District Court
                </div>
                <h3 className="display-serif text-xl sm:text-2xl font-bold text-foreground">
                  State of Nevada v. Cameron Church
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Pro se defendant. Documented violations spanning 2022–present.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] bg-destructive/15 text-destructive border border-destructive/30 rounded-sm">
                  Active
                </span>
                <span className="px-2 py-1 text-[10px] font-mono uppercase tracking-[0.15em] bg-primary/10 text-primary border border-primary/30 rounded-sm">
                  Documented
                </span>
              </div>
            </div>
          </div>

          {/* Violation summary */}
          <div className="px-6 py-6 border-b border-border/60">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Documented Constitutional Violations
            </div>
            <div className="flex flex-wrap gap-2">
              <ViolationBadge label="Faretta Violation" cite="Faretta v. California, 422 U.S. 806" />
              <ViolationBadge label="Speedy Trial" cite="NRS 178.556 · 6th Amendment" />
              <ViolationBadge label="Competency Detour" cite="NRS 178.400 misapplication" />
              <ViolationBadge label="No-Bail Warrant" cite="8th Amendment" />
              <ViolationBadge label="PRR Obstruction" cite="NRS 239.010" />
              <ViolationBadge label="Family Separation" cite="14th Amendment" />
            </div>
          </div>

          {/* Key facts */}
          <div className="px-6 py-6 grid sm:grid-cols-3 gap-4 border-b border-border/60">
            {[
              { icon: Clock, label: "≈ 110 days", sub: "Pretrial custody without trial" },
              { icon: Scale, label: "1,000+ days", sub: "Case pending without resolution" },
              { icon: AlertTriangle, label: "0 trials", sub: "Despite timely demand" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-sm bg-primary/10 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono font-bold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 bg-card">
            <p className="text-sm text-muted-foreground max-w-md">
              Every violation listed above has a corresponding court filing, transcript, or public record.
              The documentation is the argument.
            </p>
            <Link href="/the-church-record">
              <button
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-sm transition-all"
                style={{
                  background: "var(--neon-gold)",
                  color: "oklch(0.1 0.02 260)",
                }}
              >
                Read the full record <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          WHAT THIS IS
      ══════════════════════════════════════════════════════════ */}
      <section className="border-y border-border bg-card">
        <div className="container py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary mb-3">
                The Mission
              </div>
              <h2 className="display-serif text-2xl sm:text-3xl font-bold text-foreground mb-5">
                Accountability through documentation.
                <br />
                <span className="text-muted-foreground">Not opinion. Not allegation. Evidence.</span>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                The Reno Record is a civic infrastructure tool built on a simple premise: constitutional
                violations are easier to ignore when they are not written down. When they are written down,
                cross-referenced, and publicly accessible, the calculus changes.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                Every document in this archive has a source. Every violation tag requires a quote from
                that source. No naked AI summaries. No unverified claims. The standard is simple:
                if you can't cite it, you can't post it.
              </p>
              <Link href="/submit">
                <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-sm border border-primary/40 text-primary hover:bg-primary/10 transition-colors">
                  Submit evidence <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  icon: FileText,
                  title: "Source-cited evidence",
                  desc: "Every document has a storage key, upload date, and source quote. Violation tags require a citation.",
                },
                {
                  icon: Users,
                  title: "Actor accountability",
                  desc: "Named actors are linked to agencies, roles, and the specific documents that name them.",
                },
                {
                  icon: TrendingUp,
                  title: "Pattern detection",
                  desc: "Individual violations are tagged and aggregated into systemic patterns across cases and actors.",
                },
                {
                  icon: AlertTriangle,
                  title: "Docket Goblin AI",
                  desc: "AI-assisted document classification. Every AI suggestion is reviewed by a human before publication.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 p-4 rounded-sm border border-border bg-background hover:border-primary/30 transition-colors">
                  <div className="p-2 rounded-sm bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          RECENT EVIDENCE
      ══════════════════════════════════════════════════════════ */}
      {recentDocs && recentDocs.length > 0 && (
        <section className="container py-16">
          <div className="flex items-end justify-between mb-8">
            <SectionHeader eyebrow="The Record" headline="Recent evidence" />
            <Link href="/evidence" className="text-sm text-primary hover:underline flex items-center gap-1 mb-8">
              All documents <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentDocs.slice(0, 4).map(doc => (
              <Link key={doc.id} href={`/evidence/${doc.id}`}>
                <div className="h-full p-4 rounded-sm border border-border bg-card hover:border-primary/40 transition-colors cursor-pointer group">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    {doc.sourceType?.replace(/_/g, " ") || "Document"}
                  </div>
                  <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-3 leading-snug">
                    {doc.title}
                  </div>
                  {doc.documentDate && (
                    <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                      {new Date(doc.documentDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          RECENT TIMELINE
      ══════════════════════════════════════════════════════════ */}
      {recentTimeline && recentTimeline.length > 0 && (
        <section className="border-t border-border bg-card">
          <div className="container py-16">
            <div className="flex items-end justify-between mb-8">
              <SectionHeader eyebrow="Timeline" headline="Recent events" />
              <Link href="/timeline" className="text-sm text-primary hover:underline flex items-center gap-1 mb-8">
                Full timeline <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-0">
                {recentTimeline.slice(0, 5).map((event, i) => (
                  <div key={event.id} className="relative pl-10 pb-6 last:pb-0">
                    <div
                      className={cn(
                        "absolute left-0 top-1 h-6 w-6 rounded-full border-2 grid place-items-center",
                        i === 0 ? "border-primary bg-primary/20" : "border-border bg-background",
                      )}
                    >
                      <div className={cn("h-2 w-2 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/40")} />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">
                      {event.eventDate
                        ? new Date(event.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "Date unknown"}
                    </div>
                    <div className="text-sm font-medium text-foreground">{event.title}</div>
                    {event.summary && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.summary}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          BOTTOM CTA
      ══════════════════════════════════════════════════════════ */}
      <section className="container py-20">
        <NeonRule className="mb-16" />
        <div className="text-center max-w-2xl mx-auto">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary mb-4">
            Contribute
          </div>
          <h2 className="display-serif text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Have a document that belongs in this record?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Court filings, public records responses, correspondence with agencies, transcripts —
            if it documents a pattern, it belongs here. Submissions require an account and are
            reviewed before publication.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/submit">
              <button
                className="flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-sm transition-all"
                style={{
                  background: "var(--neon-gold)",
                  color: "oklch(0.1 0.02 260)",
                  boxShadow: "0 0 20px oklch(0.82 0.19 72 / 0.3)",
                }}
              >
                Submit evidence <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="/pricing">
              <button className="flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-sm border border-border hover:border-primary/60 transition-colors text-foreground hover:text-primary">
                View access tiers
              </button>
            </Link>
          </div>
        </div>
      </section>

    </SiteShell>
  );
}
