import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Check,
  Loader2,
  Shield,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [, params] = useRoute("/admin/story/:id");
  const [, paramsDoc] = useRoute("/admin/document/:id");

  if (loading) {
    return (
      <SiteShell>
        <div className="container py-24 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      </SiteShell>
    );
  }
  if (!user) {
    return (
      <SiteShell>
        <section className="container py-24 text-center max-w-lg mx-auto">
          <Shield className="h-8 w-8 mx-auto" />
          <h1 className="display-serif text-3xl mt-4">Editor sign-in required</h1>
          <p className="text-muted-foreground mt-2">
            Admin tools are restricted to The Reno Record editorial owner.
          </p>
          <a href={getLoginUrl()}>
            <Button className="mt-6 bg-foreground text-background">Sign in</Button>
          </a>
        </section>
      </SiteShell>
    );
  }
  if (user.role !== "admin") {
    return (
      <SiteShell>
        <section className="container py-24 text-center max-w-lg mx-auto">
          <h1 className="display-serif text-3xl">Not authorized</h1>
          <p className="text-muted-foreground mt-2">
            Your account does not have admin access to this archive.
          </p>
        </section>
      </SiteShell>
    );
  }

  if (params?.id) return <StoryReview id={Number(params.id)} />;
  if (paramsDoc?.id) return <DocumentReview id={Number(paramsDoc.id)} />;

  return <AdminDashboard />;
}

function AdminDashboard() {
  return (
    <SiteShell>
      <section className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="eyebrow">Editor desk</div>
            <h1 className="display-serif text-4xl mt-2">Moderation</h1>
          </div>
          <Badge variant="outline" className="font-mono uppercase text-[10px]">
            Nothing publishes without you
          </Badge>
        </div>

        <Tabs defaultValue="stories">
          <TabsList>
            <TabsTrigger value="ingest">Goblin Ingest</TabsTrigger>
            <TabsTrigger value="stories">Stories</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="actors">Actors</TabsTrigger>
            <TabsTrigger value="prr">Public records</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>
          <TabsContent value="ingest"><IngestTab /></TabsContent>
          <TabsContent value="stories"><StoriesTab /></TabsContent>
          <TabsContent value="documents"><DocumentsTab /></TabsContent>
          <TabsContent value="timeline"><TimelineTab /></TabsContent>
          <TabsContent value="actors"><ActorsTab /></TabsContent>
          <TabsContent value="prr"><PrrTab /></TabsContent>
          <TabsContent value="audit"><AuditTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
        </Tabs>
      </section>
    </SiteShell>
  );
}

/* ============= Stories ============= */
function IngestTab() {
  const utils = trpc.useUtils();
  const list = trpc.docketGoblin.ingestList.useQuery({ status: undefined });
  const approve = trpc.docketGoblin.approveIngest.useMutation({
    onSuccess: () => {
      toast.success("Approved & promoted to public archive");
      utils.docketGoblin.ingestList.invalidate();
      utils.document.adminList.invalidate();
      utils.timeline.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const jobs = list.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-serif text-2xl">Goblin Ingest Queue</h2>
          <p className="text-sm text-muted-foreground">
            Drop files into the Docket Goblin chat bubble (bottom-right). Each file is
            extracted, classified, tagged, and staged here as a pending document.
            Nothing is public until you approve below.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => list.refetch()}
          disabled={list.isFetching}
        >
          {list.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {jobs.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No ingest jobs yet. Drop a PDF, transcript, or image onto the Docket
          Goblin bubble to start.
        </Card>
      )}

      <div className="grid gap-3">
        {jobs.map((j: any) => {
          const draft: any = j.draftJson || {};
          const proposed: string[] = j.proposedActors || [];
          return (
            <Card key={j.id} className="p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      Job #{j.id}
                    </Badge>
                    <Badge
                      className={
                        j.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
                          : j.status === "failed"
                            ? "bg-red-500/15 text-red-300 border-red-400/30"
                            : j.status === "drafted"
                              ? "bg-amber-400/15 text-amber-300 border-amber-300/30"
                              : "bg-white/[0.04] text-bone/70 border-white/10"
                      }
                    >
                      {j.status}
                    </Badge>
                    {draft.sourceType && (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {draft.sourceType.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {draft.caseNumber && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {draft.caseNumber}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-serif text-lg mt-2">
                    {draft.title || j.filename}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {j.filename} · {(j.fileSize / 1024).toFixed(0)} KB
                    {draft.documentDate ? ` · ${draft.documentDate}` : ""}
                  </div>
                  {draft.summary && (
                    <p className="text-sm mt-2 leading-relaxed">{draft.summary}</p>
                  )}
                  {(draft.tags?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {draft.tags.map((t: string) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="font-mono text-[10px] uppercase"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {(draft.actorNames?.length || 0) > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      <span className="uppercase tracking-wider mr-1">Named:</span>
                      {draft.actorNames.join(" · ")}
                      {proposed.length > 0 && (
                        <span className="ml-2 text-emerald-400">
                          (matches existing: {proposed.join(", ")})
                        </span>
                      )}
                    </div>
                  )}
                  {(draft.warnings?.length || 0) > 0 && (
                    <div className="text-xs text-amber-400 mt-2">
                      ⚠ {draft.warnings.join(" — ")}
                    </div>
                  )}
                  {draft.proposedTimeline && (
                    <div className="mt-3 rounded border border-amber-300/30 bg-amber-400/10 p-2 text-xs">
                      <span className="uppercase tracking-wider text-amber-300 mr-2">
                        Proposed timeline event:
                      </span>
                      <span className="font-mono">
                        {draft.proposedTimeline.eventDate}
                      </span>{" "}
                      · {draft.proposedTimeline.title} (
                      {draft.proposedTimeline.category}/
                      {draft.proposedTimeline.status})
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {j.documentId && (
                    <Link href={`/admin/document/${j.documentId}`}>
                      <Button variant="outline" size="sm">
                        Open document
                      </Button>
                    </Link>
                  )}
                  {j.status !== "approved" && j.documentId && (
                    <Button
                      size="sm"
                      className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      disabled={approve.isPending}
                      onClick={() =>
                        approve.mutate({
                          jobId: j.id,
                          approveDocument: true,
                          publishDocument: true,
                          createTimelineEvent: !!draft.proposedTimeline,
                          publishTimelineEvent: !!draft.proposedTimeline,
                        })
                      }
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve & publish
                    </Button>
                  )}
                  {j.status === "failed" && j.error && (
                    <span className="text-xs text-red-400 max-w-xs">
                      {j.error}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StoriesTab() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "needs_changes" | "all">("pending");
  const list = trpc.story.adminList.useQuery({ status });
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4">
        <Label className="eyebrow !text-[0.62rem]">Status</Label>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="needs_changes">Needs changes</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {list.isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!list.isLoading && (list.data ?? []).length === 0 && (
        <div className="paper-card p-10 text-center text-muted-foreground">
          No stories with this status.
        </div>
      )}
      <div className="grid gap-3">
        {(list.data ?? []).map((s) => (
          <Link key={s.id} href={`/admin/story/${s.id}`}>
            <article className="paper-card p-5 hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="font-mono uppercase text-[10px]">
                  #{s.id}
                </Badge>
                <Badge
                  variant={s.status === "approved" ? "default" : "secondary"}
                  className="font-mono uppercase text-[10px]"
                >
                  {s.status}
                </Badge>
                {s.featured && (
                  <Badge className="bg-[var(--amber)] text-foreground font-mono uppercase text-[10px]">
                    Featured
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="mt-2 display-serif text-lg">
                {s.mainIssue || s.alias || s.submitterName || "Untitled submission"}
              </h3>
              {s.summary && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{s.summary}</p>
              )}
              <div className="mt-2 text-xs text-muted-foreground">
                {s.court || "Court not specified"} · {s.judge || "Judge not specified"} · custody{" "}
                {s.custodyDays ?? 0} d
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StoryReview({ id }: { id: number }) {
  const story = trpc.story.adminGet.useQuery({ id });
  const utils = trpc.useUtils();
  const update = trpc.story.adminUpdate.useMutation({
    onSuccess: () => {
      utils.story.adminList.invalidate();
      utils.story.adminGet.invalidate({ id });
      utils.story.featured.invalidate();
    },
  });
  const draft = trpc.docketGoblin.draftForStory.useMutation();
  const [reviewerNote, setReviewerNote] = useState("");
  const [mainIssue, setMainIssue] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (story.data) {
      setReviewerNote(story.data.reviewerNote || "");
      setMainIssue(story.data.mainIssue || "");
      setSlug(story.data.slug || "");
    }
  }, [story.data]);

  if (story.isLoading) {
    return (
      <SiteShell>
        <div className="container py-20 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      </SiteShell>
    );
  }
  if (!story.data) {
    return (
      <SiteShell>
        <div className="container py-20 text-center">Story not found.</div>
      </SiteShell>
    );
  }
  const s = story.data;

  const setStatus = async (status: "approved" | "rejected" | "needs_changes" | "pending") => {
    try {
      await update.mutateAsync({
        id,
        patch: { status, reviewerNote, mainIssue, slug: slug || undefined },
      });
      toast.success(`Story marked ${status.replace("_", " ")}`);
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };
  const toggleFeatured = async () => {
    try {
      await update.mutateAsync({ id, patch: { featured: !s.featured } });
      toast.success(s.featured ? "Removed from featured" : "Marked as featured");
    } catch (e: any) {
      toast.error(e?.message || "Update failed");
    }
  };
  const runGoblin = async () => {
    try {
      const res = await draft.mutateAsync({ storyId: id });
      toast.success("Docket Goblin draft ready (advisory)");
      // Pre-fill main issue / slug suggestions if empty
      if (!mainIssue && res.draft.summary) {
        const firstSentence = res.draft.summary.split(/(?<=\.)\s/)[0];
        setMainIssue(firstSentence?.slice(0, 200) || "");
      }
      if (!slug && res.draft.slug) setSlug(res.draft.slug.slice(0, 180));
    } catch (e: any) {
      toast.error(e?.message || "Goblin failed");
    }
  };

  return (
    <SiteShell>
      <section className="container py-10">
        <Link href="/admin">
          <Button variant="ghost" className="-ml-3 gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Button>
        </Link>
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="paper-card p-6">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="font-mono uppercase text-[10px]">
                  Submission #{s.id}
                </Badge>
                <Badge variant="secondary" className="font-mono uppercase text-[10px]">
                  {s.status}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                  {new Date(s.createdAt).toLocaleString()}
                </span>
              </div>
              <h1 className="display-serif text-3xl mt-3">
                {s.mainIssue || s.alias || s.submitterName || "Untitled submission"}
              </h1>
              <div className="mt-2 text-sm text-muted-foreground">
                {s.submitterName || s.alias || "Anonymous"} · {s.email}
                {s.phone ? ` · ${s.phone}` : ""}
              </div>
            </div>

            <div className="paper-card p-6">
              <div className="eyebrow">Case</div>
              <div className="mt-3 grid sm:grid-cols-2 gap-4 text-sm">
                <KV label="Case number" value={s.caseNumber || "—"} />
                <KV label="Court" value={s.court || "—"} />
                <KV label="Department" value={s.department || "—"} />
                <KV label="Judge" value={s.judge || "—"} />
                <KV label="Prosecutor" value={s.prosecutor || "—"} />
                <KV label="Defense" value={s.defenseAttorney || "—"} />
                <KV label="Charges" value={s.charges || "—"} />
                <KV
                  label="Date case started"
                  value={
                    s.dateCaseStarted ? new Date(s.dateCaseStarted).toLocaleDateString() : "—"
                  }
                />
                <KV label="Custody days" value={String(s.custodyDays ?? "—")} />
                <KV label="Still pending" value={s.stillPending ? "Yes" : "No"} />
                <KV label="Trial held" value={s.trialHeld ? "Yes" : "No"} />
                <KV label="Asked self-rep" value={s.askedSelfRep ? "Yes" : "No"} />
                <KV label="Faretta canvass held" value={s.farettaHandled ? "Yes" : "No"} />
                <KV label="Competency raised" value={s.competencyRaised ? "Yes" : "No"} />
                <KV label="Filings blocked" value={s.filingsBlocked ? "Yes" : "No"} />
                <KV label="Discovery missing" value={s.discoveryMissing ? "Yes" : "No"} />
                <KV label="Warrants used" value={s.warrantsUsed ? "Yes" : "No"} />
              </div>
            </div>

            <div className="paper-card p-6">
              <div className="eyebrow">Submitter narrative</div>
              <p className="mt-3 whitespace-pre-line text-foreground/90 leading-relaxed">
                {s.summary}
              </p>
              {s.familyHarm && (
                <>
                  <div className="eyebrow mt-6">Family / harm</div>
                  <p className="mt-2 whitespace-pre-line text-foreground/90 leading-relaxed">
                    {s.familyHarm}
                  </p>
                </>
              )}
              {s.competencyContext && (
                <>
                  <div className="eyebrow mt-6">Competency context</div>
                  <p className="mt-2 whitespace-pre-line text-foreground/90 leading-relaxed">
                    {s.competencyContext}
                  </p>
                </>
              )}
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="paper-card p-6">
              <div className="eyebrow">Editorial decision</div>
              <div className="mt-4 space-y-3">
                <div>
                  <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Public main issue</Label>
                  <Input
                    value={mainIssue}
                    onChange={(e) => setMainIssue(e.target.value)}
                    placeholder="Headline-style summary"
                  />
                </div>
                <div>
                  <Label className="eyebrow !text-[0.62rem] mb-1.5 block">URL slug (auto on approve)</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="optional-custom-slug"
                  />
                </div>
                <div>
                  <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Reviewer note</Label>
                  <Textarea
                    rows={3}
                    value={reviewerNote}
                    onChange={(e) => setReviewerNote(e.target.value)}
                    placeholder="Internal note (not published)"
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  className="bg-foreground text-background gap-2"
                  onClick={() => setStatus("approved")}
                  disabled={update.isPending}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setStatus("needs_changes")}
                  disabled={update.isPending}
                >
                  Request changes
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setStatus("pending")}
                  disabled={update.isPending}
                >
                  Reset to pending
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => setStatus("rejected")}
                  disabled={update.isPending}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
              <div className="mt-4 paper-card !p-3 flex items-center justify-between">
                <span className="text-sm">Featured (Church Record)</span>
                <Switch checked={!!s.featured} onCheckedChange={toggleFeatured} />
              </div>
            </div>

            <div className="paper-card p-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[var(--rust)]" />
                <div className="eyebrow !mb-0">Docket Goblin (advisory)</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Drafts a neutral summary, tags, and a slug suggestion. <strong>Never publishes.</strong>{" "}
                Anything you choose to use is saved by you, not the goblin.
              </p>
              <Button
                className="mt-4 w-full gap-2"
                variant="outline"
                onClick={runGoblin}
                disabled={draft.isPending}
              >
                {draft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate draft
              </Button>
              {draft.data && (
                <div className="mt-4 space-y-3 text-xs font-mono">
                  <div>
                    <div className="eyebrow !text-[0.6rem]">Summary</div>
                    <div className="mt-1 whitespace-pre-line">{draft.data.draft.summary}</div>
                  </div>
                  <div>
                    <div className="eyebrow !text-[0.6rem]">Tags</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(draft.data.draft.tags || []).map((t) => (
                        <Badge key={t} variant="secondary" className="font-mono uppercase text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {(draft.data.draft.warnings || []).length > 0 && (
                    <div>
                      <div className="eyebrow !text-[0.6rem]">Warnings</div>
                      <ul className="list-disc pl-4 mt-1">
                        {draft.data.draft.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
}

/* ============= Documents ============= */
function DocumentsTab() {
  const [vizFilter, setVizFilter] = useState<string | null>(null);
  const [aiFilter, setAiFilter] = useState<string | null>(null);
  const list = trpc.document.adminList.useQuery({
    visibility: (vizFilter as any) ?? undefined,
    aiPolicy: (aiFilter as any) ?? undefined,
  });
  const counts = trpc.document.adminCounts.useQuery();
  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const v = r.result as string;
        resolve(v.slice(v.indexOf(",") + 1));
      };
      r.onerror = reject;
      r.readAsDataURL(f);
    });

  const upload = trpc.document.adminUpload.useMutation({
    onSuccess: () => list.refetch(),
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("court_order");
  const [caseNumber, setCaseNumber] = useState("");
  const [actorNames, setActorNames] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) {
      toast.error("Title and file required");
      return;
    }
    const dataBase64 = await fileToBase64(file);
    await upload.mutateAsync({
      title,
      description,
      sourceType: sourceType as any,
      caseNumber,
      actorNames,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      dataBase64,
    });
    toast.success("Uploaded as pending. Review & approve to publish.");
    setTitle("");
    setDescription("");
    setCaseNumber("");
    setActorNames("");
    setFile(null);
  };

  const c = counts.data ?? {};
  const counterCells: Array<[string, string]> = [
    ["Pending review", "pending_review"],
    ["Needs redaction", "needs_redaction"],
    ["Public preview", "public_preview"],
    ["Receipts only", "receipts_only"],
    ["Goblin allowed", "goblin_allowed"],
    ["Private (admin only)", "private_admin_only"],
    ["Rejected", "rejected"],
  ];
  const goblinAllowedAi = c["ai:goblin_allowed"] ?? 0;
  const noAi = c["ai:no_ai_processing"] ?? 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {counterCells.map(([label, key]) => {
          const active = vizFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setVizFilter(active ? null : key)}
              className={`paper-card p-3 text-left transition ${
                active ? "ring-2 ring-[var(--amber)] -translate-y-0.5" : "hover:-translate-y-0.5"
              }`}
            >
              <div className="eyebrow !text-[0.6rem] text-muted-foreground">{label}</div>
              <div className="display-serif text-2xl">{Number((c as any)[key] ?? 0)}</div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 text-xs flex-wrap items-center">
        <button
          type="button"
          onClick={() =>
            setAiFilter(aiFilter === "goblin_allowed" ? null : "goblin_allowed")
          }
        >
          <Badge
            variant={aiFilter === "goblin_allowed" ? "default" : "outline"}
          >
            AI: goblin_allowed {goblinAllowedAi}
          </Badge>
        </button>
        <button
          type="button"
          onClick={() =>
            setAiFilter(aiFilter === "no_ai_processing" ? null : "no_ai_processing")
          }
        >
          <Badge
            variant={aiFilter === "no_ai_processing" ? "default" : "outline"}
          >
            AI: no_ai_processing {noAi}
          </Badge>
        </button>
        {(vizFilter || aiFilter) && (
          <button
            type="button"
            onClick={() => {
              setVizFilter(null);
              setAiFilter(null);
            }}
            className="text-muted-foreground hover:text-foreground underline ml-2"
          >
            reset filters
          </button>
        )}
      </div>
      <div className="grid lg:grid-cols-12 gap-6">
      <form className="lg:col-span-5 paper-card p-6 space-y-3" onSubmit={submit}>
        <h3 className="display-serif text-xl rule-amber">Add evidence</h3>
        <div>
          <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Description</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Source type</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[
                  "court_order",
                  "motion",
                  "email",
                  "transcript",
                  "warrant",
                  "public_records_response",
                  "audio",
                  "video",
                  "image",
                  "jail_record",
                  "risk_notice",
                  "other",
                ].map((v) => (
                  <SelectItem key={v} value={v}>{v.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Case number</Label>
            <Input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Actor names</Label>
          <Input value={actorNames} onChange={(e) => setActorNames(e.target.value)} />
        </div>
        <div>
          <Label className="eyebrow !text-[0.62rem] mb-1.5 block">File *</Label>
          <Input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          type="submit"
          className="bg-foreground text-background gap-2"
          disabled={upload.isPending}
        >
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Upload (pending)
        </Button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        {(list.data ?? []).map((d: any) => (
          <Link key={d.id} href={`/admin/document/${d.id}`}>
            <article className="paper-card p-5 hover:-translate-y-0.5 transition-transform">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="font-mono uppercase text-[10px]">
                  #{d.id}
                </Badge>
                <Badge
                  variant={d.reviewStatus === "approved" ? "default" : "secondary"}
                  className="font-mono uppercase text-[10px]"
                >
                  {d.reviewStatus}
                </Badge>
                <Badge variant="outline" className="font-mono uppercase text-[10px]">
                  {d.publicStatus ? "public" : "private"}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                  {d.sourceType.replace(/_/g, " ")}
                </span>
              </div>
              <h3 className="mt-2 display-serif text-lg">{d.title}</h3>
              {d.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{d.description}</p>
              )}
            </article>
          </Link>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="paper-card p-10 text-center text-muted-foreground">
            No documents yet.
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function DocumentReview({ id }: { id: number }) {
  const { data: doc, isLoading, refetch } = trpc.document.adminGet.useQuery({ id });
  const utils = trpc.useUtils();
  const update = trpc.document.adminUpdate.useMutation({
    onSuccess: () => {
      refetch();
      utils.document.listPublic.invalidate();
    },
  });
  const goblin = trpc.docketGoblin.draftForDocument.useMutation();
  const apply = trpc.docketGoblin.applyDraftToDocument.useMutation({ onSuccess: () => refetch() });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actorNames, setActorNames] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [redaction, setRedaction] = useState<"unverified" | "verified" | "needs_redaction">(
    "unverified",
  );
  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setDescription(doc.description || "");
      setActorNames(doc.actorNames || "");
      setCaseNumber(doc.caseNumber || "");
      setRedaction(doc.redactionStatus);
    }
  }, [doc]);

  if (isLoading) {
    return (
      <SiteShell>
        <div className="container py-20 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      </SiteShell>
    );
  }
  if (!doc) {
    return (
      <SiteShell>
        <div className="container py-20 text-center">Document not found.</div>
      </SiteShell>
    );
  }

  const save = async () => {
    await update.mutateAsync({
      id,
      patch: { title, description, actorNames, caseNumber, redactionStatus: redaction },
    });
    toast.success("Saved");
  };
  const approveAndPublish = async () => {
    if (redaction !== "verified") {
      toast.error("Mark redaction status as 'verified' before publishing.");
      return;
    }
    await update.mutateAsync({
      id,
      patch: { reviewStatus: "approved", publicStatus: true },
    });
    toast.success("Published to public archive");
  };
  const reject = async () => {
    await update.mutateAsync({
      id,
      patch: { reviewStatus: "rejected", publicStatus: false },
    });
    toast.success("Rejected");
  };
  const unpublish = async () => {
    await update.mutateAsync({ id, patch: { publicStatus: false } });
    toast.success("Unpublished");
  };
  const runGoblin = async () => {
    try {
      await goblin.mutateAsync({ documentId: id });
      toast.success("Docket Goblin draft ready (advisory)");
    } catch (e: any) {
      toast.error(e?.message || "Goblin failed");
    }
  };
  const acceptDraft = async () => {
    if (!goblin.data) return;
    await apply.mutateAsync({
      documentId: id,
      summary: goblin.data.draft.summary,
      tags: goblin.data.draft.tags,
    });
    toast.success("Draft applied to document (still not public until you publish).");
  };

  return (
    <SiteShell>
      <section className="container py-10">
        <Link href="/admin">
          <Button variant="ghost" className="-ml-3 gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Button>
        </Link>
        <div className="grid lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4 space-y-4">
            <div className="paper-card p-6 space-y-3">
              <div className="eyebrow">Metadata</div>
              <div>
                <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Description</Label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Actor names</Label>
                <Input value={actorNames} onChange={(e) => setActorNames(e.target.value)} />
              </div>
              <div>
                <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Case number</Label>
                <Input value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
              </div>
              <div>
                <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Redaction status</Label>
                <Select value={redaction} onValueChange={(v) => setRedaction(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unverified">unverified</SelectItem>
                    <SelectItem value="verified">verified</SelectItem>
                    <SelectItem value="needs_redaction">needs_redaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={save} disabled={update.isPending} variant="outline" className="w-full">
                Save metadata
              </Button>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  className="bg-foreground text-background gap-2"
                  onClick={approveAndPublish}
                  disabled={update.isPending}
                >
                  <Check className="h-4 w-4" /> Approve + publish
                </Button>
                <Button variant="outline" onClick={unpublish} disabled={update.isPending}>
                  Unpublish
                </Button>
                <Button variant="destructive" className="col-span-2 gap-2" onClick={reject}>
                  <Trash2 className="h-4 w-4" /> Reject
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Status: <strong>{doc.reviewStatus}</strong> · Public: {doc.publicStatus ? "yes" : "no"}
              </div>
            </div>

            <div className="paper-card p-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[var(--rust)]" />
                <div className="eyebrow !mb-0">Docket Goblin</div>
              </div>
              <p className="text-xs text-muted-foreground">
                Drafts neutral summary + tags. Apply only if you agree. <strong>Never publishes.</strong>
              </p>
              <Button
                onClick={runGoblin}
                variant="outline"
                className="mt-3 w-full gap-2"
                disabled={goblin.isPending}
              >
                {goblin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate draft
              </Button>
              {goblin.data && (
                <div className="mt-3 space-y-3 text-xs font-mono">
                  <div>
                    <div className="eyebrow !text-[0.6rem]">Summary</div>
                    <div className="mt-1 whitespace-pre-line">{goblin.data.draft.summary}</div>
                  </div>
                  <div>
                    <div className="eyebrow !text-[0.6rem]">Tags</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(goblin.data.draft.tags || []).map((t) => (
                        <Badge key={t} variant="secondary" className="font-mono uppercase text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button onClick={acceptDraft} className="w-full bg-foreground text-background">
                    Apply draft to document
                  </Button>
                </div>
              )}
              {doc.aiSummary && (
                <div className="mt-4 text-xs">
                  <div className="eyebrow !text-[0.6rem]">Currently saved AI summary</div>
                  <div className="mt-1 italic text-muted-foreground">{doc.aiSummary}</div>
                </div>
              )}
            </div>
          </aside>

          <div className="lg:col-span-8">
            <div className="paper-card overflow-hidden">
              <div className="h-[80vh]">
                {/^image\//.test(doc.mimeType || "") ? (
                  <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-contain" />
                ) : /^audio\//.test(doc.mimeType || "") ? (
                  <div className="p-8">
                    <audio controls src={doc.fileUrl} className="w-full" />
                  </div>
                ) : /^video\//.test(doc.mimeType || "") ? (
                  <video controls src={doc.fileUrl} className="w-full h-full" />
                ) : (
                  <object data={doc.fileUrl} type={doc.mimeType || "application/pdf"} className="w-full h-full">
                    <iframe src={doc.fileUrl} title={doc.title} className="w-full h-full border-0" />
                  </object>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

/* ============= Timeline tab ============= */
function TimelineTab() {
  const list = trpc.timeline.adminList.useQuery();
  const create = trpc.timeline.adminCreate.useMutation({ onSuccess: () => list.refetch() });
  const update = trpc.timeline.adminUpdate.useMutation({ onSuccess: () => list.refetch() });
  const del = trpc.timeline.adminDelete.useMutation({ onSuccess: () => list.refetch() });

  const [draft, setDraft] = useState({
    eventDate: "",
    title: "",
    summary: "",
    caseNumber: "",
    category: "state_case",
    status: "needs_review",
    publicStatus: false,
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title || !draft.eventDate) {
      toast.error("Date and title required");
      return;
    }
    await create.mutateAsync({
      eventDate: draft.eventDate,
      title: draft.title,
      summary: draft.summary,
      caseNumber: draft.caseNumber,
      category: draft.category as any,
      status: draft.status as any,
      publicStatus: draft.publicStatus,
    });
    setDraft({
      eventDate: "",
      title: "",
      summary: "",
      caseNumber: "",
      category: "state_case",
      status: "needs_review",
      publicStatus: false,
    });
    toast.success("Event added");
  };

  return (
    <div className="mt-6 grid lg:grid-cols-12 gap-6">
      <form onSubmit={add} className="lg:col-span-5 paper-card p-6 space-y-3">
        <h3 className="display-serif text-xl rule-amber">Add timeline event</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Date *</Label>
            <Input
              type="date"
              value={draft.eventDate}
              onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })}
            />
          </div>
          <div>
            <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Case number</Label>
            <Input
              value={draft.caseNumber}
              onChange={(e) => setDraft({ ...draft, caseNumber: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Title *</Label>
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div>
          <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Summary</Label>
          <Textarea
            rows={3}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Category</Label>
            <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[
                  "state_case",
                  "federal_case",
                  "custody",
                  "motion",
                  "warrant",
                  "competency",
                  "public_records",
                  "communications",
                  "election_accountability",
                  "other",
                ].map((c) => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="eyebrow !text-[0.62rem] mb-1.5 block">Status</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">confirmed</SelectItem>
                <SelectItem value="alleged">alleged</SelectItem>
                <SelectItem value="needs_review">needs review</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center justify-between paper-card !p-3 cursor-pointer">
          <span className="text-sm">Make public on save</span>
          <Switch
            checked={draft.publicStatus}
            onCheckedChange={(v) => setDraft({ ...draft, publicStatus: v })}
          />
        </label>
        <Button type="submit" className="bg-foreground text-background">
          Add event
        </Button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        {(list.data ?? []).map((ev) => (
          <article key={ev.id} className="paper-card p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {new Date(ev.eventDate).toLocaleDateString()}
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
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {ev.publicStatus ? "public" : "private"}
              </Badge>
            </div>
            <h4 className="mt-1.5 font-semibold">{ev.title}</h4>
            {ev.summary && <p className="text-sm text-muted-foreground mt-1">{ev.summary}</p>}
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await update.mutateAsync({
                    id: ev.id,
                    patch: { publicStatus: !ev.publicStatus },
                  });
                }}
              >
                {ev.publicStatus ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await update.mutateAsync({
                    id: ev.id,
                    patch: { status: ev.status === "confirmed" ? "alleged" : "confirmed" },
                  });
                }}
              >
                Toggle status
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (confirm("Delete this event?")) await del.mutateAsync({ id: ev.id });
                }}
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="paper-card p-10 text-center text-muted-foreground">
            No timeline events yet.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============= Actors tab ============= */
function ActorsTab() {
  const list = trpc.actor.adminList.useQuery();
  const create = trpc.actor.adminCreate.useMutation({ onSuccess: () => list.refetch() });
  const update = trpc.actor.adminUpdate.useMutation({ onSuccess: () => list.refetch() });
  const del = trpc.actor.adminDelete.useMutation({ onSuccess: () => list.refetch() });

  const [draft, setDraft] = useState({
    name: "",
    role: "",
    agency: "",
    bio: "",
    notes: "",
    status: "documented" as "documented" | "alleged" | "needs_review",
    publicStatus: true,
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name) return toast.error("Name required");
    await create.mutateAsync(draft);
    setDraft({ name: "", role: "", agency: "", bio: "", notes: "", status: "documented", publicStatus: true });
    toast.success("Actor added");
  };

  return (
    <div className="mt-6 grid lg:grid-cols-12 gap-6">
      <form onSubmit={add} className="lg:col-span-5 paper-card p-6 space-y-3">
        <h3 className="display-serif text-xl rule-amber">Add actor</h3>
        <Field label="Name *">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Role">
          <Input
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            placeholder="District Court Judge, Public Defender, …"
          />
        </Field>
        <Field label="Agency">
          <Input value={draft.agency} onChange={(e) => setDraft({ ...draft, agency: e.target.value })} />
        </Field>
        <Field label="Bio">
          <Textarea rows={3} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
        </Field>
        <Field label="Conduct on record (notes)">
          <Textarea rows={4} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="documented">documented</SelectItem>
                <SelectItem value="alleged">alleged</SelectItem>
                <SelectItem value="needs_review">needs review</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center justify-between paper-card !p-3 cursor-pointer self-end">
            <span className="text-sm">Public</span>
            <Switch
              checked={draft.publicStatus}
              onCheckedChange={(v) => setDraft({ ...draft, publicStatus: v })}
            />
          </label>
        </div>
        <Button type="submit" className="bg-foreground text-background">Add actor</Button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        {(list.data ?? []).map((a) => (
          <article key={a.id} className="paper-card p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {a.role || "—"}
              </span>
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {a.status}
              </Badge>
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {a.publicStatus ? "public" : "private"}
              </Badge>
            </div>
            <div className="display-serif text-lg mt-1">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.agency}</div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await update.mutateAsync({
                    id: a.id,
                    patch: { publicStatus: !a.publicStatus },
                  });
                }}
              >
                {a.publicStatus ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (confirm("Delete this actor?")) await del.mutateAsync({ id: a.id });
                }}
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="paper-card p-10 text-center text-muted-foreground">
            No actor profiles yet.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============= PRR tab ============= */
function PrrTab() {
  const list = trpc.prr.adminList.useQuery();
  const create = trpc.prr.adminCreate.useMutation({ onSuccess: () => list.refetch() });
  const update = trpc.prr.adminUpdate.useMutation({ onSuccess: () => list.refetch() });
  const del = trpc.prr.adminDelete.useMutation({ onSuccess: () => list.refetch() });
  const [draft, setDraft] = useState({
    title: "",
    agency: "",
    description: "",
    dateSent: "",
    deadline: "",
    status: "sent" as
      | "draft"
      | "sent"
      | "awaiting_response"
      | "overdue"
      | "partial_response"
      | "denied"
      | "produced"
      | "appealed"
      | "closed",
    publicStatus: true,
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title || !draft.agency) {
      toast.error("Title and agency required");
      return;
    }
    await create.mutateAsync({
      ...draft,
      dateSent: draft.dateSent || null,
      deadline: draft.deadline || null,
    });
    setDraft({
      title: "",
      agency: "",
      description: "",
      dateSent: "",
      deadline: "",
      status: "sent",
      publicStatus: true,
    });
    toast.success("Request added");
  };

  return (
    <div className="mt-6 grid lg:grid-cols-12 gap-6">
      <form onSubmit={add} className="lg:col-span-5 paper-card p-6 space-y-3">
        <h3 className="display-serif text-xl rule-amber">Add public records request</h3>
        <Field label="Title *">
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </Field>
        <Field label="Agency *">
          <Input value={draft.agency} onChange={(e) => setDraft({ ...draft, agency: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date sent">
            <Input
              type="date"
              value={draft.dateSent}
              onChange={(e) => setDraft({ ...draft, dateSent: e.target.value })}
            />
          </Field>
          <Field label="Deadline">
            <Input
              type="date"
              value={draft.deadline}
              onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[
                  "draft",
                  "sent",
                  "awaiting_response",
                  "overdue",
                  "partial_response",
                  "denied",
                  "produced",
                  "appealed",
                  "closed",
                ].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-center justify-between paper-card !p-3 cursor-pointer self-end">
            <span className="text-sm">Public</span>
            <Switch
              checked={draft.publicStatus}
              onCheckedChange={(v) => setDraft({ ...draft, publicStatus: v })}
            />
          </label>
        </div>
        <Button type="submit" className="bg-foreground text-background">Add request</Button>
      </form>

      <div className="lg:col-span-7 space-y-3">
        {(list.data ?? []).map((r) => (
          <article key={r.id} className="paper-card p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {r.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" className="font-mono uppercase text-[10px]">
                {r.publicStatus ? "public" : "private"}
              </Badge>
              <span className="text-xs text-muted-foreground">{r.agency}</span>
            </div>
            <div className="display-serif text-lg mt-1">{r.title}</div>
            <div className="text-xs text-muted-foreground">
              Sent: {r.dateSent ? new Date(r.dateSent).toLocaleDateString() : "—"} · Deadline:{" "}
              {r.deadline ? new Date(r.deadline).toLocaleDateString() : "—"}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await update.mutateAsync({
                    id: r.id,
                    patch: { publicStatus: !r.publicStatus },
                  });
                }}
              >
                {r.publicStatus ? "Unpublish" : "Publish"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (confirm("Delete this request?")) await del.mutateAsync({ id: r.id });
                }}
              >
                Delete
              </Button>
            </div>
          </article>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="paper-card p-10 text-center text-muted-foreground">
            No public records requests logged.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="eyebrow !text-[0.62rem] mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-l-2 border-[var(--amber)] pl-3">
      <div className="eyebrow !text-[0.62rem]">{label}</div>
      <div className="text-sm mt-0.5 font-medium">{value}</div>
    </div>
  );
}


/* ===================== Audit Log Tab ===================== */

const AUDIT_ACTIONS = [
  "all",
  "story_submitted",
  "story_approved",
  "story_rejected",
  "story_changes_requested",
  "document_uploaded",
  "document_ingested",
  "document_approved",
  "document_rejected",
  "visibility_changed",
  "ai_policy_changed",
  "admin_role_changed",
  "upload_rejected",
  "rate_limit_triggered",
] as const;

const AUDIT_TARGET_TYPES = ["all", "story", "document", "user", "ingest_job"] as const;

function toCsv(rows: any[]): string {
  if (rows.length === 0) return "";
  const cols = ["id", "createdAt", "actorUserId", "actorRole", "action", "targetType", "targetId", "metadata", "ipHash"];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c])).join(","));
  return lines.join("\n");
}

function AuditTab() {
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [actorUserId, setActorUserId] = useState<string>("");
  const [action, setAction] = useState<string>("all");
  const [targetType, setTargetType] = useState<string>("all");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [open, setOpen] = useState<null | any>(null);

  const filterArgs = useMemo(
    () => ({
      actorUserId: actorUserId ? Number(actorUserId) : undefined,
      action,
      targetType,
      q: q.trim() || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [actorUserId, action, targetType, q, dateFrom, dateTo, page, pageSize],
  );

  const { data, isLoading, refetch } = trpc.audit.list.useQuery(filterArgs);
  const trpcUtils = trpc.useUtils();

  async function downloadCsv() {
    const rows = await trpcUtils.audit.exportCsv.fetch({
      actorUserId: filterArgs.actorUserId,
      action: filterArgs.action,
      targetType: filterArgs.targetType,
      q: filterArgs.q,
      dateFrom: filterArgs.dateFrom,
      dateTo: filterArgs.dateTo,
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reno-record-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Search</Label>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="action / metadata / target type" />
        </div>
        <div>
          <Label>Action</Label>
          <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDIT_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Target</Label>
          <Select value={targetType} onValueChange={(v) => { setTargetType(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDIT_TARGET_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Actor user ID</Label>
          <Input value={actorUserId} onChange={(e) => { setActorUserId(e.target.value.replace(/\D/g, "")); setPage(0); }} placeholder="" />
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${total.toLocaleString()} events`}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
          <Button onClick={downloadCsv}>Export CSV</Button>
        </div>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-left p-3">Actor</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Metadata</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 whitespace-nowrap font-mono text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-3 whitespace-nowrap">{r.actorUserId ?? "—"} <Badge variant="outline" className="ml-1">{r.actorRole ?? "—"}</Badge></td>
                <td className="p-3 whitespace-nowrap"><Badge>{r.action}</Badge></td>
                <td className="p-3 whitespace-nowrap">{r.targetType ?? "—"} #{r.targetId ?? "—"}</td>
                <td className="p-3 max-w-[300px] truncate text-xs text-muted-foreground">
                  {r.metadata ? JSON.stringify(r.metadata).slice(0, 120) : "—"}
                </td>
                <td className="p-3"><Button variant="ghost" size="sm" onClick={() => setOpen(r)}>Detail</Button></td>
              </tr>
            ))}
            {rows.length === 0 && !isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No events match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <div className="flex items-center justify-between">
        <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
        <div className="text-sm text-muted-foreground">Page {page + 1} of {pages}</div>
        <Button variant="outline" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit event #{open?.id}</DialogTitle>
            <DialogDescription>{open?.createdAt && new Date(open.createdAt).toLocaleString()}</DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Actor</Label><div>{open.actorUserId ?? "—"} ({open.actorRole ?? "—"})</div></div>
                <div><Label>Action</Label><div>{open.action}</div></div>
                <div><Label>Target</Label><div>{open.targetType} #{open.targetId}</div></div>
                <div><Label>IP hash</Label><div className="font-mono text-xs break-all">{open.ipHash ?? "—"}</div></div>
              </div>
              {open.metadata && (
                <div>
                  <Label>Metadata</Label>
                  {open.metadata.from !== undefined && open.metadata.to !== undefined ? (
                    <div className="rounded border p-3 space-y-1 bg-muted/30">
                      <div><span className="text-muted-foreground">From:</span> <span className="font-mono">{JSON.stringify(open.metadata.from)}</span></div>
                      <div><span className="text-muted-foreground">To:</span> <span className="font-mono">{JSON.stringify(open.metadata.to)}</span></div>
                    </div>
                  ) : null}
                  <pre className="mt-2 text-xs bg-muted/40 rounded p-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(open.metadata, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===================== Users Tab ===================== */

function UsersTab() {
  const { user: me } = useAuth();
  const { data, isLoading, refetch } = trpc.user.adminListWithCounts.useQuery();
  const setRole = trpc.user.setRole.useMutation({
    onSuccess: () => { toast.success("Role updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [confirm, setConfirm] = useState<null | { userId: number; name: string; role: "user" | "admin" }>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Loading..." : `${data?.length ?? 0} users`}
        </div>
        <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Submissions</th>
              <th className="text-left p-3">Uploads</th>
              <th className="text-left p-3">Last sign-in</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u: any) => {
              const isMe = me?.id === u.id;
              return (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 whitespace-nowrap">{u.name ?? "—"} <span className="text-muted-foreground text-xs">#{u.id}</span></td>
                  <td className="p-3">{u.email ?? "—"}</td>
                  <td className="p-3"><Badge variant={u.role === "admin" ? "default" : "outline"}>{u.role}</Badge></td>
                  <td className="p-3">{u.submissionCount}</td>
                  <td className="p-3">{u.uploadCount}</td>
                  <td className="p-3 text-xs text-muted-foreground">{u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString() : "—"}</td>
                  <td className="p-3 text-right">
                    {u.role === "admin" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isMe || setRole.isPending}
                        title={isMe ? "Cannot demote yourself (lockout protection)" : ""}
                        onClick={() => setConfirm({ userId: u.id, name: u.name ?? u.email ?? `#${u.id}`, role: "user" })}
                      >
                        Demote to user
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={setRole.isPending}
                        onClick={() => setConfirm({ userId: u.id, name: u.name ?? u.email ?? `#${u.id}`, role: "admin" })}
                      >
                        Promote to admin
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted-foreground">
        Lockout protection: you cannot remove your own admin role. Every role change is written to the audit log.
      </p>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm role change</DialogTitle>
            <DialogDescription>
              {confirm && `Set ${confirm.name} to "${confirm.role}". This is audited.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!confirm) return;
                await setRole.mutateAsync({ userId: confirm.userId, role: confirm.role });
                setConfirm(null);
              }}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
