import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Github, Star, FolderGit2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  live: { label: "Live", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", dot: "bg-emerald-400" },
  in_development: { label: "In Development", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10", dot: "bg-amber-400" },
  beta: { label: "Beta", cls: "text-sky-400 border-sky-500/30 bg-sky-500/10", dot: "bg-sky-400" },
  concept: { label: "Concept", cls: "text-violet-400 border-violet-500/30 bg-violet-500/10", dot: "bg-violet-400" },
  archived: { label: "Archived", cls: "text-muted-foreground border-border bg-secondary/40", dot: "bg-muted-foreground" },
};

function ProjectCard({ p, featured = false }: { p: any; featured?: boolean }) {
  const status = STATUS_META[p.status] ?? STATUS_META.concept;
  const stack = (p.techStack as string[] | null) ?? [];
  const href = p.internalPath || `/projects/${p.slug}`;
  const isInternal = href.startsWith("/");

  return (
    <div className={`group relative flex flex-col rounded-sm border transition-all hover:border-primary/50 ${featured ? "border-primary/40 bg-primary/[0.04] lg:flex-row" : "border-border bg-card/40"}`}>
      {/* Thumbnail */}
      <div className={`relative overflow-hidden bg-secondary/40 ${featured ? "lg:w-1/2 aspect-video lg:aspect-auto" : "aspect-video"} rounded-t-sm ${featured ? "lg:rounded-l-sm lg:rounded-tr-none" : ""}`}>
        {p.thumbnailKey ? (
          <img src={`/manus-storage/${p.thumbnailKey}`} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <FolderGit2 className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        {featured && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-wider font-bold">
            <Star className="w-3 h-3 fill-current" /> Flagship
          </span>
        )}
      </div>

      {/* Body */}
      <div className={`flex flex-col flex-1 p-6 ${featured ? "lg:w-1/2 lg:justify-center" : ""}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] font-mono uppercase tracking-wider ${status.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} /> {status.label}
          </span>
          {p.parentBrand && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{p.parentBrand}</span>
          )}
        </div>

        <h3 className={`display-serif font-bold tracking-tight ${featured ? "text-2xl lg:text-3xl" : "text-xl"}`}>{p.name}</h3>
        {p.tagline && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.tagline}</p>}

        {stack.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {stack.slice(0, featured ? 8 : 5).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-sm bg-secondary text-[10px] font-mono text-muted-foreground">{t}</span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          {isInternal ? (
            <Link href={href}>
              <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                {p.internalPath ? "Open live system" : "Details"} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          ) : (
            <Link href={`/projects/${p.slug}`}>
              <Button size="sm" variant="outline" className="gap-1.5">Details <ArrowRight className="w-3.5 h-3.5" /></Button>
            </Link>
          )}
          {p.liveUrl && (
            <a href={p.liveUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Live</Button>
            </a>
          )}
          {p.repoUrl && (
            <a href={p.repoUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5"><Github className="w-3.5 h-3.5" /> Code</Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Projects() {
  const { data: profile } = trpc.operator.profile.useQuery();
  const { data: projects, isLoading } = trpc.operator.projects.useQuery();

  useSEO({
    title: "Projects",
    description: "The project catalog of Artificially Educated — AI automation, autonomous agents, and legal-intelligence systems.",
    canonicalPath: "/projects",
  });

  const flagship = projects?.find((p) => p.featured);
  const rest = projects?.filter((p) => !p.featured) ?? [];

  return (
    <SiteShell>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <section className="border-b border-border">
          <div className="container py-14">
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary mb-3">
              {profile?.brand ?? "Artificially Educated"} · Catalog
            </div>
            <h1 className="display-serif text-4xl lg:text-5xl font-bold tracking-tight">The Work</h1>
            <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">
              Systems I&apos;ve engineered, orchestrated, and deployed — from a live forensic court audit to
              autonomous AI agents. Built for real-world stakes, not demos.
            </p>
            <div className="mt-4">
              <Link href="/operator" className="text-sm font-mono text-primary hover:underline inline-flex items-center gap-1.5">
                ← Meet the operator
              </Link>
            </div>
          </div>
        </section>

        <div className="container py-12 space-y-10">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-72 bg-secondary/50 rounded-sm animate-pulse" />)}
            </div>
          ) : !projects?.length ? (
            <p className="text-muted-foreground">No projects published yet.</p>
          ) : (
            <>
              {flagship && <ProjectCard p={flagship} featured />}
              {rest.length > 0 && (
                <div className="grid gap-6 md:grid-cols-2">
                  {rest.map((p) => <ProjectCard key={p.id} p={p} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
