import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";
import { Link } from "wouter";
import { User, FileText, Trash2, AlertCircle, Clock, CheckCircle, XCircle, RefreshCw, Shield, LogIn } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  needs_changes: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  approved: <CheckCircle className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
  needs_changes: <RefreshCw className="h-3.5 w-3.5" />,
};

function DeleteStoryButton({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const utils = trpc.useUtils();
  const del = trpc.userData.deleteMyStory.useMutation({
    onSuccess: () => {
      toast.success("Submission deleted.");
      utils.userData.myStories.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Delete this submission?</span>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          onClick={() => del.mutate({ id })}
          disabled={del.isPending}
        >
          {del.isPending ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </Button>
  );
}

function ReviewRequestModal({ targetType, targetId, onClose }: { targetType: "story" | "document"; targetId: number; onClose: () => void }) {
  const [requestType, setRequestType] = useState<string>("correction");
  const [reason, setReason] = useState("");
  const [correctionText, setCorrectionText] = useState("");
  const submit = trpc.reviewRequest.submit.useMutation({
    onSuccess: () => {
      toast.success("Review request submitted. An editor will review it.");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="paper-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="display-serif text-xl mb-1">Request Review</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Submit a formal request for an editor to review this record. This does not remove the record immediately.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">Request type</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm"
            >
              <option value="correction">Correction — factual error</option>
              <option value="redaction">Redaction — sensitive information</option>
              <option value="removal">Removal — should not be published</option>
              <option value="privacy_concern">Privacy concern</option>
              <option value="legal_safety_concern">Legal / safety concern</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">Reason <span className="text-destructive">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Describe the issue clearly and specifically (min 10 characters)"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm resize-none"
            />
          </div>

          {requestType === "correction" && (
            <div>
              <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground block mb-1.5">Proposed correction</label>
              <textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                rows={3}
                placeholder="What should the correct information be?"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm resize-none"
              />
            </div>
          )}

          <div className="rounded border border-[var(--amber)]/30 bg-[var(--amber)]/5 p-3 text-xs text-foreground/80">
            <strong>Note:</strong> Once approved, records are part of the public archive. This request goes to editorial review — the editor decides the resolution. Records are not removed automatically.
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="bg-foreground text-background"
            onClick={() => submit.mutate({
              targetType,
              targetId,
              requestType: requestType as any,
              reason,
              correctionText: correctionText || undefined,
            })}
            disabled={submit.isPending || reason.length < 10}
          >
            {submit.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StoriesTab() {
  const stories = trpc.userData.myStories.useQuery();
  const [reviewTarget, setReviewTarget] = useState<{ id: number } | null>(null);

  if (stories.isLoading) return <div className="text-muted-foreground text-sm">Loading submissions…</div>;

  const data = stories.data ?? [];
  if (data.length === 0) {
    return (
      <div className="paper-card p-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="display-serif text-lg">No submissions yet</h3>
        <p className="text-muted-foreground text-sm mt-1 mb-4">You haven't submitted any stories.</p>
        <Link href="/submit">
          <Button size="sm" className="bg-foreground text-background">Submit Your Story</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviewTarget && (
        <ReviewRequestModal
          targetType="story"
          targetId={reviewTarget.id}
          onClose={() => setReviewTarget(null)}
        />
      )}
      {data.map((s) => (
        <div key={s.id} className="paper-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">#{s.id}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-xs font-mono ${STATUS_COLORS[s.status] || ""}`}
                >
                  {STATUS_ICONS[s.status]}
                  {s.status.replace("_", " ")}
                </span>
                {s.featured && <Badge variant="outline" className="text-[10px]">Featured</Badge>}
              </div>
              <div className="mt-1.5 font-medium text-sm">
                {s.mainIssue || s.alias || `Submission #${s.id}`}
              </div>
              {s.court && <div className="text-xs text-muted-foreground mt-0.5">{s.court}</div>}
              <div className="text-xs text-muted-foreground mt-0.5">
                Submitted {new Date(s.createdAt).toLocaleDateString()}
              </div>
              {s.reviewerNote && (
                <div className="mt-2 text-xs bg-secondary rounded-sm p-2 text-foreground/80">
                  <span className="font-semibold">Editor note:</span> {s.reviewerNote}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {s.status === "pending" && (
                <DeleteStoryButton id={s.id} onDeleted={() => {}} />
              )}
              {(s.status === "approved" && s.publicPermission) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setReviewTarget({ id: s.id })}
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Request review
                </Button>
              )}
              {s.slug && (
                <Link href={`/the-church-record`}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5">View</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="text-xs text-muted-foreground p-3 rounded border border-dashed border-border">
        <strong>Public archive permanence:</strong> Once approved, records become part of the public archive and cannot be edited or deleted directly by the submitter. Use "Request review" to flag issues for editorial consideration.
      </div>
    </div>
  );
}

function DocumentsTab() {
  const docs = trpc.userData.myDocuments.useQuery();
  const [reviewTarget, setReviewTarget] = useState<{ id: number } | null>(null);
  const utils = trpc.useUtils();
  const del = trpc.userData.deleteMyDocument.useMutation({
    onSuccess: () => { toast.success("Document deleted."); utils.userData.myDocuments.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (docs.isLoading) return <div className="text-muted-foreground text-sm">Loading documents…</div>;

  const data = docs.data ?? [];
  if (data.length === 0) {
    return (
      <div className="paper-card p-8 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="display-serif text-lg">No documents uploaded</h3>
        <p className="text-muted-foreground text-sm mt-1">Documents uploaded with your story submissions will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviewTarget && (
        <ReviewRequestModal
          targetType="document"
          targetId={reviewTarget.id}
          onClose={() => setReviewTarget(null)}
        />
      )}
      {data.map((d) => (
        <div key={d.id} className="paper-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">#{d.id}</span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-xs font-mono ${STATUS_COLORS[d.reviewStatus] || ""}`}
                >
                  {STATUS_ICONS[d.reviewStatus]}
                  {d.reviewStatus}
                </span>
              </div>
              <div className="mt-1.5 font-medium text-sm">{d.title}</div>
              {d.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{d.description}</div>}
              <div className="text-xs text-muted-foreground mt-0.5">
                Uploaded {new Date(d.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {d.reviewStatus === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                  onClick={() => del.mutate({ id: d.id })}
                  disabled={del.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              )}
              {(d.reviewStatus === "approved" && d.publicStatus) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setReviewTarget({ id: d.id })}
                >
                  <AlertCircle className="h-3.5 w-3.5" /> Request review
                </Button>
              )}
              {d.publicStatus && (
                <Link href={`/evidence/${d.id}`}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">View</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestsTab() {
  const requests = trpc.reviewRequest.myRequests.useQuery();

  if (requests.isLoading) return <div className="text-muted-foreground text-sm">Loading requests…</div>;

  const data = requests.data ?? [];
  if (data.length === 0) {
    return (
      <div className="paper-card p-8 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="display-serif text-lg">No review requests</h3>
        <p className="text-muted-foreground text-sm mt-1">Review requests you submit for approved records will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((r) => (
        <div key={r.id} className="paper-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">Request #{r.id}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-sm border text-xs font-mono bg-secondary">
                  {r.status.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground">{r.requestType.replace(/_/g, " ")} · {r.targetType} #{r.targetId}</span>
              </div>
              <div className="mt-1.5 text-sm text-foreground/80 line-clamp-2">{r.reason}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Submitted {new Date(r.createdAt).toLocaleDateString()}
              </div>
              {r.editorialNote && (
                <div className="mt-2 text-xs bg-secondary rounded-sm p-2">
                  <span className="font-semibold">Editor response:</span> {r.editorialNote}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  useSEO({ title: "My Profile", description: "Manage your submissions and review requests.", canonicalPath: "/profile" });
  const { isAuthenticated, user, loading } = useAuth();
  const [tab, setTab] = useState<"stories" | "documents" | "requests">("stories");

  if (loading) {
    return (
      <SiteShell>
        <div className="container py-24 text-center text-muted-foreground">Loading…</div>
      </SiteShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <SiteShell>
        <section className="container py-24">
          <div className="paper-card p-10 max-w-md mx-auto text-center">
            <LogIn className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h1 className="display-serif text-3xl">Sign in required</h1>
            <p className="text-muted-foreground mt-3 mb-6 text-sm">
              You need to be signed in to view your profile and submissions.
            </p>
            <a href={getLoginUrl()}>
              <Button className="bg-foreground text-background gap-2">
                <LogIn className="h-4 w-4" /> Sign in
              </Button>
            </a>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <div className="paper-card p-5 sticky top-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-[var(--amber)] text-foreground grid place-items-center text-sm font-bold font-mono shrink-0">
                  {user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{user?.name || "Account"}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
              </div>
              {user?.role === "admin" && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--amber)] mb-3">
                  <Shield className="h-3 w-3" /> Admin
                </div>
              )}
              <div className="space-y-0.5">
                {(["stories", "documents", "requests"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${
                      tab === t ? "bg-[var(--amber-soft)] text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {t === "stories" ? "My Stories" : t === "documents" ? "My Documents" : "Review Requests"}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="lg:col-span-9">
            <div className="eyebrow mb-2">
              {tab === "stories" ? "My Submissions" : tab === "documents" ? "My Documents" : "Review Requests"}
            </div>
            <h1 className="display-serif text-3xl mb-6">
              {tab === "stories" ? "Your story submissions" : tab === "documents" ? "Your uploaded documents" : "Your review requests"}
            </h1>
            {tab === "stories" && <StoriesTab />}
            {tab === "documents" && <DocumentsTab />}
            {tab === "requests" && <RequestsTab />}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
