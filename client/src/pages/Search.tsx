import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import SiteShell from "@/components/SiteShell";
import { useSEO } from "@/hooks/useSEO";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, FileText, User, Clock, Tag, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function highlight(text: string, q: string): React.ReactNode {
  if (!q || !text) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/30 text-amber-200 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  court_filing: "Court Filing",
  police_report: "Police Report",
  public_record: "Public Record",
  media: "Media",
  correspondence: "Correspondence",
  other: "Other",
};

const RECORD_STATUS_COLORS: Record<string, string> = {
  on_record_state: "bg-blue-900/40 text-blue-300 border-blue-800/50",
  on_record_federal: "bg-indigo-900/40 text-indigo-300 border-indigo-800/50",
  off_record: "bg-stone-800/60 text-stone-400 border-stone-700/50",
  disputed: "bg-amber-900/40 text-amber-300 border-amber-800/50",
  unclassified: "bg-stone-800/40 text-stone-500 border-stone-700/40",
};

export default function SearchPage() {
  const [, navigate] = useLocation();
  const [rawQ, setRawQ] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("q") ?? "";
  });
  const [query, setQuery] = useState(rawQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useSEO({ title: "Search — The Reno Record", description: "Search the full archive: documents, actors, timeline events, and violation patterns." });

  // Debounce input → query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(rawQ);
      const url = rawQ.trim() ? `/search?q=${encodeURIComponent(rawQ.trim())}` : "/search";
      window.history.replaceState(null, "", url);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [rawQ]);

  const enabled = query.trim().length >= 2;
  const { data, isFetching, error } = trpc.search.global.useQuery(
    { q: query.trim() },
    { enabled, staleTime: 30_000 },
  );

  const totalHits = (data?.documents.length ?? 0) + (data?.actors.length ?? 0) + (data?.timeline.length ?? 0) + (data?.violations.length ?? 0);

  return (
    <SiteShell>
      <div className="min-h-screen bg-stone-950 text-stone-100">
        <div className="max-w-4xl mx-auto px-4 pt-12 pb-20">
          {/* Search bar */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <SearchIcon className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-bold text-stone-100 font-mono uppercase tracking-widest">Archive Search</h1>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
              <Input
                autoFocus
                value={rawQ}
                onChange={(e) => setRawQ(e.target.value)}
                placeholder="Search documents, actors, timeline, violations…"
                className="pl-9 bg-stone-900 border-stone-700 text-stone-100 placeholder:text-stone-600 focus:border-amber-600 h-11 text-base"
              />
              {isFetching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 animate-spin" />
              )}
            </div>
            {enabled && !isFetching && data && (
              <p className="mt-2 text-xs font-mono text-stone-500">
                {totalHits} result{totalHits !== 1 ? "s" : ""} for <span className="text-amber-400">"{query}"</span>
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-6">
              <AlertCircle className="w-4 h-4" />
              Search failed. Try again.
            </div>
          )}

          {/* Empty prompt */}
          {!enabled && (
            <div className="text-center py-20 text-stone-600">
              <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">Type at least 2 characters to search</p>
            </div>
          )}

          {/* No results */}
          {enabled && !isFetching && data && totalHits === 0 && (
            <div className="text-center py-20 text-stone-600">
              <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">No results found for "{query}"</p>
            </div>
          )}

          {/* Results */}
          {data && totalHits > 0 && (
            <div className="space-y-8">
              {/* Documents */}
              {data.documents.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-800">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-mono uppercase tracking-widest text-stone-400">Documents</span>
                    <Badge variant="outline" className="ml-auto text-xs border-stone-700 text-stone-500">{data.documents.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {data.documents.map((doc) => (
                      <Link key={doc.id} href={`/evidence/${doc.id}`}>
                        <div className="group rounded border border-stone-800 bg-stone-900/40 hover:border-amber-700/50 hover:bg-stone-900/70 p-3 cursor-pointer transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-200 group-hover:text-amber-300 transition-colors leading-snug">
                                {highlight(doc.title, query)}
                              </p>
                              {doc.description && (
                                <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                                  {highlight(doc.description, query)}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {doc.recordStatus && (
                                <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", RECORD_STATUS_COLORS[doc.recordStatus] ?? "bg-stone-800 text-stone-400 border-stone-700")}>
                                  {doc.recordStatus.replace(/_/g, " ")}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-stone-600">
                                {SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                              </span>
                            </div>
                          </div>
                          {(doc.caseNumber || doc.filingStampDate) && (
                            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-stone-600">
                              {doc.caseNumber && <span>{doc.caseNumber}</span>}
                              {doc.filingStampDate && <span>{new Date(doc.filingStampDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Actors */}
              {data.actors.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-800">
                    <User className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-mono uppercase tracking-widest text-stone-400">Actors</span>
                    <Badge variant="outline" className="ml-auto text-xs border-stone-700 text-stone-500">{data.actors.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {data.actors.map((actor) => (
                      <Link key={actor.id} href={`/actors/${actor.slug}`}>
                        <div className="group rounded border border-stone-800 bg-stone-900/40 hover:border-sky-700/50 hover:bg-stone-900/70 p-3 cursor-pointer transition-all">
                          <p className="text-sm font-medium text-stone-200 group-hover:text-sky-300 transition-colors">
                            {highlight(actor.name, query)}
                          </p>
                          {(actor.role || actor.agency) && (
                            <p className="text-xs text-stone-500 mt-0.5">
                              {[actor.role, actor.agency].filter(Boolean).map((s, i) => (
                                <span key={i}>{i > 0 && " · "}{highlight(s!, query)}</span>
                              ))}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline */}
              {data.timeline.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-800">
                    <Clock className="w-4 h-4 text-violet-400" />
                    <span className="text-xs font-mono uppercase tracking-widest text-stone-400">Timeline Events</span>
                    <Badge variant="outline" className="ml-auto text-xs border-stone-700 text-stone-500">{data.timeline.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {data.timeline.map((ev) => (
                      <Link key={ev.id} href="/timeline">
                        <div className="group rounded border border-stone-800 bg-stone-900/40 hover:border-violet-700/50 hover:bg-stone-900/70 p-3 cursor-pointer transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium text-stone-200 group-hover:text-violet-300 transition-colors leading-snug">
                              {highlight(ev.title, query)}
                            </p>
                            <span className="text-[10px] font-mono text-stone-600 shrink-0">
                              {new Date(ev.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          </div>
                          {ev.summary && (
                            <p className="text-xs text-stone-500 mt-1 line-clamp-2">{highlight(ev.summary, query)}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Violations */}
              {data.violations.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-800">
                    <Tag className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-mono uppercase tracking-widest text-stone-400">Violation Patterns</span>
                    <Badge variant="outline" className="ml-auto text-xs border-stone-700 text-stone-500">{data.violations.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {data.violations.map((vt) => (
                      <Link key={vt.id} href={`/patterns/tag/${vt.slug}`}>
                        <div className="group rounded border border-stone-800 bg-stone-900/40 hover:border-red-700/50 hover:bg-stone-900/70 p-3 cursor-pointer transition-all">
                          <p className="text-sm font-medium text-stone-200 group-hover:text-red-300 transition-colors">
                            {highlight(vt.label, query)}
                          </p>
                          {vt.description && (
                            <p className="text-xs text-stone-500 mt-1 line-clamp-2">{highlight(vt.description, query)}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
