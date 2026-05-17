import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Calendar,
  User,
  Tag,
  Link2,
  Download,
  Clock,
  ChevronLeft,
  ExternalLink,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  court_order: "Court Order",
  motion: "Motion",
  email: "Email",
  transcript: "Transcript",
  warrant: "Warrant",
  public_records_response: "Public Records Response",
  audio: "Audio Recording",
  video: "Video Recording",
  image: "Image",
  jail_record: "Jail Record",
  risk_notice: "Risk Notice",
  other: "Document",
};

const CATEGORY_LABELS: Record<string, string> = {
  state_case: "State Case",
  federal_case: "Federal Case",
  custody: "Custody",
  motion: "Motion",
  warrant: "Warrant",
  competency: "Competency",
  public_records: "Public Records",
  communications: "Communications",
  election_accountability: "Election Accountability",
  other: "Other",
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** URL for inline embedding — always streams server-side, never redirects to CloudFront */
function fileProxyUrl(fileKey?: string | null): string {
  if (!fileKey) return "";
  const encodedKey = fileKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/api/file-proxy/${encodedKey}`;
}

/** URL for download / open-in-new-tab — uses /manus-storage/ redirect (fine for navigation) */
function storageDownloadUrl(fileKey?: string | null, fileUrl?: string | null): string {
  if (fileKey) {
    const encodedKey = fileKey
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `/manus-storage/${encodedKey}`;
  }
  return fileUrl ?? "";
}

export default function EvidenceDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? "0", 10);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: doc, isLoading } = trpc.document.byId.useQuery(
    { id },
    { enabled: !!id && !isNaN(id), retry: false }
  );
  const { data: relatedEvents = [] } = trpc.document.relatedEvents.useQuery(
    { docId: id },
    { enabled: !!doc }
  );

  const pageTitle = doc
    ? `${doc.title} — The Reno Record`
    : "Document Not Found — The Reno Record";
  const pageDesc = doc?.description ?? doc?.aiSummary ?? "Public accountability document from The Reno Record archive.";

  useSEO({
    title: doc ? doc.title : "Document Not Found",
    description: pageDesc,
    ogType: "article",
    canonicalPath: `/evidence/${id}`,
  });

  const canonicalUrl = `${window.location.origin}/evidence/${id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(canonicalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    const title = doc?.title ?? "Document";
    const text = `"${title}" — on the public record at The Reno Record. #PublicRecord #Accountability #WashoeCounty`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(canonicalUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
  };

  // Parse actor names from comma-separated string
  const actorNames: string[] = doc?.actorNames
    ? doc.actorNames.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const issueTags: string[] = Array.isArray(doc?.issueTags) ? doc.issueTags : [];
  const aiTags: string[] = Array.isArray(doc?.aiTags) ? doc.aiTags : [];

  if (isLoading) {
    return (
      <SiteShell>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground font-mono text-sm tracking-widest uppercase">
              Loading record…
            </p>
          </div>
        </div>
      </SiteShell>
    );
  }

  if (!doc) {
    return (
      <SiteShell>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center space-y-6 max-w-md">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
                Record Not Found
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                This document is either private, pending review, or does not exist.
                If you believe this is an error, contact the archive.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" asChild>
                <Link href="/evidence">Browse Evidence Archive</Link>
              </Button>
              <Button asChild className="bg-amber-400 text-navy-900 hover:bg-amber-300">
                <Link href="/submit">Submit a Record</Link>
              </Button>
            </div>
          </div>
        </div>
      </SiteShell>
    );
  }

  // embedUrl: server-side proxy — never redirects, safe for iframe/object/audio/video
  const embedUrl = fileProxyUrl(doc.fileKey);
  // downloadUrl: /manus-storage/ redirect — fine for <a href> download/open
  const downloadUrl = storageDownloadUrl(doc.fileKey, doc.fileUrl);
  const mimeType = doc.mimeType ?? "";
  const lowerKey = (doc.fileKey ?? "").toLowerCase();
  const hasEvidenceFile = !!(doc.fileKey || doc.fileUrl);
  const isPdf = mimeType === "application/pdf" || lowerKey.endsWith(".pdf");
  const isImage = mimeType.startsWith("image/");
  const isAudio = mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");

  return (
    <SiteShell>
      <div className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <div className="border-b border-border/40 bg-card/30">
          <div className="container py-3">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <span>/</span>
              <Link href="/evidence" className="hover:text-foreground transition-colors">Evidence Archive</Link>
              <span>/</span>
              <span className="text-foreground truncate max-w-[200px]">{doc.title}</span>
            </nav>
          </div>
        </div>

        <div className="container py-8 lg:py-12">
          <div className="max-w-5xl mx-auto">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/evidence")}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Archive
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Header */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs uppercase tracking-wider border-amber-400/50 text-amber-400">
                      {SOURCE_LABELS[doc.sourceType] ?? "Document"}
                    </Badge>
                    {doc.caseNumber && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {doc.caseNumber}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="font-mono text-xs text-emerald-400 border-emerald-400/50"
                    >
                      Public Record
                    </Badge>
                  </div>

                  <h1 className="font-serif text-3xl lg:text-4xl font-bold text-foreground leading-tight">
                    {doc.title}
                  </h1>

                  {doc.documentDate && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(doc.documentDate)}</span>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {(doc.description || doc.aiSummary) && (
                  <div className="paper-card p-5 space-y-3">
                    <h2 className="font-mono text-xs uppercase tracking-widest text-amber-400">
                      Summary
                    </h2>
                    <p className="text-foreground/90 leading-relaxed">
                      {doc.description ?? doc.aiSummary}
                    </p>
                    {doc.aiSummary && !doc.description && (
                      <p className="text-xs text-muted-foreground font-mono">
                        AI-assisted summary — reviewed by archive editor
                      </p>
                    )}
                  </div>
                )}

                {/* Correction / Editorial notes — public transparency */}
                {(doc.correctionNote || doc.editorialNote) && (
                  <div className="space-y-3">
                    {doc.correctionNote && (
                      <div className="rounded border border-blue-500/30 bg-blue-500/5 p-4">
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-mono uppercase tracking-widest text-blue-500 mb-1">Correction notice</div>
                            <p className="text-sm text-foreground/85">{doc.correctionNote}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {doc.editorialNote && (
                      <div className="rounded border border-amber-400/30 bg-amber-400/5 p-4">
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-mono uppercase tracking-widest text-amber-400 mb-1">Editorial note</div>
                            <p className="text-sm text-foreground/85">{doc.editorialNote}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Evidence file viewer */}
                <div className="paper-card overflow-hidden">
                  <div className="p-4 border-b border-border/40 flex flex-col gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-medium text-foreground text-sm leading-snug break-words">
                          {doc.title}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                          {mimeType && <span>{mimeType}</span>}
                          {doc.fileSize && <span>{formatBytes(doc.fileSize)}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      {hasEvidenceFile ? (
                        <>
                          <Button
                            size="sm"
                            asChild
                            className="bg-amber-400 text-navy-900 hover:bg-amber-300 text-xs"
                          >
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download>
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild className="text-xs">
                            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open original
                            </a>
                          </Button>
                        </>
                      ) : (
                        <div className="col-span-2 text-xs text-muted-foreground">
                          This record has metadata but no stored evidence file attached.
                        </div>
                      )}
                    </div>
                  </div>

                  {!hasEvidenceFile ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p className="text-sm">No evidence file is available for inline viewing.</p>
                    </div>
                  ) : isPdf ? (
                    <div className="w-full bg-card">
                      <object data={`${embedUrl}#toolbar=1`} type="application/pdf" className="w-full h-[72vh] min-h-[520px]">
                        <iframe
                          src={`${embedUrl}#toolbar=1`}
                          className="w-full h-[72vh] min-h-[520px] border-0"
                          title={doc.title}
                        />
                      </object>
                    </div>
                  ) : isImage ? (
                    <div className="bg-card p-2 sm:p-4">
                      <img src={embedUrl} alt={doc.title} className="mx-auto max-h-[72vh] w-full object-contain rounded-sm" />
                    </div>
                  ) : isAudio ? (
                    <div className="p-5 sm:p-8">
                      <audio controls src={embedUrl} className="w-full" />
                    </div>
                  ) : isVideo ? (
                    <div className="bg-black">
                      <video controls src={embedUrl} className="w-full max-h-[72vh]" />
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <h3 className="font-serif text-xl text-foreground">Preview unavailable for this file type</h3>
                      <p className="mt-2 text-sm">Use Open original or Download above. The URL now goes through the same-origin storage proxy to avoid the broken direct-file error.</p>
                    </div>
                  )}
                </div>

                {/* Related Timeline Events */}
                {relatedEvents.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-mono text-xs uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Referenced in Timeline
                    </h2>
                    <div className="space-y-2">
                      {relatedEvents.map((ev) => (
                        <Link
                          key={ev.id}
                          href={`/timeline#event-${ev.id}`}
                          className="block paper-card p-4 hover:border-amber-400/40 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <p className="font-medium text-foreground group-hover:text-amber-400 transition-colors text-sm leading-snug">
                                {ev.title}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {formatDate(ev.eventDate)}
                                {ev.category && (
                                  <span className="ml-2 uppercase tracking-wider">
                                    · {CATEGORY_LABELS[ev.category] ?? ev.category}
                                  </span>
                                )}
                              </p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-amber-400 flex-shrink-0 mt-0.5 transition-colors" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Share */}
                <div className="paper-card p-5 space-y-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-amber-400">
                    Share This Record
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs gap-2"
                      onClick={handleCopy}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs gap-2"
                      onClick={handleShare}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Post to X
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Canonical URL:
                    <br />
                    <span className="font-mono break-all text-foreground/70">{canonicalUrl}</span>
                  </p>
                </div>

                {/* Actors */}
                {actorNames.length > 0 && (
                  <div className="paper-card p-5 space-y-3">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <User className="w-3.5 h-3.5" />
                      Named Actors
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {actorNames.map((name) => (
                        <Link
                          key={name}
                          href={`/actors/${encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"))}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-card border border-border hover:border-amber-400/50 hover:text-amber-400 transition-colors font-mono"
                        >
                          {name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {(issueTags.length > 0 || aiTags.length > 0) && (
                  <div className="paper-card p-5 space-y-3">
                    <h3 className="font-mono text-xs uppercase tracking-widest text-amber-400 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      Issue Tags
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(new Set([...issueTags, ...aiTags])).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-xs bg-amber-400/10 text-amber-400/80 border border-amber-400/20 font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="paper-card p-5 space-y-3">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-amber-400">
                    Record Metadata
                  </h3>
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground font-mono">Source Type</dt>
                      <dd className="text-foreground text-right">{SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}</dd>
                    </div>
                    {doc.caseNumber && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground font-mono">Case No.</dt>
                        <dd className="text-foreground font-mono text-right">{doc.caseNumber}</dd>
                      </div>
                    )}
                    {doc.documentDate && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground font-mono">Document Date</dt>
                        <dd className="text-foreground text-right">{formatDate(doc.documentDate)}</dd>
                      </div>
                    )}
                    {doc.fileSize && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground font-mono">File Size</dt>
                        <dd className="text-foreground font-mono text-right">{formatBytes(doc.fileSize)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground font-mono">Status</dt>
                      <dd className="text-emerald-400 font-mono text-right">Approved · Public</dd>
                    </div>
                    <Separator className="opacity-30" />
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground font-mono">Added</dt>
                      <dd className="text-foreground text-right">{formatDate(doc.createdAt)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Archive link */}
                <div className="paper-card p-4 flex items-center gap-3 hover:border-amber-400/40 transition-colors group">
                  <BookOpen className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <Link href="/evidence" className="text-sm font-medium text-foreground group-hover:text-amber-400 transition-colors">
                      Browse Full Archive
                    </Link>
                    <p className="text-xs text-muted-foreground">All public records</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
