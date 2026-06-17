import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import {
  ArrowRight,
  FileText,
  Users,
  AlertTriangle,
  Clock,
  Scale,
  Activity,
  BarChart3,
  Search,
  Zap,
  Shield,
  Database,
  ChevronRight,
  ExternalLink,
  Trophy,
  TrendingUp,
  BookOpen,
  Gavel,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { cn } from "@/lib/utils";

/* ─── Utility ─────────────────────────────────────────────────── */
function relTime(date: Date | string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTION_COLORS: Record<string, string> = {
  document_ingested: "text-amber-400",
  document_approved: "text-green-400",
  document_uploaded: "text-sky-400",
  story_submitted: "text-violet-400",
  story_approved: "text-green-400",
  review_request_submitted: "text-orange-400",
  inline_edit: "text-stone-400",
  visibility_changed: "text-stone-400",
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  document_ingested: Zap,
  document_approved: Shield,
  document_uploaded: Database,
  story_submitted: FileText,
  story_approved: Shield,
  review_request_submitted: Search,
  inline_edit: Activity,
};

/* ─── Clickable Gauge ─────────────────────────────────────────── */
function Gauge({
  value,
  max,
  label,
  sublabel,
  color = "amber",
  href,
  tooltip,
}: {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  color?: "amber" | "sky" | "green" | "red" | "violet" | "orange";
  href: string;
  tooltip?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colors = {
    amber:  { stroke: "#f59e0b", glow: "rgba(245,158,11,0.4)",  bg: "hover:bg-amber-950/30",  border: "hover:border-amber-700/50",  text: "text-amber-400" },
    sky:    { stroke: "#38bdf8", glow: "rgba(56,189,248,0.4)",   bg: "hover:bg-sky-950/30",    border: "hover:border-sky-700/50",    text: "text-sky-400" },
    green:  { stroke: "#4ade80", glow: "rgba(74,222,128,0.4)",   bg: "hover:bg-green-950/30",  border: "hover:border-green-700/50",  text: "text-green-400" },
    red:    { stroke: "#f87171", glow: "rgba(248,113,113,0.4)",  bg: "hover:bg-red-950/30",    border: "hover:border-red-700/50",    text: "text-red-400" },
    violet: { stroke: "#a78bfa", glow: "rgba(167,139,250,0.4)",  bg: "hover:bg-violet-950/30", border: "hover:border-violet-700/50", text: "text-violet-400" },
    orange: { stroke: "#fb923c", glow: "rgba(251,146,60,0.4)",   bg: "hover:bg-orange-950/30", border: "hover:border-orange-700/50", text: "text-orange-400" },
  };
  const c = colors[color];
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <Link href={href}>
      <div
        className={cn(
          "relative flex flex-col items-center gap-2 p-3 rounded-lg border border-stone-800/60 cursor-pointer transition-all duration-200 group",
          c.bg, c.border,
          hovered && "scale-[1.03] shadow-lg"
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={tooltip}
      >
        <div className={cn(
          "absolute top-2 right-2 transition-opacity duration-200",
          hovered ? "opacity-100" : "opacity-0"
        )}>
          <ArrowRight className={cn("w-3 h-3", c.text)} />
        </div>
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="#292524" strokeWidth="8" />
            <circle
              cx="50" cy="50" r={r}
              fill="none"
              stroke={c.stroke}
              strokeWidth="8"
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 ${hovered ? "10px" : "6px"} ${c.glow})`, transition: "filter 0.2s" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-black font-mono tabular-nums", c.text)}>
              {value.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-stone-400 group-hover:text-stone-200 transition-colors leading-tight">
            {label}
          </p>
          {sublabel && (
            <p className="text-[9px] font-mono text-stone-600 group-hover:text-stone-500 transition-colors mt-0.5">
              {sublabel}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ─── Live ticker ─────────────────────────────────────────────── */
function LiveFeed({ items }: { items: any[] }) {
  const visible = items.slice(0, 8);

  if (!visible.length) {
    return (
      <div className="flex items-center gap-2 text-stone-600 text-xs font-mono py-4">
        <Activity className="w-3.5 h-3.5 animate-pulse" />
        <span>Monitoring archive activity…</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {visible.map((item: any, i: number) => {
        const Icon = ACTION_ICONS[item.action] ?? Activity;
        const colorClass = ACTION_COLORS[item.action] ?? "text-stone-400";
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-2.5 py-1.5 px-2 rounded transition-all",
              i === 0 ? "bg-stone-800/60" : "hover:bg-stone-900/40",
            )}
          >
            <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", colorClass)} />
            <span className="text-xs text-stone-300 flex-1 leading-relaxed">{item.label}</span>
            <span className="text-[10px] text-stone-600 font-mono shrink-0 mt-0.5">
              {relTime(item.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── System status dot ───────────────────────────────────────── */
function StatusDot({ label, status }: { label: string; status: "online" | "standby" | "offline" }) {
  const colors = {
    online: "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]",
    standby: "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]",
    offline: "bg-stone-600",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-2 h-2 rounded-full animate-pulse", colors[status])} />
      <span className="text-xs font-mono text-stone-400">{label}</span>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
export default function Home() {
  useSEO({
    title: "The Reno Record — Forensic Accountability Archive",
    description:
      "Live forensic audit of the Second Judicial District Court. Real-time pattern analysis, procedural violation tracking, and evidence archive for State v. Church (CR23-0657) and Church v. Washoe County (3:24-cv-00579).",
  });

  const { data: stats } = trpc.patterns.siteStats.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: activity } = trpc.patterns.liveActivity.useQuery(
    { limit: 15 },
    { refetchInterval: 15_000 },
  );
  const { data: patternMetrics } = trpc.patterns.metrics.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const s = stats as any;
  const pm = patternMetrics as any;

  const daysSince = s?.daysSinceArrest ?? 0;
  const docCount = s?.documents ?? 0;
  const actorCount = s?.actors ?? 0;
  const eventCount = s?.timelineEvents ?? 0;
  const prrCount = s?.prrs ?? 0;

  return (
    <SiteShell>
      <div className="min-h-screen bg-stone-950 text-stone-100">

        {/* ── HERO: Command Center Header ─────────────────────────── */}
        <section className="relative border-b border-stone-800 overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(245,158,11,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.5) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12">
            {/* Status bar */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <StatusDot label="ARCHIVE ONLINE" status="online" />
              <StatusDot label="GOBLIN PIPELINE" status="online" />
              <StatusDot label="JUDICIAL AUDIT" status="standby" />
              <StatusDot label="FEDERAL CASE MONITOR" status="online" />
              <div className="ml-auto text-xs font-mono text-stone-600 hidden md:block">
                {new Date().toUTCString().replace(" GMT", " UTC")}
              </div>
            </div>

            {/* Main headline */}
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 border border-amber-800/40 bg-amber-950/30 rounded px-3 py-1 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">
                  Live Forensic Archive
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-stone-50 leading-tight mb-4">
                The Reno Record
              </h1>
              <p className="text-lg text-stone-400 leading-relaxed mb-2">
                Autonomous forensic audit of the Second Judicial District Court, Washoe County, Nevada.
              </p>
              <p className="text-sm text-stone-500 font-mono">
                State v. Church · CR23-0657 &nbsp;|&nbsp; Church v. Washoe County · 3:24-cv-00579-ART-CSD
              </p>
            </div>

            {/* Gauge strip — all clickable */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <Gauge
                value={daysSince}
                max={Math.max(daysSince * 1.5, 100)}
                label="Days in System"
                sublabel="Since arrest"
                color="red"
                href="/the-church-record"
                tooltip="View the Church Record — full case overview and procedural history"
              />
              <Gauge
                value={docCount}
                max={Math.max(docCount * 1.5, 10)}
                label="Evidence Files"
                sublabel="AI-tagged docs"
                color="amber"
                href="/evidence"
                tooltip="Browse the Evidence Archive — all ingested and tagged documents"
              />
              <Gauge
                value={eventCount}
                max={Math.max(eventCount * 1.5, 10)}
                label="Timeline Events"
                sublabel="State + federal"
                color="sky"
                href="/timeline"
                tooltip="View the full case timeline — state and federal events"
              />
              <Gauge
                value={actorCount}
                max={Math.max(actorCount * 1.5, 10)}
                label="Named Actors"
                sublabel="On record"
                color="violet"
                href="/actors"
                tooltip="Actor dossiers — judges, prosecutors, attorneys, officials"
              />
              <Gauge
                value={prrCount}
                max={Math.max(prrCount * 1.5, 5)}
                label="Records Requests"
                sublabel="NPRA filings"
                color="green"
                href="/public-records"
                tooltip="Public records requests — filed, pending, and fulfilled"
              />
              <Gauge
                value={(pm?.tagCounts ?? []).reduce((a: number, t: any) => a + (t.count ?? 0), 0)}
                max={Math.max((pm?.tagCounts ?? []).reduce((a: number, t: any) => a + (t.count ?? 0), 0) * 1.5, 10)}
                label="Violation Signals"
                sublabel={`${pm?.tagCounts?.length ?? 0} tag types`}
                color="orange"
                href="/patterns"
                tooltip="Pattern dashboard — all violation tag counts and evidence signals"
              />
            </div>
            <p className="mt-2 text-[10px] font-mono text-stone-700 text-center">
              ↑ Click any gauge to navigate to that section
            </p>
          </div>
        </section>

        {/* ── MAIN GRID ──────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Live activity + pattern signals + what this is */}
          <div className="lg:col-span-2 space-y-6">

            {/* Live feed */}
            <div className="rounded-lg border border-stone-800 bg-stone-900/40">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono uppercase tracking-widest text-stone-300">
                    Live Archive Activity
                  </span>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <div className="p-4">
                <LiveFeed items={activity ?? []} />
              </div>
            </div>

            {/* Pattern signals */}
            <div className="rounded-lg border border-stone-800 bg-stone-900/40">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-mono uppercase tracking-widest text-stone-300">
                    Procedural Pattern Signals
                  </span>
                </div>
                <Link href="/patterns" className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  Full analysis <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {(() => {
                  // Build a lookup: slug → { count, latestDocTitle, latestDocDate }
                  type TagMeta = { count: number; latestDocTitle?: string | null; latestDocDate?: string | null };
                  const tc: Record<string, TagMeta> = {};
                  ((pm?.tagCounts ?? []) as { slug: string; count: number; latestDocTitle?: string | null; latestDocDate?: string | null }[]).forEach((t) => {
                    tc[t.slug] = { count: t.count, latestDocTitle: t.latestDocTitle, latestDocDate: t.latestDocDate };
                  });
                  return [
                    { label: "Faretta Violations",    slug: "faretta_self_representation",    cite: "Faretta v. California", color: "border-red-800/50 bg-red-950/20 text-red-300" },
                    { label: "Speedy Trial Issues",   slug: "speedy_trial_delay",             cite: "6th Amendment",         color: "border-amber-800/50 bg-amber-950/20 text-amber-300" },
                    { label: "Due Process Defects",   slug: "due_process_defect",             cite: "14th Amendment",        color: "border-orange-800/50 bg-orange-950/20 text-orange-300" },
                    { label: "Warrant / Bail Defects",slug: "warrant_or_bail_defect",         cite: "4th Amendment",         color: "border-sky-800/50 bg-sky-950/20 text-sky-300" },
                    { label: "Access to Courts",      slug: "access_to_courts_interference",  cite: "Due Process",           color: "border-violet-800/50 bg-violet-950/20 text-violet-300" },
                    { label: "Competency Abuse",      slug: "competency_proceeding_abuse",    cite: "Pate v. Robinson",      color: "border-rose-800/50 bg-rose-950/20 text-rose-300" },
                  ].map((sig) => {
                    const meta = tc[sig.slug];
                    const docTitle = meta?.latestDocTitle;
                    const docDate = meta?.latestDocDate
                      ? new Date(meta.latestDocDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                      : null;
                    return (
                      <div key={sig.slug} className="group relative">
                        <Link href={`/patterns/tag/${sig.slug}`}>
                          <div className={cn("rounded border p-3 cursor-pointer transition-all duration-150 hover:brightness-110 hover:scale-[1.02]", sig.color)}>
                            <p className="text-2xl font-black tabular-nums mb-1">{meta?.count ?? 0}</p>
                            <p className="text-xs font-mono leading-tight">{sig.label}</p>
                            <p className="text-[10px] opacity-60 mt-1">{sig.cite}</p>
                          </div>
                        </Link>
                        {/* Hover tooltip — most recently tagged document */}
                        {docTitle && (
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                                          w-56 rounded-md border border-stone-700 bg-stone-900 shadow-xl px-3 py-2
                                          opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-1">Latest tagged doc</p>
                            <p className="text-xs text-stone-200 font-medium leading-snug line-clamp-2">{docTitle}</p>
                            {docDate && (
                              <p className="text-[10px] font-mono text-stone-500 mt-1">{docDate}</p>
                            )}
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                                            border-l-4 border-r-4 border-t-4
                                            border-l-transparent border-r-transparent border-t-stone-700" />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* What this is */}
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-5">
              <h2 className="text-sm font-bold text-stone-200 mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                What This Is
              </h2>
              <div className="space-y-3 text-sm text-stone-400 leading-relaxed">
                <p>
                  The Reno Record is a <strong className="text-stone-200">live forensic accountability archive</strong> documenting
                  systemic procedural violations in the Second Judicial District Court of Washoe County, Nevada.
                  Built on an autonomous AI pipeline that ingests court documents, extracts violation signals,
                  maps actors, and surfaces patterns — in real time, in public.
                </p>
                <p>
                  The primary case is <strong className="text-stone-200">State v. Church (CR23-0657)</strong>, a pro se criminal
                  matter with documented violations of Faretta rights, speedy trial guarantees, due process
                  protections, and access-to-courts doctrine. The parallel federal case,{" "}
                  <strong className="text-stone-200">Church v. Washoe County (3:24-cv-00579)</strong>, asserts §1983 claims
                  against the county and named officials.
                </p>
                <p>
                  Everything here is sourced from public records. Every claim is citation-anchored.
                  The system does not assert guilt — it documents patterns and lets the record speak.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/case-intelligence">
                  <button className="inline-flex items-center gap-1.5 text-xs font-mono border border-amber-800/50 bg-amber-950/30 text-amber-400 hover:bg-amber-950/50 rounded px-3 py-1.5 transition-colors">
                    Case Intelligence <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
                <Link href="/timeline">
                  <button className="inline-flex items-center gap-1.5 text-xs font-mono border border-stone-700 text-stone-400 hover:border-stone-600 rounded px-3 py-1.5 transition-colors">
                    Full Timeline <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
                <Link href="/evidence">
                  <button className="inline-flex items-center gap-1.5 text-xs font-mono border border-stone-700 text-stone-400 hover:border-stone-600 rounded px-3 py-1.5 transition-colors">
                    Evidence Archive <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className="space-y-6">

            {/* Service offer CTA */}
            <div className="rounded-lg border border-amber-700/50 bg-gradient-to-br from-amber-950/40 to-stone-900/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
                  Forensic Audit Services
                </span>
              </div>
              <h3 className="text-base font-black text-stone-100 mb-2 leading-tight">
                This system can audit your case.
              </h3>
              <p className="text-xs text-stone-400 leading-relaxed mb-4">
                The same AI pipeline that built this archive — document ingest, violation tagging, actor mapping,
                pattern analysis — is available for other cases. Upload your court documents. Get a structured
                forensic dossier.
              </p>
              <div className="space-y-2 mb-4">
                {[
                  "Procedural violation extraction",
                  "Actor and agency mapping",
                  "Timeline reconstruction",
                  "Immunity bypass analysis",
                  "Pattern detection across filings",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-xs text-stone-400">
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <Link href="/request-audit">
                <button className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm rounded px-4 py-2.5 transition-colors flex items-center justify-center gap-2">
                  Request a Case Audit
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            {/* Quick nav */}
            <div className="rounded-lg border border-stone-800 bg-stone-900/40">
              <div className="px-4 py-3 border-b border-stone-800">
                <span className="text-xs font-mono uppercase tracking-widest text-stone-500">
                  Archive Navigation
                </span>
              </div>
              <div className="divide-y divide-stone-800/50">
                {[
                  { href: "/the-church-record", label: "The Church Record", sub: "Primary case overview", icon: FileText },
                  { href: "/timeline", label: "Timeline", sub: `${eventCount} documented events`, icon: Clock },
                  { href: "/evidence", label: "Evidence Archive", sub: `${docCount} public documents`, icon: Database },
                  { href: "/actors", label: "Named Actors", sub: `${actorCount} individuals`, icon: Users },
                  { href: "/patterns", label: "Pattern Analysis", sub: "Violation signal dashboard", icon: BarChart3 },
                  { href: "/judicial-pattern", label: "Judicial Audit", sub: "Comparative corpus analysis", icon: Scale },
                  { href: "/public-records", label: "Records Requests", sub: `${prrCount} NPRA filings`, icon: Search },
                ].map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-800/40 transition-colors cursor-pointer group">
                      <item.icon className="w-4 h-4 text-stone-600 group-hover:text-amber-400 transition-colors shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-300 group-hover:text-stone-100 transition-colors truncate">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-stone-600 font-mono truncate">{item.sub}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-stone-700 group-hover:text-stone-400 transition-colors shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Case status */}
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-3">Case Status</p>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-stone-400">CR23-0657</span>
                    <span className="text-[10px] font-mono bg-amber-900/40 text-amber-400 border border-amber-800/40 rounded px-1.5 py-0.5">ACTIVE</span>
                  </div>
                  <p className="text-xs text-stone-500">State v. Church · Washoe County</p>
                  <p className="text-[10px] text-stone-600 mt-0.5">Pro se · Dept. 6 · Judge Breslow</p>
                </div>
                <div className="border-t border-stone-800 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-stone-400">3:24-cv-00579</span>
                    <span className="text-[10px] font-mono bg-sky-900/40 text-sky-400 border border-sky-800/40 rounded px-1.5 py-0.5">RULE 59(e)</span>
                  </div>
                  <p className="text-xs text-stone-500">Church v. Washoe County · D. Nev.</p>
                  <p className="text-[10px] text-stone-600 mt-0.5">§1983 · Judge Traum · Post-dismissal</p>
                </div>
              </div>
            </div>

            {/* Builder credit */}
            <div className="rounded-lg border border-stone-800/50 bg-stone-900/20 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-600 mb-2">Built by</p>
              <p className="text-sm font-bold text-stone-300">Cameron Church</p>
              <p className="text-xs text-stone-500 mt-1">Systems Architect · Strategic Operator</p>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                This platform was designed and built pro se — no legal team, no dev team. The forensic
                pipeline, the evidence archive, the violation tagging system, and the judicial audit
                corpus were all engineered from scratch.
              </p>
              <Link href="/request-audit">
                <button className="mt-3 text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                  Hire for your case <ExternalLink className="w-3 h-3" />
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── BOTTOM STRIP ───────────────────────────────────────── */}
        <div className="border-t border-stone-800 bg-stone-950">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-stone-600">
            <div className="flex items-center gap-4">
              <span>All records are public domain</span>
              <span>·</span>
              <span>No legal advice is provided</span>
              <span>·</span>
              <Link href="/privacy" className="hover:text-stone-400 transition-colors">Privacy Policy</Link>
            </div>
            <div className="flex items-center gap-2 text-stone-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>System operational</span>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
