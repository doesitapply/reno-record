import { useSEO } from "@/hooks/useSEO";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Search,
  X,
  FileText,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Filter,
  CalendarOff,
  Landmark,
  Building2,
  Paperclip,
  FileClock,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const SOURCE_LABELS: Record<string, string> = {
  court_order: "Court Order",
  motion: "Motion",
  email: "Email",
  transcript: "Transcript",
  warrant: "Warrant",
  public_records_response: "PRR Response",
  audio: "Audio",
  video: "Video",
  image: "Image",
  jail_record: "Jail/Custody",
  risk_notice: "Risk Notice",
  other: "Other",
};

const SOURCE_COLORS: Record<string, string> = {
  court_order: "bg-amber-500/15 text-primary border-primary/30",
  motion: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  email: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  transcript: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  warrant: "bg-red-500/15 text-red-400 border-red-500/30",
  public_records_response: "bg-green-500/15 text-green-400 border-green-500/30",
  audio: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  video: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  image: "bg-teal-500/15 text-teal-400 border-teal-500/30",
  jail_record: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  risk_notice: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  other: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
};

/* The 4-way record classification. This replaces the old coarse State/Federal split.
   "Supporting" and "Not Yet On Record" are deliberately NOT presented as part of the
   official court record. */
type RecordStatusKey =
  | "on_record_state"
  | "on_record_federal"
  | "supporting"
  | "unfiled_not_on_record"
  | "unclassified";

const RECORD_SECTIONS: {
  key: RecordStatusKey;
  title: string;
  subtitle: string;
  accent: "amber" | "blue" | "violet" | "zinc";
  icon: typeof Landmark;
  onRecord: boolean;
}[] = [
  {
    key: "on_record_state",
    title: "On Record — State",
    subtitle: "Filed in State v. Church · CR23-0657 · Washoe County District Court",
    accent: "amber",
    icon: Landmark,
    onRecord: true,
  },
  {
    key: "on_record_federal",
    title: "On Record — Federal",
    subtitle: "Filed in Church v. Washoe County · 3:24-cv-00579 · U.S. District Court, D. Nev.",
    accent: "blue",
    icon: Building2,
    onRecord: true,
  },
  {
    key: "supporting",
    title: "Supporting Material",
    subtitle: "Evidence and exhibits that support the record but are not themselves filed entries",
    accent: "violet",
    icon: Paperclip,
    onRecord: false,
  },
  {
    key: "unfiled_not_on_record",
    title: "Not Yet On Record",
    subtitle: "Unfiled material — collected but not part of any official court record",
    accent: "zinc",
    icon: FileClock,
    onRecord: false,
  },
  {
    key: "unclassified",
    title: "Unclassified — Needs Review",
    subtitle: "The engine could not confidently classify these. Escalated for human review.",
    accent: "zinc",
    icon: AlertTriangle,
    onRecord: false,
  },
];

const RECORD_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Material" },
  { value: "on_record_state", label: "On Record — State" },
  { value: "on_record_federal", label: "On Record — Federal" },
  { value: "supporting", label: "Supporting" },
  { value: "unfiled_not_on_record", label: "Not Yet On Record" },
  { value: "unclassified", label: "Unclassified" },
];

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Resolve the legal date of a document: filing stamp first, then documentDate,
 *  else null (UNDATED). Returns the timestamp used for sorting + display metadata. */
function resolveDocDate(doc: any): {
  ts: number | null;
  label: string | null;
  isFilingStamp: boolean;
  undated: boolean;
} {
  const stamp = doc.filingStampDate ?? null;
  const fallback = doc.documentDate ?? null;
  const flagged = doc.needsDateReview || doc.dateSource === "undated";
  if (stamp && doc.dateSource === "filing_stamp") {
    return { ts: new Date(stamp).getTime(), label: formatDate(stamp), isFilingStamp: true, undated: false };
  }
  if (stamp) {
    return { ts: new Date(stamp).getTime(), label: formatDate(stamp), isFilingStamp: false, undated: false };
  }
  if (fallback && !flagged) {
    return { ts: new Date(fallback).getTime(), label: formatDate(fallback), isFilingStamp: false, undated: false };
  }
  return { ts: null, label: fallback ? formatDate(fallback) : null, isFilingStamp: false, undated: true };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const ACCENT_HEADER: Record<string, string> = {
  amber: "bg-amber-500/8 border-primary/20",
  blue: "bg-blue-500/8 border-blue-500/20",
  violet: "bg-violet-500/8 border-violet-500/20",
  zinc: "bg-zinc-500/8 border-zinc-500/20",
};
const ACCENT_TEXT: Record<string, string> = {
  amber: "text-primary",
  blue: "text-blue-400",
  violet: "text-violet-400",
  zinc: "text-muted-foreground",
};

/* ─────────────────────────────────────────────
   Main page
───────────────────────────────────────────── */
export default function EvidencePage() {
  useSEO({
    title: "Evidence Archive",
    description:
      "Searchable archive of source documents grouped by record status: on-record State and Federal filings, supporting material, and unfiled material. Sorted by court filing-stamp date.",
    canonicalPath: "/evidence",
  });

  const [q, setQ] = useState("");
  const [recordFilter, setRecordFilter] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const [violationSlug, setViolationSlug] = useState("all");
  const [sortBy, setSortBy] = useState<"date_asc" | "date_desc">("date_asc");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const debouncedQ = useDebounce(q, 300);

  const { data: meta } = trpc.document.filterMeta.useQuery();
  const { data: rawDocs = [], isLoading } = trpc.document.listPublic.useQuery({
    q: debouncedQ || undefined,
    sourceType: sourceType !== "all" ? sourceType : undefined,
    recordStatus: recordFilter !== "all" ? recordFilter : undefined,
    violationTagSlug: violationSlug !== "all" ? violationSlug : undefined,
    sortBy,
  });

  /* Sort by resolved legal date. UNDATED docs always sink to the bottom
     regardless of sort direction — we never fake their chronological position. */
  const docs = useMemo(() => {
    const withDate = rawDocs.map((d) => ({ doc: d, resolved: resolveDocDate(d) }));
    withDate.sort((a, b) => {
      if (a.resolved.undated && b.resolved.undated) return 0;
      if (a.resolved.undated) return 1;
      if (b.resolved.undated) return -1;
      const da = a.resolved.ts ?? 0;
      const db_ = b.resolved.ts ?? 0;
      return sortBy === "date_asc" ? da - db_ : db_ - da;
    });
    return withDate;
  }, [rawDocs, sortBy]);

  /* Bucket by record_status. */
  const buckets = useMemo(() => {
    const map: Record<string, typeof docs> = {};
    for (const item of docs) {
      const key = (item.doc.recordStatus ?? "unclassified") as string;
      (map[key] ??= []).push(item);
    }
    return map;
  }, [docs]);

  const totalCount = docs.length;
  const undatedCount = useMemo(() => docs.filter((d) => d.resolved.undated).length, [docs]);

  /* Sidebar counts */
  const sourceTypeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (meta?.bySourceType ?? []).forEach((r: any) => {
      map[r.sourceType ?? "other"] = Number(r.cnt);
    });
    return map;
  }, [meta]);

  const recordStatusCounts = useMemo(() => {
    const map: Record<string, number> = { all: 0 };
    (meta?.byRecordStatus ?? []).forEach((r: any) => {
      const k = r.recordStatus ?? "unclassified";
      map[k] = Number(r.cnt);
      map.all += Number(r.cnt);
    });
    return map;
  }, [meta]);

  const clearFilters = useCallback(() => {
    setQ("");
    setRecordFilter("all");
    setSourceType("all");
    setViolationSlug("all");
    setSortBy("date_asc");
  }, []);

  const hasActiveFilters =
    !!q || recordFilter !== "all" || sourceType !== "all" || violationSlug !== "all";

  /* Which sections to render: if a record filter is active, only that one. */
  const sectionsToRender = useMemo(() => {
    if (recordFilter !== "all") {
      return RECORD_SECTIONS.filter((s) => s.key === recordFilter);
    }
    return RECORD_SECTIONS;
  }, [recordFilter]);

  return (
    <SiteShell>
      {/* ── Page header ── */}
      <div className="border-b border-border/50 bg-card/30">
        <div className="container py-8 md:py-10">
          <div className="eyebrow mb-2">Forensic Archive</div>
          <h1 className="display-serif text-3xl md:text-4xl">Evidence Archive</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Source documents grouped by <span className="text-foreground font-medium">record status</span> —
            on-record State and Federal filings are kept separate from supporting material and
            unfiled material. Sorted by court filing-stamp date; undated items are flagged, never
            guessed.
          </p>

          {undatedCount > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-primary/90 bg-primary/10 border border-amber-500/25 rounded px-2.5 py-1">
              <CalendarOff className="h-3.5 w-3.5" />
              {undatedCount} document{undatedCount !== 1 ? "s" : ""} undated — needs a verified filing date
            </div>
          )}

          {/* Search + sort bar */}
          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, description, actors…"
                className="pl-9 pr-8"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy((s) => (s === "date_asc" ? "date_desc" : "date_asc"))}
              className="gap-1.5 shrink-0"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === "date_asc" ? "Oldest first" : "Newest first"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarOpen((o) => !o)}
              className={cn(
                "gap-1.5 shrink-0 lg:hidden",
                hasActiveFilters && "border-amber-500/60 text-primary",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && <span className="ml-0.5 text-[10px] font-bold">•</span>}
            </Button>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 shrink-0 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <span className="text-xs text-muted-foreground shrink-0">
              {isLoading ? "Loading…" : `${totalCount} document${totalCount !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-6 lg:gap-8">
          {/* ── Sidebar ── */}
          <aside
            className={cn(
              "shrink-0 w-56 space-y-6",
              "hidden lg:block",
              sidebarOpen &&
                "!block fixed inset-0 z-50 w-full bg-background/95 backdrop-blur overflow-y-auto p-6 lg:static lg:bg-transparent lg:p-0 lg:backdrop-blur-none",
            )}
          >
            {sidebarOpen && (
              <div className="flex items-center justify-between mb-4 lg:hidden">
                <span className="font-semibold">Filters</span>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Record status */}
            <div>
              <div className="eyebrow mb-2">Record Status</div>
              <div className="space-y-0.5">
                {RECORD_FILTERS.map((f) => {
                  const cnt = f.value === "all" ? recordStatusCounts.all : recordStatusCounts[f.value] ?? 0;
                  if (f.value !== "all" && cnt === 0) return null;
                  return (
                    <button
                      key={f.value}
                      onClick={() => {
                        setRecordFilter(f.value);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded text-sm flex items-center justify-between gap-2 transition-colors",
                        recordFilter === f.value
                          ? "bg-amber-500/15 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                    >
                      <span className="truncate">{f.label}</span>
                      <span className="text-[10px] tabular-nums shrink-0 opacity-60">{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source type */}
            <div>
              <div className="eyebrow mb-2">Source Type</div>
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setSourceType("all");
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded text-sm flex items-center justify-between gap-2 transition-colors",
                    sourceType === "all"
                      ? "bg-amber-500/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <span>All types</span>
                  <span className="text-[10px] tabular-nums opacity-60">
                    {recordStatusCounts.all ?? 0}
                  </span>
                </button>
                {Object.entries(SOURCE_LABELS).map(([val, label]) => {
                  const cnt = sourceTypeCounts[val] ?? 0;
                  if (cnt === 0) return null;
                  return (
                    <button
                      key={val}
                      onClick={() => {
                        setSourceType(val);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded text-sm flex items-center justify-between gap-2 transition-colors",
                        sourceType === val
                          ? "bg-amber-500/15 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                    >
                      <span className="truncate">{label}</span>
                      <span className="text-[10px] tabular-nums shrink-0 opacity-60">{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Violation tags */}
            {(meta?.byViolationTag ?? []).length > 0 && (
              <div>
                <div className="eyebrow mb-2">Violation Signal</div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setViolationSlug("all");
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded text-sm flex items-center justify-between gap-2 transition-colors",
                      violationSlug === "all"
                        ? "bg-amber-500/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    )}
                  >
                    <span>All signals</span>
                  </button>
                  {(meta?.byViolationTag ?? []).map((tag: any) => (
                    <button
                      key={tag.slug}
                      onClick={() => {
                        setViolationSlug(tag.slug);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded text-sm flex items-center justify-between gap-2 transition-colors",
                        violationSlug === tag.slug
                          ? "bg-amber-500/15 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                      )}
                    >
                      <span className="truncate leading-tight">{tag.label}</span>
                      <span className="text-[10px] tabular-nums shrink-0 opacity-60">
                        {Number(tag.cnt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 space-y-10">
            {isLoading ? (
              <LoadingSkeleton />
            ) : totalCount === 0 ? (
              <EmptyState onClear={clearFilters} hasFilters={hasActiveFilters} />
            ) : (
              sectionsToRender.map((section) => {
                const sectionDocs = buckets[section.key] ?? [];
                if (sectionDocs.length === 0) return null;
                return (
                  <DocSection
                    key={section.key}
                    section={section}
                    docs={sectionDocs}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

/* ─────────────────────────────────────────────
   DocSection — collapsible record-status group
───────────────────────────────────────────── */
function DocSection({
  section,
  docs,
}: {
  section: (typeof RECORD_SECTIONS)[number];
  docs: { doc: any; resolved: ReturnType<typeof resolveDocDate> }[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = section.icon;

  return (
    <section>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          "w-full flex items-center justify-between gap-4 px-4 py-3 rounded-lg border mb-4 transition-colors hover:bg-muted/20",
          ACCENT_HEADER[section.accent],
        )}
      >
        <div className="text-left flex items-start gap-3 min-w-0">
          <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", ACCENT_TEXT[section.accent])} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-mono text-xs font-bold tracking-widest uppercase",
                  ACCENT_TEXT[section.accent],
                )}
              >
                {section.title}
              </span>
              {!section.onRecord && (
                <span className="text-[9px] uppercase tracking-wider font-mono px-1 py-px rounded bg-zinc-500/20 text-muted-foreground border border-zinc-500/30">
                  not a filing
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("text-xs font-mono font-bold tabular-nums", ACCENT_TEXT[section.accent])}>
            {docs.length} doc{docs.length !== 1 ? "s" : ""}
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {docs.map(({ doc, resolved }) => (
            <DocCard key={doc.id} doc={doc} resolved={resolved} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────
   DocCard
───────────────────────────────────────────── */
function DocCard({
  doc,
  resolved,
}: {
  doc: any;
  resolved: ReturnType<typeof resolveDocDate>;
}) {
  const { data: tags = [] } = trpc.violationTag.getDocumentTags.useQuery(
    { documentId: doc.id },
    { staleTime: 60_000 },
  );

  const sourceLabel = SOURCE_LABELS[doc.sourceType] ?? doc.sourceType;
  const sourceColor = SOURCE_COLORS[doc.sourceType] ?? SOURCE_COLORS.other;
  const snippet = doc.description?.slice(0, 120) ?? doc.aiSummary?.slice(0, 120) ?? null;

  return (
    <Link href={`/evidence/${doc.id}`}>
      <div className="paper-card p-4 h-full flex flex-col gap-3 cursor-pointer hover:border-primary/40 hover:shadow-[0_0_0_1px_oklch(0.76_0.14_72_/_0.2)] transition-all group">
        {/* Top row: source chip + date */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
              sourceColor,
            )}
          >
            {sourceLabel}
          </span>
          {resolved.undated ? (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5 shrink-0">
              <CalendarOff className="h-3 w-3" />
              UNDATED
            </span>
          ) : (
            <span
              className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 flex items-center gap-1"
              title={resolved.isFilingStamp ? "Court filing-stamp date" : "Approximate date — not from a filing stamp"}
            >
              {resolved.isFilingStamp && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
              {resolved.label}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {doc.title}
          </h3>
          {snippet && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
              {snippet}
            </p>
          )}
        </div>

        {/* Bottom: violation signal count + case number */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            {tags.length > 0 ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                {tags.length} signal{tags.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/50 font-mono">no signals</span>
            )}
          </div>
          {doc.caseNumber && (
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
              {doc.caseNumber}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─────────────────────────────────────────────
   Loading skeleton
───────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1].map((i) => (
        <div key={i}>
          <div className="h-14 rounded-lg bg-muted/30 animate-pulse mb-4" />
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="paper-card p-4 h-32 animate-pulse bg-muted/20" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Empty state
───────────────────────────────────────────── */
function EmptyState({
  onClear,
  hasFilters,
}: {
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="paper-card p-12 text-center">
      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <h3 className="display-serif text-xl">No documents found</h3>
      <p className="text-muted-foreground mt-2 text-sm">
        {hasFilters
          ? "No documents match the current filters."
          : "No public documents are available yet."}
      </p>
      {hasFilters && (
        <Button variant="outline" size="sm" onClick={onClear} className="mt-4 gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
