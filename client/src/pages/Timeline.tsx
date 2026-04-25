import { useState } from "react";
import { Link } from "wouter";
import { FileText, ArrowRight } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "state_case", label: "State case" },
  { value: "federal_case", label: "Federal" },
  { value: "custody", label: "Custody" },
  { value: "motion", label: "Motions" },
  { value: "warrant", label: "Warrants" },
  { value: "competency", label: "Competency" },
  { value: "public_records", label: "Public records" },
  { value: "communications", label: "Comms" },
  { value: "election_accountability", label: "Election" },
  { value: "other", label: "Other" },
] as const;

export default function TimelinePage() {
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]["value"]>("all");
  const events = trpc.timeline.listPublic.useQuery({ category: cat });

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="eyebrow">The Record</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Docket, in order.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              Every approved event with its date, category, status, and links to source documents.
              Filter by category. Each card connects to the underlying record where available.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCat(c.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded-sm border transition-colors",
                    cat === c.value
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="relative pl-6 border-l border-border">
              {events.isLoading && (
                <p className="text-muted-foreground">Loading docket…</p>
              )}
              {!events.isLoading && (events.data ?? []).length === 0 && (
                <div className="paper-card p-8 text-muted-foreground">
                  No approved events for this filter yet.
                </div>
              )}
              {(events.data ?? []).map((ev) => (
                <article key={ev.id} className="relative pl-6 pb-8 last:pb-0">
                  <span className="absolute -left-[7px] top-2 h-3 w-3 rounded-full bg-[var(--amber)] ring-4 ring-background" />
                  <div className="paper-card p-5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        {new Date(ev.eventDate).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })}
                      </span>
                      <Badge variant="outline" className="font-mono uppercase text-[10px]">
                        {ev.category.replace(/_/g, " ")}
                      </Badge>
                      <Badge
                        variant={ev.status === "confirmed" ? "default" : "secondary"}
                        className="font-mono uppercase text-[10px]"
                      >
                        {ev.status}
                      </Badge>
                      {ev.caseNumber && (
                        <Badge variant="outline" className="font-mono uppercase text-[10px]">
                          {ev.caseNumber}
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-2 display-serif text-xl">{ev.title}</h3>
                    {ev.summary && (
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {ev.summary}
                      </p>
                    )}
                    {(ev.actors ?? []).length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground font-mono uppercase tracking-widest">
                        Actors: {(ev.actors ?? []).join(" · ")}
                      </div>
                    )}
                    {(ev.sourceDocuments ?? []).length > 0 && (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {(ev.sourceDocuments ?? []).map((id) => (
                          <Link key={id} href={`/evidence/${id}`}>
                            <Badge variant="outline" className="gap-1.5 font-mono uppercase text-[10px]">
                              <FileText className="h-3 w-3" /> Source #{id}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 paper-card p-6 flex items-center justify-between">
              <div>
                <div className="eyebrow">Add to the docket</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Submitter timelines feed this archive after admin review.
                </p>
              </div>
              <Link href="/submit">
                <Button className="bg-foreground text-background gap-2">
                  Submit Your Story <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
