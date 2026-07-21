import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Scale, Shield, Users, FileText, ExternalLink, ChevronLeft, User } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";

const AGENCY_TYPE_LABELS: Record<string, string> = {
  court: "Court",
  prosecutor: "Prosecutor",
  law_enforcement: "Law Enforcement",
  public_defender: "Public Defender",
  government_department: "Government Department",
  oversight_body: "Oversight Body",
  municipality: "Municipality",
  state_agency: "State Agency",
  federal_agency: "Federal Agency",
  other: "Other",
};

export default function AgencyDetail() {
  const [, params] = useRoute("/agencies/:slug");
  const slug = params?.slug ?? "";

  const { data, isLoading, error } = trpc.agency.getBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );

  useSEO({ title: data ? `${data.agency.name} — The Reno Record` : "Agency — The Reno Record" });

  if (isLoading) {
    return (
      <SiteShell>
      <div className="container py-16">
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      </SiteShell>
    );
  }

  if (error || !data) {
    return (
      <SiteShell>
      <div className="container py-16 text-center">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold">Agency not found</h2>
        <p className="text-muted-foreground mt-2">This agency may not be indexed yet.</p>
        <Link href="/agencies" className="text-primary hover:underline text-sm mt-4 inline-block">
          ← Back to Agency Directory
        </Link>
      </div>
      </SiteShell>
    );
  }

  const { agency, actors, docCount } = data;
  const currentActors = actors.filter((a) => a.isCurrent);
  const formerActors = actors.filter((a) => !a.isCurrent);

  return (
    <SiteShell>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-8">
          <Link href="/agencies" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 w-fit">
            <ChevronLeft className="w-4 h-4" />
            Agency Directory
          </Link>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 shrink-0">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">
                  {AGENCY_TYPE_LABELS[agency.agencyType ?? "other"]}
                </Badge>
                {agency.jurisdictionName && (
                  <Badge variant="outline" className="text-xs">
                    {agency.jurisdictionName}
                  </Badge>
                )}
                {agency.state && (
                  <Badge variant="outline" className="text-xs">
                    {agency.state}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{agency.name}</h1>
              {agency.notes && (
                <p className="text-muted-foreground mt-2 max-w-2xl">{agency.notes}</p>
              )}
              {agency.websiteUrl && (
                <a
                  href={agency.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-primary hover:underline mt-2 w-fit"
                >
                  Official website <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-background rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold">{actors.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Named Officials</div>
            </div>
            <div className="bg-background rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold">{currentActors.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Current</div>
            </div>
            <div className="bg-background rounded-xl border p-4 text-center">
              <div className="text-2xl font-bold">{docCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Linked Documents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8 space-y-8">
        {/* Current Officials */}
        {currentActors.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Current Officials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentActors.map((actor) => (
                <Link key={actor.id} href={`/actors/${actor.actorSlug}`}>
                  <Card className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                          {actor.actorName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{actor.title}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Former Officials */}
        {formerActors.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Former Officials
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {formerActors.map((actor) => (
                <Link key={actor.id} href={`/actors/${actor.actorSlug}`}>
                  <Card className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group opacity-75">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                          {actor.actorName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{actor.title}</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {actors.length === 0 && (
          <div className="text-center py-16 text-muted-foreground border rounded-xl">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No officials linked yet</p>
            <p className="text-sm mt-1">
              Officials are linked as documents are ingested and actor profiles are created.
            </p>
          </div>
        )}

        {/* Archive notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-5">
          <p className="text-sm text-amber-800 dark:text-primary/80">
            <strong>Archive methodology:</strong> Officials are linked to this agency based on their
            documented roles in public records. Document counts reflect publicly available records in
            the archive. This is not a comprehensive directory — it reflects what has been submitted
            and verified.
          </p>
        </div>
      </div>
    </div>
    </SiteShell>
  );
}
