import { useSEO } from "@/hooks/useSEO";
import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, FileUp, Loader2, LogIn, ShieldAlert, Trash2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

type Attachment = { filename: string; mimeType: string; dataBase64: string; size: number };

type IntakeForm = {
  submitterName: string;
  alias: string;
  email: string;
  phone: string;
  headline: string;
  agencyInstitution: string;
  officeDepartment: string;
  location: string;
  incidentStart: string;
  incidentEnd: string;
  ongoingIncident: boolean;
  relatedCaseNumber: string;
  incidentTypes: string[];
  actorDetails: string;
  evidenceDescription: string;
  timelineDescription: string;
  patternSignals: string[];
  publicRecordsStatus: string;
  harmDescription: string;
  requestedFollowup: string;
  evidenceTypes: string[];
  summary: string;
  publicPermission: boolean;
  redactionConfirmed: boolean;
};

const MAX_TOTAL = 30 * 1024 * 1024; // 30 MB total

const INCIDENT_TYPES = [
  "Records obstruction",
  "Judicial misconduct",
  "Law enforcement misconduct",
  "Prosecutorial misconduct",
  "Public-defender conflict or failure",
  "Retaliation or intimidation",
  "Financial misconduct or self-dealing",
  "Conflict of interest / cronyism",
  "Jail, custody, or probation abuse",
  "Election or public-office accountability",
  "Agency silence / failure to respond",
  "Other public corruption signal",
];

const PATTERN_SIGNALS = [
  "same actor appears repeatedly",
  "records request ignored or delayed",
  "official explanation conflicts with records",
  "missing order, transcript, email, or minutes",
  "filing blocked, ignored, or never ruled on",
  "retaliation after complaint or public-records request",
  "pressure through custody, warrants, fines, or supervision",
  "financial benefit, vendor tie, or insider relationship",
  "policy says one thing; practice shows another",
  "vulnerable person, family, housing, or employment harm",
];

const EVIDENCE_TYPES = [
  "Court order / minute entry",
  "Motion, filing, or pleading",
  "Email, letter, or text message",
  "Public-records request or response",
  "Audio, video, photo, or bodycam reference",
  "Financial, contract, payroll, or vendor record",
  "Complaint, grievance, or internal-affairs record",
  "Jail, custody, probation, or supervision record",
  "News article, meeting agenda, or public statement",
  "Witness account with supporting record",
];

const fileToBase64 = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      const idx = result.indexOf(",");
      resolve(result.slice(idx + 1));
    };
    r.onerror = reject;
    r.readAsDataURL(f);
  });

function SignInGate() {
  return (
    <SiteShell>
      <section className="py-20">
        <div className="container max-w-2xl text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500 mb-4" />
          <h1 className="display-serif text-4xl mb-3">Sign in to submit evidence</h1>
          <p className="text-muted-foreground mb-8">
            Submissions and document uploads require an account. This protects the archive from spam,
            malware, and unauthorized publishing — and gives editors a way to follow up before anything
            becomes public.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href={getLoginUrl()}>
              <Button size="lg" className="gap-2">
                <LogIn className="h-4 w-4" /> Sign in to continue
              </Button>
            </a>
            <Link href="/">
              <Button variant="outline" size="lg">
                Back home
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            By signing in you confirm you have the right to share what you upload. Files are size-limited,
            held privately for review, and never published without explicit approval.
          </p>
        </div>
      </section>
    </SiteShell>
  );
}

export default function SubmitPage() {
  useSEO({
    title: "Submit Evidence",
    description:
      "Submit public corruption evidence, records-obstruction signals, actor details, timelines, and source documents for editorial review by The Reno Record.",
    canonicalPath: "/submit",
  });
  const { isAuthenticated, loading: authLoading } = useAuth();
  if (authLoading) return null;
  if (!isAuthenticated) return <SignInGate />;
  return <SubmitForm />;
}

function SubmitForm() {
  const submit = trpc.story.submit.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<IntakeForm>({
    submitterName: "",
    alias: "",
    email: "",
    phone: "",
    headline: "",
    agencyInstitution: "",
    officeDepartment: "",
    location: "",
    incidentStart: "",
    incidentEnd: "",
    ongoingIncident: false,
    relatedCaseNumber: "",
    incidentTypes: [],
    actorDetails: "",
    evidenceDescription: "",
    timelineDescription: "",
    patternSignals: [],
    publicRecordsStatus: "",
    harmDescription: "",
    requestedFollowup: "",
    evidenceTypes: [],
    summary: "",
    publicPermission: false,
    redactionConfirmed: false,
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [success, setSuccess] = useState<number | null>(null);

  const set = <K extends keyof IntakeForm>(k: K, v: IntakeForm[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const toggle = (key: "incidentTypes" | "patternSignals" | "evidenceTypes", value: string) => {
    setForm((s) => ({
      ...s,
      [key]: s[key].includes(value) ? s[key].filter((item) => item !== value) : [...s[key], value],
    }));
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const totalIncoming = list.reduce((a, f) => a + f.size, 0);
    const totalExisting = attachments.reduce((a, f) => a + f.size, 0);
    if (totalIncoming + totalExisting > MAX_TOTAL) {
      toast.error("Total attachments exceed 30 MB. Trim down or send the rest after review.");
      return;
    }
    const next: Attachment[] = [];
    for (const f of list) {
      const b64 = await fileToBase64(f);
      next.push({
        filename: f.name,
        mimeType: f.type || "application/octet-stream",
        dataBase64: b64,
        size: f.size,
      });
    }
    setAttachments((s) => [...s, ...next]);
  };

  const removeAtt = (idx: number) => setAttachments((s) => s.filter((_, i) => i !== idx));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.publicPermission || !form.redactionConfirmed) {
      toast.error("Please confirm both the redaction and review checkboxes.");
      return;
    }
    if (!form.email) {
      toast.error("A contact email is required so editors can follow up.");
      return;
    }
    if (!form.headline.trim()) {
      toast.error("Please provide a one-line misconduct signal headline.");
      return;
    }
    if (!form.agencyInstitution.trim()) {
      toast.error("Please name the agency, court, office, contractor, or institution involved.");
      return;
    }
    if (!form.summary || form.summary.trim().length < 20) {
      toast.error("Please describe what happened in at least a few sentences.");
      return;
    }
    try {
      const res = await submit.mutateAsync({
        ...form,
        mainIssue: form.headline,
        caseNumber: form.relatedCaseNumber,
        court: form.agencyInstitution,
        department: form.officeDepartment,
        defenseAttorney: form.actorDetails,
        charges: form.incidentTypes.join(", "),
        dateCaseStarted: form.incidentStart || null,
        stillPending: form.ongoingIncident,
        familyHarm: form.harmDescription,
        competencyContext: form.publicRecordsStatus,
        filingsBlocked: form.patternSignals.some((s) => s.includes("blocked") || s.includes("ignored")),
        discoveryMissing: form.patternSignals.some((s) => s.includes("missing")),
        warrantsUsed: form.patternSignals.some((s) => s.includes("custody") || s.includes("warrants")),
        requestedTrial: false,
        trialHeld: false,
        counselWaivedTime: false,
        askedSelfRep: false,
        farettaHandled: false,
        competencyRaised: false,
        attachments: attachments.map(({ filename, mimeType, dataBase64 }) => ({
          filename,
          mimeType,
          dataBase64,
        })),
      });
      setSuccess(res.id);
      toast.success("Evidence received. It is now queued for review.");
    } catch (e: any) {
      toast.error(e?.message || "Submission failed.");
    }
  };

  if (success !== null) {
    return (
      <SiteShell>
        <section className="container py-24">
          <div className="paper-card p-10 max-w-2xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--amber)] grid place-items-center">
                <Check className="h-6 w-6 text-foreground" />
              </div>
              <div className="eyebrow mt-6">Submission received</div>
              <h1 className="display-serif text-4xl mt-2">On the record.</h1>
            </div>
<<<<<<< Updated upstream
            <div className="eyebrow mt-6">Submission #{success}</div>
            <h1 className="display-serif text-4xl mt-2">Evidence queued for review.</h1>
            <p className="mt-4 text-muted-foreground">
              Your materials are private while editors separate actors, evidence items, allegations,
              pattern signals, timeline events, redaction risks, and follow-up public-records targets.
              Nothing appears publicly unless it is explicitly approved.
            </p>
            <div className="mt-7 flex gap-3 justify-center flex-wrap">
              <Link href="/patterns">
=======

            {/* Submission ID — prominent */}
            <div className="mt-6 rounded border border-[var(--amber)]/40 bg-[var(--amber)]/5 p-4 text-center">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Your submission ID</div>
              <div className="font-mono text-2xl font-bold mt-1 text-[var(--amber)]">#{success}</div>
              <div className="text-xs text-muted-foreground mt-1">Save this number. You’ll need it to reference your submission.</div>
            </div>

            {/* What happens next */}
            <div className="mt-6 space-y-3 text-sm text-foreground/80">
              <div className="font-semibold text-foreground">What happens next</div>
              <div className="flex gap-3">
                <span className="font-mono text-[var(--amber)] shrink-0">1.</span>
                <span>Your submission enters the editorial moderation queue. Nothing you sent is visible to the public yet.</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-[var(--amber)] shrink-0">2.</span>
                <span>An editor reviews the submission for completeness, accuracy, and redaction compliance.</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-[var(--amber)] shrink-0">3.</span>
                <span>If approved, your story and documents become part of the public archive. If clarification is needed, we’ll contact you at the email you provided.</span>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-[var(--amber)] shrink-0">4.</span>
                <span className="font-medium">Once approved, records become part of the public archive and cannot be edited or deleted directly by the submitter. You may submit a formal review request for corrections, redactions, or removal after approval.</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              <Link href="/">
                <Button variant="outline">Back to home</Button>
              </Link>
              <Link href="/the-church-record">
>>>>>>> Stashed changes
                <Button className="bg-foreground text-background gap-2">
                  See pattern dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/evidence">
                <Button variant="outline">Browse evidence archive</Button>
              </Link>
            </div>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="container py-14 md:py-20">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <div className="eyebrow">Public Evidence Intake</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Submit misconduct evidence.
            </h1>
            <p className="mt-5 text-foreground/85 leading-relaxed">
              This form is built to separate the mess: actors, agencies, source records, timeline events,
              alleged misconduct, pattern signals, harms, and follow-up public-records targets. The goal is
              not to publish accusations quickly; the goal is to make corruption patterns provable.
            </p>
            <div className="mt-7 paper-card p-5 border-l-4 border-[var(--rust)]">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-[var(--rust)] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold tracking-tight">Redact first.</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Do not upload Social Security numbers, full birth dates, medical records, minor-child
                    PII, financial account numbers, addresses of non-public people, passwords, or sealed
                    records unless legally authorized.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 paper-card p-5 bg-[var(--amber-soft)]">
              <div className="eyebrow !text-[0.62rem]">What happens next</div>
              <p className="text-sm text-foreground/80 mt-2 leading-relaxed">
                Uploaded files stay private. Editors and the ingest assistant draft structured notes, then a
                human reviewer decides what can be safely published as evidence, timeline, actor, or pattern
                material.
              </p>
            </div>
          </div>

          <form className="lg:col-span-8 space-y-8" onSubmit={onSubmit}>
            <FieldGroup title="Contact for follow-up">
              <Row>
                <Field label="Name, handle, or source label">
                  <Input
                    value={form.submitterName}
                    onChange={(e) => set("submitterName", e.target.value)}
                    placeholder="Jane Doe, agency employee, family member, observer…"
                  />
                </Field>
                <Field label="Public alias if approved">
                  <Input
                    value={form.alias}
                    onChange={(e) => set("alias", e.target.value)}
                    placeholder="Anonymous Washoe resident"
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Email" required>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Phone or secure contact note">
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="Optional"
                  />
                </Field>
              </Row>
            </FieldGroup>

            <FieldGroup title="Misconduct signal">
              <Field label="One-line headline" required>
                <Input
                  required
                  value={form.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="e.g. Records request ignored after complaint against county official"
                />
              </Field>
              <CheckGrid
                label="Type of conduct"
                items={INCIDENT_TYPES}
                selected={form.incidentTypes}
                onToggle={(item) => toggle("incidentTypes", item)}
              />
              <Row>
                <Field label="Agency, court, office, contractor, or institution" required>
                  <Input
                    required
                    value={form.agencyInstitution}
                    onChange={(e) => set("agencyInstitution", e.target.value)}
                    placeholder="Washoe County, Reno Police, Second Judicial District Court…"
                  />
                </Field>
                <Field label="Division, department, office, or unit">
                  <Input
                    value={form.officeDepartment}
                    onChange={(e) => set("officeDepartment", e.target.value)}
                    placeholder="Records office, Dept. __, jail unit, campaign, board…"
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Location / jurisdiction">
                  <Input
                    value={form.location}
                    onChange={(e) => set("location", e.target.value)}
                    placeholder="Reno, Sparks, Washoe County, Nevada…"
                  />
                </Field>
                <Field label="Related case, request, complaint, or contract number">
                  <Input
                    value={form.relatedCaseNumber}
                    onChange={(e) => set("relatedCaseNumber", e.target.value)}
                    placeholder="Optional; court case, PRR number, IA complaint, contract ID…"
                  />
                </Field>
              </Row>
              <Row>
                <Field label="First known date">
                  <Input
                    type="date"
                    value={form.incidentStart}
                    onChange={(e) => set("incidentStart", e.target.value)}
                  />
                </Field>
                <Field label="Last known date">
                  <Input
                    type="date"
                    value={form.incidentEnd}
                    onChange={(e) => set("incidentEnd", e.target.value)}
                  />
                </Field>
              </Row>
              <label className="flex items-start gap-3 cursor-pointer paper-card !p-3">
                <Checkbox
                  checked={form.ongoingIncident}
                  onCheckedChange={(v) => set("ongoingIncident", Boolean(v))}
                />
                <span className="text-sm text-foreground/90">
                  This appears to be ongoing, unresolved, or still being hidden from the public record.
                </span>
              </label>
            </FieldGroup>

            <FieldGroup title="Actors, roles, and institutions">
              <Field label="Named actors and roles">
                <Textarea
                  rows={6}
                  value={form.actorDetails}
                  onChange={(e) => set("actorDetails", e.target.value)}
                  placeholder="List each person, office, agency, contractor, campaign, or institution on its own line if possible. Include role, agency, and what the record shows they did or failed to do."
                />
              </Field>
            </FieldGroup>

            <FieldGroup title="Evidence and source quality">
              <CheckGrid
                label="Evidence type"
                items={EVIDENCE_TYPES}
                selected={form.evidenceTypes}
                onToggle={(item) => toggle("evidenceTypes", item)}
              />
              <Field label="What records prove or support this?">
                <Textarea
                  rows={5}
                  value={form.evidenceDescription}
                  onChange={(e) => set("evidenceDescription", e.target.value)}
                  placeholder="Name the orders, emails, public-records responses, contracts, videos, filings, meeting minutes, receipts, screenshots, or witnesses. Say what each item proves."
                />
              </Field>
              <div className="paper-card p-5 border-dashed border-2 border-border bg-secondary/40 text-center">
                <FileUp className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Attach source documents, images, audio, video, transcripts, emails, records responses, or
                  other receipts. Up to 30 MB total.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => onFiles(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileRef.current?.click()}
                >
                  Choose files
                </Button>
              </div>
              {attachments.length > 0 && (
                <ul className="mt-3 divide-y divide-border border border-border rounded-sm">
                  {attachments.map((a, i) => (
                    <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{a.filename}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {(a.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAtt(i)}
                        aria-label="Remove"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </FieldGroup>

            <FieldGroup title="Timeline and pattern separation">
              <Field label="Chronology">
                <Textarea
                  rows={6}
                  value={form.timelineDescription}
                  onChange={(e) => set("timelineDescription", e.target.value)}
                  placeholder="Give dates in order. Include what happened, who acted, what record exists, and what is missing. Approximate dates are better than no dates."
                />
              </Field>
              <CheckGrid
                label="Pattern signals"
                items={PATTERN_SIGNALS}
                selected={form.patternSignals}
                onToggle={(item) => toggle("patternSignals", item)}
              />
              <Field label="Public-records status">
                <Textarea
                  rows={3}
                  value={form.publicRecordsStatus}
                  onChange={(e) => set("publicRecordsStatus", e.target.value)}
                  placeholder="Have records been requested? Who was asked, when, what deadline passed, what was denied, and what remains missing?"
                />
              </Field>
            </FieldGroup>

            <FieldGroup title="Narrative, harm, and next records">
              <Field label="What happened, in sourced paragraphs" required>
                <Textarea
                  rows={8}
                  required
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  placeholder="Stick to what you personally know, what the record shows, and what remains an allegation. Separate facts from suspicion."
                />
              </Field>
              <Field label="Concrete harm or public impact">
                <Textarea
                  rows={3}
                  value={form.harmDescription}
                  onChange={(e) => set("harmDescription", e.target.value)}
                  placeholder="Family, employment, housing, custody, public funds, civil rights, public safety, voter information, or agency accountability impacts."
                />
              </Field>
              <Field label="What should be requested or verified next?">
                <Textarea
                  rows={3}
                  value={form.requestedFollowup}
                  onChange={(e) => set("requestedFollowup", e.target.value)}
                  placeholder="Missing emails, bodycam, calendars, audit logs, policies, contracts, complaints, disciplinary files, minute entries, transcripts, etc."
                />
              </Field>
            </FieldGroup>

            <FieldGroup title="Consent and publication safety">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={form.redactionConfirmed}
                  onCheckedChange={(v) => set("redactionConfirmed", Boolean(v))}
                />
                <span className="text-sm text-foreground/90">
                  I confirm I have permission to share these materials and have redacted SSNs, full DOBs,
                  medical records, minor-child PII, private addresses, financial account numbers, passwords,
                  and any sealed or legally restricted information.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={form.publicPermission}
                  onCheckedChange={(v) => set("publicPermission", Boolean(v))}
                />
                <span className="text-sm text-foreground/90">
                  I understand this submission will be reviewed before publication. I consent to publication
                  of approved, appropriately redacted material under my chosen alias, and I understand that
                  allegations will be described as allegations unless records corroborate them.
                </span>
              </label>
            </FieldGroup>

            <div className="flex items-center gap-4 flex-wrap">
              <Button
                type="submit"
                disabled={submit.isPending}
                size="lg"
                className="bg-foreground text-background gap-2"
              >
                {submit.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    Submit evidence for review <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Nothing publishes until an admin approves it.
              </p>
            </div>
          </form>
        </div>
      </section>
    </SiteShell>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="paper-card p-6 md:p-7 space-y-4">
      <h2 className="display-serif text-xl rule-amber">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="eyebrow !text-[0.62rem] mb-1.5 block">
        {label} {required && <span className="text-[var(--rust)]">*</span>}
      </Label>
      {children}
    </div>
  );
}

function CheckGrid({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div>
      <Label className="eyebrow !text-[0.62rem] mb-2 block">{label}</Label>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const checked = selected.includes(item);
          return (
            <label
              key={item}
              className={
                "flex items-start gap-2.5 rounded-sm border p-3 cursor-pointer transition-colors " +
                (checked ? "border-[var(--amber)] bg-[var(--amber-soft)]" : "border-border bg-background hover:bg-secondary/50")
              }
            >
              <Checkbox checked={checked} onCheckedChange={() => onToggle(item)} />
              <span className="text-sm leading-snug">{item}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
