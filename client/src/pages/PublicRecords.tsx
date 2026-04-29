import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

type PrrStatus =
  | "draft"
  | "sent"
  | "awaiting_response"
  | "overdue"
  | "partial_response"
  | "denied"
  | "produced"
  | "appealed"
  | "closed";

type StatusHistoryEntry = {
  date?: string;
  status: PrrStatus;
  note?: string;
};

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

const STATUS_LABEL: Record<PrrStatus, string> = {
  draft: "Drafted",
  sent: "Request sent",
  awaiting_response: "Awaiting response",
  overdue: "Overdue",
  partial_response: "Partial response",
  denied: "Denied",
  produced: "Records produced",
  appealed: "Appealed",
  closed: "Closed",
};

export default function PublicRecordsPage() {
  useSEO({
    title: "Public Records Tracker",
    description:
      "Live status of public records requests filed with Reno, Washoe County, courts, law enforcement, contractors, boards, and related agencies.",
    canonicalPath: "/public-records",
  });
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
              The Reno Record's running log of records requests, agency deadlines, production gaps,
              denials, appeals, and what actually came back. Non-responses are part of the evidence.
            </p>
            <div className="mt-6 paper-card p-4 text-sm text-muted-foreground leading-relaxed">
              Each request includes a public status trail, so readers can see when a request was sent,
              when a deadline passed, which agency held the record, and what the agency ultimately did.
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {prrs.isLoading && <p className="text-muted-foreground">Loading…</p>}
            {!prrs.isLoading && (prrs.data ?? []).length === 0 && (
              <div className="paper-card p-10 text-center text-muted-foreground">
                No public requests posted yet.
              </div>
            )}
            {(prrs.data ?? []).map((r) => {
              const history = buildHistory(r);
              return (
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
                    <Meta label="Days open" value={formatDaysOpen(r.dateSent, r.status)} />
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
                  <StatusTimeline history={history} />
                </article>
              );
            })}
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

function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) return null;
  return (
    <div className="mt-5 border-t border-border/70 pt-5">
      <div className="eyebrow">Status history</div>
      <ol className="mt-3 space-y-3">
        {history.map((entry, index) => (
          <li key={`${entry.status}-${entry.date ?? index}-${index}`} className="relative pl-6">
            <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--amber)] ring-4 ring-[var(--amber-soft)]" />
            {index < history.length - 1 && (
              <span className="absolute left-[4px] top-5 h-[calc(100%+0.35rem)] w-px bg-border" />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{STATUS_LABEL[entry.status] ?? entry.status}</span>
              {entry.date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString()}
                </span>
              )}
            </div>
            {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function buildHistory(r: {
  status: string;
  dateSent: string | Date | null;
  deadline: string | Date | null;
  responseSummary: string | null;
  legalBasisForDenial: string | null;
  statusHistory?: unknown;
}): StatusHistoryEntry[] {
  if (Array.isArray(r.statusHistory) && r.statusHistory.length > 0) {
    return r.statusHistory
      .filter(isStatusHistoryEntry)
      .sort((a, b) => dateSortValue(a.date) - dateSortValue(b.date));
  }

  const history: StatusHistoryEntry[] = [];
  if (r.dateSent) {
    history.push({ date: isoDate(r.dateSent), status: "sent", note: "Request delivered to the agency." });
  }
  if (r.deadline) {
    history.push({
      date: isoDate(r.deadline),
      status: r.status === "overdue" ? "overdue" : "awaiting_response",
      note: r.status === "overdue" ? "Statutory response deadline passed." : "Response deadline tracked.",
    });
  }
  if (isPrrStatus(r.status) && !["sent", "awaiting_response", "overdue"].includes(r.status)) {
    history.push({
      date: undefined,
      status: r.status,
      note: r.responseSummary || r.legalBasisForDenial || "Latest public status update.",
    });
  }
  return history;
}

function isStatusHistoryEntry(value: unknown): value is StatusHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StatusHistoryEntry>;
  return typeof candidate.status === "string" && isPrrStatus(candidate.status);
}

function isPrrStatus(value: string): value is PrrStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_LABEL, value);
}

function isoDate(value: string | Date) {
  return new Date(value).toISOString().split("T")[0];
}

function dateSortValue(value?: string) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function formatDaysOpen(dateSent: string | Date | null, status: string) {
  if (!dateSent) return "—";
  if (["closed", "produced", "denied"].includes(status)) return "closed";
  return `${Math.max(
    0,
    Math.floor((Date.now() - new Date(dateSent).getTime()) / (1000 * 60 * 60 * 24)),
  )}`;
}
