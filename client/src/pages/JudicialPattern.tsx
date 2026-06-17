import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Clock,
  FileText,
  Scale,
  TrendingUp,
  Users,
} from "lucide-react";

const JUDGE = "Barry Breslow";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: "red" | "amber" | "sky" | "green";
}) {
  const colors = {
    red: "text-red-400 bg-red-400/10 border-red-400/20",
    amber: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    sky: "text-sky-400 bg-sky-400/10 border-sky-400/20",
    green: "text-green-400 bg-green-400/10 border-green-400/20",
  };
  const cls = accent ? colors[accent] : "text-stone-300 bg-stone-800/60 border-stone-700";
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest opacity-70 mb-1">{label}</p>
          <p className="text-3xl font-black tabular-nums">{value}</p>
          {sub && <p className="text-xs opacity-60 mt-1">{sub}</p>}
        </div>
        <Icon className="w-5 h-5 opacity-50 mt-1 shrink-0" />
      </div>
    </div>
  );
}

function BoilerplateBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono tabular-nums w-10 text-right opacity-70">{pct}%</span>
    </div>
  );
}

export default function JudicialPattern() {
  const { data: metrics, isLoading: metricsLoading } = trpc.judicialPattern.metrics.useQuery(
    { judge: JUDGE },
    { refetchInterval: 60_000 },
  );
  const { data: phrases, isLoading: phrasesLoading } = trpc.judicialPattern.boilerplate.useQuery(
    { judge: JUDGE, flaggedOnly: false, minOccurrences: 1 },
    { refetchInterval: 60_000 },
  );
  const { data: cases } = trpc.judicialPattern.list.useQuery(
    { judge: JUDGE, limit: 50 },
    { refetchInterval: 60_000 },
  );

  const m = metrics as any;
  const totalCases = Number(m?.totalCases ?? 0);
  const proSeCases = Number(m?.proSeCases ?? 0);
  const avgBoilerplate = Number(m?.avgBoilerplateScore ?? 0);
  const avgTimeMin = Number(m?.avgTimeToRulingMinutes ?? 0);
  const minTimeMin = Number(m?.minTimeToRulingMinutes ?? 0);
  const proSeConvRate =
    proSeCases > 0
      ? Math.round((Number(m?.proSeConvictions ?? 0) / proSeCases) * 100)
      : null;
  const repCases = Number(m?.representedCases ?? 0);
  const repConvRate =
    repCases > 0
      ? Math.round((Number(m?.representedConvictions ?? 0) / repCases) * 100)
      : null;

  const corpusEmpty = totalCases === 0;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <div className="border-b border-stone-800 bg-stone-950/90 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-black tracking-tight text-amber-400 font-mono uppercase">
              Judicial Pattern Analysis
            </h1>
            <p className="text-xs text-stone-500 font-mono">
              Second Judicial District Court · Dept. 6 · {JUDGE}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-400 border border-stone-700 rounded px-2 py-1">
              <span className={`w-1.5 h-1.5 rounded-full ${corpusEmpty ? "bg-stone-600" : "bg-green-400 animate-pulse"}`} />
              {corpusEmpty ? "AWAITING CORPUS" : "LIVE"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">

        {/* What this is */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <Scale className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-stone-200 mb-1">What This Is</h2>
              <p className="text-sm text-stone-400 leading-relaxed">
                This page presents a <strong className="text-stone-200">comparative forensic analysis</strong> of
                public court records from cases presided over by Judge {JUDGE} in Washoe County's Second Judicial
                District Court. The corpus is built from records obtained via the{" "}
                <strong className="text-stone-200">Nevada Public Records Act (NRS Chapter 239)</strong> and public
                case search portals. All data is public record. The analysis focuses on three signals:{" "}
                <strong className="text-amber-400">boilerplate language reuse</strong> across rulings (indicating
                templated rather than individualized review),{" "}
                <strong className="text-amber-400">time-to-ruling anomalies</strong> (statistically improbable
                ruling speeds), and{" "}
                <strong className="text-amber-400">pro se outcome differentials</strong> (whether unrepresented
                defendants face systematically different outcomes).
              </p>
            </div>
          </div>
        </div>

        {/* NPRA Status */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider mb-1">
              Data Acquisition Status
            </p>
            <p className="text-sm text-stone-400">
              A formal NPRA request for Judge Breslow's complete docket (2020–present) has been drafted and is
              pending submission to the Washoe County District Court Clerk. The corpus below will populate as
              records are received and processed through the forensic ingest pipeline. The NPRA request itself
              is logged as a public record in the{" "}
              <a href="/public-records" className="text-amber-400 underline underline-offset-2 hover:text-amber-300">
                Public Records Tracker
              </a>.
            </p>
          </div>
        </div>

        {/* Metrics grid */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
            Corpus Metrics
          </h2>
          {metricsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-24 rounded-lg bg-stone-900 animate-pulse" />
              ))}
            </div>
          ) : corpusEmpty ? (
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-8 text-center">
              <BarChart3 className="w-8 h-8 text-stone-700 mx-auto mb-3" />
              <p className="text-stone-500 text-sm font-mono">
                Corpus is empty — awaiting NPRA response and document ingest.
              </p>
              <p className="text-stone-600 text-xs mt-1">
                Metrics will populate automatically as cases are processed.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Cases in Corpus" value={totalCases} icon={FileText} accent="sky" />
              <StatCard
                label="Pro Se Cases"
                value={proSeCases}
                sub={`${totalCases > 0 ? Math.round((proSeCases / totalCases) * 100) : 0}% of corpus`}
                icon={Users}
                accent="amber"
              />
              <StatCard
                label="Avg Boilerplate Score"
                value={`${Math.round(avgBoilerplate)}%`}
                sub="across all rulings"
                icon={BookOpen}
                accent={avgBoilerplate >= 60 ? "red" : avgBoilerplate >= 30 ? "amber" : "green"}
              />
              <StatCard
                label="Fastest Ruling"
                value={minTimeMin > 0 ? `${minTimeMin}m` : "—"}
                sub="time motion → order"
                icon={Clock}
                accent={minTimeMin > 0 && minTimeMin < 5 ? "red" : "sky"}
              />
              {proSeConvRate !== null && (
                <StatCard
                  label="Pro Se Conviction Rate"
                  value={`${proSeConvRate}%`}
                  sub={`${proSeCases} pro se cases`}
                  icon={Scale}
                  accent={proSeConvRate > 70 ? "red" : proSeConvRate > 50 ? "amber" : "green"}
                />
              )}
              {repConvRate !== null && (
                <StatCard
                  label="Represented Conv. Rate"
                  value={`${repConvRate}%`}
                  sub={`${repCases} represented cases`}
                  icon={Scale}
                  accent="sky"
                />
              )}
              {proSeConvRate !== null && repConvRate !== null && (
                <StatCard
                  label="Pro Se Disadvantage"
                  value={`+${proSeConvRate - repConvRate}pp`}
                  sub="conviction rate differential"
                  icon={TrendingUp}
                  accent={proSeConvRate - repConvRate > 15 ? "red" : "amber"}
                />
              )}
              <StatCard
                label="Avg Time to Ruling"
                value={avgTimeMin > 0 ? `${Math.round(avgTimeMin)}m` : "—"}
                sub="motion → order"
                icon={Clock}
                accent="sky"
              />
            </div>
          )}
        </div>

        {/* Boilerplate phrases */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500">
              Boilerplate Phrase Registry
            </h2>
            {phrases && phrases.length > 0 && (
              <Badge variant="outline" className="text-xs font-mono border-stone-700 text-stone-400">
                {phrases.filter((p: any) => p.flagged).length} flagged / {phrases.length} total
              </Badge>
            )}
          </div>
          {phrasesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 rounded bg-stone-900 animate-pulse" />
              ))}
            </div>
          ) : !phrases || phrases.length === 0 ? (
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-8 text-center">
              <BookOpen className="w-8 h-8 text-stone-700 mx-auto mb-3" />
              <p className="text-stone-500 text-sm font-mono">
                No boilerplate phrases detected yet.
              </p>
              <p className="text-stone-600 text-xs mt-1">
                Phrases are flagged automatically when identical language appears in 5+ rulings.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {phrases.map((p: any) => (
                <div
                  key={p.id}
                  className={`rounded-lg border p-4 ${
                    p.flagged
                      ? "border-red-800/50 bg-red-950/20"
                      : "border-stone-800 bg-stone-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <p className="text-sm text-stone-200 font-mono leading-relaxed flex-1">
                      "{p.phrase}"
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.flagged && (
                        <Badge className="bg-red-900/60 text-red-300 border-red-700 text-xs font-mono">
                          FLAGGED
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-stone-700 text-stone-400 text-xs font-mono">
                        {p.occurrenceCount}×
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <BoilerplateBar score={Math.min(100, (p.occurrenceCount / 20) * 100)} />
                    <span className="text-xs text-stone-600 font-mono shrink-0">
                      {p.phraseCategory?.replace(/_/g, " ")}
                    </span>
                  </div>
                  {p.significance && (
                    <p className="text-xs text-stone-500 mt-2 border-t border-stone-800 pt-2">
                      {p.significance}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Case list */}
        {cases && cases.length > 0 && (
          <div>
            <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
              Case Corpus ({cases.length} cases)
            </h2>
            <div className="overflow-x-auto rounded-lg border border-stone-800">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-stone-800 bg-stone-900/60">
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Case #</th>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Pro Se</th>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Disposition</th>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Boilerplate</th>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Time→Ruling</th>
                    <th className="text-left px-4 py-2 text-xs text-stone-500 uppercase tracking-wider">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c: any) => (
                    <tr key={c.id} className="border-b border-stone-800/50 hover:bg-stone-900/40 transition-colors">
                      <td className="px-4 py-3 text-amber-400">{c.caseNumber}</td>
                      <td className="px-4 py-3 text-stone-400">{c.caseType?.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3">
                        {c.proSeFlag ? (
                          <span className="text-amber-400">Yes</span>
                        ) : (
                          <span className="text-stone-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-400">
                        {c.dispositionType?.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 w-32">
                        <BoilerplateBar score={c.boilerplateScore} />
                      </td>
                      <td className="px-4 py-3 text-stone-400">
                        {c.timeToRulingMinutes != null ? `${c.timeToRulingMinutes}m` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-stone-700 text-stone-500 text-xs">
                          {c.dataSource?.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Separator className="bg-stone-800" />

        {/* Methodology note */}
        <div className="text-xs text-stone-600 font-mono space-y-2 pb-8">
          <p className="font-bold text-stone-500 uppercase tracking-wider">Methodology</p>
          <p>
            Boilerplate scores are calculated by comparing ruling text against a registry of phrases that appear
            verbatim in multiple cases. A phrase is flagged when it appears in 5 or more distinct cases, suggesting
            templated rather than individualized judicial review. Time-to-ruling is measured from the timestamp of
            a filed motion to the timestamp of the corresponding minute order, where both are available in the
            public docket. All source documents are public records obtained under NRS Chapter 239.
          </p>
          <p>
            This analysis does not constitute legal advice. It is a public-interest forensic research project.
            All findings are based on public records and are subject to correction upon presentation of contrary
            evidence. Correction requests may be submitted via the{" "}
            <a href="/submit" className="text-stone-500 underline hover:text-stone-400">
              Submit page
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
