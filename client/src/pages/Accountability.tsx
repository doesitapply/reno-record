import { Link } from "wouter";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Scale, Shield, FileX, Users, Gavel, Building2, ChevronRight, ExternalLink } from "lucide-react";

/* ─── data ─────────────────────────────────────────────────────────────────── */

const ROLES = [
  {
    id: "court",
    icon: Gavel,
    title: "The Court",
    subtitle: "Second Judicial District — Washoe County",
    duty: "Protect constitutional rights, ensure a fair and speedy trial, rule impartially on motions, and safeguard the defendant's right to self-representation under Faretta v. California.",
    color: "text-red-400",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/5",
    failures: [
      {
        label: "Pro se motions repeatedly struck",
        detail: "The court struck the defendant's pro se filings on at least four documented occasions while he was without effective counsel — directly suppressing his ability to participate in his own defense.",
        tag: "Faretta / Self-Representation Rights",
        count: 23,
        docs: "See: May 10, Dec 4 orders; Jan 7 contempt motion",
      },
      {
        label: "Nunc pro tunc competency order",
        detail: "A competency order was entered nunc pro tunc to December 5 — backdating a ruling to a date before it was actually issued. The archive documents this as a Record Integrity Issue.",
        tag: "Record Integrity Issue",
        count: 2,
        docs: "See: Dec 10 competency order",
      },
      {
        label: "1,205 days without trial",
        detail: "As of today, the defendant has been in the Washoe County system for over three years without a trial. Nevada's speedy trial statute requires trial within 60 days of arraignment absent good cause.",
        tag: "Speedy Trial / Delay",
        count: 25,
        docs: "See: Sep 13 arraignment → present",
      },
      {
        label: "Judicial disqualification concerns",
        detail: "Eight documents in the archive are tagged with Judicial Disqualification / Bias signals — rulings and conduct the AI pipeline flagged as warranting recusal review.",
        tag: "Judicial Disqualification / Bias",
        count: 8,
        docs: "See: Patterns → Judicial Conduct",
      },
    ],
  },
  {
    id: "da",
    icon: Shield,
    title: "District Attorney's Office",
    subtitle: "Washoe County — DDA Kandaras, Drinkwater, Hicks, Stege",
    duty: "Pursue justice, not merely conviction. Disclose all exculpatory evidence (Brady), avoid delay tactics, and conduct proceedings without misconduct or abuse of process.",
    color: "text-orange-400",
    borderColor: "border-orange-500/30",
    bgColor: "bg-orange-500/5",
    failures: [
      {
        label: "Prosecutorial misconduct — documented",
        detail: "Eight documents are tagged with Prosecutorial Misconduct signals. The defendant filed a sanctions motion against Chief DDA Mary Kandaras — which the court struck rather than adjudicated on the merits.",
        tag: "Prosecutorial Misconduct",
        count: 8,
        docs: "See: Nov 30 sanctions motion; Dec 4 order striking",
      },
      {
        label: "Brady / discovery concerns",
        detail: "A Brady / Discovery Issue violation tag exists in the archive. The defendant had to personally request discovery from the public defender in writing — documented February 13.",
        tag: "Brady / Discovery Issue",
        count: 1,
        docs: "See: Feb 13 discovery request; Brady tag",
      },
      {
        label: "14 public records requests — 12 unanswered",
        detail: "The defendant filed 14 NPRA requests to obtain records the prosecution and agencies hold. 12 remain awaiting response. 2 received only partial responses. Zero full disclosures.",
        tag: "Public Records Noncompliance",
        count: 1,
        docs: "See: Public Records → 14 filed, 12 pending",
      },
    ],
  },
  {
    id: "defense",
    icon: Users,
    title: "Defense Counsel",
    subtitle: "5 attorneys — Brinson, Hutt, Carrico, Figueroa, Verness",
    duty: "Provide effective assistance of counsel under the Sixth Amendment. Investigate the case, file timely motions, communicate with the client, and advocate zealously.",
    color: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/5",
    failures: [
      {
        label: "Five attorneys in three years",
        detail: "Cooper Brinson, Sydney Hutt, Galen Carrico, Samuel Figueroa, and Gianna Verness have each represented the defendant. Every transition created gaps, delays, and lost institutional knowledge.",
        tag: "Due Process Defect",
        count: 33,
        docs: "See: Jan 18, May 31, Jun 4, Jun 7 substitutions",
      },
      {
        label: "Defendant filed first IAC motion himself",
        detail: "On May 8, the defendant filed his own pro se motion alleging Ineffective Assistance of Counsel and an unauthorized Young hearing — before any attorney raised these issues. The court struck it.",
        tag: "Faretta / Self-Representation Rights",
        count: 23,
        docs: "See: May 8 pro se IAC motion; May 10 order striking",
      },
      {
        label: "Trial continued without client consent",
        detail: "On April 24, stand-in counsel requested vacation of the trial date citing a vacation schedule — without documented client consent. This is a documented continuance the defendant did not agree to.",
        tag: "Due Process Defect",
        count: 33,
        docs: "See: Apr 24 trial continuance",
      },
      {
        label: "Defendant had to request his own discovery",
        detail: "On February 13, the defendant sent a written request to his own public defender for discovery materials. A defendant should not have to formally demand basic case materials from his own attorney.",
        tag: "Due Process Defect",
        count: 33,
        docs: "See: Feb 13 discovery request letter",
      },
    ],
  },
  {
    id: "agencies",
    icon: Building2,
    title: "Government Agencies",
    subtitle: "Washoe County, WCSO, WCDA, and others",
    duty: "Respond to public records requests within statutory deadlines, provide access to government records, and comply with Nevada's Public Records Act (NRS Chapter 239).",
    color: "text-blue-400",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/5",
    failures: [
      {
        label: "12 of 14 NPRA requests unanswered",
        detail: "The defendant filed 14 Nevada Public Records Act requests across multiple agencies. 12 remain awaiting response. 2 received partial responses. NRS 239.010 requires response within 5 business days.",
        tag: "Public Records Noncompliance",
        count: 1,
        docs: "See: Public Records section — 14 requests filed",
      },
      {
        label: "First Amendment retaliation documented",
        detail: "One document is tagged with First Amendment Retaliation — conduct by a government actor that the AI pipeline identified as potentially retaliatory against protected speech or petition activity.",
        tag: "First Amendment Retaliation",
        count: 1,
        docs: "See: Apr 24 eviction motion; First Amendment tag",
      },
    ],
  },
  {
    id: "competency",
    icon: FileX,
    title: "Competency System",
    subtitle: "Court-ordered evaluators + Department 7",
    duty: "Conduct timely, objective competency evaluations. Proceedings stayed for competency review must resume promptly once competency is established. The process cannot be weaponized to delay.",
    color: "text-purple-400",
    borderColor: "border-purple-500/30",
    bgColor: "bg-purple-500/5",
    failures: [
      {
        label: "Three competency evaluations ordered",
        detail: "The court ordered three separate competency evaluations — Lindsay Coyle, Dr. Rachael Pinkerman, and a third by stipulation. Each evaluation extended the stay of proceedings, adding months to the delay.",
        tag: "Competency Proceeding Abuse",
        count: 7,
        docs: "See: Dec 6 competency order; May 24, May 29, Jun 6 reports",
      },
      {
        label: "Proceedings stayed for 6+ months",
        detail: "Criminal proceedings were stayed pending competency evaluation from December 2024 through at least June 2025 — while the defendant remained in custody with no trial date.",
        tag: "Competency Proceeding Abuse",
        count: 7,
        docs: "See: Dec 6 stay order → Jun 6 third evaluation",
      },
    ],
  },
];

/* ─── component ─────────────────────────────────────────────────────────────── */

export default function Accountability() {
  const { data: stats } = trpc.patterns.siteStats.useQuery();
  const { data: eventTagCounts } = trpc.violationTag.getEventTagCounts.useQuery();

  const daysInSystem = Math.floor((Date.now() - new Date("2023-03-13").getTime()) / 86400000);
  const totalEventSignals = eventTagCounts?.reduce((sum: number, t: any) => sum + (t.count ?? 0), 0) ?? null;

  return (
    <SiteShell>
      <div className="min-h-screen bg-background">
        {/* ── hero ── */}
        <div className="border-b border-border bg-gradient-to-b from-red-950/20 to-background">
          <div className="max-w-5xl mx-auto px-4 py-16">
            <div className="flex items-center gap-2 text-xs font-mono text-red-400 uppercase tracking-widest mb-6">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Professional Accountability Record</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-foreground mb-4 leading-tight">
              The Accountability Gap
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mb-6 leading-relaxed">
              Every professional in this case had a defined legal duty. This archive documents,
              with source-cited evidence, where each one failed to perform it — and how a
              defendant with no legal training was forced to identify those failures himself.
            </p>

            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5">
                <span className="text-red-400 font-mono font-bold">{daysInSystem}</span>
                <span className="text-muted-foreground">days held without trial</span>
              </div>
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded px-3 py-1.5">
                <span className="text-orange-400 font-mono font-bold">{totalEventSignals ?? "—"}</span>
                <span className="text-muted-foreground">event-level violation signals</span>
              </div>
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-1.5">
                <span className="text-yellow-400 font-mono font-bold">5</span>
                <span className="text-muted-foreground">defense attorneys cycled through</span>
              </div>
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded px-3 py-1.5">
                <span className="text-blue-400 font-mono font-bold">12 / 14</span>
                <span className="text-muted-foreground">public records requests unanswered</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── pro se callout ── */}
        <div className="border-b border-amber-500/20 bg-amber-500/5">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex items-start gap-4">
              <Scale className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold mb-1">
                  None of this was found by a lawyer.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">
                  The defendant — Cameron Church — is not an attorney. He has no legal training.
                  Every pattern documented in this archive, every violation tag, every cross-referenced
                  filing was identified by a man who taught himself constitutional law, civil procedure,
                  and forensic document analysis while incarcerated, because the professionals assigned
                  to protect his rights did not do it. He then built an AI-powered audit system to
                  make the record undeniable.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── role cards ── */}
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.id}
                className={`rounded-xl border ${role.borderColor} ${role.bgColor} overflow-hidden`}
              >
                {/* header */}
                <div className="px-6 py-5 border-b border-border/50">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg bg-background/50 ${role.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`text-xl font-bold ${role.color}`}>{role.title}</h2>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{role.subtitle}</p>
                    </div>
                  </div>

                  <div className="mt-4 pl-11">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">
                      Legal Duty
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{role.duty}</p>
                  </div>
                </div>

                {/* failures */}
                <div className="divide-y divide-border/30">
                  {role.failures.map((f, i) => (
                    <div key={i} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1.5">
                            <h3 className="font-semibold text-foreground text-sm">{f.label}</h3>
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0 border-red-500/30 text-red-400"
                            >
                              {f.count}×
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                            {f.detail}
                          </p>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {f.tag}
                            </Badge>
                            <span className="text-xs text-muted-foreground/60 font-mono">
                              {f.docs}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── what he built instead ── */}
        <div className="border-t border-border bg-muted/20">
          <div className="max-w-5xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-foreground mb-2">What He Built Instead</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl">
              When the system failed to document its own conduct, the defendant built the documentation
              system himself. This is not a blog or an opinion. It is a structured forensic archive.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: "AI Forensic Pipeline",
                  desc: "Every document is processed through an AI engine that extracts filing dates, classifies record status, identifies constitutional violation patterns, and generates QC-verified summaries.",
                  link: "/evidence",
                  linkLabel: "Browse Evidence",
                },
                {
                  title: "Immutable Version History",
                  desc: "Every document has a cryptographically-linked version chain. Nothing can be altered without the change being recorded. The record is tamper-evident by architecture.",
                  link: "/patterns",
                  linkLabel: "View Patterns",
                },
                {
                  title: "Public API + MCP Interface",
                  desc: "The archive is queryable by journalists, attorneys, and AI systems via a documented REST API and MCP manifest. The record is designed to be verified by anyone.",
                  link: "/record",
                  linkLabel: "The Record",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.desc}</p>
                  <Link href={item.link}>
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 hover:text-amber-300 transition-colors cursor-pointer">
                      {item.linkLabel}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── footer nav ── */}
        <div className="border-t border-border">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/patterns">
              <span className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Pattern Analysis
              </span>
            </Link>
            <Link href="/evidence">
              <span className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Evidence Archive
              </span>
            </Link>
            <Link href="/actors">
              <span className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Named Actors
              </span>
            </Link>
            <Link href="/public-records">
              <span className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" /> Public Records
              </span>
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
