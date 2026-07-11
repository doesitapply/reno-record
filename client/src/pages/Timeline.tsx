import { useSEO } from "@/hooks/useSEO";
import { useState, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { FileText, Copy, Check, Twitter, Scale, Landmark, Eye, EyeOff, AlertTriangle } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-wrap gap-2 mt-4">
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

function EventViolationTags({ eventId }: { eventId: number }) {
  const { data: tags = [] } = trpc.violationTag.getEventTags.useQuery({ timelineEventId: eventId });
  if (!tags.length) return null;
  const categoryColor = (cat: string) => {
    if (cat === "constitutional") return "border-red-500/50 text-red-400";
    if (cat === "procedural") return "border-amber-500/50 text-amber-400";
    if (cat === "discovery") return "border-blue-500/50 text-blue-400";
    if (cat === "judicial_conduct") return "border-purple-500/50 text-purple-400";
    if (cat === "prosecutorial_conduct") return "border-orange-500/50 text-orange-400";
    return "border-border text-muted-foreground";
  };
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t: any) => (
        <Badge key={t.id} variant="outline" className={`font-mono uppercase text-[9px] gap-1 ${categoryColor(t.tagCategory)}`}>
          {t.tagLabel}
          {t.confidence < 100 && <span className="opacity-60">·{t.confidence}%</span>}
        </Badge>
      ))}
    </div>
  );
}

const NARRATIVE_DELIMITER = "[WHAT WAS REALLY HAPPENING]";

function parseEventSummary(summary: string | null | undefined): { official: string; narrative: string | null } {
  if (!summary) return { official: "", narrative: null };
  const idx = summary.indexOf(NARRATIVE_DELIMITER);
  if (idx === -1) return { official: summary, narrative: null };
  return {
    official: summary.slice(0, idx).trim(),
    narrative: summary.slice(idx + NARRATIVE_DELIMITER.length).trim(),
  };
}

type CaseFilter = "all" | "state_case" | "federal_case";

const CASE_FILTERS: { value: CaseFilter; label: string; icon: React.ReactNode; sub: string }[] = [
  { value: "all", label: "All Events", icon: null, sub: "Both courts, unified view" },
  { value: "state_case", label: "State Court", icon: <Scale className="h-3.5 w-3.5" />, sub: "CR23-0657 · Washoe County Dept. 8" },
  { value: "federal_case", label: "Federal Court", icon: <Landmark className="h-3.5 w-3.5" />, sub: "3:24-cv-00579-ART-CSD · D. Nev." },
];

const SUB_CATEGORIES = [
  { value: "all", label: "All types" },
  { value: "motion", label: "Motions" },
  { value: "custody", label: "Custody" },
  { value: "warrant", label: "Warrants" },
  { value: "competency", label: "Competency" },
  { value: "public_records", label: "Public records" },
  { value: "communications", label: "Comms" },
  { value: "other", label: "Other" },
] as const;

function getCaseColor(caseFilter: CaseFilter) {
  if (caseFilter === "state_case") return "bg-amber-500";
  if (caseFilter === "federal_case") return "bg-blue-500";
  return "bg-[var(--amber)]";
}

function getEventCaseTag(category: string): CaseFilter | null {
  if (category === "state_case") return "state_case";
  if (category === "federal_case") return "federal_case";
  return null;
}

function EventCard({ ev }: { ev: any }) {
  const [showNarrative, setShowNarrative] = useState(false);
  const evCase = getEventCaseTag(ev.category);
  const dotColor =
    evCase === "state_case"
      ? "bg-amber-500"
      : evCase === "federal_case"
      ? "bg-blue-500"
      : "bg-[var(--amber)]";
  const { official, narrative } = useMemo(() => parseEventSummary(ev.summary), [ev.summary]);

  return (
    <article key={ev.id} className="relative pl-6 pb-8 last:pb-0">
      <span
        className={cn(
          "absolute -left-[7px] top-2 h-3 w-3 rounded-full ring-4 ring-background",
          dotColor,
        )}
      />
      <div className="paper-card p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {new Date(ev.eventDate).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          </span>
          {evCase === "state_case" && (
            <Badge variant="outline" className="font-mono uppercase text-[10px] border-amber-500/50 text-amber-400 gap-1">
              <Scale className="h-2.5 w-2.5" /> State
            </Badge>
          )}
          {evCase === "federal_case" && (
            <Badge variant="outline" className="font-mono uppercase text-[10px] border-blue-500/50 text-blue-400 gap-1">
              <Landmark className="h-2.5 w-2.5" /> Federal
            </Badge>
          )}
          <Badge
            variant={ev.status === "confirmed" ? "default" : "secondary"}
            className="font-mono uppercase text-[10px]"
          >
            {ev.status}
          </Badge>
          {ev.caseNumber && (
            <Badge variant="outline" className="font-mono uppercase text-[10px]">
              {ev.caseNumber}
            </Badge>
          )}
          {narrative && (
            <button
              onClick={() => setShowNarrative((v) => !v)}
              className={cn(
                "ml-auto flex items-center gap-1 font-mono uppercase text-[10px] tracking-widest px-2 py-0.5 rounded border transition-colors",
                showNarrative
                  ? "border-red-500/60 text-red-400 bg-red-500/10"
                  : "border-border text-muted-foreground hover:border-red-500/50 hover:text-red-400",
              )}
            >
              {showNarrative ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showNarrative ? "Official record" : "What really happened"}
            </button>
          )}
        </div>
        <h3 className="mt-2 display-serif text-xl">{ev.title}</h3>

        {/* Official summary */}
        {!showNarrative && official && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{official}</p>
        )}

        {/* Narrative layer */}
        {showNarrative && narrative && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-red-400 font-semibold">
                What was really happening
              </span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{narrative}</p>
          </div>
        )}

        {(ev.actors ?? []).length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Actors: {(ev.actors ?? []).join(" · ")}
          </div>
        )}
        {(ev.sourceDocuments ?? []).length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {(ev.sourceDocuments ?? []).map((id: any) => (
              <Link key={id} href={`/evidence/${id}`}>
                <Badge variant="outline" className="gap-1.5 font-mono uppercase text-[10px]">
                  <FileText className="h-3 w-3" /> Source #{id}
                </Badge>
              </Link>
            ))}
          </div>
        )}
        <EventViolationTags eventId={ev.id} />
      </div>
    </article>
  );
}

export default function TimelinePage() {
  useSEO({
    title: "Timeline",
    description: "A chronological exposure map of documented events across both state and federal courts. Every entry is source-cited.",
    canonicalPath: "/timeline",
  });

  const [caseFilter, setCaseFilter] = useState<CaseFilter>("all");
  const [subCat, setSubCat] = useState<string>("all");

  // When case filter is set, pass it as category; when sub-cat is set, use that instead
  const queryCategory =
    caseFilter !== "all" && subCat === "all"
      ? caseFilter
      : subCat !== "all"
      ? subCat
      : undefined;

  const events = trpc.timeline.listPublic.useQuery({ category: queryCategory });

  // Client-side filter: if both caseFilter and subCat are set, filter locally
  const displayEvents = (events.data ?? []).filter((ev) => {
    if (caseFilter !== "all" && subCat !== "all") {
      return ev.category === caseFilter || ev.category === subCat;
    }
    return true;
  });

  const stateCount = (events.data ?? []).filter((e) => e.category === "state_case").length;
  const federalCount = (events.data ?? []).filter((e) => e.category === "federal_case").length;
  const otherCount = (events.data ?? []).filter(
    (e) => e.category !== "state_case" && e.category !== "federal_case"
  ).length;

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        {/* Header */}
        <div className="mb-10">
          <div className="eyebrow">Unified Docket</div>
          <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
            Receipts, in order.
          </h1>
          <p className="mt-4 text-foreground/70 max-w-2xl leading-relaxed">
            Every documented event across both courts — state and federal — in chronological order.
            Every entry is source-cited. Filter by court or event type. The record does not dispute itself.
          </p>
          <ShareBar
            url={`${window.location.origin}/timeline`}
            title="The Reno Record — Unified Docket: every documented event across both courts"
          />
        </div>

        {/* Case filter — primary axis */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {CASE_FILTERS.map((cf) => (
            <button
              key={cf.value}
              onClick={() => { setCaseFilter(cf.value); setSubCat("all"); }}
              className={cn(
                "text-left p-4 rounded-md border transition-all",
                caseFilter === cf.value
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest font-semibold">
                {cf.icon}
                {cf.label}
                {cf.value === "all" && events.data && (
                  <span className="ml-auto text-muted-foreground">{events.data.length}</span>
                )}
                {cf.value === "state_case" && (
                  <span className="ml-auto text-muted-foreground">{stateCount}</span>
                )}
                {cf.value === "federal_case" && (
                  <span className="ml-auto text-muted-foreground">{federalCount}</span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{cf.sub}</div>
            </button>
          ))}
        </div>

        {/* Sub-category filter — secondary axis */}
        {caseFilter !== "all" && (
          <div className="flex flex-wrap gap-2 mb-8">
            {SUB_CATEGORIES.map((sc) => (
              <button
                key={sc.value}
                onClick={() => setSubCat(sc.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded-sm border transition-colors",
                  subCat === sc.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground",
                )}
              >
                {sc.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-10">
          {/* Timeline feed */}
          <div className="lg:col-span-8">
            <div className="relative pl-6 border-l border-border">
              {events.isLoading && (
                <p className="text-muted-foreground py-8">Loading docket…</p>
              )}
              {!events.isLoading && displayEvents.length === 0 && (
                <div className="paper-card p-8 text-muted-foreground">
                  No approved events for this filter yet.
                </div>
              )}
              {displayEvents.map((ev) => (
                <EventCard key={ev.id} ev={ev} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-5">
            {/* Case status cards */}
            <div className="paper-card p-5">
              <div className="eyebrow mb-3">Case Status</div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Scale className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">CR23-0657</div>
                    <div className="text-xs text-muted-foreground">Washoe County District Court · Dept. 8</div>
                    <div className="text-xs text-amber-400 mt-1 font-mono uppercase tracking-widest">Stayed · Disqualification pending Dept. 6</div>
                  </div>
                </div>
                <div className="border-t border-border" />
                <div className="flex items-start gap-3">
                  <Landmark className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">3:24-cv-00579-ART-CSD</div>
                    <div className="text-xs text-muted-foreground">U.S. District Court · D. Nev.</div>
                    <div className="text-xs text-blue-400 mt-1 font-mono uppercase tracking-widest">Rule 59(e) Pending · Appellate Clock Tolled</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Event counts */}
            {events.data && (
              <div className="paper-card p-5">
                <div className="eyebrow mb-3">Event Breakdown</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State court events</span>
                    <span className="font-mono">{stateCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Federal court events</span>
                    <span className="font-mono">{federalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other documented events</span>
                    <span className="font-mono">{otherCount}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="font-mono">{events.data.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit CTA */}
            <div className="paper-card p-5">
              <div className="eyebrow mb-2">Add to the docket</div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Submitted dates, records, and actor references feed this archive after redaction review and approval.
              </p>
              <Link href="/submit">
                <Button size="sm" className="w-full bg-foreground text-background">
                  Submit Evidence
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
