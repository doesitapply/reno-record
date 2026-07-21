import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft,
  FileText,
  Quote,
  Calendar,
  ExternalLink,
  AlertTriangle,
  BookOpen,
  Hash,
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
  constitutional: "Constitutional",
  procedural: "Procedural",
  discovery: "Discovery",
  judicial_conduct: "Judicial Conduct",
  prosecutorial_conduct: "Prosecutorial Conduct",
  law_enforcement: "Law Enforcement",
  public_records: "Public Records",
  civil_rights: "Civil Rights",
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

/** Group entries by document so each document appears once with all its quotes */
function groupByDocument(entries: Array<{
  dvtId: number;
  docId: number;
  docTitle: string;
  docSourceType: string;
  docCaseNumber: string | null;
  docDate: Date | string | null;
  docFileUrl: string;
  sourceQuote: string;
  sourceCitation: string | null;
  confidence: number;
  addedBy: string;
}>) {
  const map = new Map<number, {
    docId: number;
    docTitle: string;
    docSourceType: string;
    docCaseNumber: string | null;
    docDate: Date | string | null;
    docFileUrl: string;
    quotes: Array<{ dvtId: number; sourceQuote: string; sourceCitation: string | null; confidence: number; addedBy: string }>;
  }>();

  for (const e of entries) {
    if (!map.has(e.docId)) {
      map.set(e.docId, {
        docId: e.docId,
        docTitle: e.docTitle,
        docSourceType: e.docSourceType,
        docCaseNumber: e.docCaseNumber,
        docDate: e.docDate,
        docFileUrl: e.docFileUrl,
        quotes: [],
      });
    }
    map.get(e.docId)!.quotes.push({
      dvtId: e.dvtId,
      sourceQuote: e.sourceQuote,
      sourceCitation: e.sourceCitation,
      confidence: e.confidence,
      addedBy: e.addedBy,
    });
  }

  return Array.from(map.values());
}

export default function ViolationTagDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = trpc.patterns.tagDetail.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );

  useSEO({
    title: data?.tag ? `${data.tag.label} — Evidence Signals` : "Violation Tag",
    description: data?.tag?.description ?? "Source-cited evidence for this procedural violation tag.",
    canonicalPath: `/patterns/tag/${slug}`,
  });

  if (isLoading) {
    return (
      <SiteShell>
        <section className="container py-14 md:py-20">
          <div className="animate-pulse space-y-6 max-w-4xl">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-10 w-2/3 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="space-y-4 mt-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded" />
              ))}
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  if (!data || error) {
    return (
      <SiteShell>
        <section className="container py-14 md:py-20 max-w-3xl">
          <div className="paper-card p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-primary mx-auto" />
            <h1 className="display-serif text-3xl">Tag not found.</h1>
            <p className="text-muted-foreground">
              This violation tag doesn't exist or has no public evidence yet.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/patterns">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Patterns
              </Link>
            </Button>
          </div>
        </section>
      </SiteShell>
    );
  }

  const { tag, entries } = data;
  const grouped = groupByDocument(entries as any);
  const totalQuotes = entries.length;
  const totalDocs = grouped.length;

  return (
    <SiteShell>
      <section className="container py-10 md:py-16">
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link
            href="/patterns"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Patterns Dashboard
          </Link>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Left: tag metadata */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div>
              <div className="eyebrow">Evidence Signal</div>
              <h1 className="display-serif text-4xl md:text-5xl mt-2 leading-[1.05]">
                {tag.label}
              </h1>
              {tag.description && (
                <p className="mt-4 text-sm text-foreground/80 leading-relaxed">{tag.description}</p>
              )}
            </div>

            {/* Stats */}
            <div className="paper-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Documents</span>
                <span className="display-serif text-3xl text-primary">{totalDocs}</span>
              </div>
              <Separator className="opacity-30" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Source Quotes</span>
                <span className="display-serif text-3xl text-primary">{totalQuotes}</span>
              </div>
              <Separator className="opacity-30" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Category</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {CATEGORY_LABELS[tag.category] ?? tag.category}
                </Badge>
              </div>
              <Separator className="opacity-30" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Slug</span>
                <span className="font-mono text-xs text-muted-foreground">{tag.slug}</span>
              </div>
            </div>

            <div className="paper-card p-4 text-xs text-muted-foreground leading-relaxed">
              Every quote below is extracted directly from the source document. Tags are organizational
              labels — not legal conclusions. Readers are encouraged to review the source documents
              directly.
            </div>

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/evidence">
                <BookOpen className="w-4 h-4 mr-2" />
                Browse Full Archive
              </Link>
            </Button>
          </div>

          {/* Right: document list with quotes */}
          <div className="lg:col-span-8 space-y-6">
            {grouped.length === 0 ? (
              <div className="paper-card p-8 text-center text-muted-foreground">
                <Quote className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No public documents are tagged with this signal yet.</p>
              </div>
            ) : (
              grouped.map((doc, docIdx) => (
                <div key={doc.docId} className="paper-card overflow-hidden">
                  {/* Document header */}
                  <div className="p-5 border-b border-border/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="font-mono text-xs text-primary uppercase tracking-widest">
                            {SOURCE_LABELS[doc.docSourceType] ?? doc.docSourceType}
                          </span>
                          {doc.docCaseNumber && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="font-mono text-xs text-muted-foreground">{doc.docCaseNumber}</span>
                            </>
                          )}
                        </div>
                        <Link
                          href={`/evidence/${doc.docId}`}
                          className="font-medium text-foreground hover:text-primary transition-colors leading-snug block"
                        >
                          {doc.docTitle}
                        </Link>
                        {doc.docDate && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(doc.docDate)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <Link href={`/evidence/${doc.docId}`}>
                            View
                          </Link>
                        </Button>
                        {doc.docFileUrl && (
                          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                            <a href={doc.docFileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono px-1.5 py-0 h-5 text-primary/70 border-amber-400/30">
                        {doc.quotes.length} {doc.quotes.length === 1 ? "quote" : "quotes"}
                      </Badge>
                    </div>
                  </div>

                  {/* Source quotes */}
                  <div className="divide-y divide-border/40">
                    {doc.quotes.map((q, qIdx) => (
                      <div key={q.dvtId} className="p-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <Quote className="w-4 h-4 text-primary/60 flex-shrink-0 mt-0.5" />
                          <blockquote className="text-sm text-foreground/90 leading-relaxed italic border-l-2 border-amber-400/40 pl-3">
                            {q.sourceQuote}
                          </blockquote>
                        </div>
                        {q.sourceCitation && (
                          <div className="flex items-center gap-2 pl-7">
                            <Hash className="w-3 h-3 text-muted-foreground/50" />
                            <span className="font-mono text-xs text-muted-foreground">{q.sourceCitation}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 pl-7">
                          <span className="font-mono text-xs text-muted-foreground/60">
                            {q.addedBy === "goblin" ? "AI-extracted" : "Human-verified"}
                          </span>
                          {q.confidence < 100 && (
                            <span className="font-mono text-xs text-primary/60">
                              {q.confidence}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
