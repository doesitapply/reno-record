import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Github, ArrowRight, Cpu, Bot, Network, Scale, Database,
  Globe, Server, Sparkles, ExternalLink, MapPin, Wrench,
} from "lucide-react";
import { Streamdown } from "streamdown";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; accent: string }> = {
  ai_automation: { label: "AI Automation", icon: <Sparkles className="w-4 h-4" />, accent: "text-primary border-primary/30 bg-primary/5" },
  ai_agents: { label: "AI Agents", icon: <Bot className="w-4 h-4" />, accent: "text-violet-400 border-violet-500/30 bg-violet-500/5" },
  systems_architecture: { label: "Systems Architecture", icon: <Network className="w-4 h-4" />, accent: "text-sky-400 border-sky-500/30 bg-sky-500/5" },
  legal_tech: { label: "Legal Tech", icon: <Scale className="w-4 h-4" />, accent: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" },
  data_pipeline: { label: "Data Pipeline", icon: <Database className="w-4 h-4" />, accent: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5" },
  web_platform: { label: "Web Platform", icon: <Globe className="w-4 h-4" />, accent: "text-rose-400 border-rose-500/30 bg-rose-500/5" },
  infrastructure: { label: "Infrastructure", icon: <Server className="w-4 h-4" />, accent: "text-orange-400 border-orange-500/30 bg-orange-500/5" },
  other: { label: "Capability", icon: <Cpu className="w-4 h-4" />, accent: "text-muted-foreground border-border bg-secondary/40" },
};

const LINK_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="w-4 h-4" />,
  scale: <Scale className="w-4 h-4" />,
};

type ProfileLink = { label: string; url: string; icon?: string };

export default function Operator() {
  const { data: profile, isLoading: profileLoading } = trpc.operator.profile.useQuery();
  const { data: buildLog, isLoading: logLoading } = trpc.operator.buildLog.useQuery();
  const { data: projects } = trpc.operator.projects.useQuery();

  useSEO({
    title: profile?.brand ?? "Artificially Educated",
    description:
      profile?.tagline ??
      "Cameron Church — Systems Architect. AI automation, autonomous agents, and legal-intelligence systems built with gravity.",
    canonicalPath: "/operator",
  });

  const links = (profile?.links as ProfileLink[] | null) ?? [];
  const flagship = projects?.find((p) => p.featured);

  return (
    <SiteShell>
      <div className="min-h-screen bg-background">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle at 20% 20%, var(--neon-gold) 0, transparent 45%), radial-gradient(circle at 80% 60%, #6366f1 0, transparent 40%)" }} />
          <div className="container relative py-16 lg:py-24">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-primary">
                  {profile?.brand ?? "Artificially Educated"}
                </span>
                <span className="h-px w-10 bg-border" />
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  The Operator
                </span>
              </div>

              <h1 className="display-serif text-4xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                {profile?.fullName ?? "Cameron Church"}
              </h1>
              {profile?.roleTitle && (
                <p className="mt-3 text-base lg:text-lg font-mono text-muted-foreground">
                  {profile.roleTitle}
                </p>
              )}

              {profile?.tagline && (
                <p className="mt-8 text-2xl lg:text-3xl font-semibold leading-snug text-foreground/90 border-l-2 border-primary pl-5">
                  {profile.tagline}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {links.map((l) => (
                  <a key={l.url} href={l.url} target={l.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      {LINK_ICONS[l.icon ?? ""] ?? <ExternalLink className="w-4 h-4" />}
                      {l.label}
                    </Button>
                  </a>
                ))}
                <Link href="/projects">
                  <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    View the work <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                {profile?.location && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
                    <MapPin className="w-3.5 h-3.5" /> {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Thesis ── */}
        {profile?.thesis && (
          <section className="border-b border-border bg-card/40">
            <div className="container py-14">
              <div className="max-w-3xl">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-4">
                  The Thesis
                </div>
                <p className="text-xl lg:text-2xl leading-relaxed text-foreground/90 font-light">
                  {profile.thesis}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Origin story ── */}
        <section className="container py-16 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-5">
              How we got here
            </div>
            {profileLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-secondary/60 rounded animate-pulse" style={{ width: `${90 - i * 6}%` }} />)}
              </div>
            ) : profile?.bioMarkdown ? (
              <div className="prose prose-invert max-w-none prose-headings:display-serif prose-headings:font-bold prose-p:text-foreground/85 prose-p:leading-relaxed prose-strong:text-primary">
                <Streamdown>{profile.bioMarkdown}</Streamdown>
              </div>
            ) : (
              <p className="text-muted-foreground">Origin story coming soon.</p>
            )}
          </div>

          {/* Flagship callout */}
          {flagship && (
            <aside className="lg:sticky lg:top-24 self-start">
              <div className="rounded-sm border border-primary/30 bg-primary/5 p-6">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary mb-3">
                  Exhibit A
                </div>
                <div className="display-serif text-xl font-bold mb-2">{flagship.name}</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{flagship.tagline}</p>
                <Link href={flagship.internalPath || `/projects/${flagship.slug}`}>
                  <Button size="sm" variant="outline" className="w-full gap-2">
                    Open the live system <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </aside>
          )}
        </section>

        {/* ── Capabilities / Build log ── */}
        <section className="border-t border-border bg-card/30">
          <div className="container py-16">
            <div className="flex items-end justify-between gap-4 mb-8">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground mb-2">
                  Build Log
                </div>
                <h2 className="display-serif text-2xl lg:text-3xl font-bold">
                  What I&apos;ve engineered, orchestrated, automated
                </h2>
              </div>
              <Wrench className="w-7 h-7 text-muted-foreground hidden sm:block" />
            </div>

            {logLoading ? (
              <div className="grid gap-5 md:grid-cols-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-secondary/50 rounded-sm animate-pulse" />)}
              </div>
            ) : !buildLog?.length ? (
              <p className="text-muted-foreground">No capabilities published yet.</p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {buildLog.map((entry) => {
                  const meta = CATEGORY_META[entry.category] ?? CATEGORY_META.other;
                  return (
                    <div key={entry.id} className={`rounded-sm border p-6 transition-colors hover:border-primary/40 ${entry.featured ? "border-primary/30 bg-primary/[0.03]" : "border-border bg-background"}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] font-mono uppercase tracking-wider ${meta.accent}`}>
                          {meta.icon} {meta.label}
                        </span>
                        {entry.featured && (
                          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Featured</Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold leading-snug mb-2">{entry.title}</h3>
                      {entry.summary && (
                        <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
                      )}
                      {entry.outcome && (
                        <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-sm font-medium text-foreground/90">{entry.outcome}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── CTA to projects ── */}
        <section className="container py-16 text-center">
          <h2 className="display-serif text-2xl lg:text-3xl font-bold mb-3">The catalog</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Every system under {profile?.brand ?? "Artificially Educated"} — live, in development, and on the bench.
          </p>
          <Link href="/projects">
            <Button size="lg" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              Browse all projects <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </section>
      </div>
    </SiteShell>
  );
}
