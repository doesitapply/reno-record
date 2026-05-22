import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import {
  Scale,
  Landmark,
  ArrowRight,
  Clock,
  FileText,
  Users,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const ARREST_DATE = new Date("2023-03-12");

function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-mono font-semibold ${highlight ? "text-amber-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function CasesPage() {
  useSEO({
    title: "The Cases",
    description: "State case CR23-0657 and federal case 3:24-cv-00579-ART-CSD — two dockets, one story. Church v. State of Nevada and Church v. Breslow et al.",
    canonicalPath: "/cases",
  });

  const stats = trpc.patterns.siteStats.useQuery();
  const days = daysSince(ARREST_DATE);

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="eyebrow mb-3">The Cases</div>
        <h1 className="display-serif text-5xl md:text-6xl leading-[1.02] mb-4">
          Two dockets. One story.
        </h1>
        <p className="text-foreground/70 max-w-2xl leading-relaxed mb-12">
          The state case and the federal case are not separate matters. The federal case exists
          because of the state case. Their timelines run through each other's courtrooms.
          The archive documents both.
        </p>

        <div className="grid lg:grid-cols-2 gap-6 mb-12">
          {/* State Case Card */}
          <div className="paper-card p-7 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 mb-5">
              <Scale className="h-5 w-5 text-amber-400" />
              <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
                State Court
              </span>
            </div>

            <h2 className="display-serif text-3xl mb-1">State v. Church</h2>
            <div className="font-mono text-sm text-muted-foreground mb-5">CR23-0657</div>

            <div className="space-y-0 mb-6">
              <StatRow label="Court" value="Washoe County District Court" />
              <StatRow label="Department" value="Dept. 8 — Judge Breslow" />
              <StatRow label="Prosecutor" value="DDA Aziz Merchant" />
              <StatRow label="Arrest date" value="March 12, 2023" />
              <StatRow label="Days since arrest" value={`${days} days`} highlight />
              <StatRow label="Trial held" value="No" highlight />
              <StatRow label="Trial date set" value="None" highlight />
              <StatRow label="Bail posted" value="$25,000" />
              <StatRow label="Current status" value="Pending — no trial date" highlight />
            </div>

            <div className="mb-5">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Documented violations
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "Faretta non-adjudication",
                  "Speedy Trial (Barker)",
                  "Competency detour",
                  "No-bail warrant",
                  "PRR obstruction",
                  "Family separation",
                  "Filing restriction",
                  "Nunc pro tunc alteration",
                ].map((v) => (
                  <Badge key={v} variant="outline" className="text-[10px] font-mono uppercase">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link href="/timeline?case=state">
                <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-400 text-black">
                  State Timeline <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/evidence?case=state">
                <Button size="sm" variant="outline" className="gap-2">
                  <FileText className="h-3.5 w-3.5" /> State Documents
                </Button>
              </Link>
            </div>
          </div>

          {/* Federal Case Card */}
          <div className="paper-card p-7 border-l-4 border-l-blue-500">
            <div className="flex items-center gap-2 mb-5">
              <Landmark className="h-5 w-5 text-blue-400" />
              <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
                Federal Court
              </span>
            </div>

            <h2 className="display-serif text-3xl mb-1">Church v. Breslow et al.</h2>
            <div className="font-mono text-sm text-muted-foreground mb-5">
              3:24-cv-00579-ART-CSD
            </div>

            <div className="space-y-0 mb-6">
              <StatRow label="Court" value="U.S. District Court, D. Nev." />
              <StatRow label="Judge" value="Hon. Anne R. Traum" />
              <StatRow label="Filed" value="October 2024" />
              <StatRow label="Defendants" value="Breslow, Merchant, Washoe County" />
              <StatRow label="District court status" value="Dismissed w/o prejudice" highlight />
              <StatRow label="Grounds" value="Rooker-Feldman (jurisdictional)" />
              <StatRow label="Post-judgment motions" value="ECF 50, 51, 55 — Pending" highlight />
              <StatRow label="Appellate clock" value="Tolled (Rule 59(e) pending)" highlight />
              <StatRow label="Ninth Circuit path" value="Preserved" />
            </div>

            <div className="mb-5">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Claims
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "§ 1983 civil rights",
                  "Faretta violation",
                  "Due process",
                  "Structural injury",
                  "Bad faith",
                  "Sanctions (ECF 43)",
                ].map((v) => (
                  <Badge key={v} variant="outline" className="text-[10px] font-mono uppercase border-blue-500/30 text-blue-300">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3 flex-wrap">
              <Link href="/timeline?case=federal">
                <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                  Federal Timeline <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/evidence?case=federal">
                <Button size="sm" variant="outline" className="gap-2">
                  <FileText className="h-3.5 w-3.5" /> Federal Docket
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Connection section */}
        <div className="paper-card p-7 mb-8">
          <div className="eyebrow mb-3">How they connect</div>
          <h3 className="display-serif text-2xl mb-4">The same actors. The same courtroom. Two dockets.</h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-semibold mb-2 text-amber-400">The state case created the federal case.</div>
              <p className="text-muted-foreground leading-relaxed">
                The federal § 1983 complaint was filed because state court proceedings produced documented
                constitutional violations — Faretta non-adjudication, custody-conditioned rights, no Barker
                findings — that the state court would not remedy.
              </p>
            </div>
            <div>
              <div className="font-semibold mb-2 text-blue-400">The federal case was dismissed on jurisdiction, not merits.</div>
              <p className="text-muted-foreground leading-relaxed">
                The district court dismissed on Rooker-Feldman grounds — a jurisdictional bar, not a ruling
                on the constitutional claims. The merits were never reached. Rule 59(e) motions are pending.
                The Ninth Circuit path is preserved.
              </p>
            </div>
            <div>
              <div className="font-semibold mb-2 text-foreground/80">The December 5, 2024 transcript appears in both.</div>
              <p className="text-muted-foreground leading-relaxed">
                The same transcript — filed as ECF 48-1 in the federal case — documents a state court hearing
                where the judge stated "I don't even know what that means" in response to a rights assertion.
                One document. Two dockets. The record is the argument.
              </p>
            </div>
          </div>
        </div>

        {/* Archive stats */}
        {stats.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Documents archived", value: stats.data.documents, icon: <FileText className="h-4 w-4" /> },
              { label: "Named actors", value: stats.data.actors, icon: <Users className="h-4 w-4" /> },
              { label: "Timeline events", value: stats.data.timelineEvents, icon: <Clock className="h-4 w-4" /> },
              { label: "Days pretrial", value: stats.data.daysSinceArrest, icon: <AlertTriangle className="h-4 w-4" />, highlight: true },
            ].map((s) => (
              <div key={s.label} className="paper-card p-5 text-center">
                <div className={`flex justify-center mb-2 ${s.highlight ? "text-amber-400" : "text-muted-foreground"}`}>
                  {s.icon}
                </div>
                <div className={`text-3xl font-mono font-bold ${s.highlight ? "text-amber-400" : ""}`}>
                  {s.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
