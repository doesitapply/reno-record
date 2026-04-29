import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";

type Metric = {
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "warning" | "alarm";
};

type PatternGroup = {
  title: string;
  eyebrow: string;
  summary: string;
  metrics: Metric[];
};

export default function PatternsPage() {
  useSEO({
    title: "Misconduct Pattern Dashboard",
    description:
      "A public dashboard for recurring Reno and Washoe County misconduct signals across actors, agencies, records, timelines, and source evidence.",
    canonicalPath: "/patterns",
  });
  const m = trpc.patterns.metrics.useQuery();
  const d = m.data ?? ({} as any);

  const groups: PatternGroup[] = [
    {
      eyebrow: "Archive volume",
      title: "Intake & review status",
      summary:
        "The first question is what the archive holds and what has been reviewed. Pending material is not public proof; it is a queue of leads that still needs source separation and human review.",
      metrics: [
        { label: "Total submissions", value: d.submitted ?? 0 },
        { label: "Approved & published", value: d.approved ?? 0 },
        { label: "In moderation queue", value: d.pending ?? 0, tone: "warning" },
      ],
    },
    {
      eyebrow: "Records obstruction",
      title: "Missing records, silence, and refusal patterns",
      summary:
        "Corruption becomes visible when the paper trail vanishes, deadlines pass, or agencies give explanations that cannot be reconciled with the record. These counts surface the records gaps editors should chase next.",
      metrics: [
        {
          label: "Discovery / source records missing",
          value: d.discoveryIssues ?? d.discoveryMissing ?? 0,
          tone: "alarm",
          hint: "Submitters reported missing discovery, withheld evidence, or missing source records.",
        },
        {
          label: "Filings blocked, ignored, or unruled",
          value: d.ignoredFilings ?? 0,
          tone: "alarm",
          hint: "A proxy for records disappearing from meaningful review or never receiving written action.",
        },
        {
          label: "Agency silence / follow-up needed",
          value: (d.pending ?? 0) + (d.discoveryIssues ?? d.discoveryMissing ?? 0),
          tone: "warning",
          hint: "Pending submissions plus missing-record signals that may need public-records pressure.",
        },
      ],
    },
    {
      eyebrow: "Retaliation & pressure",
      title: "Custody, warrants, and coercive posture",
      summary:
        "The dashboard treats pressure tactics as pattern evidence when a person reports custody, warrants, supervision, or family harm around attempts to assert rights, complain, or obtain records.",
      metrics: [
        { label: "Custody ≥ 30 days", value: d.custodyOver30 ?? 0 },
        { label: "Custody ≥ 60 days", value: d.custodyOver60 ?? 0, tone: "warning" },
        { label: "Custody ≥ 100 days", value: d.custodyOver100 ?? 0, tone: "alarm" },
        { label: "No-bail / OSC warrants used", value: d.noBailWarrant ?? 0, tone: "warning" },
        {
          label: "Family, caregiver, housing, or work harm",
          value: d.familyHarm ?? 0,
          tone: "warning",
          hint: "Concrete harm outside the formal file is preserved as part of the public-impact record.",
        },
      ],
    },
    {
      eyebrow: "Court-system misconduct",
      title: "Due-process failure cluster",
      summary:
        "Court failures remain important, but they are no longer the whole project. They are one pattern cluster that can be compared against other public corruption signals across agencies.",
      metrics: [
        {
          label: "Faretta requested · canvass not handled",
          value: d.farettaIssues ?? 0,
          tone: "alarm",
          hint: "Right to self-representation requested but not properly canvassed.",
        },
        {
          label: "Trial requested · no trial held",
          value: d.speedyTrialIssues ?? 0,
          tone: "alarm",
          hint: "Speedy-trial demand made; no trial occurred on record.",
        },
        {
          label: "Competency raised after rights asserted",
          value: d.competencyAfterAssertion ?? 0,
          tone: "warning",
          hint: "Competency surfaced after a defendant requested self-representation or asserted rights.",
        },
        { label: "Cases pending ≥ 1 year", value: d.over1y ?? 0, tone: "warning" },
        { label: "Cases pending ≥ 2 years", value: d.over2y ?? 0, tone: "alarm" },
        { label: "Cases pending ≥ 3 years", value: d.over3y ?? 0, tone: "alarm" },
      ],
    },
    {
      eyebrow: "Public corruption watchlist",
      title: "Signals editors now separate during intake",
      summary:
        "Some signals are still qualitative until the archive has dedicated fields or reviewed evidence. The new intake flow explicitly separates these flags so future metrics can count them cleanly.",
      metrics: [
        {
          label: "Conflict-of-interest leads",
          value: 0,
          tone: "neutral",
          hint: "Tracked from new submissions involving insider relationships, vendor ties, or public-office conflicts.",
        },
        {
          label: "Financial misconduct leads",
          value: 0,
          tone: "neutral",
          hint: "Tracked from contracts, payroll, campaign, vendor, or public-funds evidence after review.",
        },
        {
          label: "Repeat-actor clusters",
          value: 0,
          tone: "neutral",
          hint: "Tracked when the same person, office, or agency appears across records and timeline events.",
        },
      ],
    },
  ];

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="eyebrow">Misconduct Pattern Dashboard</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Patterns first. Cases second.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              The Reno Record is organized around repeatable public-corruption signals: actors, agencies,
              source records, timeline gaps, records obstruction, retaliation, conflicts, money trails, and
              court-system due-process failures. Individual cases matter because they create receipts that
              can be compared against the next record.
            </p>
            <div className="mt-7 paper-card p-5 text-xs text-muted-foreground leading-relaxed">
              Counts include approved records and pending submissions awaiting review. A high number does
              not establish wrongdoing in any single matter; it identifies frequency in the material this
              archive has received.
            </div>
          </div>

          <div className="lg:col-span-8 space-y-12">
            {groups.map((g) => (
              <div key={g.title}>
                <div className="eyebrow">{g.eyebrow}</div>
                <h2 className="display-serif text-2xl mt-2 rule-amber">{g.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-3xl">{g.summary}</p>
                <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.metrics.map((metric) => (
                    <MetricCard key={metric.label} m={metric} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function MetricCard({ m }: { m: Metric }) {
  const accent =
    m.tone === "alarm"
      ? "border-l-[var(--rust)]"
      : m.tone === "warning"
        ? "border-l-[var(--amber)]"
        : "border-l-foreground/30";
  return (
    <div className={"paper-card p-5 border-l-4 " + accent}>
      <div className="display-serif text-4xl">{Number(m.value).toLocaleString()}</div>
      <div className="eyebrow !text-[0.62rem] mt-2">{m.label}</div>
      {m.hint && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{m.hint}</p>}
    </div>
  );
}
