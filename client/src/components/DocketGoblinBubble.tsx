import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileUp,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Skull,
  X,
} from "lucide-react";
import { Streamdown } from "streamdown";

type Mode = "closed" | "open";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocketGoblinBubble() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [mode, setMode] = useState<Mode>("closed");
  const [draft, setDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const utils = trpc.useUtils();
  const history = trpc.docketGoblin.history.useQuery(undefined, {
    enabled: isAdmin && mode === "open",
    refetchOnWindowFocus: false,
  });

  const send = trpc.docketGoblin.send.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.docketGoblin.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reset = trpc.docketGoblin.resetChat.useMutation({
    onSuccess: () => {
      utils.docketGoblin.history.invalidate();
      toast.success("New chat started");
    },
  });

  const [recentIngests, setRecentIngests] = useState<
    Array<{ jobId: number; documentId: number; title: string; sourceType: string }>
  >([]);
  const ingest = trpc.docketGoblin.ingest.useMutation({
    onSuccess: (data) => {
      toast.success(`Ingested: "${data.draft.title}" — pending in admin`);
      setRecentIngests((prev) =>
        [
          {
            jobId: data.jobId,
            documentId: data.documentId,
            title: data.draft.title,
            sourceType: data.draft.sourceType,
          },
          ...prev,
        ].slice(0, 6),
      );
      utils.docketGoblin.history.invalidate();
      utils.docketGoblin.ingestList.invalidate();
      utils.document.adminList.invalidate();
    },
    onError: (e) => toast.error(`Ingest failed: ${e.message}`),
  });

  // auto-scroll on new messages
  useEffect(() => {
    if (mode === "open" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mode, history.data?.messages.length, send.isPending, ingest.isPending]);

  if (!isAdmin) return null;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    for (const file of files) {
      if (file.size > 18 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 18 MB upload limit`);
        continue;
      }
      try {
        const dataBase64 = await fileToBase64(file);
        await ingest.mutateAsync({
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64,
        });
      } catch (e: any) {
        toast.error(`Could not ingest ${file.name}: ${e?.message || e}`);
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  // Closed: floating button
  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("open")}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-3 rounded-full border border-amber-400/50 bg-[var(--ink-deep,#0c1430)] pl-3 pr-5 py-3 shadow-2xl hover:border-amber-300 transition"
        aria-label="Open Docket Goblin"
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-400/15 ring-1 ring-amber-300/40">
          <Skull className="h-5 w-5 text-amber-300" />
        </span>
        <span className="text-left">
          <span className="block font-serif text-base leading-none text-bone">Docket Goblin</span>
          <span className="block text-[10px] uppercase tracking-[0.16em] text-amber-300/70">
            Talk · Drop evidence · Auto-structure
          </span>
        </span>
      </button>
    );
  }

  const messages = history.data?.messages ?? [];
  const isBusy = send.isPending || ingest.isPending;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))] h-[min(640px,calc(100vh-3rem))] flex flex-col rounded-xl border border-amber-400/40 bg-[var(--ink-deep,#0c1430)] shadow-2xl"
    >
      {/* header */}
      <div className="flex items-center justify-between border-b border-amber-400/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400/15 ring-1 ring-amber-300/40">
            <Skull className="h-4 w-4 text-amber-300" />
          </span>
          <div className="leading-tight">
            <div className="font-serif text-bone">Docket Goblin</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-amber-300/70">
              Advisory only · Never auto-publishes
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="text-bone/60 hover:text-bone"
            onClick={() => reset.mutate()}
            title="New chat"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-bone/60 hover:text-bone"
            onClick={() => setMode("closed")}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {history.isLoading ? (
          <div className="flex items-center gap-2 text-bone/60 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading chat…
          </div>
        ) : messages.length === 0 ? (
          <Card className="bg-white/[0.03] border-white/10 p-4 text-sm text-bone/80">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquareText className="h-4 w-4 text-amber-300" />
              <span className="font-serif text-bone">Welcome, Counselor.</span>
            </div>
            <p className="leading-snug">
              Ask me about the archive — stories, motions, custody days, who said
              what to whom. Or drop a PDF / image / transcript anywhere on this
              panel and I'll extract, classify, draft tags + a timeline event,
              and stage it as a pending document for your approval.
            </p>
          </Card>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "flex justify-end"
                  : m.role === "assistant"
                    ? "flex justify-start"
                    : "flex justify-center"
              }
            >
              <div
                className={
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed " +
                  (m.role === "user"
                    ? "bg-amber-400/15 text-bone border border-amber-300/30"
                    : m.role === "assistant"
                      ? "bg-white/[0.04] text-bone/90 border border-white/10"
                      : "bg-transparent text-bone/50 italic")
                }
              >
                {m.role === "assistant" ? (
                  <Streamdown>{m.content}</Streamdown>
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </div>
          ))
        )}
        {ingest.isPending && (
          <div className="flex items-center gap-2 text-amber-300 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Ingesting & drafting structure…
          </div>
        )}
        {recentIngests.length > 0 && (
          <div className="space-y-2">
            {recentIngests.map((r) => (
              <Card
                key={r.jobId}
                className="bg-emerald-500/10 border-emerald-400/30 p-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase border-emerald-400/40 text-emerald-200"
                      >
                        {r.sourceType.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-emerald-300 font-mono">
                        Job #{r.jobId}
                      </span>
                    </div>
                    <div className="text-bone/90 truncate mt-0.5">{r.title}</div>
                  </div>
                  <a
                    href={`/admin/document/${r.documentId}`}
                    className="shrink-0 text-emerald-200 underline hover:text-emerald-100"
                  >
                    Open in admin →
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
        {send.isPending && (
          <div className="flex items-center gap-2 text-bone/60 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Goblin is reading the archive…
          </div>
        )}
      </div>

      {/* drop overlay */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl bg-amber-400/15 backdrop-blur-sm border-2 border-dashed border-amber-300">
          <div className="text-bone text-center">
            <FileUp className="mx-auto h-8 w-8 text-amber-300 mb-2" />
            <div className="font-serif text-lg">Drop evidence to ingest</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-amber-300/80">
              Stays pending until you approve
            </div>
          </div>
        </div>
      )}

      {/* footer */}
      <div className="border-t border-amber-400/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-300/40 text-amber-200 hover:bg-amber-400/10"
            onClick={() => fileInputRef.current?.click()}
            disabled={ingest.isPending}
          >
            <FileUp className="h-4 w-4 mr-1" />
            Drop / Pick file
          </Button>
          <Badge variant="outline" className="border-white/10 text-bone/60 text-[10px]">
            PDF · text · image · audio
          </Badge>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim() || isBusy) return;
            send.mutate({ message: draft.trim() });
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the Goblin about the case…"
            disabled={isBusy}
            className="bg-white/[0.04] border-white/10 text-bone placeholder:text-bone/40"
          />
          <Button
            type="submit"
            size="icon"
            className="bg-amber-300 text-[var(--ink-deep,#0c1430)] hover:bg-amber-200"
            disabled={isBusy || !draft.trim()}
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
