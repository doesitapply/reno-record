import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Share2, FileText, User, Clock, Tag, AlertTriangle, ExternalLink, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const RECORD_STATUS_LABELS: Record<string, string> = {
  on_record_state: "On Record (State)",
  on_record_federal: "On Record (Federal)",
  off_record: "Off Record",
  disputed: "Disputed",
  unclassified: "Unclassified",
};

const RECORD_STATUS_COLORS: Record<string, string> = {
  on_record_state: "bg-blue-900/40 text-blue-300 border-blue-800/50",
  on_record_federal: "bg-indigo-900/40 text-indigo-300 border-indigo-800/50",
  off_record: "bg-stone-800/60 text-stone-400 border-stone-700/50",
  disputed: "bg-amber-900/40 text-primary/80 border-amber-800/50",
  unclassified: "bg-stone-800/40 text-stone-500 border-stone-700/40",
};

const SOURCE_LABELS: Record<string, string> = {
  court_filing: "Court Filing",
  police_report: "Police Report",
  public_record: "Public Record",
  media: "Media",
  correspondence: "Correspondence",
  other: "Other",
};

const CATEGORY_LABELS: Record<string, string> = {
  state_case: "State Case",
  federal_case: "Federal Case",
  custody: "Custody",
  motion: "Motion",
  warrant: "Warrant",
  competency: "Competency",
  public_records: "Public Records",
  communications: "Communications",
  election_accountability: "Election",
  other: "Other",
};

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Report link copied");
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 border-stone-700 text-stone-400 hover:text-stone-100">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export default function CaseReportPage() {
  const params = useParams<{ storyId: string }>();
  const storyId = parseInt(params.storyId ?? "0", 10);

  const { data, isLoading, error } = trpc.search.caseReport.useQuery(
    { storyId },
    { enabled: storyId > 0 },
  );

  useSEO({
    title: data?.story ? `Case Report — ${data.story.mainIssue ?? "The Reno Record"}` : "Case Report — The Reno Record",
    description: "Comprehensive case report: violation analysis, timeline, actors, evidence archive, and public records.",
  });

  if (isLoading) {
    return (
      <SiteShell>
        <div className="min-h-screen bg-stone-950 flex items-center justify-center">
          <div className="text-stone-500 font-mono text-sm animate-pulse">Generating report…</div>
        </div>
      </SiteShell>
    );
  }

  if (error || !data) {
    return (
      <SiteShell>
        <div className="min-h-screen bg-stone-950 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="text-stone-400 text-sm">Report not found or not available.</p>
            <Link href="/"><Button variant="ghost" size="sm" className="mt-4">← Back to archive</Button></Link>
          </div>
        </div>
      </SiteShell>
    );
  }

  const { story, documents, timeline, actors, prrs, violationCounts } = data;
  const reportUrl = typeof window !== "undefined" ? window.location.href : "";
  const generatedAt = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const topViolations = violationCounts.filter((v) => (v.cnt ?? 0) > 0).slice(0, 10);

  return (
    <SiteShell>
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-24">

          {/* Report header */}
          <div className="border border-stone-700 rounded-lg bg-stone-900/60 p-6 mb-8 print:border-stone-300 print:bg-white print:text-black">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="inline-flex items-center gap-2 border border-amber-800/40 bg-amber-950/30 rounded px-3 py-1 mb-3 print:hidden">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-mono text-primary uppercase tracking-widest">Forensic Case Report</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black text-stone-50 leading-tight mb-1">
                  {story.mainIssue ?? "Case Report"}
                </h1>
                <p className="text-sm text-stone-400 font-mono">
                  The Reno Record · Generated {generatedAt}
                </p>
                {story.caseNumber && (
                  <p className="text-xs text-stone-500 font-mono mt-1">Case: {story.caseNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-2 print:hidden shrink-0">
                <ShareButton url={reportUrl} />
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 border-stone-700 text-stone-400 hover:text-stone-100">
                  <Printer className="w-3.5 h-3.5" /> Print
                </Button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {[
                { label: "Documents", value: documents.length, color: "text-primary" },
                { label: "Timeline Events", value: timeline.length, color: "text-violet-400" },
                { label: "Named Actors", value: actors.length, color: "text-sky-400" },
                { label: "Violation Types", value: topViolations.length, color: "text-red-400" },
              ].map((s) => (
                <div key={s.label} className="rounded border border-stone-800 bg-stone-900/40 p-3 text-center">
                  <p className={cn("text-2xl font-black tabular-nums", s.color)}>{s.value}</p>
                  <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Violation Pattern Summary */}
          {topViolations.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-stone-300">Documented Violation Patterns</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {topViolations.map((v) => (
                  <Link key={v.slug} href={`/patterns/tag/${v.slug}`}>
                    <div className="group flex items-center justify-between rounded border border-stone-800 bg-stone-900/40 hover:border-red-700/50 hover:bg-stone-900/70 px-3 py-2.5 cursor-pointer transition-all">
                      <span className="text-sm text-stone-300 group-hover:text-red-300 transition-colors">{v.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-red-400 tabular-nums">{v.cnt}</span>
                        <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-mono uppercase tracking-widest text-stone-300">Timeline ({timeline.length} events)</h2>
                </div>
                <Link href="/timeline">
                  <Button variant="ghost" size="sm" className="text-xs text-stone-500 hover:text-stone-300 print:hidden">
                    Full timeline <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="relative pl-4 border-l border-stone-800 space-y-3">
                {timeline.slice(0, 30).map((ev) => (
                  <div key={ev.id} className="relative">
                    <div className="absolute -left-[1.375rem] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-stone-700 bg-stone-950" />
                    <div className="rounded border border-stone-800 bg-stone-900/30 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-stone-200 leading-snug">{ev.title}</p>
                        <span className="text-[10px] font-mono text-stone-600 shrink-0">
                          {new Date(ev.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {ev.summary && <p className="text-xs text-stone-500 mt-1 line-clamp-2">{ev.summary}</p>}
                      {ev.category && (
                        <span className="inline-block mt-1 text-[10px] font-mono text-stone-600 bg-stone-800/50 px-1.5 py-0.5 rounded">
                          {CATEGORY_LABELS[ev.category] ?? ev.category}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {timeline.length > 30 && (
                  <p className="text-xs text-stone-600 font-mono pl-2">
                    + {timeline.length - 30} more events — <Link href="/timeline" className="text-primary hover:underline">view full timeline</Link>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Actors */}
          {actors.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-stone-300">Named Actors ({actors.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {actors.map((actor) => (
                  <Link key={actor.id} href={`/actors/${actor.slug}`}>
                    <div className="group flex items-center justify-between rounded border border-stone-800 bg-stone-900/30 hover:border-sky-700/50 hover:bg-stone-900/60 px-3 py-2.5 cursor-pointer transition-all">
                      <div>
                        <p className="text-sm font-medium text-stone-200 group-hover:text-sky-300 transition-colors">{actor.name}</p>
                        {(actor.role || actor.agency) && (
                          <p className="text-xs text-stone-500 mt-0.5">{[actor.role, actor.agency].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-400 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Evidence Archive */}
          {documents.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-mono uppercase tracking-widest text-stone-300">Evidence Archive ({documents.length} documents)</h2>
                </div>
                <Link href="/evidence">
                  <Button variant="ghost" size="sm" className="text-xs text-stone-500 hover:text-stone-300 print:hidden">
                    Full archive <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-1.5">
                {documents.map((doc) => (
                  <Link key={doc.id} href={`/evidence/${doc.id}`}>
                    <div className="group flex items-center justify-between rounded border border-stone-800 bg-stone-900/30 hover:border-amber-700/40 hover:bg-stone-900/60 px-3 py-2 cursor-pointer transition-all">
                      <div className="min-w-0">
                        <p className="text-sm text-stone-300 group-hover:text-primary/80 transition-colors truncate">{doc.title}</p>
                        {doc.caseNumber && <p className="text-[10px] font-mono text-stone-600 mt-0.5">{doc.caseNumber}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {doc.recordStatus && (
                          <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border hidden sm:inline", RECORD_STATUS_COLORS[doc.recordStatus] ?? "bg-stone-800 text-stone-400 border-stone-700")}>
                            {RECORD_STATUS_LABELS[doc.recordStatus] ?? doc.recordStatus}
                          </span>
                        )}
                        {doc.filingStampDate && (
                          <span className="text-[10px] font-mono text-stone-600">
                            {new Date(doc.filingStampDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                        <ExternalLink className="w-3 h-3 text-stone-600 group-hover:text-stone-400" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Public Records */}
          {prrs.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-stone-300">Public Records Requests ({prrs.length})</h2>
              </div>
              <div className="space-y-1.5">
                {prrs.map((prr) => (
                  <div key={prr.id} className="flex items-center justify-between rounded border border-stone-800 bg-stone-900/30 px-3 py-2">
                    <div>
                      <p className="text-sm text-stone-300">{prr.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{prr.agency}</p>
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                      prr.status === "produced" ? "bg-green-900/40 text-green-300 border-green-800/50" :
                      prr.status === "denied" ? "bg-red-900/40 text-red-300 border-red-800/50" :
                      prr.status === "overdue" ? "bg-amber-900/40 text-primary/80 border-amber-800/50" :
                      "bg-stone-800/40 text-stone-400 border-stone-700/40"
                    )}>
                      {prr.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="border-t border-stone-800 pt-6 text-center">
            <p className="text-xs font-mono text-stone-600">
              Generated by The Reno Record · therenorecord.manus.space · {generatedAt}
            </p>
            <p className="text-xs text-stone-700 mt-1">
              All documents are sourced from public court records, public records requests, and verified submissions.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
