import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { ArrowRight, FileText, Share2, Copy, Check, Twitter } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  return (
    <div className="flex flex-wrap gap-2 mt-6">
      <Button variant="outline" size="sm" onClick={copyLink} className="gap-2 text-xs">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <a href={tweetUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Twitter className="h-3.5 w-3.5" /> Share on X
        </Button>
      </a>
    </div>
  );
}

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "actors", label: "Key actors" },
  { id: "issues", label: "Constitutional issues" },
  { id: "custody", label: "110-day custody" },
  { id: "faretta", label: "Faretta / self-rep" },
  { id: "competency", label: "Competency detour" },
  { id: "warrant", label: "No-bail warrant" },
  { id: "federal", label: "Rooker-Feldman" },
  { id: "records", label: "Public records" },
  { id: "family", label: "Family harm" },
];

export default function ChurchRecord() {
  useSEO({ title: "The Church Record", description: "A documented case example inside The Reno Record's broader public corruption evidence platform — court delay, ignored filings, custody pressure, and records silence.", ogType: "article", canonicalPath: "/the-church-record" });
  const featured = trpc.story.featured.useQuery();
  const events = trpc.timeline.listPublic.useQuery(undefined);
  const churchEvents = (events.data ?? []).filter(
    (e) => e.category !== "election_accountability",
  );

  return (
    <SiteShell>
      {/* Header */}
      <section className="border-b border-border bg-foreground text-background">
        <div className="container py-16 md:py-24 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8">
              <div className="eyebrow !text-background/70">Documented Example · Court-System Cluster</div>
            <h1 className="display-serif hero-headline text-5xl md:text-6xl mt-3 leading-[1.02]">
              The Church Record
            </h1>
            <p className="mt-5 max-w-2xl text-background/80 text-lg leading-relaxed">
              One documented case file inside a larger public evidence platform. The Church Record shows
              how delay, blocked filings, competency detours, no-bail warrant practice, unresolved motions,
              and records silence can be converted into source-backed pattern evidence.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="stamp text-[var(--amber)]">≈ 110 days custody</span>
              <span className="stamp text-[var(--amber)]">1,000+ days pending</span>
              <span className="stamp text-[var(--amber)]">No trial</span>
            </div>
            <ShareBar
              url={`${window.location.origin}/the-church-record`}
              title="The Church Record — documented due process failures in Washoe County"
            />
          </div>
          <aside className="lg:col-span-4">
            <div className="paper-card !bg-background/5 !border-background/15 p-5">
              <div className="eyebrow !text-background/70">In this file</div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a className="hover:text-[var(--amber)]" href={`#${s.id}`}>
                      → {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* Correction / Editorial notes — public transparency */}
      {(featured.data?.correctionNote || featured.data?.editorialNote) && (
        <div className="container py-4">
          {featured.data?.correctionNote && (
            <div className="rounded border border-blue-500/30 bg-blue-500/5 p-4 mb-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-500 text-xs font-mono uppercase tracking-widest shrink-0 mt-0.5">Correction notice</span>
                <p className="text-sm text-foreground/85 ml-2">{featured.data.correctionNote}</p>
              </div>
            </div>
          )}
          {featured.data?.editorialNote && (
            <div className="rounded border border-amber-400/30 bg-amber-400/5 p-4">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 text-xs font-mono uppercase tracking-widest shrink-0 mt-0.5">Editorial note</span>
                <p className="text-sm text-foreground/85 ml-2">{featured.data.editorialNote}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Overview */}
      <Section id="overview" eyebrow="Section 1" title="Overview">
        <p>
          {featured.data?.summary ||
            `The Church Record traces one Washoe County criminal case through procedural machinery that has kept it pending for more than 1,000 days. The defendant was held in custody for approximately 110 days. Across that time, the docket reflects repeated, documented requests for rulings, self-representation, written findings, and trial — and a pattern of delay, filing restrictions, competency detours, no-bail warrant practice, unresolved motions, and silence where written answers should exist.`}
        </p>
        <p>
          This page presents the case as a structured example, not the entire mission. Each claim links,
          where available, to the underlying document in the Evidence Archive. Items not yet corroborated
          by records are flagged as such, and the same method is now applied to other Reno and Washoe
          misconduct signals.
        </p>
      </Section>

      {/* Timeline subset */}
      <Section
        id="timeline"
        eyebrow="Section 2"
        title="Timeline"
        action={
          <Link href="/timeline">
            <Button variant="outline" className="gap-2">
              Open full timeline <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      >
        <div className="relative pl-6 border-l border-border">
          {churchEvents.length === 0 && (
            <p className="text-muted-foreground">
              The full timeline is being assembled and approved. Approved events will appear here.
            </p>
          )}
          {churchEvents.slice(0, 12).map((ev) => (
            <div key={ev.id} className="relative pl-6 pb-8 last:pb-0">
              <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-[var(--amber)] ring-4 ring-background" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {new Date(ev.eventDate).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                })}
              </div>
              <h3 className="mt-1 font-semibold tracking-tight">{ev.title}</h3>
              {ev.summary && <p className="mt-1 text-sm text-muted-foreground">{ev.summary}</p>}
              <div className="mt-2 flex gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono uppercase text-[10px]">
                  {ev.category.replace(/_/g, " ")}
                </Badge>
                <Badge
                  variant={ev.status === "confirmed" ? "default" : "secondary"}
                  className="font-mono uppercase text-[10px]"
                >
                  {ev.status}
                </Badge>
                {(ev.sourceDocuments ?? []).length > 0 && (
                  <Badge variant="outline" className="font-mono uppercase text-[10px] gap-1">
                    <FileText className="h-3 w-3" /> {ev.sourceDocuments!.length} source(s)
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Actors */}
      <Section
        id="actors"
        eyebrow="Section 3"
        title="Key actors"
        action={
          <Link href="/actors">
            <Button variant="outline" className="gap-2">
              All actors <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      >
        <KeyActorsGrid />
      </Section>

      {/* Constitutional issues */}
      <Section id="issues" eyebrow="Section 4" title="Core constitutional issues">
        <div className="grid md:grid-cols-2 gap-5">
          {[
            {
              t: "Speedy trial",
              d: "Repeated demands for trial; case remained pending past one-, two-, and three-year markers without trial occurring.",
            },
            {
              t: "Right to self-representation",
              d: "Faretta requests met with detours instead of a clean canvass; counsel-of-record posture used to block defendant filings.",
            },
            {
              t: "Access to courts",
              d: "Filings struck or marked received-but-not-considered; written findings not issued where required.",
            },
            {
              t: "Pretrial detention as punishment",
              d: "≈ 110 days of custody before adjudication, with no-bail warrant posture used to compel compliance.",
            },
            {
              t: "Effective assistance of counsel",
              d: "Public defender's office declined to litigate constitutional issues despite repeated, specific written requests.",
            },
            {
              t: "Due process — written findings",
              d: "Material rulings without written reasoning, leaving the appellate record incomplete.",
            },
          ].map((c) => (
            <div key={c.t} className="paper-card p-5">
              <h3 className="font-semibold tracking-tight">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <NarrativeCard
        id="custody"
        eyebrow="Section 5"
        title="The 110-day custody injury"
        body="Approximately 110 days in pretrial custody. Time that imposed concrete harm on family responsibilities, caregiving duties, employment, housing, and medical care — costs that do not stop at the jail door and that the docket did not weigh."
      />
      <NarrativeCard
        id="faretta"
        eyebrow="Section 6"
        title="Faretta / self-representation"
        body="A request to represent oneself triggers a Faretta canvass — a defined, on-the-record inquiry. The Church Record reflects a pattern in which that canvass was avoided, rerouted to competency, or treated as a procedural inconvenience rather than a constitutional right."
      />
      <NarrativeCard
        id="competency"
        eyebrow="Section 7"
        title="Competency detour"
        body="Competency was raised after rights were asserted — after demands for trial, written findings, and self-representation. The sequence matters. Used in that posture, competency stops being a safeguard and starts functioning as a delay device."
      />
      <NarrativeCard
        id="warrant"
        eyebrow="Section 8"
        title="No-bail warrant posture"
        body="No-bail warrants were used in a posture that operated to compel compliance and extend custody, rather than to address adjudicated risk on a developed record."
      />
      <NarrativeCard
        id="federal"
        eyebrow="Section 9"
        title="Federal Rooker-Feldman problem"
        body="When state-court conduct injures a litigant in ways the federal courts then refuse to reach under Rooker-Feldman, the doctrine becomes a structural shield. This section preserves the record needed to surface that asymmetry."
      />
      <NarrativeCard
        id="records"
        eyebrow="Section 10"
        title="Public records & unanswered questions"
        body="A running list of public records requests, deadlines, and non-responses related to this case is maintained in the Public Records Tracker and cross-referenced here as records arrive."
        cta={{ href: "/public-records", label: "Open the tracker" }}
      />
      <NarrativeCard
        id="family"
        eyebrow="Section 11"
        title="Family / caregiver harm"
        body="The damage of pretrial custody and prolonged delay reaches family members, caregivers, children, elderly parents, housing, employment, and medical care. The Reno Record treats those harms as part of the case file, not as collateral noise."
      />

      {/* CTA */}
      <section className="container py-16">
        <div className="paper-card p-10 grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8">
            <div className="eyebrow">If your records show the same machinery</div>
            <h2 className="display-serif text-3xl mt-2">Add evidence to the public corruption map.</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Submissions are reviewed before publication. Your documents, dates, actors, and records
              requests help build a cross-agency comparator that no single person can build alone.
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

function Section({
  id,
  eyebrow,
  title,
  action,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="container py-16 scroll-mt-24">
      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display-serif text-3xl md:text-4xl mt-2 rule-amber">{title}</h2>
          {action && <div className="mt-5">{action}</div>}
        </div>
        <div className="md:col-span-8 space-y-4 text-[1.04rem] leading-relaxed text-foreground/85">
          {children}
        </div>
      </div>
    </section>
  );
}

function NarrativeCard({
  id,
  eyebrow,
  title,
  body,
  cta,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <section id={id} className="container py-10 scroll-mt-24">
      <div className="paper-card p-8 md:p-10 grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4">
          <div className="eyebrow">{eyebrow}</div>
          <h3 className="display-serif text-2xl md:text-3xl mt-2">{title}</h3>
        </div>
        <div className="md:col-span-8">
          <p className="text-[1.04rem] leading-relaxed text-foreground/85">{body}</p>
          {cta && (
            <Link href={cta.href}>
              <Button variant="outline" className="mt-5 gap-2">
                {cta.label} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function KeyActorsGrid() {
  const actors = trpc.actor.listPublic.useQuery();
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(actors.data ?? []).slice(0, 9).map((a) => (
        <Link key={a.id} href={`/actors/${a.slug}`}>
          <div className="paper-card p-5 h-full hover:-translate-y-0.5 transition-transform">
            <div className="eyebrow">{a.role || "Documented actor"}</div>
            <div className="display-serif text-xl mt-1">{a.name}</div>
            {a.agency && <div className="text-sm text-muted-foreground mt-1">{a.agency}</div>}
          </div>
        </Link>
      ))}
      {(actors.data ?? []).length === 0 && (
        <div className="paper-card p-6 text-muted-foreground col-span-full">
          Actor profiles are being prepared and approved.
        </div>
      )}
    </div>
  );
}
