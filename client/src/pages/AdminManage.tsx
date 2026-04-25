import { useState } from "react";
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
          <TabsList className="mb-6">
            <TabsTrigger value="timeline" className="gap-2">
              <Calendar className="h-3.5 w-3.5" /> Timeline Events
            </TabsTrigger>
            <TabsTrigger value="actors" className="gap-2">
              <Users className="h-3.5 w-3.5" /> Actors
            </TabsTrigger>
            <TabsTrigger value="prrs" className="gap-2">
              <ClipboardList className="h-3.5 w-3.5" /> Public Records
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
                  <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30 font-mono uppercase text-[9px]">
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
      publicStatus: p.publicStatus ?? true,
    });
    setEditTarget(p);
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "text-muted-foreground border-muted-foreground/30",
    sent: "text-blue-700 border-blue-500/40",
    awaiting_response: "text-amber-700 border-amber-500/40",
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
