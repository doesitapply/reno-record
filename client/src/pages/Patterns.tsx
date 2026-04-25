import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";

type Metric = {
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "warning" | "alarm";
};

export default function PatternsPage() {
  const m = trpc.patterns.metrics.useQuery();
  const d = m.data ?? ({} as any);

  const groups: { title: string; eyebrow: string; metrics: Metric[] }[] = [
    {
      eyebrow: "Submissions",
      title: "Volume & status",
      metrics: [
        { label: "Total submissions", value: d.submitted ?? 0 },
        { label: "Approved & published", value: d.approved ?? 0 },
        { label: "In moderation queue", value: d.pending ?? 0, tone: "warning" },
      ],
    },
    {
      eyebrow: "Delay",
      title: "Time-to-resolution",
      metrics: [
        { label: "Cases pending ≥ 1 year", value: d.over1y ?? 0, tone: "warning" },
        { label: "Cases pending ≥ 2 years", value: d.over2y ?? 0, tone: "alarm" },
        { label: "Cases pending ≥ 3 years", value: d.over3y ?? 0, tone: "alarm" },
      ],
    },
    {
      eyebrow: "Custody",
      title: "Pretrial detention",
      metrics: [
        { label: "Custody ≥ 30 days", value: d.custodyOver30 ?? 0 },
        { label: "Custody ≥ 60 days", value: d.custodyOver60 ?? 0, tone: "warning" },
        { label: "Custody ≥ 100 days", value: d.custodyOver100 ?? 0, tone: "alarm" },
      ],
    },
    {
      eyebrow: "Procedural failure",
      title: "Documented patterns",
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
          hint: "Competency surfaced after defendant requested self-representation.",
        },
        {
          label: "No-bail / OSC warrants used",
          value: d.noBailWarrant ?? 0,
          tone: "warning",
        },
        {
          label: "Discovery missing or withheld",
          value: d.discoveryMissing ?? 0,
          tone: "alarm",
        },
        {
          label: "Pro se filings blocked / unruled",
          value: d.ignoredFilings ?? 0,
          tone: "alarm",
        },
      ],
    },
    {
      eyebrow: "Collateral harm",
      title: "Beyond the docket",
      metrics: [
        {
          label: "Family / caregiver / employment harm reported",
          value: d.familyHarm ?? 0,
          tone: "warning",
          hint: "Submitters who reported concrete harm to dependents, jobs, housing, or care.",
        },
      ],
    },
  ];

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="eyebrow">Pattern Dashboard</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              The shape of the system.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              Anonymized aggregate counts across approved and submitted cases. Numbers are
              generated from the structured intake form. They reflect what submitters have
              reported and what records have corroborated. They are not a survey of all Washoe
              County cases.
            </p>
            <div className="mt-7 paper-card p-5 text-xs text-muted-foreground leading-relaxed">
              Counts include both approved cases and pending submissions awaiting review. A high
              number does not establish wrongdoing in any single case; it identifies frequency in
              the records this archive holds.
            </div>
          </div>

          <div className="lg:col-span-8 space-y-12">
            {groups.map((g) => (
              <div key={g.title}>
                <div className="eyebrow">{g.eyebrow}</div>
                <h2 className="display-serif text-2xl mt-2 rule-amber">{g.title}</h2>
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
