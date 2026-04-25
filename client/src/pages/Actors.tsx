import { useSEO } from "@/hooks/useSEO";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Scale,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const CATEGORY_LABELS: Record<string, string> = {
  state_case: "State Case",
  federal_case: "Federal Case",
  custody: "Custody",
  motion: "Motion",
  warrant: "Warrant",
  competency: "Competency",
  public_records: "Public Records",
  communications: "Communications",
  election_accountability: "Election",
  other: "Other",
};

const SOURCE_LABELS: Record<string, string> = {
  court_order: "Court Order",
  motion: "Motion",
  email: "Email",
  transcript: "Transcript",
  warrant: "Warrant",
  public_records_response: "PRR Response",
  audio: "Audio",
  video: "Video",
  image: "Image",
  jail_record: "Jail Record",
  risk_notice: "Risk Notice",
  other: "Document",
};

export default function ActorsPage() {
  useSEO({
    title: "Actors",
    description:
      "Profiles of judges, attorneys, officials, and institutions documented in the Reno Record archive.",
    canonicalPath: "/actors",
  });
  const [, params] = useRoute("/actors/:slug");
  if (params?.slug) return <ActorDetail slug={params.slug} />;
  return <ActorIndex />;
}

function ActorIndex() {
  const actors = trpc.actor.listPublic.useQuery();
  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="eyebrow">Actors</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Names on the record.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              Profiles of judges, attorneys, officials, and institutions documented in the cases
              archived here. Each profile aggregates every timeline event, source document, and
              public records request where that actor appears.
            </p>
            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
              Profiles describe documented conduct in the cases archived here. The Reno Record
              presents allegations as reported until corroborated by records and does not assert
              misconduct as proven fact.
            </p>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
            {(actors.data ?? []).length === 0 && (
              <div className="paper-card p-10 text-muted-foreground col-span-full">
                Actor profiles are being prepared and approved.
              </div>
            )}
            {(actors.data ?? []).map((a) => (
              <Link key={a.id} href={`/actors/${a.slug}`}>
                <div className="paper-card p-5 h-full hover:-translate-y-0.5 transition-transform cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="eyebrow">{a.role || "Documented actor"}</div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {a.judicialActor && (
                        <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 font-mono uppercase text-[9px]">
                          Judicial
                        </Badge>
                      )}
                      <Badge variant="outline" className="font-mono uppercase text-[9px]">
                        {a.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="display-serif text-xl mt-1">{a.name}</div>
                  {a.agency && (
                    <div className="text-sm text-muted-foreground mt-1">{a.agency}</div>
                  )}
                  {a.bio && (
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {a.bio}
                    </p>
                  )}
                  <div className="mt-4 text-xs text-amber-600 font-medium">
                    View dossier →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function ActorDetail({ slug }: { slug: string }) {
  const { data: actor, isLoading: actorLoading } = trpc.actor.bySlug.useQuery({ slug });
  const { data: dossier, isLoading: dossierLoading } = trpc.actor.dossier.useQuery(
    { name: actor?.name ?? "" },
    { enabled: !!actor?.name },
  );

  const isLoading = actorLoading || dossierLoading;

  return (
    <SiteShell>
      <section className="container py-10 md:py-14">
        <Link href="/actors">
          <Button variant="ghost" className="gap-2 mb-6 -ml-3">
            <ArrowLeft className="h-4 w-4" /> All actors
          </Button>
        </Link>

        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="paper-card p-6 animate-pulse h-20 bg-muted/40" />
            ))}
          </div>
        )}

        {!isLoading && !actor && (
          <div className="paper-card p-10 text-center">
            <h3 className="display-serif text-2xl">Profile not available</h3>
            <p className="text-muted-foreground mt-2">
              This profile may not be public, or it has not been published yet.
            </p>
          </div>
        )}

        {actor && (
          <div className="grid lg:grid-cols-12 gap-10">
            {/* ── Sidebar ── */}
            <aside className="lg:col-span-4 space-y-5">
              <div className="paper-card p-6">
                <div className="eyebrow">{actor.role || "Documented actor"}</div>
                <h1 className="display-serif text-3xl mt-2 leading-tight">{actor.name}</h1>
                {actor.agency && (
                  <div className="text-sm text-muted-foreground mt-1">{actor.agency}</div>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                  {actor.judicialActor && (
                    <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 font-mono uppercase text-[10px]">
                      Judicial actor
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono uppercase text-[10px]">
                    {actor.status}
                  </Badge>
                </div>
                <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
                  Profiles describe documented conduct in the cases archived here. The Reno Record
                  presents allegations as reported until corroborated by records and does not assert
                  misconduct as proven fact.
                </p>
              </div>

              {/* Dossier stats */}
              {dossier && (
                <div className="paper-card p-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-2xl font-bold text-amber-600">
                      {dossier.events.length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Events</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">
                      {dossier.documents.length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Documents</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">
                      {dossier.prrs.length}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">PRRs</div>
                  </div>
                </div>
              )}
            </aside>

            {/* ── Main content ── */}
            <div className="lg:col-span-8 space-y-10">
              {/* Bio */}
              {actor.bio && (
                <div>
                  <div className="eyebrow">Profile</div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">Background</h2>
                  <p className="mt-4 text-foreground/85 leading-relaxed">{actor.bio}</p>
                </div>
              )}

              {/* Notes / conduct on record */}
              {actor.notes && (
                <div>
                  <div className="eyebrow">Documented in this archive</div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">Conduct on record</h2>
                  <p className="mt-4 whitespace-pre-line text-foreground/85 leading-relaxed">
                    {actor.notes}
                  </p>
                </div>
              )}

              {/* Timeline events */}
              {dossier && dossier.events.length > 0 && (
                <div>
                  <div className="eyebrow flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Timeline
                  </div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">
                    Documented events ({dossier.events.length})
                  </h2>
                  <div className="mt-5 space-y-3">
                    {dossier.events.map((ev) => (
                      <Link key={ev.id} href={`/timeline`}>
                        <div className="paper-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {new Date(ev.eventDate).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="font-mono uppercase text-[9px]"
                                >
                                  {CATEGORY_LABELS[ev.category] ?? ev.category}
                                </Badge>
                              </div>
                              <div className="font-medium mt-1 text-sm">{ev.title}</div>
                              {ev.summary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {ev.summary}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Source documents */}
              {dossier && dossier.documents.length > 0 && (
                <div>
                  <div className="eyebrow flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Evidence
                  </div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">
                    Source documents ({dossier.documents.length})
                  </h2>
                  <div className="mt-5 space-y-3">
                    {dossier.documents.map((doc) => (
                      <Link key={doc.id} href={`/evidence/${doc.id}`}>
                        <div className="paper-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {doc.documentDate && (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {new Date(doc.documentDate).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className="font-mono uppercase text-[9px]"
                                >
                                  {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                                </Badge>
                              </div>
                              <div className="font-medium mt-1 text-sm">{doc.title}</div>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {doc.description}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Public records requests */}
              {dossier && dossier.prrs.length > 0 && (
                <div>
                  <div className="eyebrow flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5" /> Public Records
                  </div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">
                    Related public records requests ({dossier.prrs.length})
                  </h2>
                  <div className="mt-5 space-y-3">
                    {dossier.prrs.map((prr) => (
                      <Link key={prr.id} href="/public-records">
                        <div className="paper-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className="font-mono uppercase text-[9px]"
                                >
                                  {prr.status}
                                </Badge>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {prr.agency}
                                </span>
                              </div>
                              <div className="font-medium mt-1 text-sm">{prr.title}</div>
                              {prr.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {prr.description}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Contradiction map — only shown for judicial actors with notes */}
              {actor.judicialActor && actor.notes && (
                <div>
                  <div className="eyebrow flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5" /> Contradiction map
                  </div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">
                    On-record contradictions
                  </h2>
                  <div className="mt-5 paper-card p-5 border-l-4 border-amber-500">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
                          {actor.notes}
                        </p>
                        <p className="mt-4 text-xs text-muted-foreground">
                          Source: documented conduct in the archive. See timeline events and
                          documents above for supporting records.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {dossier &&
                dossier.events.length === 0 &&
                dossier.documents.length === 0 &&
                dossier.prrs.length === 0 && (
                  <div className="paper-card p-8 text-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <h3 className="display-serif text-xl">No public records yet</h3>
                    <p className="text-muted-foreground mt-2 text-sm">
                      Evidence and timeline events for this actor are pending review or have not
                      been published yet.
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
