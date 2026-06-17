import { trpc } from "@/lib/trpc";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Flame, Users, Shield, AlertTriangle } from "lucide-react";

function HeatBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color =
    pct >= 80
      ? "bg-red-500"
      : pct >= 60
      ? "bg-orange-500"
      : pct >= 40
      ? "bg-amber-500"
      : pct >= 20
      ? "bg-yellow-400"
      : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{score}</span>
    </div>
  );
}

function ActorViolationBoard() {
  const { data, isLoading } = trpc.leaderboard.actorViolations.useQuery({});

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No actor data yet. Evidence corpus is being built.</p>
      </div>
    );
  }

  const maxScore = Math.max(...data.map((a) => Number(a.heatScore) || 0));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-4">
        Heat score = document count × violation tag count. Higher score = more documented misconduct.
      </p>
      {data.map((actor, idx) => {
        const score = Number(actor.heatScore) || 0;
        const docs = Number(actor.docCount) || 0;
        const tags = Number(actor.tagCount) || 0;
        return (
          <div
            key={actor.actorId}
            className="paper-card p-4 flex items-center gap-4"
          >
            {/* Rank */}
            <div className="w-8 text-center shrink-0">
              {idx === 0 ? (
                <Trophy className="h-5 w-5 text-amber-400 mx-auto" />
              ) : (
                <span className="text-sm font-mono text-muted-foreground">#{idx + 1}</span>
              )}
            </div>

            {/* Actor info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{actor.actorName}</span>
                {actor.actorRole && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {actor.actorRole}
                  </Badge>
                )}
              </div>
              <HeatBar score={score} max={maxScore} />
            </div>

            {/* Stats */}
            <div className="text-right shrink-0 space-y-0.5">
              <div className="text-xs text-muted-foreground">
                {docs} doc{docs !== 1 ? "s" : ""} · {tags} tag{tags !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Flame className="h-3 w-3 text-orange-400" />
                <span className="text-xs font-mono font-bold text-orange-400">{score}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AuditorBoard() {
  const { data, isLoading } = trpc.leaderboard.auditors.useQuery({});

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No auditor activity yet. Be the first to submit verified evidence.</p>
      </div>
    );
  }

  const maxXp = Math.max(...data.map((a) => Number(a.totalXp) || 0));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-4">
        Auditors earn XP for verified submissions, confirmed tags, and pattern discoveries. Identities are anonymized.
      </p>
      {data.map((auditor, idx) => {
        const xp = Number(auditor.totalXp) || 0;
        const actions = Number(auditor.actionCount) || 0;
        return (
          <div key={String(auditor.userId)} className="paper-card p-4 flex items-center gap-4">
            <div className="w-8 text-center shrink-0">
              {idx === 0 ? (
                <Trophy className="h-5 w-5 text-amber-400 mx-auto" />
              ) : (
                <span className="text-sm font-mono text-muted-foreground">#{idx + 1}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-muted-foreground">
                Auditor #{String(auditor.userId).padStart(4, "0")}
              </div>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden mt-1.5">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: maxXp > 0 ? `${Math.round((xp / maxXp) * 100)}%` : "0%" }}
                />
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground">{actions} action{actions !== 1 ? "s" : ""}</div>
              <div className="text-sm font-mono font-bold text-amber-400">{xp.toLocaleString()} XP</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        {/* Header */}
        <div className="mb-10">
          <div className="eyebrow mb-2">Evidence Corpus</div>
          <h1 className="display-serif text-4xl md:text-5xl mb-4">Accountability Index</h1>
          <p className="text-muted-foreground max-w-2xl">
            Two live rankings: which named officials have the most documented misconduct in the archive,
            and which contributors have done the most to build it.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="mb-8 rounded border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground flex gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Rankings are derived from documents in the public archive. Heat scores reflect evidence density,
            not legal findings. All entries are source-cited public records.
          </span>
        </div>

        <Tabs defaultValue="actors">
          <TabsList className="mb-8">
            <TabsTrigger value="actors" className="gap-2">
              <Flame className="h-4 w-4" />
              Actor Heat Map
            </TabsTrigger>
            <TabsTrigger value="auditors" className="gap-2">
              <Users className="h-4 w-4" />
              Auditor Board
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actors">
            <ActorViolationBoard />
          </TabsContent>

          <TabsContent value="auditors">
            <AuditorBoard />
          </TabsContent>
        </Tabs>
      </section>
    </SiteShell>
  );
}
