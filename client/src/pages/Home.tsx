import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import {
  FileText,
  Clock,
  Users,
  AlertTriangle,
  Search,
  Scale,
  Shield,
  MapPin,
  Calendar,
  TrendingUp,
  Gavel,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const COUNSEL_TIMELINE = [
  { name: "Cooper Brinson", role: "Alternate Public Defender", period: "Mar 2023 – Jan 17, 2024", exit: "Substituted out; left APD entirely" },
  { name: "Sydney McBride Hutt", role: "Alternate Public Defender", period: "Jan 17 – May 30, 2024", exit: "Declared conflict" },
  { name: "Biray Dogan", role: "Alternate Public Defender", period: "Sep 2023 – Jun 2024", exit: "Substituted out" },
  { name: "Galen D. Carrico", role: "Conflict counsel", period: "Jun 24, 2024 – May 8, 2025", exit: "Moved to withdraw" },
  { name: "Samuel Figueroa", role: "Private counsel (retained)", period: "~Jun – Aug 2025", exit: 'Sought withdrawal in writing to court and DA' },
];

const COMPARATOR = [
  { label: "Alleged act", joyce: "Stabbing (violent felony)", church: "Moving a motorcycle (property dispute)" },
  { label: "Initial bail", joyce: "$150,000", church: "$25,000 cash-only" },
  { label: "Bail outcome", joyce: "Reduced to $500", church: "Revoked; $25,000 cash posted by mother" },
  { label: "Case outcome", joyce: "Dismissed at preliminary hearing", church: "Pending — no trial after 3+ years" },
  { label: "Prosecutor", joyce: "Amos Stege (Chief DDA)", church: "Aziz Merchant; Stege later intervenes" },
];

const STATUS_EVENTS = [
  { date: "Dec 19, 2024", event: "No-bail bench warrant issued", color: "bg-red-500" },
  { date: "Apr 17, 2025", event: "Warrant executed via US Marshals operation", color: "bg-orange-500" },
  { date: "Apr 25, 2025", event: "Psychiatric evaluation ordered (NRS 178.400)", color: "bg-zinc-500" },
  { date: "Jul 30, 2025", event: "Bail reinstated ($25,000); no-contact order with DA's office", color: "bg-zinc-500" },
  { date: "Aug 21–22, 2025", event: "OSC hearing; second no-bail bench warrant issued", color: "bg-red-500" },
  { date: "Jun 16, 2026", event: "Order Staying Case issued", color: "bg-amber-400" },
  { date: "Jun 22, 2026", event: "Order Referring Disqualification Question", color: "bg-amber-400" },
  { date: "Jul 7, 2026", event: "Most recent pro se filing (today)", color: "bg-green-500" },
];

function StatCard({ value, label, icon: Icon, href }: { value: string | number; label: string; icon: React.ElementType; href?: string }) {
  const inner = (
    <div className={cn(
      "flex flex-col items-center gap-1.5 p-4 rounded-lg bg-card border border-border transition-all",
      href && "hover:border-primary/40 hover:bg-primary/5 cursor-pointer group"
    )}>
      <Icon className={cn("w-4 h-4 text-primary mb-0.5", href && "group-hover:text-primary transition-colors")} />
      <span className="text-2xl font-bold text-foreground tabular-nums font-mono">{value}</span>
      <span className={cn("text-xs text-muted-foreground text-center leading-tight", href && "group-hover:text-foreground transition-colors")}>{label}</span>
      {href && <span className="text-[10px] text-primary/50 group-hover:text-primary transition-colors mt-0.5">View →</span>}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-border" />
      <span className="eyebrow">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Blockquote({ quote, attribution }: { quote: string; attribution: string }) {
  return (
    <div className="my-6 border-l-4 border-primary/60 pl-5 py-2">
      <p className="text-foreground/80 italic text-base leading-relaxed font-serif">"{quote}"</p>
      <p className="mt-2 citation">— {attribution}</p>
    </div>
  );
}

export default function Home() {
  useSEO({
    title: "The Reno Record — State v. Cameron Doyle Church, CR23-0657",
    description:
      "A public records archive documenting State v. Cameron Doyle Church, CR23-0657. A rent dispute. A motorcycle. Three years. US Marshals. No trial.",
  });

  const { data: stats } = trpc.patterns.siteStats.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: patternMetrics } = trpc.patterns.metrics.useQuery(undefined, { refetchInterval: 120_000 });
  const s = stats as any;
  const pm = patternMetrics as any;
  const topTags: Array<{ slug: string; label: string; count: number }> = (pm?.tagCounts ?? [])
    .filter((t: any) => t.count > 0)
    .slice(0, 6);

  return (
    <SiteShell>
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden bg-background border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_oklch(0.58_0.18_255_/_0.06)_0%,_transparent_55%)] pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-semibold tracking-widest uppercase mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Active · CR23-0657 · Second Judicial District · Washoe County, NV
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground leading-[1.08] tracking-tight mb-6">
            State v. Church<br />
            <span className="text-primary">{s?.daysSinceArrest ? `${s.daysSinceArrest.toLocaleString()} Days.` : "1,162 Days."}</span><br />
            <span className="text-muted-foreground text-3xl md:text-4xl font-normal italic">No trial. No adjudication. No findings.</span>
          </h1>
          <p className="text-base md:text-lg text-foreground/75 max-w-2xl leading-relaxed mb-4">
            On March 10, 2023, a landlord-tenant dispute over unpaid rent became a Category C felony prosecution in Reno, Nevada. The arresting officer’s own probable-cause declaration records the defense theory. The case has been pending for over three years. There has been no trial.
          </p>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed mb-10">
            Every claim on this site is sourced to a document, a docket entry, or a court filing. The record is public.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/evidence">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors">
                <FileText className="w-4 h-4" />
                Browse the Archive
              </button>
            </Link>
            <Link href="/timeline">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card hover:bg-accent text-foreground font-semibold text-sm transition-colors border border-border">
                <Clock className="w-4 h-4" />
                View Timeline
              </button>
            </Link>
            <Link href="/missing-predicate">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card hover:bg-accent text-foreground font-semibold text-sm transition-colors border border-border">
                <Search className="w-4 h-4" />
                Predicate Report
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── LIVE STATS ─── */}
      {s && (
        <section className="bg-card border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard value={s.daysSinceArrest?.toLocaleString() ?? "—"} label="Days Since Arrest" icon={Calendar} href="/timeline" />
              <StatCard value={s.documents ?? 0} label="Documents Archived" icon={FileText} href="/evidence" />
              <StatCard value={s.timelineEvents ?? 0} label="Timeline Events" icon={Clock} href="/timeline" />
              <StatCard value={s.actors ?? 0} label="Named Actors" icon={Users} href="/actors" />
              <StatCard value={s.prrs ?? 0} label="Records Requests" icon={Search} href="/public-records" />
            </div>
          </div>
        </section>
      )}

      {/* ─── LIVE NUMBERS ─── */}
      {pm && (
        <section className="bg-background border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-8">
            <p className="eyebrow text-center mb-5">What the record shows</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {topTags.map((tag) => (
                <Link key={tag.slug} href={`/patterns?tag=${tag.slug}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                    <span className="text-foreground/80 text-sm group-hover:text-foreground transition-colors truncate pr-2">{tag.label}</span>
                    <span className="text-primary font-bold text-lg tabular-nums font-mono shrink-0">{tag.count}</span>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">Unique documents tagged per violation signal · <Link href="/patterns"><span className="text-primary hover:text-primary/80 cursor-pointer">View full breakdown →</span></Link></p>
          </div>
        </section>
      )}

      {/* ─── MAIN NARRATIVE ─── */}
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">

        {/* SECTION 1: THE ORIGIN */}
        <section>
          <SectionLabel>The Origin</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            The Defense Theory Was in the Arrest Report
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            On March 10, 2023, a motorcycle was moved from a shared residence in Reno, Nevada. The registered owner, Brandon Pearson, filed a theft report. Cameron Church was arrested the following morning.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            The probable-cause declaration — written by the arresting officer, filed by the State — records that Church told law enforcement the motorcycle was collateral for unpaid rent owed to him by Pearson. This is not a defense invented later. It is in the State's own paperwork, from the night of the arrest.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            The Washoe County District Attorney charged the matter as Grand Larceny of a Motor Vehicle (NRS 205.228, Category C Felony) and Unlawful Taking of a Motor Vehicle (NRS 205.2715, Gross Misdemeanor). The legal question — whether holding collateral for unpaid rent constitutes theft — was never adjudicated. There has been no trial.
          </p>
          <Blockquote
            quote="Cameron Church stole his roommate's motorcycle over a rent dispute."
            attribution="DA Aziz Merchant, Motion for No Bail Hold, April 18, 2025 (CR23-0657)"
          />
          <p className="text-muted-foreground text-sm leading-relaxed">
            The DA's own framing confirms the nature of the dispute. The defense theory — motorcycle as collateral for unpaid rent — is documented in the State's own probable-cause declaration and has never been ruled upon by a court.
          </p>
        </section>

        {/* SECTION 2: THE COUNSEL CAROUSEL */}
        <section>
          <SectionLabel>The Counsel Carousel</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            Five Attorneys. Three Years. No Trial. No Substantive Motions.
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            Between March 2023 and the present, five attorneys have been assigned to or retained for this case. The docket does not reflect a single substantive motion filed on Church's behalf by any of them. Each attorney either declared a conflict, moved to withdraw, or was substituted out — in one case, the attorney left the public defender's office entirely. The last retained attorney, Samuel Figueroa, texted Church at 10:49 AM on the morning of an 11:00 AM hearing: "You have court at 11:00 A.M. I told you about this. Where are you? You need to be here in 10 minutes." Church missed the hearing. A no-bail bench warrant was issued the next day.
          </p>

          <div className="overflow-x-auto rounded-lg border border-border mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Attorney</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Role</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Period</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Exit</th>
                </tr>
              </thead>
              <tbody>
                {COUNSEL_TIMELINE.map((row, i) => (
                  <tr key={i} className={cn("border-b border-border/50", i % 2 === 0 ? "bg-transparent" : "bg-muted/30")}>
                    <td className="px-4 py-3 text-foreground font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.role}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.period}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.exit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-foreground/80 leading-relaxed mb-4">
            Throughout this period, Church filed his own motions — raising Faretta rights, speedy trial violations, competency order challenges, and ineffective assistance claims. Every pro se filing was stamped with a notation: <span className="font-mono text-primary text-xs bg-primary/10 px-1.5 py-0.5 rounded">DFX: DEFENDANT REPRESENTED BY COUNSEL</span>. They were struck without ruling on the merits.
          </p>

          <Blockquote
            quote="I want to withdraw, Mr. Church consents and wants to represent himself."
            attribution="Samuel Figueroa, email to court and DA Merchant, August 12, 2025"
          />
        </section>

        {/* SECTION 3: THE DECEMBER 5 PIVOT */}
        <section>
          <SectionLabel>The December 5 Pivot</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            A Judge Cited "Micro-Focus" and Constitutional Arguments as Grounds for a Competency Evaluation
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            On December 5, 2024, a Young hearing was held before Judge Barry L. Breslow, Department 8, Second Judicial District Court. A transcript of this hearing is in the record.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            The transcript confirms three things happened at that hearing: Church's Faretta request to represent himself was not formally ruled upon; a psychiatric competency evaluation was ordered under NRS 178.400 — the referral basis, as documented in the subsequent evaluation report, was that Church was "uncooperative and abusive to counsel, staff, and everyone at the court, from the judge, DA, staff, etc." — not any medical evidence; and a blanket prohibition on pro se filings was issued.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            NRS 178.400 requires "reasonable grounds" to believe a defendant may be incompetent. The standard is medical, not argumentative. No prior psychiatric evaluation existed. No medical professional had raised competency concerns. Two weeks later, on December 19, 2024, a no-bail bench warrant was issued.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Two competency evaluations were subsequently conducted — both by evaluators employed by NaphCare, the private company contracted to provide medical services at Washoe County Jail. The first evaluator (April 2025) found Church incompetent and recommended inpatient treatment. The second evaluator (May 2025) found Church competent and recommended proceeding to trial. The second evaluator explicitly noted that Church "expressed frustration about wanting to represent himself in this case and feeling as though the issue of competency was raised due to his desire to represent himself." No competency hearing has been held. The case is stayed.
          </p>
          <Blockquote
            quote="Defendant has never been found incompetent by any medical or psychological professional. There is no documented history of mental illness. There is no record of Defendant being unable to communicate or assist in his own defense. In fact, Defendant has consistently engaged in litigation, drafted substantive motions, and filed constitutionally sound challenges — all of which the Court has either ignored or actively suppressed."
            attribution="Church, Motion to Strike Competency Order, March 19, 2025 (CR23-0657)"
          />
        </section>

        {/* SECTION 4: THE OPERATION */}
        <section>
          <SectionLabel>The Operation</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">
            US Marshals. A Vehicle Tracker. Weeks of Surveillance. A Ruse.
          </h2>
          <p className="text-muted-foreground text-sm mb-6 italic">The following is taken verbatim from the DA's own court filing.</p>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-amber-200 font-semibold text-sm">From DA Aziz Merchant, Motion for No Bail Hold, April 18, 2025 — filed in CR23-0657:</p>
            </div>
            <blockquote className="text-foreground/90 leading-relaxed italic border-l-4 border-amber-500 pl-4">
              "law enforcement to include the federal US Marshall's Service, worked diligently to affect his capture with the use of a tracker on a vehicle associated with him and worked for weeks to pattern his movements. The first attempt to arrest him was unsuccessful, with the Defendant barricading himself in his house for days and refusing to come out. He was not captured willingly, but rather through a ruse that got him to eventually exit his home."
            </blockquote>
          </div>

          <p className="text-foreground/80 leading-relaxed mb-6">
            This is the State's own description, in a court filing, of the resources deployed to execute a bench warrant on a non-violent property dispute case. The bench warrant had been sitting unserved for four months. A recorded call from February 21, 2025 — between Church and a US Marshal — confirms the Marshals had already been to Church's address and knew his location at that time. Church's address was on file with the court. He was filing motions. He was in contact with his attorney.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { icon: Shield, label: "US Marshals Service", sub: "Federal law enforcement deployed" },
              { icon: MapPin, label: "Vehicle Tracker", sub: "Placed on associated vehicle" },
              { icon: TrendingUp, label: "Weeks of Surveillance", sub: "To 'pattern his movements'" },
              { icon: Search, label: "A Ruse", sub: "Deceptive operation to exit home" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="rounded-lg bg-card border border-border p-4 text-center">
                <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-muted-foreground text-xs mt-1">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4b: THE EMAILS */}
        <section>
          <SectionLabel>The "Threats"</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            The DA Called Them Threats. The Record Shows 31 Emails Citing Statutes and Case Law.
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            In the April 18, 2025 no-bail motion, DA Merchant characterized Church's correspondence as "insulting, threatening emails" and "demeaning and hateful phone calls." Merchant attached 31 emails as Exhibit 1. Those emails are in the record.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            The subject lines include: <span className="text-foreground/90 italic">"Transparency or a Circus Act? Accountability Questions for the Washoe County DA's Office,"</span> <span className="text-foreground/90 italic">"Mr. Hicks — Your 'Backlog' Isn't a Mystery. It's You,"</span> and <span className="text-foreground/90 italic">"Christopher Hicks Accountability Quiz: Policy and Transparency Questions."</span> The content cites Brady v. Maryland, NRS 239.0107, Valdez-Jimenez v. Eighth Jud. Dist. Ct., and the Eighth Amendment. Church signed each email: "Cameron Doyle Church, Citizen, Constitutionalist, Advocate for Accountability."
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            One email alleges that Church's phone — seized at arrest — contained exculpatory video evidence that was subsequently destroyed. This allegation, if accurate, would constitute a Brady violation under Brady v. Maryland, 373 U.S. 83 (1963). The record does not reflect any response from the DA's office to this allegation.
          </p>
          <Blockquote
            quote="My phone—seized during my arrest—contained exculpatory video evidence. That evidence was destroyed, violating Brady v. Maryland, 373 U.S. 83 (1963). This wasn't an accident; it was deliberate suppression of evidence critical to my defense."
            attribution="Church, email to DA Hicks, December 2024 (Exhibit 1 to State's No-Bail Motion, CR23-0657)"
          />
          <p className="text-muted-foreground text-sm leading-relaxed">
            The DA's own exhibit — filed to support a no-bail hold — documents Church's legal arguments, his public records requests, and his Brady allegation. The record does not reflect any response to the Brady allegation.
          </p>
        </section>

        {/* SECTION 5: THE COMPARATOR */}
        <section>
          <SectionLabel>The Comparator</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            The Man Who Stabbed Church Got His Charges Dismissed. Church's Bail Was $25,000 Cash-Only.
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            On April 10, 2023 — one month after Church's arrest — Richard Joyce stabbed Church. Joyce was charged in State v. Richard Joyce, RCR2023-122783. His bail was reduced from $150,000 to $500. His charges were dismissed at the preliminary hearing. Chief Deputy District Attorney Amos Stege prosecuted the Joyce case. He is not assigned to CR23-0657. On September 26, 2025, Stege filed a "Notice of Violation of Bail Conditions" in Church's case — attaching Church's email about a medical emergency as evidence of a "threat."
          </p>

          <div className="overflow-x-auto rounded-lg border border-border mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold w-1/3"></th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-semibold">Richard Joyce (RCR2023-122783)</th>
                  <th className="text-left px-4 py-3 text-primary font-semibold">Cameron Church (CR23-0657)</th>
                </tr>
              </thead>
              <tbody>
                {COMPARATOR.map((row, i) => (
                  <tr key={i} className={cn("border-b border-border/50", i % 2 === 0 ? "bg-transparent" : "bg-muted/30")}>
                    <td className="px-4 py-3 text-muted-foreground font-medium">{row.label}</td>
                    <td className="px-4 py-3 text-foreground/80">{row.joyce}</td>
                    <td className="px-4 py-3 text-foreground/80">{row.church}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 6: CURRENT STATUS */}
        <section>
          <SectionLabel>Current Record Status</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            The Case Is Stayed. A Judge Is Being Reviewed. The Defendant Is Still Filing.
          </h2>

          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {STATUS_EVENTS.map(({ date, event, color }) => (
              <div key={date} className="flex items-start gap-3 p-4 rounded-lg bg-card border border-border">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", color)} />
                <div>
                  <p className="text-xs text-muted-foreground font-mono mb-0.5">{date}</p>
                  <p className="text-foreground/90 text-sm">{event}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-foreground/80 leading-relaxed mb-4">
            Church continues to file pro se motions from the same address that has been on file with the court throughout the case. His most recent filings include a motion demanding the court identify "the operative legal authority governing this case" and "terminate custody-conditioned adjudication," and a "Master Structural Injury Motion" requesting written findings of fact and conclusions of law, or dismissal with prejudice if the court cannot explain its own record.
          </p>
          <p className="text-foreground/80 leading-relaxed">
            The court has not issued written findings in response to any of these motions.
          </p>
        </section>

        {/* SECTION 7: THE FEDERAL CASE */}
        <section>
          <SectionLabel>The Federal Case</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            Church v. Breslow et al., 3:24-cv-00579-ART-CSD
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            A federal civil rights lawsuit is pending in the United States District Court for the District of Nevada. Named defendants include Judge Barry L. Breslow and other officials. The claims include violations of the First, Sixth, and Fourteenth Amendments, and claims under 42 U.S.C. § 1983.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-4">
            DA Merchant, who continues to prosecute CR23-0657, is named in the federal lawsuit. Church's September 2025 email to Merchant notes this directly:
          </p>
          <Blockquote
            quote="Despite naming both you personally and your employer in a pending federal civil rights lawsuit (3:24-cv-00579-ART-CSD), you've somehow managed to maintain your role as prosecutor in my criminal case."
            attribution="Church, email to DA Merchant, September 2025"
          />
          <p className="text-foreground/80 leading-relaxed">
            The court has not addressed this conflict on the record in CR23-0657.
          </p>
        </section>

        {/* SECTION 8: HOW TO HELP */}
        <section>
          <SectionLabel>How to Help</SectionLabel>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
            This Record Is Public. So Is Your Ability to Act on It.
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-6">
            This archive exists because public scrutiny is a check on institutional behavior. You don't need to be an attorney, a journalist, or an activist to use it. You need to be someone who reads the record and decides what it means.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {[
              { action: "Read the record", detail: "Browse the evidence archive. Read the actual documents. Form your own assessment.", href: "/evidence" },
              { action: "Share this page", detail: "The more people who see this, the harder it is to ignore. Share the URL. Link to specific documents.", href: null },
              { action: "Contact the court", detail: "Second Judicial District Court, Dept. 8. Public records are available. Docket entries are public.", href: null },
              { action: "Contact the DA's office", detail: "Washoe County District Attorney. Case CR23-0657. The charging decision and prosecution conduct are matters of public record.", href: null },
              { action: "File a public records request", detail: "Nevada Public Records Act (NRS 239) gives you the right to request court and agency records. The archive documents what has and hasn't been produced.", href: "/public-records" },
              { action: "Follow the federal case", detail: "Church v. Breslow et al., 3:24-cv-00579-ART-CSD. PACER is public. The federal docket is searchable.", href: null },
            ].map(({ action, detail, href }) => (
              <div key={action} className="p-4 rounded-lg bg-card border border-border">
                {href ? (
                  <Link href={href}><p className="text-primary font-semibold text-sm mb-1 hover:text-primary/80 cursor-pointer">{action} →</p></Link>
                ) : (
                  <p className="text-white font-semibold text-sm mb-1">{action}</p>
                )}
                <p className="text-muted-foreground text-sm leading-relaxed">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 9: WHAT THIS SITE IS */}
        <section className="rounded-xl border border-border bg-card p-8">
          <SectionLabel>About This Archive</SectionLabel>
          <h2 className="text-2xl font-bold text-white mb-4">This Is Not a Blog. This Is a Record.</h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            The Reno Record is a public archive of documents, timeline events, and procedural analysis from State v. Cameron Doyle Church, CR23-0657. Everything here is sourced to a document, a docket entry, a court filing, or a public record.
          </p>
          <p className="text-foreground/80 leading-relaxed mb-6">
            This site does not make legal conclusions. It identifies what the record contains, what it does not contain, and where the gaps are. The Missing Predicate Report identifies official court actions that appear in the record without a locatable supporting document. The Judicial Pattern Audit compares this docket against comparable cases in the same court.
          </p>

          <div className="grid md:grid-cols-3 gap-3 mb-6">
            {[
              { href: "/evidence", icon: FileText, label: "Document Archive", desc: "All documents, searchable and classified" },
              { href: "/timeline", icon: Clock, label: "Case Timeline", desc: "80+ events in chronological order" },
              { href: "/missing-predicate", icon: Search, label: "Predicate Report", desc: "Court actions without locatable support" },
              { href: "/actors", icon: Users, label: "Named Actors", desc: "Every named individual in the record" },
              { href: "/accountability", icon: Scale, label: "Accountability", desc: "Violation tags by actor and category" },
              { href: "/pattern", icon: Gavel, label: "Judicial Pattern", desc: "Comparative docket analysis" },
            ].map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-card hover:bg-white/10 border border-border hover:border-border transition-all cursor-pointer group">
                  <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-white text-sm font-semibold group-hover:text-primary transition-colors">{label}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed border-t border-border pt-4">
            <strong className="text-muted-foreground">Disclaimer:</strong> The Reno Record is a public records archive. All information presented on this site is sourced to documents in the public record, court filings, or official docket entries. Nothing on this site constitutes legal advice, legal conclusions, or findings of fact. Characterizations of procedural events are record-integrity observations, not legal determinations. The reviewed record does not locate supporting predicates for certain events noted herein; the record should be consulted directly for verification.
          </p>
        </section>

      </div>
    </SiteShell>
  );
}
