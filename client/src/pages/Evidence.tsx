import { useSEO } from "@/hooks/useSEO";
import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, FileText, ExternalLink, Search, X } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function sameOriginStorageUrl(fileKey?: string | null, fileUrl?: string | null): string {
  if (!fileKey) return fileUrl ?? "#";
  const encodedKey = fileKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `/manus-storage/${encodedKey}`;
}

const SOURCE_TYPES = [
  { value: "all", label: "All" },
  { value: "court_order", label: "Court order" },
  { value: "motion", label: "Motion" },
  { value: "email", label: "Email" },
  { value: "transcript", label: "Transcript" },
  { value: "warrant", label: "Warrant" },
  { value: "public_records_response", label: "PRR response" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "jail_record", label: "Jail/custody" },
  { value: "risk_notice", label: "Risk notice" },
  { value: "other", label: "Other" },
];

export default function EvidencePage() {
  useSEO({ title: "Evidence Archive", description: "Searchable archive of source documents: transcripts, orders, motions, and filings. Every claim has a receipt.", canonicalPath: "/evidence" });
  const [, params] = useRoute("/evidence/:id");
  if (params?.id) return <EvidenceDetail id={Number(params.id)} />;
  return <EvidenceList />;
}

function EvidenceList() {
  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");
  const docs = trpc.document.listPublic.useQuery({ q, sourceType: source });

  const grouped = useMemo(() => {
    const map: Record<string, typeof docs.data extends (infer T)[] | undefined ? T[] : never> = {} as any;
    (docs.data ?? []).forEach((d) => {
      const k = d.sourceType;
      (map[k] = map[k] || ([] as any)).push(d);
    });
    return map;
  }, [docs.data]);

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="eyebrow">Evidence Archive</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Receipts, on file.
            </h1>
            <p className="mt-5 text-foreground/80 leading-relaxed">
              Approved orders, motions, transcripts, warrants, emails, and public records
              responses. PDFs open inline. Searchable by title, description, actor, and case
              number.
            </p>

            <div className="mt-7 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search evidence…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9 bg-background"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    aria-label="Clear"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSource(t.value)}
                    className={cn(
                      "px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-widest rounded-sm border transition-colors",
                      source === t.value
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-foreground border-border hover:border-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {docs.isLoading && <p className="text-muted-foreground">Loading archive…</p>}
            {!docs.isLoading && (docs.data ?? []).length === 0 && (
              <div className="paper-card p-10 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                <h3 className="display-serif text-2xl mt-4">No documents match.</h3>
                <p className="text-muted-foreground mt-2">
                  Try a different filter or clear your search. Approved evidence will appear here as
                  it lands in the archive.
                </p>
              </div>
            )}
            {Object.entries(grouped).map(([type, list]) => (
              <div key={type} className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="eyebrow">
                    {SOURCE_TYPES.find((s) => s.value === type)?.label || type}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <div className="text-xs font-mono text-muted-foreground">
                    {(list as any[]).length} item{(list as any[]).length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(list as any[]).map((d) => (
                    <Link key={d.id} href={`/evidence/${d.id}`}>
                      <div className="paper-card p-5 h-full hover:-translate-y-0.5 transition-transform">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold tracking-tight leading-snug">{d.title}</h3>
                          <Badge variant="outline" className="font-mono uppercase text-[10px] shrink-0">
                            #{d.id}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                          {d.documentDate
                            ? new Date(d.documentDate).toLocaleDateString()
                            : "Date unknown"}
                          {d.caseNumber ? ` · ${d.caseNumber}` : ""}
                        </div>
                        {d.description && (
                          <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-3">
                            {d.description}
                          </p>
                        )}
                        {(d.aiTags ?? []).length > 0 && (
                          <div className="mt-3 flex gap-1.5 flex-wrap">
                            {(d.aiTags as string[]).slice(0, 5).map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="font-mono uppercase text-[10px]"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

function EvidenceDetail({ id }: { id: number }) {
  const { data: doc, isLoading } = trpc.document.byId.useQuery({ id });
  const fileUrl = doc ? sameOriginStorageUrl(doc.fileKey, doc.fileUrl) : "#";

  return (
    <SiteShell>
      <section className="container py-10 md:py-14">
        <Link href="/evidence">
          <Button variant="ghost" className="gap-2 mb-6 -ml-3">
            <ArrowLeft className="h-4 w-4" /> Back to archive
          </Button>
        </Link>

        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && !doc && (
          <div className="paper-card p-10 text-center">
            <h3 className="display-serif text-2xl">Document not available</h3>
            <p className="text-muted-foreground mt-2">
              This document may not be public, or it has not been approved yet.
            </p>
          </div>
        )}

        {doc && (
          <div className="grid lg:grid-cols-12 gap-8">
            <aside className="lg:col-span-4 lg:order-2">
              <div className="paper-card p-6">
                <div className="eyebrow">Evidence #{doc.id}</div>
                <h1 className="display-serif text-2xl mt-2 leading-tight">{doc.title}</h1>
                <div className="mt-4 space-y-3 text-sm">
                  <Meta label="Source type" value={doc.sourceType.replace(/_/g, " ")} />
                  <Meta
                    label="Document date"
                    value={
                      doc.documentDate ? new Date(doc.documentDate).toLocaleDateString() : "—"
                    }
                  />
                  <Meta label="Case number" value={doc.caseNumber || "—"} />
                  <Meta label="Actors" value={doc.actorNames || "—"} />
                  <Meta label="MIME" value={doc.mimeType || "—"} />
                  <Meta label="Redaction" value={doc.redactionStatus.replace(/_/g, " ")} />
                </div>
                {doc.description && (
                  <>
                    <div className="eyebrow mt-6">Description</div>
                    <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
                      {doc.description}
                    </p>
                  </>
                )}
                {doc.aiSummary && (
                  <>
                    <div className="eyebrow mt-6">Goblin summary (advisory)</div>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed italic">
                      {doc.aiSummary}
                    </p>
                  </>
                )}
                {(doc.aiTags ?? []).length > 0 && (
                  <div className="mt-4 flex gap-1.5 flex-wrap">
                    {(doc.aiTags as string[]).map((t) => (
                      <Badge key={t} variant="secondary" className="font-mono uppercase text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-6">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="w-full gap-2">
                      Open in new tab <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            </aside>

            <div className="lg:col-span-8">
              <DocumentViewer url={fileUrl} mime={doc.mimeType ?? ""} title={doc.title} />
            </div>
          </div>
        )}
      </section>
    </SiteShell>
  );
}

function DocumentViewer({ url, mime, title }: { url: string; mime: string; title: string }) {
  const isPdf = mime === "application/pdf" || /\.pdf(\?|$)/i.test(url);
  const isImg = mime.startsWith("image/");
  const isAudio = mime.startsWith("audio/");
  const isVideo = mime.startsWith("video/");

  if (isPdf) {
    return (
      <div className="paper-card overflow-hidden">
        <div className="h-[80vh]">
          <object data={url} type="application/pdf" className="w-full h-full">
            <iframe src={url} title={title} className="w-full h-full border-0" />
          </object>
        </div>
      </div>
    );
  }
  if (isImg) {
    return (
      <div className="paper-card p-4">
        <img src={url} alt={title} className="w-full h-auto rounded-sm" />
      </div>
    );
  }
  if (isAudio) {
    return (
      <div className="paper-card p-6">
        <audio controls src={url} className="w-full" />
      </div>
    );
  }
  if (isVideo) {
    return (
      <div className="paper-card p-4">
        <video controls src={url} className="w-full rounded-sm" />
      </div>
    );
  }
  return (
    <div className="paper-card p-10 text-center">
      <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
      <h3 className="display-serif text-2xl mt-3">Inline preview not available</h3>
      <p className="text-muted-foreground mt-2">Open the file in a new tab to view it.</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Button className="mt-5 gap-2 bg-foreground text-background">
          Open file <ExternalLink className="h-4 w-4" />
        </Button>
      </a>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
      <div className="eyebrow !text-[0.62rem] shrink-0">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
