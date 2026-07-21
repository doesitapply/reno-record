import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Calendar,
  Users,
  ClipboardList,
  Check,
  X,
  Cpu,
  FolderGit2,
  Star,
  KeyRound,
  Copy,
  ShieldAlert,
  AlertCircle,
  CalendarCheck,
  FileSearch,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import SiteShell from "@/components/SiteShell";
import { getLoginUrl } from "@/const";

const TIMELINE_CATEGORIES = [
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
] as const;

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

const PRR_STATUSES = [
  "draft",
  "sent",
  "awaiting_response",
  "overdue",
  "partial_response",
  "denied",
  "produced",
  "appealed",
  "closed",
] as const;

export default function AdminManagePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  if (loading) {
    return (
      <SiteShell>
        <div className="container py-20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SiteShell>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <SiteShell>
        <div className="container py-20 max-w-md mx-auto text-center">
          <h1 className="display-serif text-3xl">Admin access required</h1>
          <p className="text-muted-foreground mt-3">
            You must be signed in as an administrator to access this page.
          </p>
          <Button className="mt-6" asChild>
            <a href={getLoginUrl()}>Sign in</a>
          </Button>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container py-10">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin">
            <Button variant="ghost" className="gap-2 -ml-3">
              <ArrowLeft className="h-4 w-4" /> Admin panel
            </Button>
          </Link>
          <div>
            <h1 className="display-serif text-3xl">Content Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create, edit, and delete timeline events, actors, and public records requests.
            </p>
          </div>
        </div>

        <Tabs defaultValue="timeline">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="timeline" className="gap-2">
              <Calendar className="h-3.5 w-3.5" /> Timeline Events
            </TabsTrigger>
            <TabsTrigger value="actors" className="gap-2">
              <Users className="h-3.5 w-3.5" /> Actors
            </TabsTrigger>
            <TabsTrigger value="prrs" className="gap-2">
              <ClipboardList className="h-3.5 w-3.5" /> Public Records
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <Star className="h-3.5 w-3.5" /> Operator Profile
            </TabsTrigger>
            <TabsTrigger value="buildlog" className="gap-2">
              <Cpu className="h-3.5 w-3.5" /> Build Log
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderGit2 className="h-3.5 w-3.5" /> Projects
            </TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-2">
              <KeyRound className="h-3.5 w-3.5" /> API Keys
            </TabsTrigger>
            <TabsTrigger value="reviewqueue" className="gap-2 text-primary">
              <AlertCircle className="h-3.5 w-3.5" /> Review Queue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <TimelineTab />
          </TabsContent>
          <TabsContent value="actors">
            <ActorsTab />
          </TabsContent>
          <TabsContent value="prrs">
            <PRRsTab />
          </TabsContent>
          <TabsContent value="profile">
            <OperatorProfileTab />
          </TabsContent>
          <TabsContent value="buildlog">
            <BuildLogTab />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectsTab />
          </TabsContent>
          <TabsContent value="apikeys">
            <ApiKeysTab />
          </TabsContent>
          <TabsContent value="reviewqueue">
            <ReviewQueueTab />
          </TabsContent>
        </Tabs>
      </div>
    </SiteShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TIMELINE TAB
───────────────────────────────────────────────────────────────────────── */
function TimelineTab() {
  const utils = trpc.useUtils();
  const { data: events, isLoading } = trpc.timeline.adminList.useQuery();
  const createMut = trpc.timeline.adminCreate.useMutation({
    onSuccess: () => {
      utils.timeline.adminList.invalidate();
      utils.timeline.listPublic.invalidate();
      toast.success("Event created");
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.timeline.adminUpdate.useMutation({
    onSuccess: () => {
      utils.timeline.adminList.invalidate();
      utils.timeline.listPublic.invalidate();
      toast.success("Event updated");
      setEditTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.timeline.adminDelete.useMutation({
    onSuccess: () => {
      utils.timeline.adminList.invalidate();
      utils.timeline.listPublic.invalidate();
      toast.success("Event deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  type TimelineEvent = NonNullable<typeof events>[number];
  const [editTarget, setEditTarget] = useState<TimelineEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const emptyForm = {
    title: "",
    eventDate: "",
    summary: "",
    caseNumber: "",
    category: "other" as (typeof TIMELINE_CATEGORIES)[number],
    actors: "",
    issueTags: "",
    status: "needs_review" as "confirmed" | "alleged" | "needs_review",
    publicStatus: false,
  };
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setForm(emptyForm);
    setShowCreate(true);
  }

  function openEdit(ev: NonNullable<typeof events>[0]) {
    setForm({
      title: ev.title,
      eventDate: ev.eventDate ? new Date(ev.eventDate).toISOString().split("T")[0] : "",
      summary: ev.summary ?? "",
      caseNumber: ev.caseNumber ?? "",
      category: (ev.category as (typeof TIMELINE_CATEGORIES)[number]) ?? "other",
      actors: Array.isArray(ev.actors) ? ev.actors.join(", ") : "",
      issueTags: Array.isArray(ev.issueTags) ? ev.issueTags.join(", ") : "",
      status: (ev.status as "confirmed" | "alleged" | "needs_review") ?? "needs_review",
      publicStatus: ev.publicStatus ?? false,
    });
    setEditTarget(ev);
  }

  function parseTagList(s: string) {
    return s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function handleCreate() {
    createMut.mutate({
      title: form.title,
      eventDate: form.eventDate,
      summary: form.summary || undefined,
      caseNumber: form.caseNumber || undefined,
      category: form.category,
      actors: parseTagList(form.actors),
      issueTags: parseTagList(form.issueTags),
      status: form.status,
      publicStatus: form.publicStatus,
    });
  }

  function handleUpdate() {
    if (!editTarget) return;
    updateMut.mutate({
      id: editTarget.id,
      patch: {
        title: form.title,
        eventDate: form.eventDate,
        summary: form.summary || undefined,
        caseNumber: form.caseNumber || undefined,
        category: form.category,
        actors: parseTagList(form.actors),
        issueTags: parseTagList(form.issueTags),
        status: form.status,
        publicStatus: form.publicStatus,
      },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="display-serif text-xl">
          Timeline Events{" "}
          <span className="text-muted-foreground font-normal text-base">
            ({events?.length ?? 0})
          </span>
        </h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New event
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <div className="space-y-2">
        {(events ?? []).map((ev) => (
          <div key={ev.id} className="paper-card p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(ev.eventDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <Badge variant="outline" className="font-mono uppercase text-[9px]">
                  {CATEGORY_LABELS[ev.category] ?? ev.category}
                </Badge>
                <Badge
                  variant="outline"
                  className={`font-mono uppercase text-[9px] ${ev.publicStatus ? "border-green-500 text-green-700" : "border-muted-foreground/30 text-muted-foreground"}`}
                >
                  {ev.publicStatus ? "Public" : "Draft"}
                </Badge>
              </div>
              <div className="font-medium mt-1 text-sm">{ev.title}</div>
              {Array.isArray(ev.actors) && ev.actors.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Actors: {(ev.actors as string[]).join(", ")}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => openEdit(ev)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(ev.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={showCreate || !!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="display-serif text-xl">
              {editTarget ? "Edit event" : "New timeline event"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. December 5 Faretta / Competency Hearing"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Event date *</Label>
              <Input
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    category: v as (typeof TIMELINE_CATEGORIES)[number],
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Summary</Label>
              <Textarea
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Brief editorial summary of what happened"
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Case number</Label>
              <Input
                value={form.caseNumber}
                onChange={(e) => setForm((f) => ({ ...f, caseNumber: e.target.value }))}
                placeholder="e.g. CR22-1234"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Actors (comma-separated names)</Label>
              <Input
                value={form.actors}
                onChange={(e) => setForm((f) => ({ ...f, actors: e.target.value }))}
                placeholder="Barry Breslow, John Smith"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Issue tags (comma-separated)</Label>
              <Input
                value={form.issueTags}
                onChange={(e) => setForm((f) => ({ ...f, issueTags: e.target.value }))}
                placeholder="due_process, pretrial_detention, competency"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Verification status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    status: v as "confirmed" | "alleged" | "needs_review",
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="alleged">Alleged</SelectItem>
                  <SelectItem value="needs_review">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="ev-public"
                checked={form.publicStatus}
                onCheckedChange={(v) => setForm((f) => ({ ...f, publicStatus: v }))}
              />
              <Label htmlFor="ev-public">Publish publicly</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editTarget ? handleUpdate : handleCreate}
              disabled={!form.title || !form.eventDate || createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editTarget ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The timeline event will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMut.mutate({ id: deleteTarget })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ACTORS TAB
───────────────────────────────────────────────────────────────────────── */
function ActorsTab() {
  const utils = trpc.useUtils();
  const { data: actorList, isLoading } = trpc.actor.adminList.useQuery();
  const createMut = trpc.actor.adminCreate.useMutation({
    onSuccess: () => {
      utils.actor.adminList.invalidate();
      utils.actor.listPublic.invalidate();
      toast.success("Actor created");
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.actor.adminUpdate.useMutation({
    onSuccess: () => {
      utils.actor.adminList.invalidate();
      utils.actor.listPublic.invalidate();
      toast.success("Actor updated");
      setEditTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.actor.adminDelete.useMutation({
    onSuccess: () => {
      utils.actor.adminList.invalidate();
      utils.actor.listPublic.invalidate();
      toast.success("Actor deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<NonNullable<typeof actorList>[0] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const emptyForm = {
    name: "",
    slug: "",
    role: "",
    agency: "",
    bio: "",
    notes: "",
    status: "documented" as "documented" | "alleged" | "needs_review",
    judicialActor: false,
    publicStatus: true,
  };
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setForm(emptyForm);
    setShowCreate(true);
  }

  function openEdit(a: NonNullable<typeof actorList>[0]) {
    setForm({
      name: a.name,
      slug: a.slug,
      role: a.role ?? "",
      agency: a.agency ?? "",
      bio: a.bio ?? "",
      notes: a.notes ?? "",
      status: (a.status as "documented" | "alleged" | "needs_review") ?? "documented",
      judicialActor: a.judicialActor ?? false,
      publicStatus: a.publicStatus ?? true,
    });
    setEditTarget(a);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="display-serif text-xl">
          Actors{" "}
          <span className="text-muted-foreground font-normal text-base">
            ({actorList?.length ?? 0})
          </span>
        </h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New actor
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <div className="space-y-2">
        {(actorList ?? []).map((a) => (
          <div key={a.id} className="paper-card p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{a.name}</span>
                {a.judicialActor && (
                  <Badge className="bg-amber-500/20 text-amber-700 border-primary/30 font-mono uppercase text-[9px]">
                    Judicial
                  </Badge>
                )}
                <Badge variant="outline" className="font-mono uppercase text-[9px]">
                  {a.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={`font-mono uppercase text-[9px] ${a.publicStatus ? "border-green-500 text-green-700" : "border-muted-foreground/30 text-muted-foreground"}`}
                >
                  {a.publicStatus ? "Public" : "Hidden"}
                </Badge>
              </div>
              {a.role && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {a.role}
                  {a.agency ? ` · ${a.agency}` : ""}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => openEdit(a)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(a.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={showCreate || !!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="display-serif text-xl">
              {editTarget ? "Edit actor" : "New actor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Full name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Barry Breslow"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Slug (auto-generated if blank)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="barry-breslow"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role / title</Label>
              <Input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Defense Attorney"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Agency / institution</Label>
              <Input
                value={form.agency}
                onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))}
                placeholder="e.g. Washoe County Public Defender"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Background and context"
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Conduct on record / notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Documented conduct, contradictions, on-record failures"
                rows={4}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Verification status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    status: v as "documented" | "alleged" | "needs_review",
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="documented">Documented</SelectItem>
                  <SelectItem value="alleged">Alleged</SelectItem>
                  <SelectItem value="needs_review">Needs review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="actor-judicial"
                checked={form.judicialActor}
                onCheckedChange={(v) => setForm((f) => ({ ...f, judicialActor: v }))}
              />
              <Label htmlFor="actor-judicial">Judicial actor (judge, magistrate, etc.)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="actor-public"
                checked={form.publicStatus}
                onCheckedChange={(v) => setForm((f) => ({ ...f, publicStatus: v }))}
              />
              <Label htmlFor="actor-public">Publish publicly</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editTarget) {
                  updateMut.mutate({
                    id: editTarget.id,
                    patch: {
                      name: form.name,
                      role: form.role || undefined,
                      agency: form.agency || undefined,
                      bio: form.bio || undefined,
                      notes: form.notes || undefined,
                      status: form.status,
                      publicStatus: form.publicStatus,
                    },
                  });
                } else {
                  createMut.mutate({
                    name: form.name,
                    slug: form.slug || undefined,
                    role: form.role || undefined,
                    agency: form.agency || undefined,
                    bio: form.bio || undefined,
                    notes: form.notes || undefined,
                    status: form.status,
                    publicStatus: form.publicStatus,
                  });
                }
              }}
              disabled={!form.name || createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editTarget ? "Save changes" : "Create actor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this actor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the actor profile. Timeline events and documents that
              reference this actor by name will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMut.mutate({ id: deleteTarget })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PRRs TAB
───────────────────────────────────────────────────────────────────────── */
function PRRsTab() {
  const utils = trpc.useUtils();
  const { data: prrs, isLoading } = trpc.prr.adminList.useQuery();
  const createMut = trpc.prr.adminCreate.useMutation({
    onSuccess: () => {
      utils.prr.adminList.invalidate();
      utils.prr.listPublic.invalidate();
      toast.success("PRR created");
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.prr.adminUpdate.useMutation({
    onSuccess: () => {
      utils.prr.adminList.invalidate();
      utils.prr.listPublic.invalidate();
      toast.success("PRR updated");
      setEditTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.prr.adminDelete.useMutation({
    onSuccess: () => {
      utils.prr.adminList.invalidate();
      utils.prr.listPublic.invalidate();
      toast.success("PRR deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<NonNullable<typeof prrs>[0] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const emptyForm = {
    title: "",
    agency: "",
    description: "",
    dateSent: "",
    deadline: "",
    status: "sent" as (typeof PRR_STATUSES)[number],
    responseSummary: "",
    legalBasisForDenial: "",
    statusHistory: "",
    publicStatus: true,
  };
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setForm(emptyForm);
    setShowCreate(true);
  }

  function openEdit(p: NonNullable<typeof prrs>[0]) {
    setForm({
      title: p.title,
      agency: p.agency,
      description: p.description ?? "",
      dateSent: p.dateSent ? new Date(p.dateSent).toISOString().split("T")[0] : "",
      deadline: p.deadline ? new Date(p.deadline).toISOString().split("T")[0] : "",
      status: (p.status as (typeof PRR_STATUSES)[number]) ?? "sent",
      responseSummary: p.responseSummary ?? "",
      legalBasisForDenial: p.legalBasisForDenial ?? "",
      statusHistory: formatPrrStatusHistory(p.statusHistory),
      publicStatus: p.publicStatus ?? true,
    });
    setEditTarget(p);
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "text-muted-foreground border-muted-foreground/30",
    sent: "text-blue-700 border-blue-500/40",
    awaiting_response: "text-amber-700 border-primary/40",
    overdue: "text-red-700 border-red-500/40",
    partial_response: "text-amber-600 border-amber-400/40",
    denied: "text-red-700 border-red-500/40",
    produced: "text-green-700 border-green-500/40",
    appealed: "text-purple-700 border-purple-500/40",
    closed: "text-muted-foreground border-muted-foreground/30",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="display-serif text-xl">
          Public Records Requests{" "}
          <span className="text-muted-foreground font-normal text-base">
            ({prrs?.length ?? 0})
          </span>
        </h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New PRR
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-10">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <div className="space-y-2">
        {(prrs ?? []).map((p) => (
          <div key={p.id} className="paper-card p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`font-mono uppercase text-[9px] ${STATUS_COLORS[p.status] ?? ""}`}
                >
                  {p.status.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-muted-foreground">{p.agency}</span>
                <Badge
                  variant="outline"
                  className={`font-mono uppercase text-[9px] ${p.publicStatus ? "border-green-500 text-green-700" : "border-muted-foreground/30 text-muted-foreground"}`}
                >
                  {p.publicStatus ? "Public" : "Hidden"}
                </Badge>
              </div>
              <div className="font-medium mt-1 text-sm">{p.title}</div>
              {p.dateSent && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Sent: {new Date(p.dateSent).toLocaleDateString()}
                  {p.deadline && ` · Deadline: ${new Date(p.deadline).toLocaleDateString()}`}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => openEdit(p)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={showCreate || !!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setEditTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="display-serif text-xl">
              {editTarget ? "Edit PRR" : "New public records request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Request for December 5 Hearing Transcript"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Agency *</Label>
              <Input
                value={form.agency}
                onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))}
                placeholder="e.g. Washoe County District Court"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What records are being requested and why"
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Date sent</Label>
                <Input
                  type="date"
                  value={form.dateSent}
                  onChange={(e) => setForm((f) => ({ ...f, dateSent: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Response deadline</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as (typeof PRR_STATUSES)[number] }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRR_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Response summary</Label>
              <Textarea
                value={form.responseSummary}
                onChange={(e) => setForm((f) => ({ ...f, responseSummary: e.target.value }))}
                placeholder="Summary of agency response, if received"
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Legal basis for denial (if denied)</Label>
              <Input
                value={form.legalBasisForDenial}
                onChange={(e) => setForm((f) => ({ ...f, legalBasisForDenial: e.target.value }))}
                placeholder="e.g. NRS 239.010 exemption claimed"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Status history</Label>
              <Textarea
                value={form.statusHistory}
                onChange={(e) => setForm((f) => ({ ...f, statusHistory: e.target.value }))}
                placeholder="YYYY-MM-DD | sent | Request delivered\nYYYY-MM-DD | overdue | Deadline passed without production"
                rows={4}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                One public timeline entry per line: date, status, and optional note separated by pipes.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="prr-public"
                checked={form.publicStatus}
                onCheckedChange={(v) => setForm((f) => ({ ...f, publicStatus: v }))}
              />
              <Label htmlFor="prr-public">Publish publicly</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                setEditTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editTarget) {
                  updateMut.mutate({
                    id: editTarget.id,
                    patch: {
                      title: form.title,
                      agency: form.agency,
                      description: form.description || undefined,
                      dateSent: form.dateSent ? new Date(form.dateSent) : undefined,
                      deadline: form.deadline ? new Date(form.deadline) : undefined,
                      status: form.status,
                      responseSummary: form.responseSummary || undefined,
                      legalBasisForDenial: form.legalBasisForDenial || undefined,
                      statusHistory: parsePrrStatusHistory(form.statusHistory),
                      publicStatus: form.publicStatus,
                    },
                  });
                } else {
                  createMut.mutate({
                    title: form.title,
                    agency: form.agency,
                    description: form.description || undefined,
                    dateSent: form.dateSent ? new Date(form.dateSent) : undefined,
                    deadline: form.deadline ? new Date(form.deadline) : undefined,
                    status: form.status,
                    responseSummary: form.responseSummary || undefined,
                    legalBasisForDenial: form.legalBasisForDenial || undefined,
                    statusHistory: parsePrrStatusHistory(form.statusHistory),
                    publicStatus: form.publicStatus,
                  });
                }
              }}
              disabled={!form.title || !form.agency || createMut.isPending || updateMut.isPending}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editTarget ? "Save changes" : "Create PRR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this PRR?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the public records request from the tracker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget !== null && deleteMut.mutate({ id: deleteTarget })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatPrrStatusHistory(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const row = entry as { date?: unknown; status?: unknown; note?: unknown };
      const date = typeof row.date === "string" ? row.date : "";
      const status = typeof row.status === "string" ? row.status : "sent";
      const note = typeof row.note === "string" ? row.note : "";
      return [date, status, note].filter((part, index) => index < 2 || part).join(" | ");
    })
    .filter(Boolean)
    .join("\n");
}

function parsePrrStatusHistory(value: string) {
  const entries = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [dateRaw, statusRaw, ...noteParts] = line.split("|").map((part) => part.trim());
      const status = PRR_STATUSES.includes(statusRaw as (typeof PRR_STATUSES)[number])
        ? (statusRaw as (typeof PRR_STATUSES)[number])
        : "sent";
      return {
        date: dateRaw || undefined,
        status,
        note: noteParts.join(" | ") || undefined,
      };
    });
  return entries.length > 0 ? entries : undefined;
}


/* ============================================================
   Operator platform admin tabs (v7.0 Artificially Educated)
   ============================================================ */

const BUILD_LOG_CATEGORIES = [
  "ai_automation",
  "ai_agents",
  "systems_architecture",
  "legal_tech",
  "data_pipeline",
  "web_platform",
  "infrastructure",
  "other",
] as const;

const BUILD_LOG_CAT_LABELS: Record<string, string> = {
  ai_automation: "AI Automation",
  ai_agents: "AI Agents",
  systems_architecture: "Systems Architecture",
  legal_tech: "Legal Tech",
  data_pipeline: "Data Pipeline",
  web_platform: "Web Platform",
  infrastructure: "Infrastructure",
  other: "Other",
};

const PROJECT_STATUSES = ["live", "in_development", "beta", "concept", "archived"] as const;
const PROJECT_STATUS_LABELS: Record<string, string> = {
  live: "Live",
  in_development: "In Development",
  beta: "Beta",
  concept: "Concept",
  archived: "Archived",
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{children}</Label>;
}

/* ---- Operator Profile ---- */
function OperatorProfileTab() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.operator.adminProfile.useQuery();
  const [form, setForm] = useState({
    brand: "",
    fullName: "",
    roleTitle: "",
    tagline: "",
    thesis: "",
    bioMarkdown: "",
    location: "",
    linksText: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (profile && !loaded) {
      const links = ((profile.links as { label: string; url: string; icon?: string }[] | null) ?? [])
        .map((l) => `${l.label} | ${l.url}${l.icon ? ` | ${l.icon}` : ""}`)
        .join("\n");
      setForm({
        brand: profile.brand ?? "",
        fullName: profile.fullName ?? "",
        roleTitle: profile.roleTitle ?? "",
        tagline: profile.tagline ?? "",
        thesis: profile.thesis ?? "",
        bioMarkdown: profile.bioMarkdown ?? "",
        location: profile.location ?? "",
        linksText: links,
      });
      setLoaded(true);
    }
  }, [profile, loaded]);

  const saveMut = trpc.operator.updateProfile.useMutation({
    onSuccess: () => {
      utils.operator.adminProfile.invalidate();
      utils.operator.profile.invalidate();
      toast.success("Profile saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSave = () => {
    const links = form.linksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, url, icon] = l.split("|").map((p) => p.trim());
        return { label: label || url, url: url || "", icon: icon || undefined };
      })
      .filter((l) => l.url);
    saveMut.mutate({
      brand: form.brand,
      fullName: form.fullName,
      roleTitle: form.roleTitle || null,
      tagline: form.tagline || null,
      thesis: form.thesis || null,
      bioMarkdown: form.bioMarkdown || null,
      location: form.location || null,
      links,
    });
  };

  if (isLoading) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-muted-foreground">
        This drives the <Link href="/operator" className="text-primary hover:underline">/operator</Link> page. Bio supports Markdown.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel>Brand (umbrella)</FieldLabel>
          <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Artificially Educated" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Full name</FieldLabel>
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Cameron Church" />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Role title</FieldLabel>
        <Input value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} placeholder="Systems Architect · Strategic Operator" />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Tagline (the hook)</FieldLabel>
        <Textarea value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} rows={2} placeholder="I build with gravity. Structural. Undeniable. It brings broken systems down." />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Thesis</FieldLabel>
        <Textarea value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} rows={3} />
      </div>
      <div className="space-y-1.5">
        <FieldLabel>Bio / origin story (Markdown)</FieldLabel>
        <Textarea value={form.bioMarkdown} onChange={(e) => setForm({ ...form, bioMarkdown: e.target.value })} rows={12} className="font-mono text-sm" placeholder="## How we got here&#10;&#10;Write your story here..." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <FieldLabel>Location</FieldLabel>
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Reno, Nevada" />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Links (one per line: Label | URL | icon)</FieldLabel>
          <Textarea value={form.linksText} onChange={(e) => setForm({ ...form, linksText: e.target.value })} rows={4} className="font-mono text-xs" placeholder="GitHub | https://github.com/you | github&#10;The Reno Record | /the-church-record | scale" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-2">
        {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save profile
      </Button>
    </div>
  );
}

/* ---- Build Log ---- */
type BuildLogForm = {
  id?: number;
  title: string;
  category: (typeof BUILD_LOG_CATEGORIES)[number];
  summary: string;
  outcome: string;
  featured: boolean;
  publicStatus: boolean;
  sortOrder: number;
};

const emptyBuildLog: BuildLogForm = {
  title: "", category: "other", summary: "", outcome: "", featured: false, publicStatus: true, sortOrder: 0,
};

function BuildLogTab() {
  const utils = trpc.useUtils();
  const { data: entries, isLoading } = trpc.operator.adminBuildLog.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BuildLogForm>(emptyBuildLog);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const refresh = () => { utils.operator.adminBuildLog.invalidate(); utils.operator.buildLog.invalidate(); };
  const createMut = trpc.operator.createBuildLog.useMutation({ onSuccess: () => { refresh(); toast.success("Capability added"); setOpen(false); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.operator.updateBuildLog.useMutation({ onSuccess: () => { refresh(); toast.success("Updated"); setOpen(false); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.operator.deleteBuildLog.useMutation({ onSuccess: () => { refresh(); toast.success("Deleted"); setDeleteId(null); }, onError: (e) => toast.error(e.message) });

  const openNew = () => { setForm(emptyBuildLog); setOpen(true); };
  const openEdit = (e: any) => {
    setForm({ id: e.id, title: e.title, category: e.category, summary: e.summary ?? "", outcome: e.outcome ?? "", featured: !!e.featured, publicStatus: !!e.publicStatus, sortOrder: e.sortOrder ?? 0 });
    setOpen(true);
  };
  const handleSubmit = () => {
    const payload = { title: form.title, category: form.category, summary: form.summary || null, outcome: form.outcome || null, featured: form.featured, publicStatus: form.publicStatus, sortOrder: form.sortOrder };
    if (form.id) updateMut.mutate({ id: form.id, ...payload });
    else createMut.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Capabilities shown on the /operator build log.</p>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add capability</Button>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !entries?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No capabilities yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-sm border border-border bg-card/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{e.title}</span>
                  {e.featured && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Featured</Badge>}
                  {!e.publicStatus && <Badge variant="outline" className="text-[10px] text-muted-foreground">Hidden</Badge>}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{BUILD_LOG_CAT_LABELS[e.category]}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit capability" : "Add capability"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><FieldLabel>Title</FieldLabel><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1.5">
              <FieldLabel>Category</FieldLabel>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BUILD_LOG_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{BUILD_LOG_CAT_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><FieldLabel>Summary</FieldLabel><Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} /></div>
            <div className="space-y-1.5"><FieldLabel>Outcome (the result)</FieldLabel><Input value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="43 docs ingested, 137 violations tagged" /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><FieldLabel>Featured</FieldLabel></div>
              <div className="flex items-center gap-2"><Switch checked={form.publicStatus} onCheckedChange={(v) => setForm({ ...form, publicStatus: v })} /><FieldLabel>Public</FieldLabel></div>
              <div className="flex items-center gap-2"><FieldLabel>Order</FieldLabel><Input type="number" className="w-20" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="gap-2">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete capability?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---- Projects ---- */
type ProjectForm = {
  id?: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  status: (typeof PROJECT_STATUSES)[number];
  role: string;
  techStackText: string;
  liveUrl: string;
  repoUrl: string;
  internalPath: string;
  parentBrand: string;
  thumbnailKey: string;
  featured: boolean;
  publicStatus: boolean;
  sortOrder: number;
};

const emptyProject: ProjectForm = {
  name: "", slug: "", tagline: "", description: "", status: "concept", role: "", techStackText: "",
  liveUrl: "", repoUrl: "", internalPath: "", parentBrand: "", thumbnailKey: "", featured: false, publicStatus: true, sortOrder: 0,
};

function ProjectsTab() {
  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.operator.adminProjects.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyProject);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const refresh = () => { utils.operator.adminProjects.invalidate(); utils.operator.projects.invalidate(); };
  const createMut = trpc.operator.createProject.useMutation({ onSuccess: () => { refresh(); toast.success("Project added"); setOpen(false); }, onError: (e) => toast.error(e.message) });
  const updateMut = trpc.operator.updateProject.useMutation({ onSuccess: () => { refresh(); toast.success("Updated"); setOpen(false); }, onError: (e) => toast.error(e.message) });
  const deleteMut = trpc.operator.deleteProject.useMutation({ onSuccess: () => { refresh(); toast.success("Deleted"); setDeleteId(null); }, onError: (e) => toast.error(e.message) });

  const openNew = () => { setForm(emptyProject); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id, name: p.name, slug: p.slug ?? "", tagline: p.tagline ?? "", description: p.description ?? "",
      status: p.status, role: p.role ?? "", techStackText: ((p.techStack as string[] | null) ?? []).join(", "),
      liveUrl: p.liveUrl ?? "", repoUrl: p.repoUrl ?? "", internalPath: p.internalPath ?? "", parentBrand: p.parentBrand ?? "",
      thumbnailKey: p.thumbnailKey ?? "", featured: !!p.featured, publicStatus: !!p.publicStatus, sortOrder: p.sortOrder ?? 0,
    });
    setOpen(true);
  };
  const handleSubmit = () => {
    const techStack = form.techStackText.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      name: form.name, slug: form.slug || undefined, tagline: form.tagline || null, description: form.description || null,
      status: form.status, role: form.role || null, techStack, liveUrl: form.liveUrl || null, repoUrl: form.repoUrl || null,
      internalPath: form.internalPath || null, parentBrand: form.parentBrand || null, thumbnailKey: form.thumbnailKey || null,
      featured: form.featured, publicStatus: form.publicStatus, sortOrder: form.sortOrder,
    };
    if (form.id) updateMut.mutate({ id: form.id, ...payload });
    else createMut.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Projects shown in the <Link href="/projects" className="text-primary hover:underline">/projects</Link> catalog.</p>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Add project</Button>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !projects?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No projects yet.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-sm border border-border bg-card/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.name}</span>
                  {p.featured && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary gap-1"><Star className="h-2.5 w-2.5 fill-current" /> Flagship</Badge>}
                  {!p.publicStatus && <Badge variant="outline" className="text-[10px] text-muted-foreground">Hidden</Badge>}
                </div>
                <div className="text-xs text-muted-foreground font-mono">{PROJECT_STATUS_LABELS[p.status]}{p.parentBrand ? ` · ${p.parentBrand}` : ""}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Edit project" : "Add project"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel>Name</FieldLabel><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1.5"><FieldLabel>Slug (auto if blank)</FieldLabel><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="due-process-ai" /></div>
            </div>
            <div className="space-y-1.5"><FieldLabel>Tagline</FieldLabel><Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
            <div className="space-y-1.5"><FieldLabel>Description (Markdown)</FieldLabel><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={6} className="font-mono text-sm" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <FieldLabel>Status</FieldLabel>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><FieldLabel>Parent brand</FieldLabel><Input value={form.parentBrand} onChange={(e) => setForm({ ...form, parentBrand: e.target.value })} placeholder="Artificially Educated" /></div>
            </div>
            <div className="space-y-1.5"><FieldLabel>Role</FieldLabel><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Architect & sole engineer" /></div>
            <div className="space-y-1.5"><FieldLabel>Tech stack (comma separated)</FieldLabel><Input value={form.techStackText} onChange={(e) => setForm({ ...form, techStackText: e.target.value })} placeholder="React, tRPC, LLM pipeline" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel>Live URL (external)</FieldLabel><Input value={form.liveUrl} onChange={(e) => setForm({ ...form, liveUrl: e.target.value })} placeholder="https://..." /></div>
              <div className="space-y-1.5"><FieldLabel>Internal path (this site)</FieldLabel><Input value={form.internalPath} onChange={(e) => setForm({ ...form, internalPath: e.target.value })} placeholder="/the-church-record" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><FieldLabel>Repo URL</FieldLabel><Input value={form.repoUrl} onChange={(e) => setForm({ ...form, repoUrl: e.target.value })} placeholder="https://github.com/..." /></div>
              <div className="space-y-1.5"><FieldLabel>Thumbnail key (storage)</FieldLabel><Input value={form.thumbnailKey} onChange={(e) => setForm({ ...form, thumbnailKey: e.target.value })} placeholder="optional" /></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} /><FieldLabel>Flagship</FieldLabel></div>
              <div className="flex items-center gap-2"><Switch checked={form.publicStatus} onCheckedChange={(v) => setForm({ ...form, publicStatus: v })} /><FieldLabel>Public</FieldLabel></div>
              <div className="flex items-center gap-2"><FieldLabel>Order</FieldLabel><Input type="number" className="w-20" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="gap-2">
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete project?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────
   API KEYS TAB — generate/list/revoke keys for the public REST API
───────────────────────────────────────────────────────────────────────── */
function ApiKeysTab() {
  const utils = trpc.useUtils();
  const { data: keys, isLoading, isError, error, refetch } = trpc.apiKey.list.useQuery();
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"read" | "ingest">("read");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<number | null>(null);

  const createMut = trpc.apiKey.create.useMutation({
    onSuccess: (res) => {
      setNewKey(res.rawKey);
      setLabel("");
      utils.apiKey.list.invalidate();
      toast.success("API key created — copy it now, it won't be shown again.");
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeMut = trpc.apiKey.revoke.useMutation({
    onSuccess: () => {
      utils.apiKey.list.invalidate();
      setRevokeTarget(null);
      toast.success("Key revoked.");
    },
    onError: (e) => toast.error(e.message),
  });

  const apiBase = `${window.location.origin}/api/public`;

  return (
    <div className="space-y-6">
      {/* Discovery endpoints */}
      <div className="rounded-lg border border-border bg-card p-4 text-sm">
        <p className="font-medium mb-2 flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Public API
        </p>
        <p className="text-muted-foreground mb-3">
          External agents authenticate with a key via <code className="text-foreground">x-api-key</code> or{" "}
          <code className="text-foreground">Authorization: Bearer &lt;key&gt;</code>. Read keys can call every GET endpoint;
          ingest keys add <code className="text-foreground">POST /ingest</code>. Ingested documents are queued for review — never
          auto-published unless they clear the verifiability threshold.
        </p>
        <div className="grid gap-1 font-mono text-xs">
          <a href={`${apiBase}/openapi.json`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {apiBase}/openapi.json <span className="text-muted-foreground">(OpenAPI 3 — for Hermes)</span>
          </a>
          <a href={`${apiBase}/mcp.json`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {apiBase}/mcp.json <span className="text-muted-foreground">(MCP manifest — for Codex/Claude)</span>
          </a>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="font-medium mb-3">Generate a new key</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">Label</Label>
            <Input
              placeholder="e.g. Hermes prod, Codex sandbox"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-44">
            <Label className="text-xs mb-1 block">Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "read" | "ingest")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">read (GET only)</SelectItem>
                <SelectItem value="ingest">ingest (read + POST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => label.trim() && createMut.mutate({ label: label.trim(), scope })}
            disabled={!label.trim() || createMut.isPending}
            className="gap-2"
          >
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading keys…
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Failed to load API keys
          </p>
          <p className="text-muted-foreground mt-1">{error?.message ?? "Unknown error."}</p>
          <Button size="sm" variant="outline" className="mt-3 bg-background" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !keys || keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No API keys yet.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Used</th>
                <th className="px-3 py-2">Last used</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{k.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{k.keyPrefix}…</td>
                  <td className="px-3 py-2">
                    <Badge variant={k.scope === "ingest" ? "default" : "secondary"}>{k.scope}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{k.useCount}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {k.revokedAt ? (
                      <Badge variant="outline" className="text-destructive border-destructive/40">
                        revoked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/40">
                        active
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!k.revokedAt && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRevokeTarget(k.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* One-time key reveal */}
      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" /> Copy your API key now
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is the only time the full key is shown. Store it securely — only its hash is kept on the server.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
            <code className="flex-1 break-all font-mono text-xs">{newKey}</code>
            <Button
              size="sm"
              variant="outline"
              className="bg-background"
              onClick={() => {
                if (newKey) navigator.clipboard.writeText(newKey);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={revokeTarget !== null} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any agent using this key will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget !== null && revokeMut.mutate({ id: revokeTarget })}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   REVIEW QUEUE TAB — UNDATED + needs-classification docs
───────────────────────────────────────────────────────────────────────── */
const RECORD_STATUS_OPTIONS = [
  { value: "on_record_state", label: "On Record — State" },
  { value: "on_record_federal", label: "On Record — Federal" },
  { value: "supporting", label: "Supporting Material" },
  { value: "unfiled_not_on_record", label: "Unfiled / Not on Record" },
  { value: "unclassified", label: "Unclassified" },
] as const;

type AiSuggestion = {
  documentId: number;
  suggestedDate: string | null;
  dateSource: string;
  dateConfidence: number;
  dateConfidenceLabel: "high" | "medium" | "low";
  dateSourceQuote: string | null;
  suggestedRecordStatus: string;
  recordStatusConfidence: number;
  recordStatusConfidenceLabel: "high" | "medium" | "low";
  recordStatusReason: string;
  docketEntryNo: string | null;
  caseNumber: string | null;
  qcNotes: string[];
  textSource: "storage" | "metadata";
  autoAcceptRecommended: boolean;
};

function ReviewQueueTab() {
  const utils = trpc.useUtils();
  const { data: docs, isLoading, error, refetch } = trpc.evidenceEngine.reviewQueue.useQuery();
  const classifyMut = trpc.evidenceEngine.setClassification.useMutation({
    onSuccess: (_, vars) => {
      utils.evidenceEngine.reviewQueue.invalidate();
      toast.success(`Doc #${vars.documentId} updated`);
      setExpanded(null);
      setSuggestions((prev) => { const next = { ...prev }; delete next[vars.documentId]; return next; });
    },
    onError: (e) => toast.error(e.message),
  });
  const suggestMut = trpc.evidenceEngine.suggestDocumentMetadata.useMutation({
    onSuccess: (data) => {
      setSuggestions((prev) => ({ ...prev, [data.documentId]: data as AiSuggestion }));
      toast.success("AI suggestion ready");
    },
    onError: (e) => toast.error(`AI suggestion failed: ${e.message}`),
  });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [forms, setForms] = useState<Record<number, { date: string; status: string; note: string }>>({});
  const [suggestions, setSuggestions] = useState<Record<number, AiSuggestion>>({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<number>>(new Set());

  function getForm(id: number) {
    return forms[id] ?? { date: "", status: "", note: "" };
  }
  function patchForm(id: number, patch: Partial<{ date: string; status: string; note: string }>) {
    setForms((prev) => ({ ...prev, [id]: { ...getForm(id), ...patch } }));
  }
  function acceptSuggestion(docId: number, s: AiSuggestion) {
    patchForm(docId, {
      date: s.suggestedDate ?? "",
      status: s.suggestedRecordStatus,
      note: `AI suggestion accepted. Date confidence: ${s.dateConfidence}%, status confidence: ${s.recordStatusConfidence}%. ${s.recordStatusReason}`,
    });
    toast.success("Suggestion applied — review fields and save to confirm");
  }
  function dismissSuggestion(docId: number) {
    setDismissedSuggestions((prev) => new Set(Array.from(prev).concat(docId)));
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading review queue…
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-10 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const queue = docs ?? [];
  const undated = queue.filter((d) => d.needsDateReview);
  const unclassified = queue.filter((d) => d.needsClassificationReview && !d.needsDateReview);

  if (queue.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <CalendarCheck className="h-10 w-10 text-emerald-400 mx-auto" />
        <p className="text-foreground font-medium">Review queue is clear</p>
        <p className="text-muted-foreground text-sm">All documents have verified dates and classifications.</p>
      </div>
    );
  }

  function handleSave(docId: number, flags: { needsDate: boolean; needsClass: boolean }) {
    const f = getForm(docId);
    classifyMut.mutate({
      documentId: docId,
      recordStatus: (f.status || undefined) as any,
      filingStampDate: flags.needsDate ? (f.date || null) : undefined,
      dateSource: flags.needsDate ? (f.date ? "filing_stamp" : "undated") : undefined,
      clearDateReview: flags.needsDate,
      clearClassificationReview: flags.needsClass,
      note: f.note || undefined,
    });
  }

  const CONFIDENCE_COLORS = {
    high: "text-emerald-400 border-emerald-400/50",
    medium: "text-primary border-amber-400/50",
    low: "text-red-400 border-red-400/50",
  };

  function DocRow({ doc }: { doc: (typeof queue)[number] }) {
    const isOpen = expanded === doc.id;
    const f = getForm(doc.id);
    const flags = { needsDate: !!doc.needsDateReview, needsClass: !!doc.needsClassificationReview };
    const suggestion = suggestions[doc.id];
    const isDismissed = dismissedSuggestions.has(doc.id);
    const isSuggesting = suggestMut.isPending && suggestMut.variables?.documentId === doc.id;
    const showSuggestion = suggestion && !isDismissed;

    return (
      <div className="paper-card overflow-hidden">
        {/* Header row */}
        <button
          className="w-full flex items-start gap-3 p-4 text-left hover:bg-stone-900/40 transition-colors"
          onClick={() => setExpanded(isOpen ? null : doc.id)}
        >
          <FileSearch className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{doc.title}</div>
            <div className="flex flex-wrap gap-2 mt-1">
              {doc.needsDateReview && (
                <Badge variant="outline" className="text-[10px] font-mono border-amber-400/50 text-primary">UNDATED</Badge>
              )}
              {doc.needsClassificationReview && (
                <Badge variant="outline" className="text-[10px] font-mono border-blue-400/50 text-blue-400">NEEDS CLASSIFICATION</Badge>
              )}
              {doc.recordStatus && (
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">{doc.recordStatus}</Badge>
              )}
              {showSuggestion && (
                <Badge variant="outline" className="text-[10px] font-mono border-violet-400/50 text-violet-400 gap-1">
                  <Sparkles className="h-2.5 w-2.5" /> AI SUGGESTION READY
                </Badge>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{isOpen ? "▲" : "▼"}</span>
        </button>

        {isOpen && (
          <div className="border-t border-border/40 p-4 space-y-4 bg-stone-950/30">

            {/* AI Suggestion Card */}
            {showSuggestion ? (
              <div className="rounded-lg border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <span className="text-xs font-mono text-violet-400 uppercase tracking-widest">AI Suggestion</span>
                    {suggestion.autoAcceptRecommended && (
                      <Badge variant="outline" className="text-[9px] font-mono border-emerald-400/50 text-emerald-400">HIGH CONFIDENCE</Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    source: {suggestion.textSource}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Date suggestion */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-primary uppercase tracking-widest">Suggested Date</div>
                    <div className="font-mono text-sm font-semibold">
                      {suggestion.suggestedDate ?? <span className="text-muted-foreground italic">No date found</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[9px] font-mono ${CONFIDENCE_COLORS[suggestion.dateConfidenceLabel]}`}>
                        {suggestion.dateConfidence}% {suggestion.dateConfidenceLabel}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{suggestion.dateSource}</span>
                    </div>
                    {suggestion.dateSourceQuote && (
                      <p className="text-[10px] text-muted-foreground italic border-l-2 border-violet-500/40 pl-2 mt-1">
                        &ldquo;{suggestion.dateSourceQuote}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Status suggestion */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Suggested Status</div>
                    <div className="font-mono text-sm font-semibold">{suggestion.suggestedRecordStatus}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[9px] font-mono ${CONFIDENCE_COLORS[suggestion.recordStatusConfidenceLabel]}`}>
                        {suggestion.recordStatusConfidence}% {suggestion.recordStatusConfidenceLabel}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{suggestion.recordStatusReason}</p>
                  </div>
                </div>

                {/* QC Notes */}
                {suggestion.qcNotes.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      <Info className="h-3 w-3" /> QC Notes
                    </div>
                    {suggestion.qcNotes.map((note, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground pl-4">{note}</p>
                    ))}
                  </div>
                )}

                {/* Supplementary */}
                {(suggestion.docketEntryNo || suggestion.caseNumber) && (
                  <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
                    {suggestion.docketEntryNo && <span>Docket: {suggestion.docketEntryNo}</span>}
                    {suggestion.caseNumber && <span>Case: {suggestion.caseNumber}</span>}
                  </div>
                )}

                {/* Accept / Dismiss */}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
                    onClick={() => acceptSuggestion(doc.id, suggestion)}
                  >
                    <ThumbsUp className="h-3 w-3" /> Apply to form
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground gap-1.5"
                    onClick={() => dismissSuggestion(doc.id)}
                  >
                    <ThumbsDown className="h-3 w-3" /> Dismiss
                  </Button>
                </div>
              </div>
            ) : (
              /* AI Suggest trigger */
              <div className="flex items-center justify-between rounded-lg border border-dashed border-violet-500/30 p-3">
                <div className="text-xs text-muted-foreground">
                  Let AI analyze this document and suggest a date and record status.
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-violet-500/50 text-violet-400 hover:bg-violet-950/30 hover:text-violet-300 shrink-0 ml-3"
                  disabled={isSuggesting}
                  onClick={() => suggestMut.mutate({ documentId: doc.id })}
                >
                  {isSuggesting
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  {isSuggesting ? "Analyzing…" : "AI Suggest"}
                </Button>
              </div>
            )}

            {/* Manual fields */}
            {flags.needsDate && (
              <div>
                <Label className="text-xs font-mono text-primary uppercase tracking-widest">Filing Date</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Enter the verified filing stamp date, or leave blank to mark as UNDATED and clear the flag.
                </p>
                <Input
                  type="date"
                  value={f.date}
                  onChange={(e) => patchForm(doc.id, { date: e.target.value })}
                  className="mt-1 max-w-xs"
                />
              </div>
            )}
            {flags.needsClass && (
              <div>
                <Label className="text-xs font-mono text-blue-400 uppercase tracking-widest">Record Status</Label>
                <Select value={f.status} onValueChange={(v) => patchForm(doc.id, { status: v })}>
                  <SelectTrigger className="mt-1 max-w-xs">
                    <SelectValue placeholder="Select classification…" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Note (optional)</Label>
              <Textarea
                value={f.note}
                onChange={(e) => patchForm(doc.id, { note: e.target.value })}
                placeholder="e.g. Date confirmed from filing stamp page 1"
                rows={2}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-amber-400 text-stone-950 hover:bg-amber-300"
                disabled={classifyMut.isPending}
                onClick={() => handleSave(doc.id, flags)}
              >
                {classifyMut.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  : <Check className="h-3 w-3 mr-1" />}
                Save & clear flags
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display-serif text-xl">Review Queue</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {queue.length} document{queue.length !== 1 ? "s" : ""} need attention
          </p>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-primary flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" /> Undated ({undated.length})
          </h3>
          {undated.map((d) => <DocRow key={d.id} doc={d} />)}
        </div>
      )}

      {unclassified.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-xs uppercase tracking-widest text-blue-400 flex items-center gap-2">
            <FileSearch className="h-3.5 w-3.5" /> Needs Classification ({unclassified.length})
          </h3>
          {unclassified.map((d) => <DocRow key={d.id} doc={d} />)}
        </div>
      )}
    </div>
  );
}
