import { useAuth } from "@/_core/hooks/useAuth";
import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { AlertTriangle, CheckCircle, ExternalLink, Lock } from "lucide-react";
import { getLoginUrl } from "@/const";

const SITE_URL = typeof window !== "undefined" ? window.location.origin : "https://therenorecord.com";

interface RoutePreview {
  path: string;
  label: string;
  title: string;
  description: string;
  ogImage?: string;
  canonicalUrl: string;
  notes?: string;
}

const ROUTES: RoutePreview[] = [
  {
    path: "/",
    label: "Home",
    title: "The Reno Record — Receipts for Due Process",
    description:
      "A public-interest archive documenting court delay, ignored filings, pretrial detention harm, and procedural misconduct patterns in Washoe County, Nevada.",
    canonicalUrl: `${SITE_URL}/`,
  },
  {
    path: "/the-church-record",
    label: "The Church Record",
    title: "The Church Record — The Reno Record",
    description:
      "A documented case of pretrial detention, ignored filings, and procedural misconduct in Washoe County District Court.",
    canonicalUrl: `${SITE_URL}/the-church-record`,
  },
  {
    path: "/timeline",
    label: "Timeline",
    title: "Case Timeline — The Reno Record",
    description:
      "A chronological record of key events, filings, hearings, and procedural failures documented in The Reno Record archive.",
    canonicalUrl: `${SITE_URL}/timeline`,
  },
  {
    path: "/evidence",
    label: "Evidence Archive",
    title: "Evidence Archive — The Reno Record",
    description:
      "Searchable archive of court orders, motions, transcripts, public records responses, and other primary source documents.",
    canonicalUrl: `${SITE_URL}/evidence`,
  },
  {
    path: "/evidence/1",
    label: "Evidence Detail (sample)",
    title: "[Document Title] — The Reno Record",
    description: "Per-document SEO is set dynamically from the document's title and description.",
    canonicalUrl: `${SITE_URL}/evidence/1`,
    notes: "Dynamic — each document sets its own title/description/canonical URL.",
  },
  {
    path: "/actors",
    label: "Actors",
    title: "Key Actors — The Reno Record",
    description:
      "Profiles of judges, attorneys, officials, and institutions documented in The Reno Record archive.",
    canonicalUrl: `${SITE_URL}/actors`,
  },
  {
    path: "/actors/barry-breslow",
    label: "Actor Detail (sample)",
    title: "[Actor Name] — The Reno Record",
    description: "Per-actor SEO is set dynamically from the actor's name and bio.",
    canonicalUrl: `${SITE_URL}/actors/barry-breslow`,
    notes: "Dynamic — each actor page sets its own title/description/canonical URL.",
  },
  {
    path: "/public-records",
    label: "Public Records Tracker",
    title: "Public Records Tracker — The Reno Record",
    description:
      "Tracking the status of public records requests filed with Washoe County courts and government agencies.",
    canonicalUrl: `${SITE_URL}/public-records`,
  },
  {
    path: "/election",
    label: "Election & Accountability",
    title: "Election & Accountability — The Reno Record",
    description:
      "Neutral, public-record-based information on elected officials relevant to documented accountability cases in Washoe County.",
    canonicalUrl: `${SITE_URL}/election`,
  },
  {
    path: "/patterns",
    label: "Pattern Dashboard",
    title: "Pattern Dashboard — The Reno Record",
    description:
      "Aggregate analysis of recurring due process failure patterns documented across cases in The Reno Record archive.",
    canonicalUrl: `${SITE_URL}/patterns`,
  },
  {
    path: "/submit",
    label: "Submit a Record",
    title: "Submit Your Story — The Reno Record",
    description:
      "Submit your account of court misconduct, procedural failure, or due process harm for review and potential inclusion in The Reno Record archive.",
    canonicalUrl: `${SITE_URL}/submit`,
  },
];

const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

function hasMissingMeta(r: RoutePreview): boolean {
  return !r.title || !r.description || r.title.includes("[") || r.description.includes("[");
}

function PreviewCard({ route }: { route: RoutePreview }) {
  const missing = hasMissingMeta(route);
  const isDynamic = !!route.notes;

  return (
    <div className={`paper-card overflow-hidden ${missing && !isDynamic ? "border-red-500/40" : ""}`}>
      {/* Simulated OG card */}
      <div className="bg-black/30 p-4 border-b border-border/40">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`font-mono text-xs ${isDynamic ? "border-blue-400/50 text-blue-400" : missing ? "border-red-400/50 text-red-400" : "border-emerald-400/50 text-emerald-400"}`}
            >
              {isDynamic ? "Dynamic" : missing ? "Missing" : "OK"}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{route.path}</span>
          </div>
          <div className="flex items-center gap-1">
            {isDynamic ? (
              <CheckCircle className="w-4 h-4 text-blue-400" />
            ) : missing ? (
              <AlertTriangle className="w-4 h-4 text-red-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
          </div>
        </div>

        {/* Simulated link preview card */}
        <div className="rounded border border-border/60 overflow-hidden bg-card/50">
          {/* OG Image placeholder */}
          <div className="h-20 bg-gradient-to-br from-navy-900 to-black flex items-center justify-center border-b border-border/40">
            {route.ogImage ? (
              <img src={route.ogImage} alt="OG" className="h-full w-full object-cover" />
            ) : (
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-mono">og:image</div>
                <div className="text-xs text-amber-400/60 font-mono">/og-default.png</div>
              </div>
            )}
          </div>
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {SITE_URL.replace("https://", "").replace("http://", "")}
            </p>
            <p className={`text-sm font-semibold leading-tight ${route.title.includes("[") ? "text-muted-foreground italic" : "text-foreground"}`}>
              {route.title}
            </p>
            <p className={`text-xs leading-relaxed line-clamp-2 ${route.description.includes("[") ? "text-muted-foreground italic" : "text-muted-foreground"}`}>
              {route.description}
            </p>
          </div>
        </div>
      </div>

      {/* Meta details */}
      <div className="p-4 space-y-2">
        <h3 className="font-mono text-xs uppercase tracking-widest text-amber-400">{route.label}</h3>
        <dl className="space-y-1.5 text-xs">
          <div>
            <dt className="text-muted-foreground font-mono inline">og:title — </dt>
            <dd className={`inline ${route.title.includes("[") ? "text-muted-foreground italic" : "text-foreground"}`}>{route.title}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-mono inline">og:description — </dt>
            <dd className={`inline ${route.description.includes("[") ? "text-muted-foreground italic" : "text-foreground"}`}>{route.description}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-mono inline">og:image — </dt>
            <dd className="inline text-foreground/70 font-mono">{route.ogImage ?? DEFAULT_OG_IMAGE}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground font-mono inline">canonical — </dt>
            <dd className="inline text-foreground/70 font-mono break-all">{route.canonicalUrl}</dd>
          </div>
        </dl>
        {route.notes && (
          <p className="text-xs text-blue-400/80 italic pt-1">{route.notes}</p>
        )}
        <div className="pt-2 flex gap-2">
          <Button size="sm" variant="outline" asChild className="text-xs gap-1">
            <a href={route.path} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3" />
              Open Page
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1"
            onClick={() => {
              const url = `https://www.opengraph.xyz/url/${encodeURIComponent(SITE_URL + route.path)}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }}
          >
            Test OG
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PreviewCheck() {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  useSEO({ title: "Social Preview Check", noIndex: true });

  if (loading) {
    return (
      <SiteShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </SiteShell>
    );
  }

  if (!isAdmin) {
    return (
      <SiteShell>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center space-y-4 max-w-sm">
            <Lock className="w-10 h-10 text-amber-400 mx-auto" />
            <h1 className="font-serif text-2xl font-bold text-foreground">Admin Only</h1>
            <p className="text-muted-foreground text-sm">
              This page is restricted to archive administrators.
            </p>
            <Button asChild className="bg-amber-400 text-navy-900 hover:bg-amber-300">
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
          </div>
        </div>
      </SiteShell>
    );
  }

  const missingCount = ROUTES.filter((r) => hasMissingMeta(r) && !r.notes).length;
  const dynamicCount = ROUTES.filter((r) => !!r.notes).length;
  const okCount = ROUTES.filter((r) => !hasMissingMeta(r) && !r.notes).length;

  return (
    <SiteShell>
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/40 bg-card/30">
          <div className="container py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="font-serif text-2xl font-bold text-foreground">Social Preview Check</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Verify OG/Twitter metadata for all public routes before launch.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin">← Admin Panel</Link>
                </Button>
              </div>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-foreground font-mono">{okCount}</span>
                <span className="text-muted-foreground">routes OK</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle className="w-4 h-4 text-blue-400" />
                <span className="text-foreground font-mono">{dynamicCount}</span>
                <span className="text-muted-foreground">dynamic (set per-record)</span>
              </div>
              {missingCount > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-foreground font-mono">{missingCount}</span>
                  <span className="text-muted-foreground">need attention</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {ROUTES.map((route) => (
              <PreviewCard key={route.path} route={route} />
            ))}
          </div>

          <div className="mt-8 paper-card p-5 space-y-3">
            <h2 className="font-mono text-xs uppercase tracking-widest text-amber-400">
              Missing: og:image
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All routes currently fall back to <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">/og-default.png</code>.
              This file does not exist yet — create a 1200×630px image and place it at{" "}
              <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">client/public/og-default.png</code>{" "}
              (or upload via <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">manus-upload-file --webdev</code> and update the URL in{" "}
              <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">client/src/hooks/useSEO.ts</code>).
            </p>
            <p className="text-xs text-muted-foreground">
              Use the "Test OG" button on each card to verify live metadata via opengraph.xyz after deploying.
            </p>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
