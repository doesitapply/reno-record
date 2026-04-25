import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, FileUp, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import SiteShell from "@/components/SiteShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Attachment = { filename: string; mimeType: string; dataBase64: string; size: number };

const MAX_TOTAL = 30 * 1024 * 1024; // 30 MB total

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

export default function SubmitPage() {
  const submit = trpc.story.submit.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<{
    submitterName: string;
    alias: string;
    email: string;
    phone: string;
    caseNumber: string;
    court: string;
    department: string;
    judge: string;
    prosecutor: string;
    defenseAttorney: string;
    charges: string;
    dateCaseStarted: string;
    custodyDays: string;
    stillPending: boolean;
    trialHeld: boolean;
    requestedTrial: boolean;
    counselWaivedTime: boolean;
    filingsBlocked: boolean;
    askedSelfRep: boolean;
    farettaHandled: boolean;
    competencyRaised: boolean;
    competencyContext: string;
    discoveryMissing: boolean;
    warrantsUsed: boolean;
    familyHarm: string;
    summary: string;
    mainIssue: string;
    publicPermission: boolean;
    redactionConfirmed: boolean;
  }>({
    submitterName: "",
    alias: "",
    email: "",
    phone: "",
    caseNumber: "",
    court: "",
    department: "",
    judge: "",
    prosecutor: "",
    defenseAttorney: "",
    charges: "",
    dateCaseStarted: "",
    custodyDays: "",
    stillPending: false,
    trialHeld: false,
    requestedTrial: false,
    counselWaivedTime: false,
    filingsBlocked: false,
    askedSelfRep: false,
    farettaHandled: false,
    competencyRaised: false,
    competencyContext: "",
    discoveryMissing: false,
    warrantsUsed: false,
    familyHarm: "",
    summary: "",
    mainIssue: "",
    publicPermission: false,
    redactionConfirmed: false,
  });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [success, setSuccess] = useState<number | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

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
      toast.error("A contact email is required so you can be reached for follow-up.");
      return;
    }
    if (!form.summary || form.summary.trim().length < 20) {
      toast.error("Please describe what happened in at least a few sentences.");
      return;
    }
    try {
      const res = await submit.mutateAsync({
        ...form,
        custodyDays: form.custodyDays ? Number(form.custodyDays) : undefined,
        dateCaseStarted: form.dateCaseStarted || null,
        attachments: attachments.map(({ filename, mimeType, dataBase64 }) => ({
          filename,
          mimeType,
          dataBase64,
        })),
      });
      setSuccess(res.id);
      toast.success("Submission received. You'll hear back after review.");
    } catch (e: any) {
      toast.error(e?.message || "Submission failed.");
    }
  };

  if (success !== null) {
    return (
      <SiteShell>
        <section className="container py-24">
          <div className="paper-card p-12 max-w-2xl mx-auto text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-[var(--amber)] grid place-items-center">
              <Check className="h-6 w-6 text-foreground" />
            </div>
            <div className="eyebrow mt-6">Submission #{success}</div>
            <h1 className="display-serif text-4xl mt-2">On the record.</h1>
            <p className="mt-4 text-muted-foreground">
              Your submission is in the moderation queue. Nothing you sent is public yet — every
              story and document is reviewed before publication. We'll reach out at the email you
              provided if we need clarification or additional records.
            </p>
            <div className="mt-7 flex gap-3 justify-center">
              <Link href="/">
                <Button variant="outline">Back to home</Button>
              </Link>
              <Link href="/the-church-record">
                <Button className="bg-foreground text-background gap-2">
                  Read the main record <ArrowRight className="h-4 w-4" />
                </Button>
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
            <div className="eyebrow">Public Intake</div>
            <h1 className="display-serif text-5xl md:text-6xl mt-3 leading-[1.02]">
              Submit your story.
            </h1>
            <p className="mt-5 text-foreground/85 leading-relaxed">
              Tell us what happened. Send the receipts. Submissions are reviewed before
              publication. The Reno Record does not provide legal advice and does not act as your
              attorney.
            </p>
            <div className="mt-7 paper-card p-5 border-l-4 border-[var(--rust)]">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-[var(--rust)] mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold tracking-tight">Redact first.</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Do not upload Social Security numbers, full birth dates, medical records,
                    minor-children PII, financial account numbers, addresses of non-public people,
                    or sealed records unless legally authorized.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form className="lg:col-span-8 space-y-8" onSubmit={onSubmit}>
            <FieldGroup title="Contact">
              <Row>
                <Field label="Name (or alias is fine)">
                  <Input
                    value={form.submitterName}
                    onChange={(e) => set("submitterName", e.target.value)}
                    placeholder="Jane Doe"
                  />
                </Field>
                <Field label="Public alias (optional)">
                  <Input
                    value={form.alias}
                    onChange={(e) => set("alias", e.target.value)}
                    placeholder="If approved, this name appears on the public site"
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
                <Field label="Phone (optional)">
                  <Input
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="775-…"
                  />
                </Field>
              </Row>
            </FieldGroup>

            <FieldGroup title="Case">
              <Row>
                <Field label="Case number">
                  <Input
                    value={form.caseNumber}
                    onChange={(e) => set("caseNumber", e.target.value)}
                  />
                </Field>
                <Field label="Court">
                  <Input
                    value={form.court}
                    onChange={(e) => set("court", e.target.value)}
                    placeholder="e.g. Second Judicial District Court, Washoe County"
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Department">
                  <Input
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    placeholder="Dept. ___"
                  />
                </Field>
                <Field label="Judge">
                  <Input value={form.judge} onChange={(e) => set("judge", e.target.value)} />
                </Field>
              </Row>
              <Row>
                <Field label="Prosecutor">
                  <Input
                    value={form.prosecutor}
                    onChange={(e) => set("prosecutor", e.target.value)}
                  />
                </Field>
                <Field label="Defense attorney / public defender">
                  <Input
                    value={form.defenseAttorney}
                    onChange={(e) => set("defenseAttorney", e.target.value)}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Charges">
                  <Input value={form.charges} onChange={(e) => set("charges", e.target.value)} />
                </Field>
                <Field label="Date case started">
                  <Input
                    type="date"
                    value={form.dateCaseStarted}
                    onChange={(e) => set("dateCaseStarted", e.target.value)}
                  />
                </Field>
              </Row>
              <Row>
                <Field label="Time in custody (days)">
                  <Input
                    type="number"
                    min={0}
                    value={form.custodyDays}
                    onChange={(e) => set("custodyDays", e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Toggle
                    label="Still pending"
                    value={form.stillPending}
                    onChange={(v) => set("stillPending", v)}
                  />
                  <Toggle
                    label="Trial held"
                    value={form.trialHeld}
                    onChange={(v) => set("trialHeld", v)}
                  />
                </div>
              </Row>
            </FieldGroup>

            <FieldGroup title="Procedural posture">
              <div className="grid sm:grid-cols-2 gap-3">
                <Toggle
                  label="I requested trial"
                  value={form.requestedTrial}
                  onChange={(v) => set("requestedTrial", v)}
                />
                <Toggle
                  label="Counsel waived time without my consent"
                  value={form.counselWaivedTime}
                  onChange={(v) => set("counselWaivedTime", v)}
                />
                <Toggle
                  label="Filings blocked, struck, or ignored"
                  value={form.filingsBlocked}
                  onChange={(v) => set("filingsBlocked", v)}
                />
                <Toggle
                  label="I asked to represent myself"
                  value={form.askedSelfRep}
                  onChange={(v) => set("askedSelfRep", v)}
                />
                <Toggle
                  label="Faretta canvass was held"
                  value={form.farettaHandled}
                  onChange={(v) => set("farettaHandled", v)}
                />
                <Toggle
                  label="Competency was raised"
                  value={form.competencyRaised}
                  onChange={(v) => set("competencyRaised", v)}
                />
                <Toggle
                  label="Discovery missing"
                  value={form.discoveryMissing}
                  onChange={(v) => set("discoveryMissing", v)}
                />
                <Toggle
                  label="Warrants / OSCs used against me"
                  value={form.warrantsUsed}
                  onChange={(v) => set("warrantsUsed", v)}
                />
              </div>
              <Field label="What happened right before competency was raised?">
                <Textarea
                  rows={3}
                  value={form.competencyContext}
                  onChange={(e) => set("competencyContext", e.target.value)}
                  placeholder="If applicable. What you filed, asserted, or asked for in the days/weeks before competency surfaced."
                />
              </Field>
            </FieldGroup>

            <FieldGroup title="Harm & narrative">
              <Field label="Family / caregiver / employment / housing / medical harm">
                <Textarea
                  rows={3}
                  value={form.familyHarm}
                  onChange={(e) => set("familyHarm", e.target.value)}
                  placeholder="Concrete impact on dependents, jobs, housing, medical care, etc."
                />
              </Field>
              <Field label="Main issue, in one sentence">
                <Input
                  value={form.mainIssue}
                  onChange={(e) => set("mainIssue", e.target.value)}
                  placeholder="e.g. Speedy trial demand ignored for 18 months."
                />
              </Field>
              <Field label="Short story" required>
                <Textarea
                  rows={8}
                  required
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  placeholder="Dates, orders, requests, responses, silences. Stick to what you can prove or sourced from records."
                />
              </Field>
            </FieldGroup>

            <FieldGroup title="Evidence">
              <div className="paper-card p-5 border-dashed border-2 border-border bg-secondary/40 text-center">
                <FileUp className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Attach orders, motions, emails, transcripts, jail records (PDF, image, audio,
                  video). Up to 30 MB total.
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

            <FieldGroup title="Consent">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={form.redactionConfirmed}
                  onCheckedChange={(v) => set("redactionConfirmed", Boolean(v))}
                />
                <span className="text-sm text-foreground/90">
                  I confirm I have permission to share these materials and have redacted SSNs,
                  full DOBs, medical records, minor-child PII, and any sealed information.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={form.publicPermission}
                  onCheckedChange={(v) => set("publicPermission", Boolean(v))}
                />
                <span className="text-sm text-foreground/90">
                  I understand my submission will be reviewed by editors and that nothing is
                  published without explicit admin approval. I consent to publication of approved,
                  appropriately redacted material under my chosen alias.
                </span>
              </label>
            </FieldGroup>

            <div className="flex items-center gap-4">
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
                    Submit for review <ArrowRight className="h-4 w-4" />
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
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 paper-card !p-3 cursor-pointer">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}
