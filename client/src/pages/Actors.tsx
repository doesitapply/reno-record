import { Link, useRoute } from "wouter";
import { ArrowLeft } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function ActorsPage() {
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
              archived here. Profiles describe public-record conduct in the documented matters and
              do not assert misconduct as proven fact.
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
                <div className="paper-card p-5 h-full hover:-translate-y-0.5 transition-transform">
                  <div className="flex items-center justify-between">
                    <div className="eyebrow">{a.role || "Documented actor"}</div>
                    <Badge variant="outline" className="font-mono uppercase text-[10px]">
                      {a.status}
                    </Badge>
                  </div>
                  <div className="display-serif text-xl mt-1">{a.name}</div>
                  {a.agency && <div className="text-sm text-muted-foreground mt-1">{a.agency}</div>}
                  {a.bio && (
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {a.bio}
                    </p>
                  )}
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
  const { data: actor, isLoading } = trpc.actor.bySlug.useQuery({ slug });
  return (
    <SiteShell>
      <section className="container py-10 md:py-14">
        <Link href="/actors">
          <Button variant="ghost" className="gap-2 mb-6 -ml-3">
            <ArrowLeft className="h-4 w-4" /> All actors
          </Button>
        </Link>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
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
            <aside className="lg:col-span-4">
              <div className="paper-card p-6">
                <div className="eyebrow">{actor.role || "Documented actor"}</div>
                <h1 className="display-serif text-3xl mt-2">{actor.name}</h1>
                {actor.agency && (
                  <div className="text-sm text-muted-foreground mt-1">{actor.agency}</div>
                )}
                <Badge variant="outline" className="mt-4 font-mono uppercase text-[10px]">
                  Status: {actor.status}
                </Badge>
                <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
                  Profiles describe documented conduct in the cases archived here. The Reno Record
                  presents allegations as reported until corroborated by records and does not
                  assert misconduct as proven fact.
                </p>
              </div>
            </aside>
            <div className="lg:col-span-8 space-y-8">
              {actor.bio && (
                <div>
                  <div className="eyebrow">Profile</div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">Background</h2>
                  <p className="mt-4 text-foreground/85 leading-relaxed">{actor.bio}</p>
                </div>
              )}
              {actor.notes && (
                <div>
                  <div className="eyebrow">Documented in this archive</div>
                  <h2 className="display-serif text-2xl mt-2 rule-amber">Conduct on record</h2>
                  <p className="mt-4 whitespace-pre-line text-foreground/85 leading-relaxed">
                    {actor.notes}
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
