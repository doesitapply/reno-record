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
            <TabsTrigger value="stories">Stories</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="actors">Actors</TabsTrigger>
            <TabsTrigger value="prr">Public records</TabsTrigger>
          </TabsList>
          <TabsContent value="stories"><StoriesTab /></TabsContent>
          <TabsContent value="documents"><DocumentsTab /></TabsContent>
          <TabsContent value="timeline"><TimelineTab /></TabsContent>
          <TabsContent value="actors"><ActorsTab /></TabsContent>
          <TabsContent value="prr"><PrrTab /></TabsContent>
        </Tabs>
      </section>
    </SiteShell>
  );
}

/* ============= Stories ============= */
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
  const list = trpc.document.adminList.useQuery();
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

  return (
    <div className="mt-6 grid lg:grid-cols-12 gap-6">
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
        {(list.data ?? []).map((d) => (
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
