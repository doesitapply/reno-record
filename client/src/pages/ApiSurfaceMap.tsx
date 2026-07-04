/**
 * API Surface Map — Internal admin page
 *
 * Documents all 22 backend tRPC procedures that exist but have no
 * frontend UI wired. Grouped by domain, with input schema, access level,
 * current status, and recommended use case for each.
 */

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Code2,
  Lock,
  Globe,
  Shield,
  Search,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Link2,
  FileText,
  Users,
  Building2,
  Database,
  Layers,
  BarChart3,
  ScrollText,
} from "lucide-react";

type AccessLevel = "adminProcedure" | "protectedProcedure" | "publicProcedure";
type Priority = "high" | "medium" | "low";
type Status = "dormant" | "partial" | "api-only";

interface Procedure {
  namespace: string;
  name: string;
  access: AccessLevel;
  status: Status;
  priority: Priority;
  inputSchema: string;
  description: string;
  potentialUse: string;
  buildEstimate: string;
  notes?: string;
}

const PROCEDURES: Procedure[] = [
  // ── actorLink ──────────────────────────────────────────────
  {
    namespace: "actorLink",
    name: "addDocumentLink",
    access: "adminProcedure",
    status: "dormant",
    priority: "high",
    inputSchema: "{ actorId, documentId, role?, confidence (0–100), extractedFrom?, addedBy: 'human'|'goblin' }",
    description:
      "Creates a typed link between an actor and a document in the archive. Supports confidence scoring and provenance tracking (human vs. Goblin-inferred).",
    potentialUse:
      "Admin UI on actor dossier pages: 'Link Document' button that opens a document search modal. Also callable by the Goblin pipeline to auto-link actors it identifies in ingested documents. Currently the only way to create these links is via seed SQL.",
    buildEstimate: "2–3 hours",
    notes: "Schema already supports role (e.g. 'defense_counsel', 'judge', 'prosecutor') and extractedFrom for the source quote.",
  },
  {
    namespace: "actorLink",
    name: "addTimelineLink",
    access: "adminProcedure",
    status: "dormant",
    priority: "high",
    inputSchema: "{ actorId, timelineEventId, role? }",
    description:
      "Links an actor to a specific timeline event with an optional role descriptor.",
    potentialUse:
      "Admin UI on timeline event detail or actor dossier: 'Add Actor' button. Enables the actor dossier to show every event they appear in, not just documents. Feeds the accountability gap analysis with richer actor-event data.",
    buildEstimate: "1–2 hours",
  },
  {
    namespace: "actorLink",
    name: "removeDocumentLink",
    access: "adminProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema: "{ id: number }",
    description: "Removes an actor-document link by its link record ID.",
    potentialUse:
      "Companion to addDocumentLink — needed for any admin UI that manages actor-document relationships. Without this, links can only be deleted via direct SQL.",
    buildEstimate: "30 minutes (UI only, backend complete)",
  },
  {
    namespace: "actorLink",
    name: "getDocumentActors",
    access: "publicProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema: "{ documentId: number }",
    description:
      "Returns all actors linked to a specific document, with their roles and confidence scores.",
    potentialUse:
      "Evidence Detail page: 'Actors on this Document' section showing named parties with their roles. Currently the page only shows actorNames as a raw string field. This would replace that with structured, linked actor cards.",
    buildEstimate: "1 hour",
  },
  {
    namespace: "actorLink",
    name: "getTimelineLinks",
    access: "publicProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema: "{ actorId: number }",
    description:
      "Returns all timeline events linked to a specific actor.",
    potentialUse:
      "Actor dossier page: 'Timeline Appearances' section. Currently actor dossiers show violation tags and documents but not which specific timeline events the actor appears in. This closes that gap.",
    buildEstimate: "1 hour",
  },

  // ── adminEdit ──────────────────────────────────────────────
  {
    namespace: "adminEdit",
    name: "editStory",
    access: "adminProcedure",
    status: "dormant",
    priority: "high",
    inputSchema:
      "{ id, patch: { alias?, court?, judge?, prosecutor?, defenseAttorney?, charges?, summary?, mainIssue?, reviewerNote?, editorialNote?, correctionNote?, featured?, slug?, status?, publicPermission? } }",
    description:
      "Full-field patch on a story record with audit logging. Supports all editorial and metadata fields.",
    potentialUse:
      "Admin story management UI: inline edit form on the story detail page. Currently story edits require direct DB access or the adminUpdate procedure on storyRouter (which has a more limited patch schema). This is the comprehensive editorial edit path.",
    buildEstimate: "2 hours",
    notes: "Audit trail is already wired — every field change is logged with before/after values.",
  },
  {
    namespace: "adminEdit",
    name: "editDocument",
    access: "adminProcedure",
    status: "dormant",
    priority: "high",
    inputSchema:
      "{ id, patch: { title?, description?, sourceType?, caseNumber?, actorNames?, editorialNote?, correctionNote?, visibility?, aiPolicy?, publicStatus?, reviewStatus? } }",
    description:
      "Full-field patch on a document record with audit logging. Covers all editorial and visibility fields.",
    potentialUse:
      "Admin document detail page: comprehensive edit form. The current adminUpdate on documentRouter handles this partially, but editDocument is the audited, field-validated version intended for editorial corrections.",
    buildEstimate: "2 hours",
  },
  {
    namespace: "adminEdit",
    name: "inlineEdit",
    access: "adminProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema:
      "{ recordType: 'story'|'document'|'timeline_event'|'actor'|'prr', recordId, field, oldValue, newValue }",
    description:
      "Generic single-field edit dispatcher across all major record types. Handles routing to the correct DB update and writes a full audit log entry with old/new values.",
    potentialUse:
      "Click-to-edit cells in any admin table or detail view. A single mutation handles all record types — wire it to a double-click or pencil icon on any field in the admin interface. The oldValue/newValue audit trail makes it safe for production use.",
    buildEstimate: "3–4 hours (UI pattern across multiple pages)",
    notes: "This is the highest-leverage admin procedure in the system. One mutation, five record types, full audit trail.",
  },

  // ── agency ────────────────────────────────────────────────
  {
    namespace: "agency",
    name: "addActorRole",
    access: "adminProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema: "{ agencyId: number, actorId: number, role: string }",
    description:
      "Associates an actor with an agency in a named role (e.g. 'Deputy District Attorney', 'Presiding Judge').",
    potentialUse:
      "Agency detail page admin panel: 'Add Staff Member' form. Currently agency-actor relationships are seeded via SQL. This enables live management from the UI and would power the agency org chart view.",
    buildEstimate: "1–2 hours",
  },
  {
    namespace: "agency",
    name: "adminUpdate",
    access: "adminProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "{ id: number, patch: { name?, slug?, description?, ... } }",
    description: "Updates agency metadata fields.",
    potentialUse:
      "Agency admin edit form. Low priority since agency data is static for this case, but needed if the system is extended to cover additional agencies or jurisdictions.",
    buildEstimate: "1 hour",
  },

  // ── audit ─────────────────────────────────────────────────
  {
    namespace: "audit",
    name: "exportCsv",
    access: "adminProcedure",
    status: "partial",
    priority: "high",
    inputSchema:
      "{ actorUserId?, action?, targetType?, dateFrom?, dateTo?, q? }",
    description:
      "Filtered audit log export. Returns structured rows that the client serializes to CSV. Supports filtering by user, action type, record type, date range, and free-text search.",
    potentialUse:
      "Admin audit log page: 'Export CSV' button. The backend is fully built and the procedure is actually called via trpcUtils.audit.exportCsv.fetch() in Admin.tsx — but there is no visible export button in the UI. The call exists in a handler that may not be wired to a rendered button.",
    buildEstimate: "30 minutes (UI button only)",
    notes: "STATUS: Actually called from Admin.tsx line 1898 via trpcUtils — may be wired to a button that was not found by the static scan. Verify before building.",
  },

  // ── docketGoblin ──────────────────────────────────────────
  {
    namespace: "docketGoblin",
    name: "listForDocument",
    access: "adminProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema: "{ documentId: number }",
    description:
      "Returns the Goblin ingest history for a specific document — all pipeline runs, extracted data, and QC results.",
    potentialUse:
      "Evidence Detail admin panel: 'Goblin History' tab showing every pipeline run for this document, what was extracted, QC supervisor verdict, and any changes made. Useful for debugging mis-classified documents.",
    buildEstimate: "1–2 hours",
  },
  {
    namespace: "docketGoblin",
    name: "listForStory",
    access: "adminProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "{ storyId: number }",
    description:
      "Returns all Goblin ingest runs associated with a story.",
    potentialUse:
      "Admin story detail: 'Ingest Activity' feed showing all documents ingested for this story, their pipeline status, and QC outcomes. Useful for story-level archive health monitoring.",
    buildEstimate: "1 hour",
  },

  // ── evidenceEngine ────────────────────────────────────────
  {
    namespace: "evidenceEngine",
    name: "reclassify",
    access: "adminProcedure",
    status: "dormant",
    priority: "high",
    inputSchema: "{ documentId: number }",
    description:
      "Re-runs the full classification pipeline (classifyDocument + qcReview) on a single document. Fetches the stored file if available, otherwise uses metadata. Snapshots a new version on change.",
    potentialUse:
      "Evidence Detail admin panel: 'Re-classify' button. When a document's classification looks wrong, this triggers a fresh AI pass without requiring a full re-ingest. The version snapshot means the old classification is preserved.",
    buildEstimate: "30 minutes (button + confirmation dialog)",
    notes: "High value for the 26 UNDATED documents in the review queue — one-click re-analysis per document.",
  },
  {
    namespace: "evidenceEngine",
    name: "batchClassify",
    access: "adminProcedure",
    status: "dormant",
    priority: "high",
    inputSchema:
      "{ onlyUnclassified: boolean (default true), limit: 1–15 (default 8), afterId: number (default 0) }",
    description:
      "Runs the classification pipeline across multiple documents in a single call. Supports pagination via afterId for processing large batches incrementally.",
    potentialUse:
      "Admin Manage page: 'Batch Re-classify' button with progress indicator. Process all unclassified documents in chunks of 8. Essential for the 26 UNDATED documents — currently the only way to trigger batch classification is via a script.",
    buildEstimate: "2–3 hours (progress UI with polling)",
    notes: "The most operationally important unexposed procedure. The 26 UNDATED documents in the review queue are the primary target.",
  },
  {
    namespace: "evidenceEngine",
    name: "version",
    access: "adminProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "{ documentId: number, versionNo: number }",
    description:
      "Fetches a single version snapshot by document ID and version number.",
    potentialUse:
      "Version history drawer on Evidence Detail: clicking a specific version in the list to view its full snapshot before deciding to restore. Currently the drawer shows a list of versions but clicking one doesn't load its full content.",
    buildEstimate: "1 hour",
  },
  {
    namespace: "evidenceEngine",
    name: "listPackages",
    access: "publicProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "{ recordStatus?: 'state_case'|'federal_case'|'supporting'|'unfiled'|'unclassified' }",
    description:
      "Returns filing packages grouped by record status — a structured view of the archive organized by case.",
    potentialUse:
      "A 'Filing Packages' view on the Evidence Archive or Case Report page: organized by case (state/federal), showing documents grouped into logical filing units rather than a flat list. Useful for attorney review artifacts.",
    buildEstimate: "2 hours",
  },

  // ── judicialPattern ───────────────────────────────────────
  {
    namespace: "judicialPattern",
    name: "adminIngest",
    access: "adminProcedure",
    status: "dormant",
    priority: "medium",
    inputSchema:
      "{ caseNumber, judgeName, department?, caseType: 'criminal_felony'|'criminal_misdemeanor'|'civil'|'family'|'small_claims'|'other', ... }",
    description:
      "Ingests a new case into the judicial pattern corpus for comparative analysis against the Breslow docket.",
    potentialUse:
      "Judicial Pattern admin page: 'Add Comparison Case' form. Currently the corpus is seeded via SQL. This enables live expansion of the comparison set — add any Washoe County case to build statistical significance for the pattern analysis.",
    buildEstimate: "2 hours",
  },
  {
    namespace: "judicialPattern",
    name: "adminUpdate",
    access: "adminProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "{ id: number, patch: { ... } }",
    description: "Updates metadata on an existing judicial pattern corpus entry.",
    potentialUse:
      "Judicial Pattern admin: inline edit for corpus entries — correct case numbers, add outcomes, update status.",
    buildEstimate: "1 hour",
  },

  // ── story ─────────────────────────────────────────────────
  {
    namespace: "story",
    name: "bySlug",
    access: "publicProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "{ slug: string }",
    description: "Fetches a story by its URL slug.",
    potentialUse:
      "Public story detail page at /cases/:slug — currently the frontend uses story.featured for the single-story use case. bySlug would enable multi-story support if the archive expands beyond the Church matter.",
    buildEstimate: "30 minutes",
  },
  {
    namespace: "story",
    name: "listApproved",
    access: "publicProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "none",
    description: "Returns all approved, public stories.",
    potentialUse:
      "A public case index page if the archive expands to cover multiple defendants or cases. Currently redundant since there is only one story.",
    buildEstimate: "1 hour",
  },

  // ── user ──────────────────────────────────────────────────
  {
    namespace: "user",
    name: "adminList",
    access: "adminProcedure",
    status: "dormant",
    priority: "low",
    inputSchema: "none",
    description:
      "Returns all users (bare list, no counts). The frontend uses user.adminListWithCounts which returns the same data plus violation/document counts per user.",
    potentialUse:
      "Redundant given adminListWithCounts. Could be used for lightweight user lookups in dropdowns (e.g. 'Assign reviewer') where the full count data is unnecessary overhead.",
    buildEstimate: "N/A — superseded by adminListWithCounts",
    notes: "Functionally redundant. Safe to deprecate.",
  },
];

const ACCESS_CONFIG: Record<AccessLevel, { label: string; color: string; icon: React.ReactNode }> = {
  adminProcedure: {
    label: "Admin only",
    color: "text-red-400 bg-red-900/20 border-red-800/40",
    icon: <Shield className="w-3 h-3" />,
  },
  protectedProcedure: {
    label: "Authenticated",
    color: "text-amber-400 bg-amber-900/20 border-amber-800/40",
    icon: <Lock className="w-3 h-3" />,
  },
  publicProcedure: {
    label: "Public",
    color: "text-green-400 bg-green-900/20 border-green-800/40",
    icon: <Globe className="w-3 h-3" />,
  },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  dormant: { label: "Dormant", color: "text-zinc-400 bg-zinc-800/60" },
  partial: { label: "Partial", color: "text-amber-400 bg-amber-900/20" },
  "api-only": { label: "API Only", color: "text-blue-400 bg-blue-900/20" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  high: { label: "High", color: "text-red-300", dot: "bg-red-500" },
  medium: { label: "Medium", color: "text-amber-300", dot: "bg-amber-500" },
  low: { label: "Low", color: "text-zinc-400", dot: "bg-zinc-500" },
};

const NAMESPACE_ICONS: Record<string, React.ReactNode> = {
  actorLink: <Link2 className="w-4 h-4" />,
  adminEdit: <FileText className="w-4 h-4" />,
  agency: <Building2 className="w-4 h-4" />,
  audit: <ScrollText className="w-4 h-4" />,
  docketGoblin: <Zap className="w-4 h-4" />,
  evidenceEngine: <Layers className="w-4 h-4" />,
  judicialPattern: <BarChart3 className="w-4 h-4" />,
  story: <Database className="w-4 h-4" />,
  user: <Users className="w-4 h-4" />,
};

const NAMESPACE_LABELS: Record<string, string> = {
  actorLink: "Actor Links",
  adminEdit: "Admin Edit",
  agency: "Agency",
  audit: "Audit Log",
  docketGoblin: "Docket Goblin",
  evidenceEngine: "Evidence Engine",
  judicialPattern: "Judicial Pattern",
  story: "Story",
  user: "User",
};

function ProcedureCard({ proc }: { proc: Procedure }) {
  const [expanded, setExpanded] = useState(false);
  const access = ACCESS_CONFIG[proc.access];
  const status = STATUS_CONFIG[proc.status];
  const priority = PRIORITY_CONFIG[proc.priority];

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <code className="text-sm font-mono text-zinc-100">
                <span className="text-zinc-500">{proc.namespace}.</span>
                <span className="text-amber-300">{proc.name}</span>
              </code>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${access.color}`}>
                {access.icon}
                {access.label}
              </span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-zinc-400 line-clamp-1">{proc.description}</p>
            {!expanded && (
              <div className="flex items-center gap-3 mt-1.5">
                <span className={`inline-flex items-center gap-1 text-[10px] ${priority.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
                  {priority.label} priority
                </span>
                <span className="text-[10px] text-zinc-600">~{proc.buildEstimate}</span>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 text-zinc-600 mt-0.5">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/40 px-4 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-zinc-300">{proc.description}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Input Schema</p>
            <code className="block text-xs text-green-300 bg-zinc-950 rounded px-3 py-2 font-mono leading-relaxed">
              {proc.inputSchema}
            </code>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Potential Use</p>
            <p className="text-sm text-zinc-300">{proc.potentialUse}</p>
          </div>

          {proc.notes && (
            <div className="flex items-start gap-2 p-3 rounded bg-amber-950/30 border border-amber-900/40">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">{proc.notes}</p>
            </div>
          )}

          <div className="flex items-center gap-4 pt-1 border-t border-zinc-800">
            <span className={`inline-flex items-center gap-1.5 text-xs ${priority.color}`}>
              <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
              {priority.label} priority
            </span>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Build estimate: {proc.buildEstimate}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ApiSurfaceMap() {
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [accessFilter, setAccessFilter] = useState<AccessLevel | "all">("all");

  const filtered = PROCEDURES.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.namespace.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.potentialUse.toLowerCase().includes(q);
    const matchPriority = priorityFilter === "all" || p.priority === priorityFilter;
    const matchAccess = accessFilter === "all" || p.access === accessFilter;
    return matchSearch && matchPriority && matchAccess;
  });

  // Group by namespace
  const namespaces = Array.from(new Set(filtered.map((p) => p.namespace)));

  const highCount = PROCEDURES.filter((p) => p.priority === "high").length;
  const adminCount = PROCEDURES.filter((p) => p.access === "adminProcedure").length;
  const publicCount = PROCEDURES.filter((p) => p.access === "publicProcedure").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Code2 className="w-5 h-5 text-amber-400" />
          <h1 className="text-2xl font-bold text-zinc-100">API Surface Map</h1>
        </div>
        <p className="text-sm text-zinc-400 max-w-2xl">
          22 tRPC procedures exist in the backend with no frontend UI wired. These are fully
          implemented, type-safe, and callable — they just have no page, button, or hook consuming
          them yet.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Unexposed", value: PROCEDURES.length, color: "text-zinc-100", bg: "bg-zinc-800/60" },
          { label: "High Priority", value: highCount, color: "text-red-300", bg: "bg-red-950/30 border border-red-900/40" },
          { label: "Admin-only", value: adminCount, color: "text-amber-300", bg: "bg-amber-950/30 border border-amber-900/40" },
          { label: "Public", value: publicCount, color: "text-green-300", bg: "bg-green-950/30 border border-green-900/40" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg px-4 py-3 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search procedures…"
            className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-700"
          />
        </div>

        <div className="flex gap-1.5">
          {(["all", "high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                priorityFilter === p
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {p === "all" ? "All priorities" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {(["all", "adminProcedure", "publicProcedure"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAccessFilter(a)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                accessFilter === a
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {a === "all" ? "All access" : a === "adminProcedure" ? "Admin" : "Public"}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-zinc-600 self-center">
          {filtered.length} of {PROCEDURES.length} procedures
        </span>
      </div>

      {/* Grouped by namespace */}
      {namespaces.length === 0 ? (
        <div className="text-center py-12 text-zinc-600">
          <Code2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No procedures match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {namespaces.map((ns) => {
            const procs = filtered.filter((p) => p.namespace === ns);
            return (
              <div key={ns}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-zinc-500">{NAMESPACE_ICONS[ns]}</span>
                  <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                    {NAMESPACE_LABELS[ns] ?? ns}
                  </h2>
                  <span className="text-xs text-zinc-600">
                    {procs.length} procedure{procs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {procs.map((proc) => (
                    <ProcedureCard key={`${proc.namespace}.${proc.name}`} proc={proc} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Build priority summary */}
      <div className="mt-10 pt-6 border-t border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-400 mb-4">Recommended Build Order</h3>
        <div className="space-y-2">
          {[
            {
              rank: 1,
              item: "evidenceEngine.batchClassify + reclassify",
              reason: "Unblocks the 26 UNDATED documents in the review queue. Highest operational impact.",
            },
            {
              rank: 2,
              item: "adminEdit.inlineEdit",
              reason: "Single mutation, five record types, full audit trail. Enables click-to-edit across the entire admin interface.",
            },
            {
              rank: 3,
              item: "actorLink.addDocumentLink + addTimelineLink + removeDocumentLink",
              reason: "Enables live actor-document relationship management. Currently only possible via SQL.",
            },
            {
              rank: 4,
              item: "adminEdit.editStory + editDocument",
              reason: "Comprehensive editorial edit paths with audit logging. Replaces the partial adminUpdate procedures.",
            },
            {
              rank: 5,
              item: "actorLink.getDocumentActors + getTimelineLinks",
              reason: "Enriches public actor dossiers and evidence detail pages with structured relationship data.",
            },
          ].map((item) => (
            <div key={item.rank} className="flex items-start gap-3 text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-xs flex items-center justify-center font-mono mt-0.5">
                {item.rank}
              </span>
              <div>
                <code className="text-amber-300 text-xs">{item.item}</code>
                <p className="text-zinc-500 text-xs mt-0.5">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
