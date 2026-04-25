import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const QUESTIONS = [
  "What is your office's average time-to-trial in non-capital felony cases over the last 24 months?",
  "How many defendants in your office's caseload have been pretrial detained for more than 90 days without trial?",
  "What is your written policy when an in-custody defendant requests self-representation under Faretta v. California?",
  "Under what circumstances does your office support raising competency after a defendant has asserted constitutional rights?",
  "How does your office track motions filed pro se while a defendant has counsel of record?",
  "What is your written standard for issuing a no-bail bench warrant?",
  "How does your office respond to public records requests within statutory deadlines, and how is that measured?",
  "What internal review process exists when a defendant alleges retaliation, ignored filings, or family harm caused by court delay?",
];

export default function ElectionPage() {
  const actors = trpc.actor.listPublic.useQuery();
  const officials = (actors.data ?? []).filter(
    (a) =>
      /judge|justice|district attorney|sheriff|public defender|commissioner|councilmember|mayor|state senator|assembly|attorney general|governor/i.test(
        a.role || "",
      ) || (a.role || "").toLowerCase().includes("elected"),
  );

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <div className="eyebrow">Election & Accountability</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Vote informed.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              The Reno Record does not endorse candidates and does not coordinate with any campaign.
              This page exists so voters can ask informed questions of the people whose offices
              control criminal court delay, pretrial detention, public defense, prosecution, and
              public records compliance in Washoe County.
            </p>
            <div className="mt-7 paper-card p-5 border-l-4 border-[var(--amber)]">
              <div className="eyebrow">Editorial standard</div>
              <p className="text-sm mt-1.5 text-foreground/85">
                Profiles list officeholders and candidates with publicly verifiable office,
                jurisdiction, and conduct documented in this archive. Sources are linked. No
                opinion language. No endorsements. Corrections accepted.
              </p>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <div>
              <div className="eyebrow">Officials documented in this archive</div>
              <h2 className="display-serif text-2xl mt-2 rule-amber">On the ballot or in office</h2>
              <p className="text-sm text-muted-foreground mt-3">
                Listed below are officials and candidates whose offices appear in cases archived
                here. Inclusion is descriptive, not editorial.
              </p>
              <div className="mt-5 grid sm:grid-cols-2 gap-4">
                {officials.length === 0 && (
                  <div className="paper-card p-6 text-muted-foreground col-span-full">
                    Officials documented in approved cases will appear here.
                  </div>
                )}
                {officials.map((a) => (
                  <a key={a.id} href={`/actors/${a.slug}`} className="block">
                    <div className="paper-card p-5 h-full hover:-translate-y-0.5 transition-transform">
                      <div className="eyebrow">{a.role}</div>
                      <div className="display-serif text-lg mt-1">{a.name}</div>
                      {a.agency && (
                        <div className="text-sm text-muted-foreground mt-1">{a.agency}</div>
                      )}
                      <div className="mt-3">
                        <Badge variant="outline" className="font-mono uppercase text-[10px]">
                          {a.status}
                        </Badge>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <div className="eyebrow">Voter question set</div>
              <h2 className="display-serif text-2xl mt-2 rule-amber">
                Eight questions any informed voter can ask
              </h2>
              <p className="text-sm text-muted-foreground mt-3">
                Print this list. Bring it to a candidate forum, a town hall, or a public records
                desk. The answers belong on the public record.
              </p>
              <ol className="mt-5 space-y-3">
                {QUESTIONS.map((q, i) => (
                  <li key={i} className="paper-card p-4 flex gap-4 items-start">
                    <div className="font-mono text-sm w-6 shrink-0 text-[var(--rust)]">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{q}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="paper-card p-6 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Disclaimer.</strong> The Reno Record is a
              non-partisan documentation project. It does not constitute political advertising. It
              does not advocate for or against any candidate, party, or ballot measure. Information
              presented is drawn from public records and reviewed submissions. To request a
              correction, submit through the standard intake form.
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
