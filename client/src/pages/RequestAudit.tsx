import { useSEO } from "@/hooks/useSEO";
import { useState } from "react";
import { Link } from "wouter";
import {
  Search,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  FileText,
  Users,
  BarChart3,
  Scale,
  Zap,
  Clock,
} from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const WHAT_YOU_GET = [
  {
    icon: FileText,
    title: "Document Ingest & Extraction",
    desc: "Every court filing, order, and correspondence processed through the Goblin pipeline. Text extracted, structured, and stored.",
  },
  {
    icon: Zap,
    title: "Violation Tag Analysis",
    desc: "AI-assisted extraction of procedural violations with source quotes anchored to specific text. Each tag includes legal basis and citation.",
  },
  {
    icon: Users,
    title: "Actor & Agency Mapping",
    desc: "Every named official, judge, prosecutor, and agency mapped with their role, actions, and cross-references to documents and events.",
  },
  {
    icon: Clock,
    title: "Timeline Reconstruction",
    desc: "Full chronological record of every procedural event, hearing, filing, and ruling — with source citations for each entry.",
  },
  {
    icon: BarChart3,
    title: "Pattern Detection",
    desc: "Statistical analysis across your filings. Identifies repeated violations, boilerplate rulings, and systemic patterns.",
  },
  {
    icon: Scale,
    title: "Immunity Bypass Analysis",
    desc: "Per-actor breakdown of what immunity applies, what bypasses are available, and which claims are actionable vs. supporting.",
  },
];

const BUDGET_LABELS: Record<string, string> = {
  under_500: "Under $500",
  "500_2000": "$500 – $2,000",
  "2000_5000": "$2,000 – $5,000",
  "5000_plus": "$5,000+",
  discuss: "Let's discuss",
};

const CASE_TYPE_LABELS: Record<string, string> = {
  criminal: "Criminal",
  civil: "Civil / §1983",
  family: "Family Court",
  administrative: "Administrative",
  other: "Other",
};

export default function RequestAudit() {
  useSEO({
    title: "Request a Case Audit — The Reno Record",
    description:
      "The same forensic AI pipeline that built this archive is available for your case. Document ingest, violation tagging, actor mapping, pattern analysis.",
  });

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    caseNumber: "",
    court: "",
    jurisdiction: "",
    caseType: "criminal" as const,
    description: "",
    objectives: "",
    budget: "discuss" as const,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = trpc.auditRequest.submit.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => setErrors({ _form: e.message }),
  });

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Valid email required";
    if (!form.description.trim() || form.description.trim().length < 20)
      errs.description = "Please describe your situation (at least 20 characters)";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    submit.mutate(form);
  }

  function field(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  if (submitted) {
    return (
      <SiteShell>
        <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-black text-stone-100 mb-3">Request Received</h1>
            <p className="text-stone-400 text-sm leading-relaxed mb-6">
              Your case audit request has been logged. You'll hear back within 48 hours at the email
              you provided. If your situation is urgent, include that in your description and it will
              be prioritized.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/">
                <button className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm rounded px-4 py-2.5 transition-colors">
                  Back to The Reno Record
                </button>
              </Link>
              <Link href="/case-intelligence">
                <button className="w-full border border-stone-700 text-stone-400 hover:border-stone-600 text-sm rounded px-4 py-2.5 transition-colors">
                  View Case Intelligence Dashboard
                </button>
              </Link>
            </div>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="min-h-screen bg-stone-950 text-stone-100">
        {/* Header */}
        <div className="border-b border-stone-800 bg-stone-950">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <Link href="/">
              <button className="flex items-center gap-1.5 text-xs font-mono text-stone-500 hover:text-stone-300 transition-colors mb-4">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to The Reno Record
              </button>
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center shrink-0">
                <Search className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-stone-100">Request a Case Audit</h1>
                <p className="text-sm text-stone-400 mt-1">
                  The forensic pipeline that built this archive — document ingest, violation tagging,
                  actor mapping, pattern analysis — available for your case.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Contact */}
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-5">
                <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
                  Contact Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono text-stone-400 mb-1.5">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => field("name", e.target.value)}
                      placeholder="Your name"
                      className={cn(
                        "w-full bg-stone-950 border rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors",
                        errors.name ? "border-red-700" : "border-stone-700 focus:border-amber-700/50",
                      )}
                    />
                    {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-stone-400 mb-1.5">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => field("email", e.target.value)}
                      placeholder="you@example.com"
                      className={cn(
                        "w-full bg-stone-950 border rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors",
                        errors.email ? "border-red-700" : "border-stone-700 focus:border-amber-700/50",
                      )}
                    />
                    {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                  </div>
                </div>
              </div>

              {/* Case details */}
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-5">
                <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
                  Case Details
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-stone-400 mb-1.5">
                        Case Number
                      </label>
                      <input
                        type="text"
                        value={form.caseNumber}
                        onChange={(e) => field("caseNumber", e.target.value)}
                        placeholder="e.g. CR23-0657"
                        className="w-full bg-stone-950 border border-stone-700 focus:border-amber-700/50 rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-stone-400 mb-1.5">
                        Case Type
                      </label>
                      <select
                        value={form.caseType}
                        onChange={(e) => field("caseType", e.target.value as any)}
                        className="w-full bg-stone-950 border border-stone-700 focus:border-amber-700/50 rounded px-3 py-2 text-sm text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                      >
                        {Object.entries(CASE_TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-stone-400 mb-1.5">Court</label>
                      <input
                        type="text"
                        value={form.court}
                        onChange={(e) => field("court", e.target.value)}
                        placeholder="e.g. Washoe County District Court"
                        className="w-full bg-stone-950 border border-stone-700 focus:border-amber-700/50 rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-stone-400 mb-1.5">
                        Jurisdiction / State
                      </label>
                      <input
                        type="text"
                        value={form.jurisdiction}
                        onChange={(e) => field("jurisdiction", e.target.value)}
                        placeholder="e.g. Nevada"
                        className="w-full bg-stone-950 border border-stone-700 focus:border-amber-700/50 rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Situation */}
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-5">
                <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
                  Your Situation
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-stone-400 mb-1.5">
                      Describe what happened <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => field("description", e.target.value)}
                      rows={5}
                      placeholder="Describe the procedural issues, violations, or patterns you've experienced. The more specific, the better."
                      className={cn(
                        "w-full bg-stone-950 border rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors resize-y",
                        errors.description
                          ? "border-red-700"
                          : "border-stone-700 focus:border-amber-700/50",
                      )}
                    />
                    {errors.description && (
                      <p className="text-xs text-red-400 mt-1">{errors.description}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-stone-400 mb-1.5">
                      What are you trying to prove or achieve?
                    </label>
                    <textarea
                      value={form.objectives}
                      onChange={(e) => field("objectives", e.target.value)}
                      rows={3}
                      placeholder="e.g. Document judicial bias for an appeal, build a §1983 complaint, create a public accountability record..."
                      className="w-full bg-stone-950 border border-stone-700 focus:border-amber-700/50 rounded px-3 py-2 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Budget */}
              <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-5">
                <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
                  Budget Range
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(BUDGET_LABELS).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => field("budget", v as any)}
                      className={cn(
                        "rounded border px-3 py-2 text-xs font-mono transition-colors text-left",
                        form.budget === v
                          ? "border-amber-600 bg-amber-950/40 text-amber-300"
                          : "border-stone-700 text-stone-500 hover:border-stone-600 hover:text-stone-400",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-stone-600 mt-3">
                  Budget is a starting point for scoping. Pro se defendants with limited resources are
                  considered on a case-by-case basis.
                </p>
              </div>

              {/* Disclaimer */}
              <div className="rounded-lg border border-stone-800/50 bg-stone-900/20 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-stone-500 leading-relaxed">
                    <strong className="text-stone-400">This is not legal advice.</strong> Case audit
                    services provide forensic document analysis, pattern detection, and evidence
                    organization — not legal representation or counsel. Nothing produced by this system
                    constitutes legal advice or creates an attorney-client relationship.
                  </p>
                </div>
              </div>

              {errors._form && (
                <p className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-3 py-2">
                  {errors._form}
                </p>
              )}

              <button
                type="submit"
                disabled={submit.isPending}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-black text-sm rounded px-4 py-3 transition-colors flex items-center justify-center gap-2"
              >
                {submit.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-stone-950/30 border-t-stone-950 rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Submit Audit Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: What you get */}
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-5">
              <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-4">
                What You Get
              </h2>
              <div className="space-y-4">
                {WHAT_YOU_GET.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded bg-amber-950/40 border border-amber-800/30 flex items-center justify-center shrink-0 mt-0.5">
                      <item.icon className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-stone-300">{item.title}</p>
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-stone-800/50 bg-stone-900/20 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-600 mb-3">
                Built by
              </p>
              <p className="text-sm font-bold text-stone-300">Cameron Church</p>
              <p className="text-xs text-stone-500 mt-1">Systems Architect · Strategic Operator</p>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Designed and built this entire forensic pipeline pro se — no legal team, no dev team.
                The same system documenting two active cases is the system available for yours.
              </p>
              <Link href="/case-intelligence">
                <button className="mt-3 text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                  See it in action →
                </button>
              </Link>
            </div>

            <div className="rounded-lg border border-stone-800 bg-stone-900/40 p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-3">
                Response Time
              </p>
              <div className="space-y-2 text-xs text-stone-500">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  Initial response within 48 hours
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  Scope and timeline confirmed before any work begins
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                  Urgent situations flagged in description are prioritized
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
