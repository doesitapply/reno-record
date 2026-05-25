import { useState } from "react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Shield,
  ShieldOff,
  ShieldAlert,
  Scale,
  FileText,
  Clock,
  Users,
  BookOpen,
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionabilityTier = "tier1" | "tier2" | "tier3";
type ImmunityStatus = "bypassed" | "partial" | "blocked" | "na";
type ActionableStatus = "yes" | "conditional" | "no";

interface ViolationEntry {
  slug: string;
  label: string;
  count: number;
  plainEnglish: string;
  legalBasis: string;
  actionable: ActionableStatus;
  immunityBypass: ImmunityStatus;
  immunityNote: string;
  tier?: ActionabilityTier;
  tierNote?: string;
}

interface ImmunityActor {
  name: string;
  role: string;
  immunityType: string;
  bypassAvailable: boolean;
  bypassNote: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const VIOLATIONS: ViolationEntry[] = [
  {
    slug: "speedy_trial_delay",
    label: "Speedy Trial / Delay",
    count: 25,
    plainEnglish:
      "You have a constitutional right to a trial within a reasonable time. This case has been pending since March 2023 — over 800 days — with no trial. Multiple continuances, a competency stay, and still no trial date.",
    legalBasis: "6th Amendment · Barker v. Wingo, 407 U.S. 514 (1972) — 4-factor test: length of delay, reason for delay, defendant's assertion of right, prejudice",
    actionable: "yes",
    immunityBypass: "bypassed",
    immunityNote:
      "Speedy trial violation = dismissal remedy in state court (NRS 178.556). Delay caused by prosecutorial strategy bypasses prosecutorial immunity when it's administrative, not quasi-judicial. 800+ days with documented trial requests is a textbook Barker violation.",
    tier: "tier1",
    tierNote: "Strongest path to case dismissal in state court right now.",
  },
  {
    slug: "faretta_self_representation",
    label: "Faretta / Self-Representation",
    count: 23,
    plainEnglish:
      "You have the right to represent yourself. The court repeatedly struck your filings because you had a lawyer, but never gave you the proper hearing to actually fire your lawyer and go pro se. Catch-22: can't file pro se, can't get rid of counsel.",
    legalBasis: "6th Amendment · Faretta v. California, 422 U.S. 806 (1975) · Godinez v. Moran (1993)",
    actionable: "yes",
    immunityBypass: "bypassed",
    immunityNote:
      "Faretta violations are structural errors — no prejudice showing required, automatic reversal on appeal. The pattern of striking pro se filings without a Faretta colloquy is documented across 23 source quotes. Survives on direct appeal and in habeas.",
    tier: "tier1",
    tierNote: "Strongest appellate reversal ground. Structural error = automatic reversal.",
  },
  {
    slug: "due_process_defect",
    label: "Due Process Defect",
    count: 33,
    plainEnglish:
      "The court repeatedly ran proceedings in ways that violated basic fairness — no proper notice, no real opportunity to be heard, fundamentally unfair outcomes. This is the highest-count tag in the archive with 33 source-cited instances.",
    legalBasis: "5th + 14th Amendment · Mathews v. Eldridge, 424 U.S. 319 (1976)",
    actionable: "yes",
    immunityBypass: "partial",
    immunityNote:
      "Judicial immunity blocks damages for most individual rulings. BUT: pattern of conduct + administrative acts (striking filings, nunc pro tunc orders without notice) can fall outside absolute immunity. Injunctive relief against ongoing violations is NOT blocked by judicial immunity (Pulliam v. Allen, 466 U.S. 522). Federal § 1983 claim already filed.",
    tier: "tier2",
    tierNote: "Core of the federal § 1983 claim. Monell liability against Washoe County.",
  },
  {
    slug: "warrant_or_bail_defect",
    label: "Warrant / Bail Defect",
    count: 8,
    plainEnglish:
      "The no-bail bench warrant issued December 18, 2024 has problems. It was issued during a competency stay — when proceedings were supposed to be suspended. The bail conditions it enforced were themselves defective.",
    legalBasis: "4th Amendment (warrant) · 8th Amendment (excessive bail) · Stack v. Boyle, 342 U.S. 1 (1951)",
    actionable: "yes",
    immunityBypass: "bypassed",
    immunityNote:
      "Warrants issued in violation of a stay are not protected by judicial immunity. Signing a warrant is a ministerial act — ministerial acts do not receive absolute judicial immunity. The no-bail hold during a competency stay is the strongest 4th/8th Amendment hook.",
    tier: "tier1",
    tierNote: "No-bail warrant during competency stay. Ministerial act = no absolute immunity.",
  },
  {
    slug: "access_to_courts_interference",
    label: "Access to Courts Interference",
    count: 19,
    plainEnglish:
      "They kept blocking you from using the court system — striking filings, refusing to let you file things, retaliating for filing. 19 source-cited instances across the record.",
    legalBasis: "1st + 14th Amendment · Lewis v. Casey, 518 U.S. 343 (1996) · Christopher v. Harbury, 536 U.S. 403 (2002)",
    actionable: "yes",
    immunityBypass: "partial",
    immunityNote:
      "Individual judge: absolute immunity for judicial acts, NOT for administrative acts. Striking filings as a pattern = potentially administrative. Prosecutor's role in moving to strike = prosecutorial immunity does NOT cover non-quasi-judicial acts. § 1983 injunctive relief available.",
    tier: "tier2",
    tierNote: "Supports § 1983 claim. Strongest when combined with Faretta and retaliation.",
  },
  {
    slug: "competency_proceeding_abuse",
    label: "Competency Proceeding Abuse",
    count: 7,
    plainEnglish:
      "After you kept asserting your rights, the court suddenly decided you might not be competent. The competency evaluation came back: competent. The case stayed frozen anyway. The timing — rights assertion → competency order → no-bail warrant — is the tell.",
    legalBasis: "Drope v. Missouri, 420 U.S. 162 (1975) · Pate v. Robinson, 383 U.S. 375 (1966) · Jackson v. Indiana, 406 U.S. 715 (1972)",
    actionable: "yes",
    immunityBypass: "partial",
    immunityNote:
      "The evaluation itself is a judicial act (immune). BUT: using competency as a delay mechanism after rights assertion = potential due process violation. Jackson v. Indiana: indefinite stay without trial violates due process. Continued stay after competency findings returned competent is the actionable part.",
    tier: "tier2",
    tierNote: "Jackson v. Indiana claim. Continued stay after competency restored.",
  },
  {
    slug: "prosecutorial_misconduct",
    label: "Prosecutorial Misconduct",
    count: 8,
    plainEnglish:
      "The DA's office (primarily Aziz Merchant) filed a contempt motion in response to pro se filings — using the court's contempt power to punish you for asserting constitutional rights. Kandaras filed a sanctions motion. These are pressure tools, not legitimate prosecutorial acts.",
    legalBasis: "Brady v. Maryland, 373 U.S. 83 (1963) · Berger v. United States, 295 U.S. 78 (1935) · Imbler v. Pachtman, 424 U.S. 409 (1976)",
    actionable: "conditional",
    immunityBypass: "partial",
    immunityNote:
      "Prosecutors have absolute immunity for quasi-judicial acts. BUT: absolute immunity does NOT cover investigative/administrative acts. The contempt motion filed in response to pro se filings = retaliatory prosecution = potential § 1983 claim (Hartman v. Moore, 547 U.S. 250). Key question: was the conduct quasi-judicial (immune) or administrative (not immune)?",
    tier: "tier2",
    tierNote: "Retaliatory contempt motion is the strongest hook. Combine with 1st Amendment claim.",
  },
  {
    slug: "judicial_disqualification_bias",
    label: "Judicial Bias / Disqualification",
    count: 8,
    plainEnglish:
      "Judge Breslow has shown a consistent pattern of ruling against you on procedural motions. You filed for disqualification. The bias pattern is documented across 8 source-cited instances.",
    legalBasis: "28 U.S.C. § 455 · NRS 1.230 · Caperton v. A.T. Massey Coal Co., 556 U.S. 868 (2009)",
    actionable: "yes",
    immunityBypass: "na",
    immunityNote:
      "Judges have absolute immunity from damages for judicial acts, even wrong or biased ones. The remedy for judicial bias is recusal + reversal on appeal — not § 1983 damages. Strategic value: use the bias pattern to support Faretta/due process claims and recusal motion. Do not pursue as a standalone damages theory.",
    tier: "tier3",
    tierNote: "Use to support other claims and recusal motion. Not a damages theory.",
  },
  {
    slug: "retaliation_first_amendment",
    label: "First Amendment Retaliation",
    count: 1,
    plainEnglish:
      "Government actors took adverse action against you specifically because you filed legal documents and spoke publicly about the case. The contempt motion filed after pro se filings is the clearest example.",
    legalBasis: "1st Amendment · Hartman v. Moore, 547 U.S. 250 (2006) · Nieves v. Bartlett, 587 U.S. 391 (2019)",
    actionable: "yes",
    immunityBypass: "bypassed",
    immunityNote:
      "Retaliatory prosecution requires showing the prosecution would not have occurred but for the protected activity. Non-judicial actors (prosecutors acting administratively) lose immunity for retaliatory acts. Combine with prosecutorial misconduct claim for maximum effect.",
    tier: "tier2",
    tierNote: "Combine with prosecutorial misconduct. High bar but immunity does not apply.",
  },
  {
    slug: "record_integrity_issue",
    label: "Record Integrity Issue",
    count: 2,
    plainEnglish:
      "There are discrepancies in the official court record. The nunc pro tunc order — backdated to December 5 but entered December 10 — is the clearest example. Nunc pro tunc orders cannot be used to create a record that didn't exist.",
    legalBasis: "Due process · Brady v. Maryland (if material to defense) · In re Marriage of Bhati (nunc pro tunc limits)",
    actionable: "conditional",
    immunityBypass: "partial",
    immunityNote:
      "Needs more documentation to be standalone actionable. Supports due process and record-integrity arguments. The nunc pro tunc issue is well-documented and worth preserving.",
    tier: "tier3",
    tierNote: "Supporting claim. Preserve for appeal and Brady argument.",
  },
];

const IMMUNITY_ACTORS: ImmunityActor[] = [
  {
    name: "Judge Barry L. Breslow",
    role: "District Judge, Dept. 8",
    immunityType: "Absolute Judicial Immunity",
    bypassAvailable: true,
    bypassNote: "Injunctive relief not blocked (Pulliam v. Allen). Administrative/ministerial acts not covered. Warrant issuance = ministerial.",
  },
  {
    name: "Aziz Merchant",
    role: "Lead Prosecutor (DDA)",
    immunityType: "Absolute Prosecutorial Immunity",
    bypassAvailable: true,
    bypassNote: "Investigative/admin acts not covered. Contempt motion in response to pro se filings = retaliatory = not quasi-judicial.",
  },
  {
    name: "Mary Kandaras",
    role: "Chief Deputy DA",
    immunityType: "Absolute Prosecutorial Immunity",
    bypassAvailable: true,
    bypassNote: "Same analysis as Merchant. Sanctions motion = potentially administrative act.",
  },
  {
    name: "Amos Stege",
    role: "Deputy DA",
    immunityType: "Absolute Prosecutorial Immunity",
    bypassAvailable: true,
    bypassNote: "Bail violation notice = administrative act, not quasi-judicial. Outside immunity scope.",
  },
  {
    name: "Christopher J. Hicks",
    role: "District Attorney",
    immunityType: "Qualified Immunity (Supervisory)",
    bypassAvailable: true,
    bypassNote: "Supervisory liability if office policy caused violation. Qualified immunity requires showing clearly established right was violated — Faretta, speedy trial, due process are all clearly established.",
  },
  {
    name: "Washoe County",
    role: "Municipal Entity",
    immunityType: "No Immunity (Monell)",
    bypassAvailable: true,
    bypassNote: "Municipalities have NO immunity under § 1983. Monell v. Dept. of Social Services (1978): liable when constitutional violation results from official policy, custom, or practice. The 136-instance pattern across 800+ days is exactly what Monell requires.",
  },
];

// ─── Helper components ────────────────────────────────────────────────────────

function ActionableBadge({ status }: { status: ActionableStatus }) {
  if (status === "yes") return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3" /> Actionable
    </span>
  );
  if (status === "conditional") return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
      <MinusCircle className="w-3 h-3" /> Conditional
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
      <XCircle className="w-3 h-3" /> Not Actionable
    </span>
  );
}

function ImmunityBadge({ status }: { status: ImmunityStatus }) {
  if (status === "bypassed") return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
      <ShieldOff className="w-3 h-3" /> Immunity Bypassed
    </span>
  );
  if (status === "partial") return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
      <ShieldAlert className="w-3 h-3" /> Partial Immunity
    </span>
  );
  if (status === "blocked") return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
      <Shield className="w-3 h-3" /> Immunity Applies
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
      <Shield className="w-3 h-3" /> N/A — Seek Recusal
    </span>
  );
}

function TierBadge({ tier }: { tier: ActionabilityTier }) {
  const map = {
    tier1: { label: "Tier 1 — Move Now", className: "bg-red-500/20 text-red-400 border-red-500/40" },
    tier2: { label: "Tier 2 — Federal / Parallel", className: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    tier3: { label: "Tier 3 — Appellate / Support", className: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  };
  const { label, className } = map[tier];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border ${className}`}>
      <Target className="w-3 h-3" /> {label}
    </span>
  );
}

function ViolationCard({ v }: { v: ViolationEntry }) {
  const [open, setOpen] = useState(false);
  const borderColor =
    v.tier === "tier1" ? "border-l-red-500" :
    v.tier === "tier2" ? "border-l-amber-400" :
    "border-l-blue-500/60";

  return (
    <div className={`paper-card border-l-4 ${borderColor} overflow-hidden`}>
      <button
        className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">{v.label}</span>
            <span className="font-mono text-xs text-amber-400">{v.count} instances</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionableBadge status={v.actionable} />
            <ImmunityBadge status={v.immunityBypass} />
            {v.tier && <TierBadge tier={v.tier} />}
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/40 pt-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Plain English</div>
            <p className="text-sm text-foreground/90 leading-relaxed">{v.plainEnglish}</p>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Legal Basis</div>
            <p className="text-sm text-foreground/80 leading-relaxed font-mono">{v.legalBasis}</p>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1.5">Immunity Analysis</div>
            <p className="text-sm text-foreground/80 leading-relaxed">{v.immunityNote}</p>
          </div>
          {v.tierNote && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded p-3">
              <div className="font-mono text-xs uppercase tracking-widest text-amber-400/70 mb-1">Strategic Note</div>
              <p className="text-sm text-amber-100/80">{v.tierNote}</p>
            </div>
          )}
          <Link
            href={`/patterns/tag/${v.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            <FileText className="w-3 h-3" />
            View {v.count} source-cited documents →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CaseIntelligencePage() {
  const [activeSection, setActiveSection] = useState<"plain" | "technical" | "violations" | "immunity">("plain");

  useSEO({
    title: "Case Intelligence — State v. Church",
    description:
      "Plain-English, technical, and legal immunity analysis of State v. Church (CR23-0657) and Church v. Washoe County (3:24-cv-00579). What happened, what violations occurred, what's actionable, and what bypasses immunity.",
    canonicalPath: "/case-intelligence",
  });

  const tier1 = VIOLATIONS.filter(v => v.tier === "tier1");
  const tier2 = VIOLATIONS.filter(v => v.tier === "tier2");
  const tier3 = VIOLATIONS.filter(v => v.tier === "tier3");
  const totalInstances = VIOLATIONS.reduce((sum, v) => sum + v.count, 0);
  const actionableCount = VIOLATIONS.filter(v => v.actionable === "yes").length;
  const bypassCount = VIOLATIONS.filter(v => v.immunityBypass === "bypassed").length;

  return (
    <SiteShell>
      <section className="container py-10 md:py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="eyebrow">Case Intelligence Dashboard</div>
          <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
            What happened.<br />
            <span className="text-amber-400">What it means.</span>
          </h1>
          <p className="mt-5 text-foreground/80 leading-relaxed max-w-2xl">
            State v. Church (CR23-0657) · Church v. Washoe County (3:24-cv-00579-ART-CSD) ·
            800+ days · 75 timeline events · 38 source-cited documents · 136 tagged violations
          </p>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Clock, label: "Days Pending", value: "800+", color: "text-red-400" },
            { icon: TrendingUp, label: "Tagged Violations", value: totalInstances, color: "text-amber-400" },
            { icon: Zap, label: "Actionable Claims", value: actionableCount, color: "text-emerald-400" },
            { icon: ShieldOff, label: "Immunity Bypassed", value: bypassCount, color: "text-red-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="paper-card p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
              <div className={`display-serif text-3xl ${color}`}>{value}</div>
              <div className="eyebrow !text-[0.6rem] mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-border/40 pb-4">
          {[
            { id: "plain", label: "Plain English", icon: BookOpen },
            { id: "technical", label: "Technical Summary", icon: FileText },
            { id: "violations", label: "Violations", icon: AlertTriangle },
            { id: "immunity", label: "Immunity Map", icon: Shield },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-mono transition-colors ${
                activeSection === id
                  ? "bg-amber-400/15 text-amber-400 border border-amber-400/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── PLAIN ENGLISH ── */}
        {activeSection === "plain" && (
          <div className="max-w-3xl space-y-8">
            <div className="paper-card p-6 border-l-4 border-l-amber-400">
              <div className="eyebrow mb-3">The Short Version</div>
              <p className="text-lg leading-relaxed text-foreground/90">
                In March 2023, Cameron Church was arrested in Washoe County, Nevada on a vehicle-related charge.
                What should have been a straightforward criminal case became something else entirely.
                Over 800 days later, there is still no trial date.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="display-serif text-2xl rule-amber mb-3">What happened</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Church was arrested March 13, 2023 on Grand Larceny of a Motor Vehicle and failure-to-register charges.
                  He was assigned a public defender. Over the following months, he repeatedly tried to fire his lawyers
                  and represent himself — a constitutional right established by the Supreme Court in 1975 (<em>Faretta v. California</em>).
                  Every time he filed anything on his own, the judge struck it. Every time he asked for a proper hearing
                  to go pro se, it didn't happen.
                </p>
              </div>

              <div>
                <h2 className="display-serif text-2xl rule-amber mb-3">The catch-22</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  He was trapped in a procedural loop: he couldn't file on his own because he had a lawyer,
                  but he couldn't get rid of the lawyer without a hearing the court wouldn't hold.
                  Meanwhile, the case kept getting continued. No trial. No resolution.
                  By the time a trial was demanded, the case was already past the point where a speedy trial
                  violation could be argued.
                </p>
              </div>

              <div>
                <h2 className="display-serif text-2xl rule-amber mb-3">When he pushed back</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  When Church started filing complaints about what was happening — to the court, to oversight bodies,
                  publicly — the response escalated. A contempt motion was filed against him for submitting pro se
                  documents. A competency evaluation was ordered. A no-bail bench warrant was issued.
                  The competency evaluation came back: competent. The case stayed frozen anyway.
                </p>
              </div>

              <div>
                <h2 className="display-serif text-2xl rule-amber mb-3">The federal case</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  In January 2025, Church filed a federal civil rights lawsuit documenting the constitutional violations
                  (Case No. 3:24-cv-00579-ART-CSD, D. Nev.). The federal court dismissed it on procedural grounds —
                  the Rooker-Feldman doctrine prevents federal courts from reviewing ongoing state court proceedings.
                  A Rule 59(e) motion to reconsider is pending.
                </p>
              </div>

              <div>
                <h2 className="display-serif text-2xl rule-amber mb-3">Where it stands</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  The state case has no trial date. It has been pending for over 800 days.
                  The documentation — 38 source-cited documents, 75 timeline events, 136 tagged violations —
                  exists in this archive. The pattern is not alleged. It is recorded.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TECHNICAL SUMMARY ── */}
        {activeSection === "technical" && (
          <div className="max-w-4xl space-y-8">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="paper-card p-5 space-y-3">
                <div className="eyebrow">State Case</div>
                <div className="font-mono text-sm space-y-1">
                  <div><span className="text-muted-foreground">Case No.:</span> CR23-0657</div>
                  <div><span className="text-muted-foreground">Court:</span> Second Judicial District, Washoe County</div>
                  <div><span className="text-muted-foreground">Judge:</span> Barry L. Breslow, Dept. 8</div>
                  <div><span className="text-muted-foreground">Charges:</span> Grand Larceny MV; Unlawful Taking MV</div>
                  <div><span className="text-muted-foreground">Filed:</span> March 21, 2023</div>
                  <div><span className="text-muted-foreground">Status:</span> <span className="text-red-400">No trial date — 800+ days pending</span></div>
                </div>
              </div>
              <div className="paper-card p-5 space-y-3">
                <div className="eyebrow">Federal Case</div>
                <div className="font-mono text-sm space-y-1">
                  <div><span className="text-muted-foreground">Case No.:</span> 3:24-cv-00579-ART-CSD</div>
                  <div><span className="text-muted-foreground">Court:</span> U.S. District Court, D. Nev.</div>
                  <div><span className="text-muted-foreground">Judge:</span> Anne R. Traum</div>
                  <div><span className="text-muted-foreground">Claims:</span> § 1983 constitutional violations</div>
                  <div><span className="text-muted-foreground">Filed:</span> January 6, 2025</div>
                  <div><span className="text-muted-foreground">Status:</span> <span className="text-amber-400">Dismissed (Rooker-Feldman) · Rule 59(e) pending</span></div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="display-serif text-2xl rule-amber mb-4">Key Procedural Sequence</h2>
              <div className="space-y-2">
                {[
                  { date: "Mar 2023", event: "Arrest, probable cause, original complaint filed (DDA Drinkwater)", flag: null },
                  { date: "Sep 2023", event: "Arraignment — not guilty plea, 60-day trial rule waived, Cooper Brinson as counsel", flag: "speedy_trial_delay" },
                  { date: "May 2024", event: "First pro se motion filed → immediately struck by Judge Breslow (hybrid representation ruling)", flag: "faretta_self_representation" },
                  { date: "Oct 2024", event: "Second pro se sanctions motion struck; Church files motion for leave to file pro se", flag: "faretta_self_representation" },
                  { date: "Dec 5, 2024", event: "Young hearing — competency evaluation ordered, proceedings stayed, pro se filings restricted", flag: "competency_proceeding_abuse" },
                  { date: "Dec 10, 2024", event: "Competency order entered nunc pro tunc to Dec 5 — backdated order without notice", flag: "record_integrity_issue" },
                  { date: "Dec 18, 2024", event: "OSC hearing — pretrial release revoked, no-bail bench warrant issued during competency stay", flag: "warrant_or_bail_defect" },
                  { date: "Jan 6, 2025", event: "Federal § 1983 complaint filed (ECF 5) — 3:24-cv-00579", flag: null },
                  { date: "Jan 7, 2025", event: "State files contempt motion against Church for pro se filings (Merchant)", flag: "prosecutorial_misconduct" },
                  { date: "May 2025", event: "Competency evaluations returned: both evaluators found Church competent under Dusky", flag: "competency_proceeding_abuse" },
                  { date: "Jun 2025", event: "Figueroa moves to withdraw citing relationship breakdown and Church's desire for self-representation", flag: "faretta_self_representation" },
                  { date: "Aug 2025", event: "Withdrawal granted — Church finally pro se after 800+ days", flag: null },
                  { date: "Sep 2025", event: "Stege files bail violation notice alleging Church email to Merchant constituted a threat", flag: "prosecutorial_misconduct" },
                ].map(({ date, event, flag }) => (
                  <div key={date + event} className="flex gap-4 items-start">
                    <div className="font-mono text-xs text-muted-foreground w-20 flex-shrink-0 pt-0.5">{date}</div>
                    <div className="flex-1 text-sm text-foreground/80 leading-relaxed">{event}</div>
                    {flag && (
                      <Link href={`/patterns/tag/${flag}`} className="text-xs font-mono text-amber-400/60 hover:text-amber-400 flex-shrink-0 transition-colors">
                        ⚑
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="display-serif text-2xl rule-amber mb-4">Archive Statistics</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Timeline Events", value: "75", sub: "27 federal · 48 state/other" },
                  { label: "Source Documents", value: "38", sub: "Court orders, motions, transcripts" },
                  { label: "Violation Instances", value: "136", sub: "Across 14 violation tags" },
                  { label: "Named Actors", value: "17", sub: "Judges, prosecutors, counsel, evaluators" },
                  { label: "Case Duration", value: "800+", sub: "Days pending without trial" },
                  { label: "Violation Tags", value: "14", sub: "Constitutional, procedural, civil rights" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="paper-card p-4">
                    <div className="display-serif text-3xl text-amber-400">{value}</div>
                    <div className="eyebrow !text-[0.62rem] mt-1">{label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VIOLATIONS ── */}
        {activeSection === "violations" && (
          <div className="max-w-4xl space-y-10">
            <div className="paper-card p-4 text-sm text-muted-foreground leading-relaxed">
              Each violation below is tagged to source documents with extracted quotes. Click any entry to expand the plain-English explanation, legal basis, and immunity analysis. Click "View source-cited documents" to see the actual record.
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <h2 className="display-serif text-xl">Tier 1 — Move Now</h2>
                <span className="text-xs font-mono text-muted-foreground">Strongest immediate claims</span>
              </div>
              <div className="space-y-3">
                {tier1.map(v => <ViolationCard key={v.slug} v={v} />)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <h2 className="display-serif text-xl">Tier 2 — Federal / Parallel Track</h2>
                <span className="text-xs font-mono text-muted-foreground">§ 1983 and concurrent claims</span>
              </div>
              <div className="space-y-3">
                {tier2.map(v => <ViolationCard key={v.slug} v={v} />)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <h2 className="display-serif text-xl">Tier 3 — Appellate / Supporting</h2>
                <span className="text-xs font-mono text-muted-foreground">Preserve for appeal, support other claims</span>
              </div>
              <div className="space-y-3">
                {tier3.map(v => <ViolationCard key={v.slug} v={v} />)}
              </div>
            </div>
          </div>
        )}

        {/* ── IMMUNITY MAP ── */}
        {activeSection === "immunity" && (
          <div className="max-w-4xl space-y-8">
            <div className="paper-card p-5 border-l-4 border-l-amber-400">
              <div className="eyebrow mb-2">The Key Insight</div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                <strong>Washoe County as an entity has no immunity.</strong> Under <em>Monell v. Dept. of Social Services</em> (1978),
                a municipality is liable under § 1983 when a constitutional violation results from an official policy, custom, or practice.
                The pattern documented here — 14 violation tags, 136 source-cited instances, across 800+ days — is exactly what Monell requires.
                Individual actors lose immunity for administrative acts, injunctive relief, and clearly established rights violations.
              </p>
            </div>

            <div className="space-y-4">
              {IMMUNITY_ACTORS.map(actor => (
                <div key={actor.name} className={`paper-card p-5 border-l-4 ${actor.bypassAvailable ? "border-l-red-500/70" : "border-l-muted"}`}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="font-medium text-foreground">{actor.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{actor.role}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                        {actor.immunityType}
                      </span>
                      {actor.bypassAvailable ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                          <ShieldOff className="w-3 h-3" /> Bypass Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          <Shield className="w-3 h-3" /> Fully Protected
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground/75 leading-relaxed">{actor.bypassNote}</p>
                </div>
              ))}
            </div>

            <div className="paper-card p-5 space-y-4">
              <div className="eyebrow mb-2">Immunity Bypass Summary</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="text-left py-2 pr-4 text-muted-foreground font-normal">Violation</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-normal">Instances</th>
                      <th className="text-left py-2 pr-4 text-muted-foreground font-normal">Actionable</th>
                      <th className="text-left py-2 text-muted-foreground font-normal">Immunity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {VIOLATIONS.map(v => (
                      <tr key={v.slug} className="border-b border-border/20 hover:bg-white/[0.02]">
                        <td className="py-2 pr-4 text-foreground/80">
                          <Link href={`/patterns/tag/${v.slug}`} className="hover:text-amber-400 transition-colors">
                            {v.label}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-amber-400">{v.count}</td>
                        <td className="py-2 pr-4">
                          <span className={v.actionable === "yes" ? "text-emerald-400" : v.actionable === "conditional" ? "text-amber-400" : "text-muted-foreground"}>
                            {v.actionable === "yes" ? "Yes" : v.actionable === "conditional" ? "Conditional" : "No"}
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={
                            v.immunityBypass === "bypassed" ? "text-red-400" :
                            v.immunityBypass === "partial" ? "text-amber-400" :
                            v.immunityBypass === "na" ? "text-blue-400" :
                            "text-muted-foreground"
                          }>
                            {v.immunityBypass === "bypassed" ? "Bypassed" :
                             v.immunityBypass === "partial" ? "Partial" :
                             v.immunityBypass === "na" ? "N/A (recusal)" :
                             "Blocked"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-border/40 flex flex-wrap gap-4">
          <Link href="/patterns" className="text-sm font-mono text-muted-foreground hover:text-amber-400 transition-colors">
            ← Patterns Dashboard
          </Link>
          <Link href="/timeline" className="text-sm font-mono text-muted-foreground hover:text-amber-400 transition-colors">
            Full Timeline →
          </Link>
          <Link href="/evidence" className="text-sm font-mono text-muted-foreground hover:text-amber-400 transition-colors">
            Evidence Archive →
          </Link>
          <Link href="/actors" className="text-sm font-mono text-muted-foreground hover:text-amber-400 transition-colors">
            Actors →
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
