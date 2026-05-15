import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import {
  ArrowRight,
  ArrowUpRight,
  ScrollText,
  FileSearch,
  Gavel,
  FileText,
  ClipboardList,
  Users,
  Vote,
  AlertTriangle,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

function HeroDocketArt() {
  // Decorative SVG: courthouse silhouette + amber stamp + docket lines (dusk)
  return (
    <svg
      viewBox="0 0 600 480"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.18 0.06 260)" />
          <stop offset="60%" stopColor="oklch(0.24 0.08 280)" />
          <stop offset="100%" stopColor="oklch(0.32 0.12 30)" />
        </linearGradient>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="600" height="480" fill="url(#sky)" />
      <rect width="600" height="480" fill="url(#grid)" />
      {/* moon */}
      <circle cx="490" cy="110" r="48" fill="oklch(0.93 0.05 80)" opacity="0.85" />
      <circle cx="478" cy="100" r="40" fill="oklch(0.18 0.06 260)" />
      {/* desert ridge */}
      <path
        d="M0 360 L60 340 L130 350 L200 320 L260 335 L340 305 L400 322 L470 300 L540 320 L600 305 L600 480 L0 480 Z"
        fill="oklch(0.16 0.05 260)"
      />
      {/* courthouse */}
      <g transform="translate(170,200)">
        <rect x="0" y="80" width="260" height="80" fill="oklch(0.22 0.06 260)" />
        <polygon points="0,80 130,20 260,80" fill="oklch(0.26 0.06 260)" />
        <polygon points="0,80 130,20 260,80" fill="none" stroke="oklch(0.78 0.16 70)" strokeWidth="1.2" />
        {/* columns */}
        {[20, 60, 100, 140, 180, 220].map((x) => (
          <rect key={x} x={x} y="80" width="14" height="80" fill="oklch(0.32 0.06 260)" />
        ))}
        <rect x="110" y="120" width="40" height="40" fill="oklch(0.16 0.05 260)" />
      </g>
      {/* stamp */}
      <g transform="translate(420,360) rotate(-8)">
        <rect x="-90" y="-30" width="180" height="60" fill="none" stroke="oklch(0.78 0.16 70)" strokeWidth="2" />
        <text
          x="0"
          y="6"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="700"
          fontSize="18"
          fill="oklch(0.78 0.16 70)"
          letterSpacing="3"
        >
          ON THE RECORD
        </text>
      </g>
    </svg>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="display-serif text-2xl md:text-3xl leading-tight text-foreground/90">
      <span className="text-[var(--rust)]">“</span>
      {children}
      <span className="text-[var(--rust)]">”</span>
    </blockquote>
  );
}

export default function Home() {
  useSEO({ title: "Home", canonicalPath: "/" });
  const featured = trpc.story.featured.useQuery();
  const metrics = trpc.patterns.metrics.useQuery();
  const timeline = trpc.timeline.listPublic.useQuery(undefined);
  const docs = trpc.document.listPublic.useQuery(undefined);

  return (
    <SiteShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-foreground text-background">
        <div className="absolute inset-0 opacity-55 sm:opacity-75">
          <HeroDocketArt />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/95 to-foreground/70 lg:to-transparent" />
        <div className="relative container py-14 md:py-24 lg:py-32 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="flex flex-col sm:inline-flex sm:flex-row sm:items-center gap-2 mb-5 max-w-full">
              <span className="stamp text-[var(--amber)] w-fit">Vol. 1 · Washoe County</span>
              <span className="eyebrow !text-background/70 whitespace-normal">Receipts for Due Process</span>
            </div>
            <h1 className="display-serif hero-headline text-5xl md:text-6xl lg:text-7xl text-background leading-[0.98]">
              The Reno
              <br />
              Record.
            </h1>
            <p className="mt-5 max-w-[21rem] sm:max-w-xl text-base md:text-lg text-background/85 leading-relaxed">
              Search receipts, see the timeline, and connect misconduct patterns across actors, agencies, and court records.
            </p>
            <div className="mt-8 grid gap-3 max-w-[21rem] sm:max-w-none sm:flex sm:flex-wrap">
              <Link href="/patterns" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-[var(--amber)] text-[var(--ink)] hover:bg-[var(--amber)]/90 gap-2">
                  View Patterns <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/evidence" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-background/30 text-background bg-transparent hover:bg-background/10 gap-2">
                  Browse Evidence <FileSearch className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/submit" className="w-full sm:w-auto">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto text-background hover:bg-background/10 gap-2">
                  Submit Evidence
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:block">
            <div className="relative paper-card !bg-background/5 !border-background/15 backdrop-blur-sm p-6">
              <div className="eyebrow !text-background/70">At a glance</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-5">
                <Stat label="Submissions" value={metrics.data?.submitted ?? 0} />
                <Stat label="Approved" value={metrics.data?.approved ?? 0} />
                <Stat label="Cases ≥ 1 year" value={metrics.data?.over1y ?? 0} />
                <Stat label="Custody ≥ 100 days" value={metrics.data?.custodyOver100 ?? 0} />
                <Stat label="Speedy-trial issues" value={metrics.data?.speedyTrialIssues ?? 0} />
                <Stat label="Family harm reports" value={metrics.data?.familyHarm ?? 0} />
              </div>
              <div className="mt-5 text-[11px] font-mono uppercase tracking-[0.18em] text-background/60">
                Signals under review · record-backed where possible
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What this is */}
      <section className="container py-20 grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="eyebrow">Editor's note</div>
          <h2 className="display-serif text-3xl md:text-4xl mt-3 rule-amber">What this is</h2>
        </div>
        <div className="md:col-span-7 space-y-5 text-[1.04rem] leading-relaxed text-foreground/85">
          <p>
            <strong>The Reno Record is a misconduct evidence archive, not a rant archive.</strong> It is built around records that can be checked: dates, orders, emails, warrants, transcripts, public records, custody time, and missing findings.
          </p>
          <p>
            The point is not to make one case the whole story. The point is to expose the machinery: court
            delay, ignored filings, retaliatory posture, records obstruction, custody pressure, agency
            silence, and repeated conduct by the same public actors.
          </p>
          <p className="text-muted-foreground">
            Submissions are reviewed before publication. Allegations are presented as reported until
            corroborated by records.
          </p>
        </div>
      </section>

      {/* Pull quote */}
      <section className="border-y border-border bg-secondary/60">
        <div className="container py-16 max-w-4xl">
          <PullQuote>
            One receipt is a data point. Repeated conduct by the same actors becomes a pattern.
            A pattern with records becomes public exposure.
          </PullQuote>
          <div className="mt-6 eyebrow">— The Reno Record · editorial standard</div>
        </div>
      </section>

      {/* Case example: The Church Record */}
      <section className="container py-20 grid lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5">
          <div className="eyebrow">Case Example</div>
          <h2 className="display-serif text-4xl mt-3">The Church Record</h2>
          <p className="mt-5 text-foreground/85 leading-relaxed">
            This is no longer the whole site; it is one documented example. The Church Record remains as
            a side file showing how delay, filing restrictions, competency detours, no-bail warrant
            practice, unresolved motions, and records silence can connect into a visible pattern.
          </p>
          <Link href="/the-church-record">
            <Button className="mt-7 bg-foreground text-background gap-2">
              Open the example file <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="lg:col-span-7">
          <div className="paper-card p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="eyebrow">Example Summary</div>
                <h3 className="display-serif text-2xl mt-1">
                  {featured.data?.alias || "Church v. Washoe County (documented example)"}
                </h3>
                <div className="mt-1 text-sm text-muted-foreground">
                  {featured.data?.court || "Second Judicial District Court, Washoe County"}
                </div>
              </div>
              <div className="stamp text-[var(--rust)]">Pending · 1,000+ days</div>
            </div>
            <div className="mt-6 grid sm:grid-cols-3 gap-4">
              <KV label="Custody" value="≈ 110 days" />
              <KV label="Trial held" value="No" />
              <KV label="Filings status" value="Blocked / unruled" />
              <KV label="Self-rep" value="Requested · denied / detoured" />
              <KV label="Competency" value="Raised after rights asserted" />
              <KV label="No-bail warrant" value="Documented" />
            </div>
            <div className="mt-7 border-t border-border pt-5 flex flex-wrap gap-2">
              {[
                "speedy-trial",
                "faretta",
                "competency",
                "no-bail-warrant",
                "ignored-motion",
                "public-defender",
                "family-harm",
              ].map((t) => (
                <Badge key={t} variant="secondary" className="font-mono uppercase tracking-wider text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core sections grid */}
      <section className="container py-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        <SectionCard
          icon={<ClipboardList className="h-5 w-5" />}
          title="Timeline"
          desc="Cross-case chronology of incidents, filings, agency responses, and public-records pressure."
          href="/timeline"
          cta="Open timeline"
        />
        <SectionCard
          icon={<FileText className="h-5 w-5" />}
          title="Evidence Archive"
          desc="Source files, receipts, transcripts, images, and responses organized around the conduct they document."
          href="/evidence"
          cta="Browse evidence"
        />
        <SectionCard
          icon={<FileSearch className="h-5 w-5" />}
          title="Public Records Tracker"
          desc="Every request, every deadline, every non-response."
          href="/public-records"
          cta="Track requests"
        />
        <SectionCard
          icon={<Users className="h-5 w-5" />}
          title="Actors"
          desc="Profiles for judges, attorneys, officials, and institutions documented in the record."
          href="/actors"
          cta="View actors"
        />
        <SectionCard
          icon={<Gavel className="h-5 w-5" />}
          title="Pattern Dashboard"
          desc="The main dashboard: recurring actors, repeated practices, delay signals, records obstruction, and harm indicators."
          href="/patterns"
          cta="See the patterns"
        />
        <SectionCard
          icon={<Vote className="h-5 w-5" />}
          title="Election & Accountability"
          desc="Neutral, public-record-based information so voters can ask informed questions."
          href="/election"
          cta="Open accountability"
        />
        <SectionCard
          icon={<ScrollText className="h-5 w-5" />}
          title="Submit Evidence"
          desc="Upload records or report misconduct signals; we separate actors, events, evidence, allegations, and redaction risks before publication."
          href="/submit"
          cta="Add your record"
          accent
        />
        <SectionCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Privacy & Redaction"
          desc="Never upload SSNs, full DOBs, sealed records, or minor-child PII. Redact first."
          href="/privacy"
          cta="Read guidance"
        />
      </section>

      {/* Recent exposure map / preview */}
      <section className="container py-20 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <div className="eyebrow">Recent exposure map</div>
          <h2 className="display-serif text-3xl md:text-4xl mt-3">From the public record</h2>
          <p className="mt-4 text-muted-foreground">
            A live look at approved incidents, filings, responses, and misconduct signals from the public timeline.
          </p>
          <Link href="/timeline">
            <Button variant="outline" className="mt-6 gap-2">
              Open full chronology <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="lg:col-span-7 space-y-3">
          {(timeline.data ?? []).slice(0, 5).map((ev) => (
            <article key={ev.id} className="paper-card p-5 flex gap-5 items-start">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground w-28 shrink-0 pt-0.5">
                {new Date(ev.eventDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold tracking-tight">{ev.title}</h3>
                  <Badge variant="outline" className="font-mono uppercase text-[10px]">
                    {ev.category.replace(/_/g, " ")}
                  </Badge>
                  <Badge
                    variant={ev.status === "confirmed" ? "default" : "secondary"}
                    className="font-mono uppercase text-[10px]"
                  >
                    {ev.status}
                  </Badge>
                </div>
                {ev.summary && (
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{ev.summary}</p>
                )}
              </div>
            </article>
          ))}
          {(timeline.data ?? []).length === 0 && (
            <div className="paper-card p-8 text-center text-muted-foreground">
              The public exposure map is being built. Check back as records are reviewed and approved.
            </div>
          )}
        </div>
      </section>

      {/* Docket Goblin */}
      <section className="border-t border-border bg-secondary/40">
        <div className="container py-20 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7">
            <div className="eyebrow">Inside the engine room</div>
            <h2 className="display-serif text-3xl md:text-4xl mt-3 rule-amber">
              Evidence ingest that separates the mess
            </h2>
            <p className="mt-5 text-foreground/85 leading-relaxed">
              The Reno Record's archive librarian. Docket Goblin reads incoming records and separates
              them into actors, evidence items, allegations, timeline events, pattern indicators,
              redaction risks, source quality, and follow-up record requests for human review.
            </p>
            <p className="mt-3 text-foreground/85 leading-relaxed">
              <strong>Docket Goblin never publishes anything.</strong> Every draft requires explicit
              editorial approval before it appears on the public site.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="paper-card p-6 font-mono text-[13px]">
              <div className="eyebrow mb-3">Ingest pass · advisory only</div>
              <div className="space-y-2.5">
                <div>
                  <span className="text-muted-foreground">actors:</span> judge · defense counsel · agency clerk
                </div>
                <div>
                  <span className="text-muted-foreground">evidence:</span> order · minute entry · email receipt
                </div>
                <div>
                  <span className="text-muted-foreground">patterns:</span>{" "}
                  <span className="text-[var(--rust)]">ignored-motion</span>{" "}
                  <span className="text-[var(--rust)]">records-obstruction</span>{" "}
                  <span className="text-[var(--rust)]">custody-pressure</span>
                </div>
                <div>
                  <span className="text-muted-foreground">warnings:</span> Verify redactions; separate allegation from record-confirmed fact.
                </div>
                <div className="pt-3 border-t border-border text-[11px] uppercase tracking-widest text-muted-foreground">
                  Status: separated for admin review
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-20">
        <div className="paper-card p-10 md:p-14 grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-8">
            <div className="eyebrow">If you have receipts</div>
            <h2 className="display-serif text-3xl md:text-4xl mt-2">
              Expose the pattern.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl">
              Names, agencies, dates, orders, minutes, emails, warrants, grievances, public-records responses,
              custody time, delay, retaliation, and what was ignored. We separate the receipts from
              the allegations before anything goes public.
            </p>
          </div>
          <div className="md:col-span-4 flex md:justify-end">
            <Link href="/submit">
              <Button size="lg" className="bg-foreground text-background gap-2">
                Submit Evidence <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="display-serif text-3xl">{value}</div>
      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-background/70 mt-1">
        {label}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[var(--amber)] pl-3">
      <div className="eyebrow !text-[0.62rem]">{label}</div>
      <div className="text-sm mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  desc,
  href,
  cta,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className={
          "paper-card p-6 h-full group transition-all hover:-translate-y-0.5 hover:shadow-lg flex flex-col " +
          (accent ? "bg-[var(--amber-soft)] border-[var(--amber)]" : "")
        }
      >
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-sm bg-foreground text-background grid place-items-center">
            {icon}
          </div>
          <h3 className="font-semibold tracking-tight">{title}</h3>
        </div>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1">{desc}</p>
        <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          {cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
