/**
 * Missing Predicate Report — v7.7
 *
 * Identifies official court actions without locatable supporting predicate documents.
 * Language is court-safe: record-integrity observations only, no legal conclusions.
 */

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  FileSearch,
  Download,
  Printer,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  XCircle,
  MinusCircle,
  Clock,
} from "lucide-react";

const STORY_ID = 1;

type PredicateStatus =
  | "located"
  | "partial"
  | "contradicted"
  | "not_located"
  | "off_record"
  | "needs_review";

type SeverityCategory = "liberty" | "counsel" | "procedural" | "administrative";

const STATUS_CONFIG: Record<
  PredicateStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  located: {
    label: "Located",
    color: "text-green-400",
    bg: "bg-green-900/30 border-green-700/50",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  partial: {
    label: "Partial",
    color: "text-amber-400",
    bg: "bg-amber-900/30 border-amber-700/50",
    icon: <MinusCircle className="w-3.5 h-3.5" />,
  },
  contradicted: {
    label: "Contradicted",
    color: "text-red-400",
    bg: "bg-red-900/30 border-red-700/50",
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  not_located: {
    label: "Not Located",
    color: "text-red-300",
    bg: "bg-red-950/40 border-red-800/60",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  off_record: {
    label: "Off-Record",
    color: "text-zinc-400",
    bg: "bg-zinc-800/40 border-zinc-600/50",
    icon: <MinusCircle className="w-3.5 h-3.5" />,
  },
  needs_review: {
    label: "Needs Review",
    color: "text-blue-400",
    bg: "bg-blue-900/30 border-blue-700/50",
    icon: <HelpCircle className="w-3.5 h-3.5" />,
  },
};

const SEVERITY_CONFIG: Record<
  SeverityCategory,
  { label: string; color: string; dot: string }
> = {
  liberty: { label: "Liberty / Custody", color: "text-red-400", dot: "bg-red-500" },
  counsel: { label: "Counsel Authority", color: "text-orange-400", dot: "bg-orange-500" },
  procedural: { label: "Procedural Disposition", color: "text-amber-400", dot: "bg-amber-500" },
  administrative: { label: "Administrative", color: "text-zinc-400", dot: "bg-zinc-500" },
};

function StatusBadge({ status }: { status: PredicateStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${cfg.color} ${cfg.bg}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function SeverityDot({ severity }: { severity: SeverityCategory }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${cfg.color}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ConfidencePill({ value }: { value: number }) {
  const color =
    value >= 80 ? "text-green-400" : value >= 50 ? "text-amber-400" : "text-zinc-500";
  return <span className={`text-xs font-mono ${color}`}>{value}%</span>;
}

type FindingRow = {
  id: number;
  eventDate: Date | null;
  officialAct: string;
  actorName: string | null;
  predicateStatus: string;
  missingPredicate: string | null;
  whyItMatters: string | null;
  recommendedRequest: string | null;
  severityCategory: string;
  severityScore: number;
  confidence: number;
  sourceDocIds: number[] | null;
  sourceEventIds: number[] | null;
};

function FindingRow({ row }: { row: FindingRow }) {
  const [expanded, setExpanded] = useState(false);
  const status = row.predicateStatus as PredicateStatus;
  const severity = row.severityCategory as SeverityCategory;
  const docIds: number[] = Array.isArray(row.sourceDocIds) ? row.sourceDocIds : [];

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Main row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Severity score indicator */}
          <div
            className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-xs font-bold mt-0.5 ${
              row.severityScore >= 8
                ? "bg-red-900/60 text-red-300"
                : row.severityScore >= 5
                ? "bg-amber-900/60 text-amber-300"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {row.severityScore}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-100 leading-snug">
                {row.officialAct}
              </span>
              <StatusBadge status={status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {row.eventDate && (
                <span>
                  {new Date(row.eventDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
              {row.actorName && <span className="text-zinc-400">{row.actorName}</span>}
              <SeverityDot severity={severity} />
              <ConfidencePill value={row.confidence} />
            </div>
            {!expanded && row.missingPredicate && status !== "located" && (
              <p className="mt-1.5 text-xs text-zinc-400 line-clamp-1">
                {row.missingPredicate}
              </p>
            )}
          </div>

          <div className="flex-shrink-0 text-zinc-600 mt-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/40 px-4 py-4 space-y-4">
          {row.missingPredicate && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Missing Predicate
              </p>
              <p className="text-sm text-zinc-300">{row.missingPredicate}</p>
            </div>
          )}

          {row.whyItMatters && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Procedural Significance
              </p>
              <p className="text-sm text-zinc-300">{row.whyItMatters}</p>
            </div>
          )}

          {row.recommendedRequest && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                Recommended Record Request
              </p>
              <p className="text-sm text-amber-300/90 font-mono text-xs leading-relaxed">
                {row.recommendedRequest}
              </p>
            </div>
          )}

          {docIds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Source Documents
              </p>
              <div className="flex flex-wrap gap-2">
                {docIds.map((docId) => (
                  <Link key={docId} href={`/evidence/${docId}`}>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                      <ExternalLink className="w-3 h-3" />
                      Doc #{docId}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function exportCSV(rows: FindingRow[]) {
  const headers = [
    "Date",
    "Official Act",
    "Actor",
    "Predicate Status",
    "Severity Category",
    "Severity Score",
    "Missing Predicate",
    "Procedural Significance",
    "Recommended Request",
    "Source Doc IDs",
    "Confidence",
  ];

  const escape = (v: string | null | undefined) => {
    if (!v) return "";
    return `"${v.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.eventDate ? new Date(r.eventDate).toISOString().split("T")[0] : "",
        escape(r.officialAct),
        escape(r.actorName),
        r.predicateStatus,
        r.severityCategory,
        r.severityScore,
        escape(r.missingPredicate),
        escape(r.whyItMatters),
        escape(r.recommendedRequest),
        (Array.isArray(r.sourceDocIds) ? r.sourceDocIds : []).join(";"),
        r.confidence,
      ].join(","),
    ),
  ].join("\n");

  const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `missing-predicate-report-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MissingPredicateReport() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const statsQuery = trpc.predicate.getReportStats.useQuery({ storyId: STORY_ID });

  const reportQuery = trpc.predicate.getReport.useQuery({
    storyId: STORY_ID,
    statusFilter: statusFilter !== "all" ? (statusFilter as PredicateStatus) : undefined,
    severityFilter: severityFilter !== "all" ? (severityFilter as SeverityCategory) : undefined,
    limit: 200,
    offset: 0,
  });

  const generateMutation = trpc.predicate.generateReport.useMutation({
    onSuccess: () => {
      statsQuery.refetch();
      reportQuery.refetch();
    },
  });

  const rows = (reportQuery.data ?? []) as FindingRow[];
  const stats = statsQuery.data;

  const criticalCount = useMemo(
    () => rows.filter((r) => r.severityScore >= 8).length,
    [rows],
  );

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">Missing Predicate Report</h1>
        <p className="text-sm text-gray-600 mt-1">
          Cameron Church — Washoe County CR23-0657 / Federal 3:24-cv-00579
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          Generated:{" "}
          {stats?.generatedAt
            ? new Date(stats.generatedAt).toLocaleString()
            : new Date().toLocaleString()}
        </p>
        <p className="text-xs text-gray-500 mt-2 italic">
          This report identifies official court actions for which the reviewed record does not
          locate a supporting predicate document. It is a record-integrity observation only and
          does not constitute a legal conclusion or opinion.
        </p>
        <hr className="mt-4" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 print:px-0 print:py-0">
        {/* Header */}
        <div className="mb-8 print:hidden">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileSearch className="w-5 h-5 text-amber-400" />
                <h1 className="text-2xl font-bold text-zinc-100">Missing Predicate Report</h1>
              </div>
              <p className="text-sm text-zinc-400 max-w-2xl">
                Identifies official court actions for which the reviewed record does not locate a
                supporting predicate document. Record-integrity observations only — no legal
                conclusions.
              </p>
              {stats?.generatedAt && (
                <p className="text-xs text-zinc-600 mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last generated:{" "}
                  {new Date(stats.generatedAt).toLocaleString()} · v{stats.reportVersion}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateMutation.mutate({ storyId: STORY_ID })}
                  disabled={generateMutation.isPending}
                  className="border-amber-700/50 text-amber-400 hover:bg-amber-900/20"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${generateMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {generateMutation.isPending ? "Analyzing…" : "Generate Report"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Print / PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCSV(rows)}
                disabled={rows.length === 0}
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 print:grid-cols-4">
            {[
              {
                label: "Total Findings",
                value: stats.total,
                color: "text-zinc-100",
                bg: "bg-zinc-800/60",
              },
              {
                label: "Not Located",
                value: stats.byStatus?.not_located ?? 0,
                color: "text-red-300",
                bg: "bg-red-950/30 border border-red-900/40",
              },
              {
                label: "Partial",
                value: stats.byStatus?.partial ?? 0,
                color: "text-amber-300",
                bg: "bg-amber-950/30 border border-amber-900/40",
              },
              {
                label: "Contradicted",
                value: stats.byStatus?.contradicted ?? 0,
                color: "text-red-400",
                bg: "bg-red-950/30 border border-red-800/50",
              },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg px-4 py-3 ${s.bg}`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Severity breakdown */}
        {stats && (
          <div className="flex flex-wrap gap-3 mb-6 print:hidden">
            {(["liberty", "counsel", "procedural", "administrative"] as SeverityCategory[]).map(
              (sev) => {
                const count = stats.bySeverity?.[sev] ?? 0;
                const cfg = SEVERITY_CONFIG[sev];
                return (
                  <button
                    key={sev}
                    onClick={() =>
                      setSeverityFilter((v) => (v === sev ? "all" : sev))
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      severityFilter === sev
                        ? "border-zinc-500 bg-zinc-700"
                        : "border-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className={cfg.color}>{cfg.label}</span>
                    <span className="text-zinc-500">{count}</span>
                  </button>
                );
              },
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5 print:hidden">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-8 text-xs bg-zinc-900 border-zinc-700">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="not_located">Not Located</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="contradicted">Contradicted</SelectItem>
              <SelectItem value="located">Located</SelectItem>
              <SelectItem value="off_record">Off-Record</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
            </SelectContent>
          </Select>

          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-48 h-8 text-xs bg-zinc-900 border-zinc-700">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="liberty">Liberty / Custody</SelectItem>
              <SelectItem value="counsel">Counsel Authority</SelectItem>
              <SelectItem value="procedural">Procedural Disposition</SelectItem>
              <SelectItem value="administrative">Administrative</SelectItem>
            </SelectContent>
          </Select>

          {(statusFilter !== "all" || severityFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-zinc-500 hover:text-zinc-300"
              onClick={() => {
                setStatusFilter("all");
                setSeverityFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}

          <span className="ml-auto text-xs text-zinc-600 self-center">
            {rows.length} finding{rows.length !== 1 ? "s" : ""}
            {criticalCount > 0 && (
              <span className="ml-2 text-red-400">
                · {criticalCount} critical (score ≥ 8)
              </span>
            )}
          </span>
        </div>

        {/* Generate prompt */}
        {!stats && !statsQuery.isLoading && (
          <Card className="bg-zinc-900 border-zinc-800 mb-6">
            <CardContent className="py-10 text-center">
              <FileSearch className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400 mb-4">No report has been generated yet.</p>
              {isAdmin ? (
                <Button
                  onClick={() => generateMutation.mutate({ storyId: STORY_ID })}
                  disabled={generateMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`}
                  />
                  {generateMutation.isPending
                    ? "Analyzing record…"
                    : "Run Predicate Analysis"}
                </Button>
              ) : (
                <p className="text-xs text-zinc-600">
                  Admin access required to generate the report.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {(reportQuery.isLoading || statsQuery.isLoading) && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-zinc-800/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Generate in progress */}
        {generateMutation.isPending && (
          <Card className="bg-zinc-900 border-amber-800/40 mb-4">
            <CardContent className="py-4 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-300 font-medium">
                  Predicate analysis in progress…
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  The AI is reviewing all timeline events against the document archive. This may
                  take 30–90 seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {generateMutation.isError && (
          <Card className="bg-zinc-900 border-red-800/40 mb-4">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">
                {generateMutation.error?.message ?? "Report generation failed."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Findings list */}
        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row) => (
              <FindingRow key={row.id} row={row} />
            ))}
          </div>
        )}

        {/* Empty state after filter */}
        {rows.length === 0 && stats && !reportQuery.isLoading && (
          <div className="text-center py-12 text-zinc-600">
            <FileSearch className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No findings match the current filters.</p>
          </div>
        )}

        {/* Court-safe disclaimer */}
        {stats && (
          <div className="mt-8 pt-6 border-t border-zinc-800 print:mt-4">
            <p className="text-xs text-zinc-600 leading-relaxed">
              <strong className="text-zinc-500">Record Integrity Disclaimer:</strong> This report
              presents observations about the reviewed document archive only. Statements such as
              "predicate not located" or "reviewed record does not locate" refer exclusively to
              materials available in the reviewed archive and do not constitute a legal conclusion,
              finding of fact, or allegation of misconduct. The absence of a document in the
              reviewed archive does not establish that the document does not exist. This report is
              intended for use as an attorney-review artifact and record-request guide only.
            </p>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          nav, header, footer { display: none !important; }
          a { color: inherit; text-decoration: underline; }
          .border { border-color: #ccc !important; }
          .text-zinc-100, .text-zinc-200, .text-zinc-300 { color: #111 !important; }
          .text-zinc-400, .text-zinc-500, .text-zinc-600 { color: #555 !important; }
          .bg-zinc-800, .bg-zinc-900, .bg-zinc-950 { background: #f9f9f9 !important; }
          .text-red-300, .text-red-400 { color: #b91c1c !important; }
          .text-amber-300, .text-amber-400 { color: #92400e !important; }
          .text-green-400 { color: #166534 !important; }
        }
      `}</style>
    </>
  );
}
