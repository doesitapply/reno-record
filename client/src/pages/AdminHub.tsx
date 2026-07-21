/**
 * Admin Hub — v7.8
 *
 * Unified operational control center. Two things in one place:
 * 1. Full CRUD over every evidence record type (documents, timeline, actors, PRRs, agencies)
 * 2. All 22 previously-unexposed backend procedures wired to real UI
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  FileText,
  Clock,
  Users,
  FolderOpen,
  Building2,
  Zap,
  Link2,
  RefreshCw,
  Trash2,
  Pencil,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  History,
  X,
  Save,
  Tag,
} from "lucide-react";

// ─── Shared helpers ────────────────────────────────────────────────────────

const RECORD_STATUS_OPTIONS = [
  { value: "on_record_state", label: "On Record — State" },
  { value: "on_record_federal", label: "On Record — Federal" },
  { value: "supporting", label: "Supporting Material" },
  { value: "unfiled_not_on_record", label: "Unfiled / Not on Record" },
  { value: "unclassified", label: "Unclassified" },
] as const;

const SOURCE_TYPES = [
  "court_order", "motion", "email", "transcript", "warrant",
  "public_records_response", "audio", "video", "image",
  "jail_record", "risk_notice", "other",
] as const;

const VISIBILITY_OPTIONS = [
  { value: "private_admin_only", label: "Private (Admin Only)" },
  { value: "pending_review", label: "Pending Review" },
  { value: "needs_redaction", label: "Needs Redaction" },
  { value: "public_preview", label: "Public Preview" },
  { value: "receipts_only", label: "Receipts Only" },
  { value: "goblin_allowed", label: "Goblin Allowed" },
  { value: "rejected", label: "Rejected" },
] as const;

const TIMELINE_CATEGORIES = [
  "state_case", "federal_case", "custody", "motion", "warrant",
  "competency", "public_records", "communications",
  "election_accountability", "other",
] as const;

const ACTOR_STATUSES = ["documented", "alleged", "needs_review"] as const;

const PRR_STATUSES = [
  "draft", "sent", "awaiting_response", "overdue",
  "partial_response", "denied", "produced", "appealed", "closed",
] as const;

const AGENCY_TYPES = [
  "court", "prosecutor", "law_enforcement", "public_defender",
  "government_department", "oversight_body", "municipality",
  "state_agency", "federal_agency", "other",
] as const;

function statusColor(s: string) {
  if (s === "approved" || s === "produced" || s === "documented") return "bg-green-900/30 text-green-300 border-green-800/40";
  if (s === "pending" || s === "awaiting_response" || s === "needs_review") return "bg-amber-900/30 text-primary/80 border-amber-800/40";
  if (s === "rejected" || s === "denied") return "bg-red-900/30 text-red-300 border-red-800/40";
  return "bg-muted/60 text-muted-foreground";
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2">
      <Label className="text-xs text-muted-foreground pt-2">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

// ─── Event Violation Tag Panel (v7.10) ────────────────────────────────────

function EventTagPanel({ eventId }: { eventId: number }) {
  const utils = trpc.useUtils();
  const { data: tags = [], isLoading } = trpc.violationTag.getEventTags.useQuery({ timelineEventId: eventId });
  const { data: allTags = [] } = trpc.violationTag.list.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ violationTagId: "", sourceQuote: "", sourceCitation: "", confidence: "100" });

  const addMut = trpc.violationTag.addToEvent.useMutation({
    onSuccess: () => {
      toast.success("Tag applied to event");
      utils.violationTag.getEventTags.invalidate({ timelineEventId: eventId });
      setShowAdd(false);
      setAddForm({ violationTagId: "", sourceQuote: "", sourceCitation: "", confidence: "100" });
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.violationTag.removeFromEvent.useMutation({
    onSuccess: () => {
      toast.success("Tag removed");
      utils.violationTag.getEventTags.invalidate({ timelineEventId: eventId });
    },
    onError: (e) => toast.error(e.message),
  });

  const categoryColor = (cat: string) => {
    if (cat === "constitutional") return "bg-red-900/30 text-red-300 border-red-800/40";
    if (cat === "procedural") return "bg-amber-900/30 text-primary/80 border-amber-800/40";
    if (cat === "discovery") return "bg-blue-900/30 text-blue-300 border-blue-800/40";
    if (cat === "judicial_conduct") return "bg-purple-900/30 text-purple-300 border-purple-800/40";
    if (cat === "prosecutorial_conduct") return "bg-orange-900/30 text-orange-300 border-orange-800/40";
    return "bg-muted/60 text-muted-foreground border-zinc-700/40";
  };

  return (
    <div className="px-3 pb-3 pt-1">
      <div className="rounded-md border border-zinc-800 bg-background/60 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Violation Tags ({tags.length})</span>
          <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground/90 transition-colors">
            <Plus className="w-3 h-3" /> Add Tag
          </button>
        </div>

        {isLoading && <div className="text-[10px] text-muted-foreground">Loading…</div>}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t: any) => (
              <div key={t.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${categoryColor(t.tagCategory)}`}>
                <span>{t.tagLabel}</span>
                {t.confidence < 100 && <span className="opacity-60">({t.confidence}%)</span>}
                <button onClick={() => removeMut.mutate({ id: t.id })} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity" title="Remove tag">
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {tags.length === 0 && !isLoading && (
          <p className="text-[10px] text-zinc-700 italic">No violation tags applied to this event.</p>
        )}

        {showAdd && (
          <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Violation Tag</Label>
                <Select value={addForm.violationTagId} onValueChange={v => setAddForm(f => ({ ...f, violationTagId: v }))}>
                  <SelectTrigger className="h-7 text-[10px] bg-card border-zinc-700"><SelectValue placeholder="Select tag…" /></SelectTrigger>
                  <SelectContent className="bg-card border-zinc-700 max-h-48">
                    {allTags.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-[10px]">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground mb-1 block">Confidence %</Label>
                <Input type="number" min="0" max="100" value={addForm.confidence} onChange={e => setAddForm(f => ({ ...f, confidence: e.target.value }))} className="h-7 text-[10px] bg-card border-zinc-700" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Source Quote <span className="text-red-500">*</span></Label>
              <Input value={addForm.sourceQuote} onChange={e => setAddForm(f => ({ ...f, sourceQuote: e.target.value }))} placeholder="Verbatim quote from record supporting this tag…" className="h-7 text-[10px] bg-card border-zinc-700" />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1 block">Citation (optional)</Label>
              <Input value={addForm.sourceCitation} onChange={e => setAddForm(f => ({ ...f, sourceCitation: e.target.value }))} placeholder="e.g. RT 12:4-9, Dec 5 2024" className="h-7 text-[10px] bg-card border-zinc-700" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-[10px] h-6 px-2">Cancel</Button>
              <Button size="sm" onClick={() => addMut.mutate({ timelineEventId: eventId, violationTagId: Number(addForm.violationTagId), sourceQuote: addForm.sourceQuote, sourceCitation: addForm.sourceCitation || undefined, confidence: Number(addForm.confidence) })} disabled={addMut.isPending || !addForm.violationTagId || addForm.sourceQuote.length < 5} className="text-[10px] h-6 px-2 gap-1">
                {addMut.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Plus className="w-2.5 h-2.5" />} Apply
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Documents Tab ─────────────────────────────────────────────────────────

function DocumentsTab() {
  const utils = trpc.useUtils();
  const { data: docs = [], isLoading } = trpc.document.adminList.useQuery();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [goblinDocId, setGoblinDocId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const updateMut = trpc.document.adminUpdate.useMutation({
    onSuccess: () => { toast.success("Document updated"); utils.document.adminList.invalidate(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const softDeleteMut = trpc.adminEdit.softDeleteDocument.useMutation({
    onSuccess: () => { toast.success("Document hidden from public"); utils.document.adminList.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });
  const hardDeleteMut = trpc.adminEdit.hardDeleteDocument.useMutation({
    onSuccess: () => { toast.success("Document permanently deleted"); utils.document.adminList.invalidate(); setDeleteId(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const reclassifyMut = trpc.evidenceEngine.reclassify.useMutation({
    onSuccess: () => { toast.success("Re-classification complete"); utils.document.adminList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (docs as any[]).filter((d: any) =>
      !q || d.title.toLowerCase().includes(q) ||
      (d.caseNumber ?? "").toLowerCase().includes(q) ||
      (d.actorNames ?? "").toLowerCase().includes(q)
    );
  }, [docs, search]);

  const editDoc = (docs as any[]).find((d: any) => d.id === editId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…" className="pl-8 h-8 text-xs bg-card border-zinc-700" />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} of {docs.length}</span>
        <BatchClassifyButton />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-card/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-8">#</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Title</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Date</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Record Status</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Visibility</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Review</th>
                <th className="px-3 py-2 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {(filtered as any[]).map((doc: any, i: number) => (
                <tr key={doc.id} className={`border-b border-zinc-800/60 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-card/20"}`}>
                  <td className="px-3 py-2 text-muted-foreground">{doc.id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/evidence/${doc.id}`} className="text-foreground/90 hover:text-primary/80 transition-colors line-clamp-1 max-w-xs">{doc.title}</Link>
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    </div>
                    {doc.actorNames && <p className="text-muted-foreground text-[10px] mt-0.5 line-clamp-1">{doc.actorNames}</p>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground font-mono">
                    {doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : <span className="text-primary">UNDATED</span>}
                  </td>
                  <td className="px-3 py-2">
                    {doc.recordStatus ? (
                      <span className="text-[10px] font-mono text-muted-foreground">{doc.recordStatus.replace(/_/g, " ")}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${statusColor(doc.visibility ?? "")}`}>
                      {(doc.visibility ?? "—").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${statusColor(doc.reviewStatus)}`}>
                      {doc.reviewStatus}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditId(doc.id); setEditForm({ title: doc.title, description: doc.description ?? "", caseNumber: doc.caseNumber ?? "", actorNames: doc.actorNames ?? "", visibility: doc.visibility ?? "pending_review", reviewStatus: doc.reviewStatus, sourceType: doc.sourceType }); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/90 transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => reclassifyMut.mutate({ documentId: doc.id })} disabled={reclassifyMut.isPending} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-300 transition-colors" title="Re-classify">
                        {reclassifyMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setGoblinDocId(doc.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary/80 transition-colors" title="Goblin history">
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteId(doc.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editId !== null} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-lg bg-background border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Document #{editId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <FieldRow label="Title">
              <Input value={editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" />
            </FieldRow>
            <FieldRow label="Description">
              <Textarea value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="text-xs bg-card border-zinc-700" />
            </FieldRow>
            <FieldRow label="Case Number">
              <Input value={editForm.caseNumber ?? ""} onChange={e => setEditForm(f => ({ ...f, caseNumber: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700 font-mono" />
            </FieldRow>
            <FieldRow label="Actor Names">
              <Input value={editForm.actorNames ?? ""} onChange={e => setEditForm(f => ({ ...f, actorNames: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" />
            </FieldRow>
            <FieldRow label="Source Type">
              <Select value={editForm.sourceType} onValueChange={v => setEditForm(f => ({ ...f, sourceType: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">
                  {SOURCE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Visibility">
              <Select value={editForm.visibility} onValueChange={v => setEditForm(f => ({ ...f, visibility: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">
                  {VISIBILITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Review Status">
              <Select value={editForm.reviewStatus} onValueChange={v => setEditForm(f => ({ ...f, reviewStatus: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">
                  {["pending", "approved", "rejected"].map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => editId && updateMut.mutate({ id: editId, patch: editForm as any })} disabled={updateMut.isPending} className="text-xs gap-1">
              {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-background border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Document #{deleteId}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Soft delete hides from public but keeps audit trail. Hard delete is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <Button variant="outline" size="sm" onClick={() => deleteId && softDeleteMut.mutate({ id: deleteId })} disabled={softDeleteMut.isPending} className="text-xs border-amber-800 text-primary hover:bg-amber-950">
              {softDeleteMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Soft Delete
            </Button>
            <AlertDialogAction               onClick={() => deleteId && hardDeleteMut.mutate({ id: deleteId, confirmPhrase: "PERMANENTLY DELETE" })} className="text-xs bg-red-900 hover:bg-red-800 text-red-100">
              {hardDeleteMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Hard Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Goblin History Dialog */}
      {goblinDocId !== null && <GoblinHistoryDialog documentId={goblinDocId} onClose={() => setGoblinDocId(null)} />}
    </div>
  );
}

// ─── Batch Classify Button ─────────────────────────────────────────────────

function BatchClassifyButton() {
  const utils = trpc.useUtils();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const batchMut = trpc.evidenceEngine.batchClassify.useMutation({
    onError: (e) => { toast.error(e.message); setRunning(false); },
  });

  async function runBatch() {
    setRunning(true);
    setProgress({ processed: 0, total: 0 });
    let afterId = 0;
    let total = 0;
    try {
      while (true) {
        const result = await batchMut.mutateAsync({ onlyUnclassified: true, limit: 8, afterId });
        total += result.processed;
        setProgress({ processed: total, total });
        if (result.done || result.nextAfterId === null) break;
        afterId = result.nextAfterId ?? afterId + 8;
      }
      toast.success(`Batch complete — ${total} documents processed`);
      utils.document.adminList.invalidate();
    } catch {
      // error already handled by onError
    } finally {
      setRunning(false);
      setTimeout(() => setProgress(null), 3000);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={runBatch} disabled={running} className="text-xs gap-1.5 border-blue-800 text-blue-300 hover:bg-blue-950">
      {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
      {progress ? `${progress.processed} processed…` : "Batch Re-classify"}
    </Button>
  );
}

// ─── Goblin History Dialog ─────────────────────────────────────────────────

function GoblinHistoryDialog({ documentId, onClose }: { documentId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.docketGoblin.listForDocument.useQuery({ documentId });
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg bg-background border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Goblin History — Doc #{documentId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground text-xs"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
        ) : !data || (data as any[]).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No pipeline runs found for this document.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {(data as any[]).map((run: any) => (
              <div key={run.id} className="p-3 rounded bg-card border border-zinc-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-muted-foreground">{run.taskType ?? "pipeline_run"}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColor(run.status ?? "pending")}`}>{run.status}</span>
                </div>
                <p className="text-muted-foreground">{run.createdAt ? new Date(run.createdAt).toLocaleString() : "—"}</p>
                {run.resultSummary && <p className="text-muted-foreground line-clamp-2">{run.resultSummary}</p>}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Timeline Tab ──────────────────────────────────────────────────────────

function TimelineTab() {
  const utils = trpc.useUtils();
  const { data: events = [], isLoading } = trpc.timeline.adminList.useQuery();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ eventDate: "", title: "", description: "", category: "other" as (typeof TIMELINE_CATEGORIES)[number], actorNames: "" });
  const [expandedTagEventId, setExpandedTagEventId] = useState<number | null>(null);

  const updateMut = trpc.timeline.adminUpdate.useMutation({
    onSuccess: () => { toast.success("Event updated"); utils.timeline.adminList.invalidate(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.timeline.adminDelete.useMutation({
    onSuccess: () => { toast.success("Event deleted"); utils.timeline.adminList.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.timeline.adminCreate.useMutation({
    onSuccess: () => { toast.success("Event created"); utils.timeline.adminList.invalidate(); setShowCreate(false); setCreateForm({ eventDate: "", title: "", description: "", category: "other", actorNames: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (events as any[]).filter((e: any) => !q || e.title.toLowerCase().includes(q) || (e.summary ?? "").toLowerCase().includes(q) || ((e.actors ?? []).join(",")).toLowerCase().includes(q));
  }, [events, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events…" className="pl-8 h-8 text-xs bg-card border-zinc-700" />
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)} className="text-xs gap-1"><Plus className="w-3 h-3" /> Add Event</Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3 bg-card/60 border-zinc-700">
          <p className="text-xs font-semibold text-foreground/80">New Timeline Event</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Date"><Input type="date" value={createForm.eventDate} onChange={e => setCreateForm(f => ({ ...f, eventDate: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Category">
              <Select value={createForm.category} onValueChange={v => setCreateForm(f => ({ ...f, category: v as any }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{TIMELINE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
          </div>
          <FieldRow label="Title"><Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
          <FieldRow label="Description"><Textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} className="text-xs bg-card border-zinc-700" /></FieldRow>
          <FieldRow label="Actor Names"><Input value={createForm.actorNames} onChange={e => setCreateForm(f => ({ ...f, actorNames: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate({ ...createForm, eventDate: createForm.eventDate ? new Date(createForm.eventDate) : new Date() } as any)} disabled={createMut.isPending || !createForm.title} className="text-xs gap-1">
              {createMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-card/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Date</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Title / Summary</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Category</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-36">Actors</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev, i) => (
                <>
                  <tr key={ev.id} className={`border-b border-zinc-800/60 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-card/20"}`}>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{ev.eventDate ? new Date(ev.eventDate).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2">
                      <p className="text-foreground/90 line-clamp-1">{(ev as any).title}</p>
                      {(ev as any).summary && <p className="text-muted-foreground text-[10px] line-clamp-1 mt-0.5">{(ev as any).summary}</p>}
                    </td>
                    <td className="px-3 py-2"><span className="text-[10px] text-muted-foreground font-mono">{((ev as any).category ?? "other").replace(/_/g, " ")}</span></td>
                    <td className="px-3 py-2 text-muted-foreground text-[10px] line-clamp-1">{((ev as any).actors ?? []).join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setExpandedTagEventId(expandedTagEventId === (ev as any).id ? null : (ev as any).id)} className={`p-1 rounded hover:bg-muted transition-colors ${expandedTagEventId === (ev as any).id ? "text-primary" : "text-muted-foreground hover:text-primary"}`} title="Violation tags"><Tag className="w-3.5 h-3.5" /></button>
                        <button onClick={() => { setEditId((ev as any).id); setEditForm({ title: (ev as any).title, description: (ev as any).summary ?? "", category: (ev as any).category ?? "other", actorNames: ((ev as any).actors ?? []).join(", "), eventDate: (ev as any).eventDate ? new Date((ev as any).eventDate).toISOString().split("T")[0] : "" }); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/90 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteId((ev as any).id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedTagEventId === (ev as any).id && (
                    <tr key={`tags-${ev.id}`} className="border-b border-zinc-800/60 bg-card/40">
                      <td colSpan={5}>
                        <EventTagPanel eventId={(ev as any).id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editId !== null} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-lg bg-background border-zinc-800">
          <DialogHeader><DialogTitle className="text-sm">Edit Event #{editId}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldRow label="Date"><Input type="date" value={editForm.eventDate ?? ""} onChange={e => setEditForm(f => ({ ...f, eventDate: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Title"><Input value={editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Description"><Textarea value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Category">
              <Select value={editForm.category} onValueChange={v => setEditForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{TIMELINE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Actor Names"><Input value={editForm.actorNames ?? ""} onChange={e => setEditForm(f => ({ ...f, actorNames: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => editId && updateMut.mutate({ id: editId, patch: { title: editForm.title, summary: editForm.description, category: editForm.category as any, actors: editForm.actorNames ? editForm.actorNames.split(",").map(s => s.trim()) : undefined, eventDate: editForm.eventDate ? new Date(editForm.eventDate) : undefined } })} disabled={updateMut.isPending} className="text-xs gap-1">
              {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-background border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Event #{deleteId}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">This is permanent and cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="text-xs bg-red-900 hover:bg-red-800 text-red-100">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Actors Tab ────────────────────────────────────────────────────────────

function ActorsTab() {
  const utils = trpc.useUtils();
  const { data: actors = [], isLoading } = trpc.actor.adminList.useQuery();
  const { data: docs = [] } = trpc.document.adminList.useQuery();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [linkActorId, setLinkActorId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", role: "", agency: "", bio: "", notes: "", status: "documented" as (typeof ACTOR_STATUSES)[number] });

  const updateMut = trpc.actor.adminUpdate.useMutation({
    onSuccess: () => { toast.success("Actor updated"); utils.actor.adminList.invalidate(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.actor.adminDelete.useMutation({
    onSuccess: () => { toast.success("Actor deleted"); utils.actor.adminList.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.actor.adminCreate.useMutation({
    onSuccess: () => { toast.success("Actor created"); utils.actor.adminList.invalidate(); setShowCreate(false); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return actors.filter(a => !q || a.name.toLowerCase().includes(q) || (a.role ?? "").toLowerCase().includes(q) || (a.agency ?? "").toLowerCase().includes(q));
  }, [actors, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actors…" className="pl-8 h-8 text-xs bg-card border-zinc-700" />
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)} className="text-xs gap-1"><Plus className="w-3 h-3" /> Add Actor</Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3 bg-card/60 border-zinc-700">
          <p className="text-xs font-semibold text-foreground/80">New Actor</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Name"><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Role"><Input value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))} placeholder="Judge, Prosecutor…" className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Agency"><Input value={createForm.agency} onChange={e => setCreateForm(f => ({ ...f, agency: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Status">
              <Select value={createForm.status} onValueChange={v => setCreateForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{ACTOR_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
          </div>
          <FieldRow label="Notes"><Textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs bg-card border-zinc-700" /></FieldRow>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate(createForm as any)} disabled={createMut.isPending || !createForm.name} className="text-xs gap-1">
              {createMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-card/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-36">Role</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-40">Agency</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Status</th>
                <th className="px-3 py-2 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((actor, i) => (
                <tr key={actor.id} className={`border-b border-zinc-800/60 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-card/20"}`}>
                  <td className="px-3 py-2">
                    <Link href={`/actors/${actor.slug}`} className="text-foreground/90 hover:text-primary/80 transition-colors">{actor.name}</Link>
                    <p className="text-muted-foreground text-[10px] font-mono">{actor.slug}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{actor.role ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{actor.agency ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${statusColor(actor.status)}`}>{actor.status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditId(actor.id); setEditForm({ name: actor.name, role: actor.role ?? "", agency: actor.agency ?? "", bio: actor.bio ?? "", notes: actor.notes ?? "", status: actor.status }); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/90 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setLinkActorId(actor.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-blue-300 transition-colors" title="Link documents"><Link2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(actor.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editId !== null} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-lg bg-background border-zinc-800">
          <DialogHeader><DialogTitle className="text-sm">Edit Actor #{editId}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldRow label="Name"><Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Role"><Input value={editForm.role ?? ""} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Agency"><Input value={editForm.agency ?? ""} onChange={e => setEditForm(f => ({ ...f, agency: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Status">
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{ACTOR_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Bio"><Textarea value={editForm.bio ?? ""} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} rows={2} className="text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Notes"><Textarea value={editForm.notes ?? ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs bg-card border-zinc-700" /></FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => editId && updateMut.mutate({ id: editId, patch: editForm as any })} disabled={updateMut.isPending} className="text-xs gap-1">
              {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-background border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Actor #{deleteId}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">This is permanent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="text-xs bg-red-900 hover:bg-red-800 text-red-100">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {linkActorId !== null && <ActorDocumentLinkDialog actorId={linkActorId} docs={docs as any[]} onClose={() => setLinkActorId(null)} />}
    </div>
  );
}

// ─── Actor Document Link Dialog ────────────────────────────────────────────

function ActorDocumentLinkDialog({ actorId, docs, onClose }: { actorId: number; docs: any[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: existingLinks = [] } = trpc.actorLink.getDocumentLinks.useQuery({ actorId });
  const [selectedDocId, setSelectedDocId] = useState("");
  const [role, setRole] = useState("");

  const addMut = trpc.actorLink.addDocumentLink.useMutation({
    onSuccess: () => { toast.success("Document linked"); utils.actorLink.getDocumentLinks.invalidate({ actorId }); setSelectedDocId(""); setRole(""); },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.actorLink.removeDocumentLink.useMutation({
    onSuccess: () => { toast.success("Link removed"); utils.actorLink.getDocumentLinks.invalidate({ actorId }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg bg-background border-zinc-800">
        <DialogHeader><DialogTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-blue-400" /> Document Links — Actor #{actorId}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Add Link</p>
            <div className="flex gap-2">
              <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700 flex-1"><SelectValue placeholder="Select document…" /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700 max-h-48">
                  {docs.map((d: any) => <SelectItem key={d.id} value={String(d.id)} className="text-xs">{d.id}: {d.title.slice(0, 50)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Role (optional)" className="h-8 text-xs bg-card border-zinc-700 w-32" />
              <Button size="sm" onClick={() => selectedDocId && addMut.mutate({ actorId, documentId: Number(selectedDocId), role: role || undefined })} disabled={!selectedDocId || addMut.isPending} className="text-xs gap-1 flex-shrink-0">
                {addMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Link
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Existing Links ({(existingLinks as any[]).length})</p>
            {(existingLinks as any[]).length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No document links yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(existingLinks as any[]).map((link: any) => (
                  <div key={link.id} className="flex items-center justify-between p-2 rounded bg-card border border-zinc-800 text-xs">
                    <div>
                      <span className="text-foreground/80">Doc #{link.documentId}</span>
                      {link.role && <span className="text-muted-foreground ml-2">— {link.role}</span>}
                      <span className={`ml-2 text-[10px] ${link.addedBy === "goblin" ? "text-primary" : "text-blue-400"}`}>{link.addedBy}</span>
                    </div>
                    <button onClick={() => removeMut.mutate({ id: link.id })} disabled={removeMut.isPending} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PRRs Tab ──────────────────────────────────────────────────────────────

function PRRsTab() {
  const utils = trpc.useUtils();
  const { data: prrs = [], isLoading } = trpc.prr.adminList.useQuery();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", agency: "", description: "", status: "draft" as (typeof PRR_STATUSES)[number], dateSent: "" });

  const updateMut = trpc.prr.adminUpdate.useMutation({
    onSuccess: () => { toast.success("PRR updated"); utils.prr.adminList.invalidate(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.prr.adminDelete.useMutation({
    onSuccess: () => { toast.success("PRR deleted"); utils.prr.adminList.invalidate(); setDeleteId(null); },
    onError: (e) => toast.error(e.message),
  });
  const createMut = trpc.prr.adminCreate.useMutation({
    onSuccess: () => { toast.success("PRR created"); utils.prr.adminList.invalidate(); setShowCreate(false); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prrs.filter(p => !q || p.title.toLowerCase().includes(q) || p.agency.toLowerCase().includes(q));
  }, [prrs, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search PRRs…" className="pl-8 h-8 text-xs bg-card border-zinc-700" />
        </div>
        <Button size="sm" onClick={() => setShowCreate(v => !v)} className="text-xs gap-1"><Plus className="w-3 h-3" /> Add PRR</Button>
      </div>

      {showCreate && (
        <Card className="p-4 space-y-3 bg-card/60 border-zinc-700">
          <p className="text-xs font-semibold text-foreground/80">New Public Records Request</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Title"><Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Agency"><Input value={createForm.agency} onChange={e => setCreateForm(f => ({ ...f, agency: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Status">
              <Select value={createForm.status} onValueChange={v => setCreateForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{PRR_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Date Sent"><Input type="date" value={createForm.dateSent} onChange={e => setCreateForm(f => ({ ...f, dateSent: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
          </div>
          <FieldRow label="Description"><Textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} className="text-xs bg-card border-zinc-700" /></FieldRow>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => createMut.mutate({ ...createForm, dateSent: createForm.dateSent ? new Date(createForm.dateSent) : undefined } as any)} disabled={createMut.isPending || !createForm.title || !createForm.agency} className="text-xs gap-1">
              {createMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-card/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Title</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-40">Agency</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Status</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Sent</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prr, i) => (
                <tr key={prr.id} className={`border-b border-zinc-800/60 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-card/20"}`}>
                  <td className="px-3 py-2 text-foreground/90 line-clamp-1">{prr.title}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{prr.agency}</td>
                  <td className="px-3 py-2"><span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${statusColor(prr.status)}`}>{prr.status.replace(/_/g, " ")}</span></td>
                  <td className="px-3 py-2 text-muted-foreground font-mono">{prr.dateSent ? new Date(prr.dateSent).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditId(prr.id); setEditForm({ title: prr.title, agency: prr.agency, description: prr.description ?? "", status: prr.status }); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/90 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(prr.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editId !== null} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-lg bg-background border-zinc-800">
          <DialogHeader><DialogTitle className="text-sm">Edit PRR #{editId}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldRow label="Title"><Input value={editForm.title ?? ""} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Agency"><Input value={editForm.agency ?? ""} onChange={e => setEditForm(f => ({ ...f, agency: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Status">
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{PRR_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Description"><Textarea value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="text-xs bg-card border-zinc-700" /></FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => editId && updateMut.mutate({ id: editId, patch: editForm as any })} disabled={updateMut.isPending} className="text-xs gap-1">
              {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-background border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete PRR #{deleteId}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">This is permanent.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate({ id: deleteId })} className="text-xs bg-red-900 hover:bg-red-800 text-red-100">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Agencies Tab ──────────────────────────────────────────────────────────

function AgenciesTab() {
  const utils = trpc.useUtils();
  const { data: agencies = [], isLoading } = trpc.agency.list.useQuery();
  const { data: actors = [] } = trpc.actor.adminList.useQuery();
  // Map agencyId -> roles, fetched lazily
  const [agencyRoles, setAgencyRoles] = useState<Record<number, any[]>>({});
  async function loadRoles(agencyId: number) {
    if (agencyRoles[agencyId]) return;
    const roles = await utils.agency.getActors.fetch({ agencyId });
    setAgencyRoles(prev => ({ ...prev, [agencyId]: roles }));
  }
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [addRoleAgencyId, setAddRoleAgencyId] = useState<number | null>(null);
  const [roleForm, setRoleForm] = useState({ actorId: "", title: "", isCurrent: "false" });

  const updateMut = trpc.agency.adminUpdate.useMutation({
    onSuccess: () => { toast.success("Agency updated"); utils.agency.list.invalidate(); setEditId(null); },
    onError: (e) => toast.error(e.message),
  });
  const addRoleMut = trpc.agency.addActorRole.useMutation({
    onSuccess: () => { toast.success("Actor role added"); setAddRoleAgencyId(null); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-card/60">
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Type</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Jurisdiction</th>
                <th className="text-left px-3 py-2 text-muted-foreground font-medium">Actor Roles</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {(agencies as any[]).map((ag: any, i: number) => {
                if (!agencyRoles[ag.id]) loadRoles(ag.id);
                const roles = agencyRoles[ag.id] ?? null;
                return (
                <tr key={ag.id} className={`border-b border-zinc-800/60 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-card/20"}`}>
                  <td className="px-3 py-2">
                    <p className="text-foreground/90">{ag.name}</p>
                    <p className="text-muted-foreground text-[10px] font-mono">{ag.slug}</p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{(ag.agencyType ?? "—").replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{ag.jurisdictionName ?? "—"}</td>
                  <td className="px-3 py-2">
                    {roles === null ? (
                      <span className="text-[10px] text-zinc-700">Loading…</span>
                    ) : roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {roles.slice(0, 3).map((r: any) => (
                          <span key={r.id} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] border ${r.isCurrent ? "border-green-800/40 text-green-400" : "border-zinc-700 text-muted-foreground"}`}>{r.actorName ?? `Actor #${r.actorId}`}: {r.title}</span>
                        ))}
                        {roles.length > 3 && <span className="text-[10px] text-muted-foreground">+{roles.length - 3} more</span>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-700">No roles assigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditId(ag.id); setEditForm({ name: ag.name, agencyType: ag.agencyType ?? "other", websiteUrl: ag.websiteUrl ?? "", notes: ag.notes ?? "" }); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground/90 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setAddRoleAgencyId(ag.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-green-300 transition-colors" title="Add actor role"><Users className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editId !== null} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-md bg-background border-zinc-800">
          <DialogHeader><DialogTitle className="text-sm">Edit Agency #{editId}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldRow label="Name"><Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Type">
              <Select value={editForm.agencyType} onValueChange={v => setEditForm(f => ({ ...f, agencyType: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">{AGENCY_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Website"><Input value={editForm.websiteUrl ?? ""} onChange={e => setEditForm(f => ({ ...f, websiteUrl: e.target.value }))} className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Notes"><Textarea value={editForm.notes ?? ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs bg-card border-zinc-700" /></FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditId(null)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => editId && updateMut.mutate({ id: editId, ...editForm as any })} disabled={updateMut.isPending} className="text-xs gap-1">
              {updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addRoleAgencyId !== null} onOpenChange={open => !open && setAddRoleAgencyId(null)}>
        <DialogContent className="max-w-md bg-background border-zinc-800">
          <DialogHeader><DialogTitle className="text-sm">Add Actor Role — Agency #{addRoleAgencyId}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <FieldRow label="Actor">
              <Select value={roleForm.actorId} onValueChange={v => setRoleForm(f => ({ ...f, actorId: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue placeholder="Select actor…" /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700 max-h-48">
                  {(actors as any[]).map((a: any) => <SelectItem key={a.id} value={String(a.id)} className="text-xs">{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Title"><Input value={roleForm.title} onChange={e => setRoleForm(f => ({ ...f, title: e.target.value }))} placeholder="Deputy District Attorney" className="h-8 text-xs bg-card border-zinc-700" /></FieldRow>
            <FieldRow label="Current?">
              <Select value={roleForm.isCurrent} onValueChange={v => setRoleForm(f => ({ ...f, isCurrent: v }))}>
                <SelectTrigger className="h-8 text-xs bg-card border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-zinc-700">
                  <SelectItem value="true" className="text-xs">Yes — current role</SelectItem>
                  <SelectItem value="false" className="text-xs">No — historical</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddRoleAgencyId(null)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={() => addRoleAgencyId && roleForm.actorId && addRoleMut.mutate({ agencyId: addRoleAgencyId, actorId: Number(roleForm.actorId), title: roleForm.title, isCurrent: roleForm.isCurrent === "true" })} disabled={addRoleMut.isPending || !roleForm.actorId || !roleForm.title} className="text-xs gap-1">
              {addRoleMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Add Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AdminHub() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <AlertTriangle className="w-8 h-8 text-primary" />
        <p className="text-sm text-muted-foreground">Admin access required.</p>
        <Link href="/" className="text-xs text-muted-foreground hover:text-muted-foreground">← Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FolderOpen className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Admin Hub</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Full CRUD over every record type. All previously-unexposed backend procedures wired here.
        </p>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-card/60 border border-zinc-800 p-1">
          <TabsTrigger value="documents" className="text-xs gap-1.5 data-[state=active]:bg-muted">
            <FileText className="w-3.5 h-3.5" /> Documents
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1.5 data-[state=active]:bg-muted">
            <Clock className="w-3.5 h-3.5" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="actors" className="text-xs gap-1.5 data-[state=active]:bg-muted">
            <Users className="w-3.5 h-3.5" /> Actors
          </TabsTrigger>
          <TabsTrigger value="prrs" className="text-xs gap-1.5 data-[state=active]:bg-muted">
            <FolderOpen className="w-3.5 h-3.5" /> PRRs
          </TabsTrigger>
          <TabsTrigger value="agencies" className="text-xs gap-1.5 data-[state=active]:bg-muted">
            <Building2 className="w-3.5 h-3.5" /> Agencies
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents"><DocumentsTab /></TabsContent>
        <TabsContent value="timeline"><TimelineTab /></TabsContent>
        <TabsContent value="actors"><ActorsTab /></TabsContent>
        <TabsContent value="prrs"><PRRsTab /></TabsContent>
        <TabsContent value="agencies"><AgenciesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
