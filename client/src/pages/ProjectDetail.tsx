import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Github, Star, FolderGit2 } from "lucide-react";
import { Streamdown } from "streamdown";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  live: { label: "Live", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", dot: "bg-emerald-400" },
  in_development: { label: "In Development", cls: "text-primary border-primary/30 bg-primary/10", dot: "bg-amber-400" },
  beta: { label: "Beta", cls: "text-sky-400 border-sky-500/30 bg-sky-500/10", dot: "bg-sky-400" },
  concept: { label: "Concept", cls: "text-violet-400 border-violet-500/30 bg-violet-500/10", dot: "bg-violet-400" },
  archived: { label: "Archived", cls: "text-muted-foreground border-border bg-secondary/40", dot: "bg-muted-foreground" },
};

export default function ProjectDetail() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: project, isLoading } = trpc.operator.projectBySlug.useQuery({ slug });

  useSEO({
    title: project?.name ?? "Project",
    description: project?.tagline ?? undefined,
    ogType: "article",
    canonicalPath: `/projects/${slug}`,
    noIndex: !project && !isLoading,
  });

  if (isLoading) {
    return (
      <SiteShell>
        <div className="container py-16 space-y-4">
          <div className="h-8 w-64 bg-secondary/60 rounded animate-pulse" />
          <div className="h-64 bg-secondary/50 rounded animate-pulse" />
        </div>
      </SiteShell>
    );
  }

  if (!project) {
    return (
      <SiteShell>
        <div className="container py-24 text-center">
          <FolderGit2 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h1 className="display-serif text-2xl font-bold mb-2">Project not found</h1>
          <p className="text-muted-foreground mb-6">This project doesn&apos;t exist or isn&apos;t public.</p>
          <Link href="/projects"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to catalog</Button></Link>
        </div>
      </SiteShell>
    );
  }

  const status = STATUS_META[project.status] ?? STATUS_META.concept;
  const stack = (project.techStack as string[] | null) ?? [];
  const screenshots = (project.screenshots as { key: string; caption?: string }[] | null) ?? [];

  return (
    <SiteShell>
      <div className="min-h-screen bg-background">
        <div className="container py-10">
          <Link href="/projects" className="text-sm font-mono text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-8">
            <ArrowLeft className="w-4 h-4" /> All projects
          </Link>

          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
            {/* Main */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[10px] font-mono uppercase tracking-wider ${status.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} /> {status.label}
                </span>
                {project.featured && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary gap-1">
                    <Star className="w-3 h-3 fill-current" /> Flagship
                  </Badge>
                )}
              </div>

              <h1 className="display-serif text-4xl lg:text-5xl font-bold tracking-tight">{project.name}</h1>
              {project.tagline && <p className="mt-3 text-lg text-muted-foreground">{project.tagline}</p>}

              {project.description && (
                <div className="mt-8 prose prose-invert max-w-none prose-p:text-foreground/85 prose-p:leading-relaxed prose-strong:text-primary prose-headings:display-serif">
                  <Streamdown>{project.description}</Streamdown>
                </div>
              )}

              {/* Screenshots */}
              {screenshots.length > 0 && (
                <div className="mt-10 space-y-6">
                  <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground">Screens</div>
                  {screenshots.map((s, i) => (
                    <figure key={i} className="rounded-sm overflow-hidden border border-border">
                      <img src={`/manus-storage/${s.key}`} alt={s.caption || `${project.name} screenshot ${i + 1}`} className="w-full" />
                      {s.caption && <figcaption className="px-4 py-2 text-xs text-muted-foreground bg-card/60 border-t border-border">{s.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-24 self-start space-y-6">
              <div className="rounded-sm border border-border bg-card/40 p-6 space-y-5">
                {(project.liveUrl || project.internalPath || project.repoUrl) && (
                  <div className="flex flex-col gap-2">
                    {project.internalPath && (
                      <Link href={project.internalPath}>
                        <Button className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                          Open live system <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    {project.liveUrl && (
                      <a href={project.liveUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="w-full gap-2"><ExternalLink className="w-4 h-4" /> Visit site</Button>
                      </a>
                    )}
                    {project.repoUrl && (
                      <a href={project.repoUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" className="w-full gap-2"><Github className="w-4 h-4" /> Source</Button>
                      </a>
                    )}
                  </div>
                )}

                {project.role && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">Role</div>
                    <div className="text-sm">{project.role}</div>
                  </div>
                )}
                {project.parentBrand && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">Brand</div>
                    <div className="text-sm">{project.parentBrand}</div>
                  </div>
                )}
                {stack.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Stack</div>
                    <div className="flex flex-wrap gap-1.5">
                      {stack.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-sm bg-secondary text-[10px] font-mono text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
