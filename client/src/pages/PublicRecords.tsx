import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-secondary text-foreground",
  sent: "bg-secondary text-foreground",
  awaiting_response: "bg-[var(--amber-soft)] text-foreground",
  overdue: "bg-[var(--rust)] text-background",
  partial_response: "bg-[var(--amber)] text-foreground",
  denied: "bg-[var(--rust)] text-background",
  produced: "bg-foreground text-background",
  appealed: "bg-[var(--rust)] text-background",
  closed: "bg-secondary text-muted-foreground",
};

export default function PublicRecordsPage() {
  const prrs = trpc.prr.listPublic.useQuery();

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="eyebrow">Public Records Tracker</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Every request. Every silence.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              The Reno Record's running log of public records requests, deadlines, and what
              actually came back. Non-responses are the news.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {prrs.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {!prrs.isLoading && (prrs.data ?? []).length === 0 && (
              <div className="paper-card p-10 text-center text-muted-foreground">
                No public requests posted yet.
              </div>
            )}
            {(prrs.data ?? []).map((r) => (
              <article key={r.id} className="paper-card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="eyebrow">{r.agency}</div>
                    <h3 className="display-serif text-xl mt-1">{r.title}</h3>
                  </div>
                  <span
                    className={
                      "px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-sm " +
                      (STATUS_TONE[r.status] || "bg-secondary text-foreground")
                    }
                  >
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
                {r.description && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {r.description}
                  </p>
                )}
                <div className="mt-4 grid sm:grid-cols-3 gap-3">
                  <Meta
                    label="Sent"
                    value={r.dateSent ? new Date(r.dateSent).toLocaleDateString() : "—"}
                  />
                  <Meta
                    label="Deadline"
                    value={r.deadline ? new Date(r.deadline).toLocaleDateString() : "—"}
                  />
                  <Meta
                    label="Days open"
                    value={
                      r.dateSent
                        ? `${Math.max(
                            0,
                            Math.floor(
                              (Date.now() - new Date(r.dateSent).getTime()) / (1000 * 60 * 60 * 24),
                            ),
                          )}`
                        : "—"
                    }
                  />
                </div>
                {r.responseSummary && (
                  <div className="mt-4">
                    <div className="eyebrow">Response summary</div>
                    <p className="mt-1.5 text-sm">{r.responseSummary}</p>
                  </div>
                )}
                {r.legalBasisForDenial && (
                  <div className="mt-3">
                    <Badge variant="outline" className="font-mono uppercase text-[10px]">
                      Denial basis: {r.legalBasisForDenial}
                    </Badge>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[var(--amber)] pl-3">
      <div className="eyebrow !text-[0.62rem]">{label}</div>
      <div className="text-sm mt-0.5 font-medium">{value}</div>
    </div>
  );
}
