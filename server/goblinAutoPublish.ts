/**
 * Goblin Auto-Publish Engine (v5.0)
 *
 * Verifiability scoring and auto-publish decision logic.
 *
 * Rules:
 * - Admin-sourced uploads: auto-publish if score >= AUTO_PUBLISH_THRESHOLD (75)
 * - Public submissions: queue for 24-hour window, then auto-publish if score >= PUBLIC_THRESHOLD (80)
 *   and no high-severity redaction risks
 * - Low-confidence or unverifiable docs: always queue for human review
 */

import type { IngestDraft } from "./_goblin";

export const AUTO_PUBLISH_THRESHOLD = 75;
export const PUBLIC_AUTO_PUBLISH_THRESHOLD = 80;

export interface VerifiabilityResult {
  score: number; // 0-100
  verdict: "auto_publish" | "queue_review" | "reject";
  reasons: string[];
  flags: string[];
}

/**
 * Score a draft for verifiability. Higher = more trustworthy.
 *
 * Scoring rubric:
 * +30  Has signatures or official headers (letterhead, court stamp, agency seal)
 * +20  Has readable dates (timestamps, filed dates, hearing dates)
 * +15  Has a case number
 * +15  sourceType is a recognized official document type (not "other")
 * +10  extractedTextQuality is "good"
 * +5   Has at least one high-confidence actor
 * +5   Has at least one evidence item with high confidence
 * -10  per high-severity redaction risk (SSN, DOB, medical, sealed record)
 * -5   per medium-severity redaction risk
 * -20  extractedTextQuality is "none" or "poor"
 * -15  sourceType is "other" with no case number and no dates
 */
export function scoreVerifiability(draft: IngestDraft): VerifiabilityResult {
  let score = 0;
  const reasons: string[] = [];
  const flags: string[] = [];

  // Positive signals
  if (draft.sourceQuality.hasSignaturesOrHeaders) {
    score += 30;
    reasons.push("Official headers or signatures detected");
  }
  if (draft.sourceQuality.hasReadableDates) {
    score += 20;
    reasons.push("Readable dates found");
  }
  if (draft.caseNumber) {
    score += 15;
    reasons.push(`Case number present: ${draft.caseNumber}`);
  }
  if (draft.sourceType !== "other") {
    score += 15;
    reasons.push(`Recognized document type: ${draft.sourceType}`);
  }
  if (draft.sourceQuality.extractedTextQuality === "good") {
    score += 10;
    reasons.push("Good text extraction quality");
  } else if (draft.sourceQuality.extractedTextQuality === "partial") {
    score += 5;
  }
  const highConfActors = draft.actors.filter((a) => a.confidence === "high");
  if (highConfActors.length > 0) {
    score += 5;
    reasons.push(`${highConfActors.length} high-confidence actor(s) identified`);
  }
  const highConfEvidence = draft.evidenceItems.filter((e) => e.confidence === "high");
  if (highConfEvidence.length > 0) {
    score += 5;
    reasons.push(`${highConfEvidence.length} high-confidence evidence item(s)`);
  }

  // Negative signals
  if (
    draft.sourceQuality.extractedTextQuality === "none" ||
    draft.sourceQuality.extractedTextQuality === "poor"
  ) {
    score -= 20;
    flags.push("Poor or no text extraction — document may be image-only or corrupted");
  }
  if (
    draft.sourceType === "other" &&
    !draft.caseNumber &&
    !draft.sourceQuality.hasReadableDates
  ) {
    score -= 15;
    flags.push("Unknown document type with no case number and no dates — provenance unclear");
  }

  for (const risk of draft.redactionRisks) {
    if (risk.severity === "high") {
      score -= 10;
      flags.push(`High-severity redaction risk: ${risk.riskType} — ${risk.description}`);
    } else if (risk.severity === "medium") {
      score -= 5;
      flags.push(`Medium redaction risk: ${risk.riskType}`);
    }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Verdict
  const hasHighRedactionRisk = draft.redactionRisks.some((r) => r.severity === "high");
  let verdict: VerifiabilityResult["verdict"];
  if (score < 30) {
    verdict = "reject";
  } else if (hasHighRedactionRisk || score < AUTO_PUBLISH_THRESHOLD) {
    verdict = "queue_review";
  } else {
    verdict = "auto_publish";
  }

  return { score, verdict, reasons, flags };
}

/**
 * Determine if a public submission should auto-publish after the 24-hour window.
 * More conservative than admin uploads.
 */
export function scorePublicSubmission(draft: IngestDraft): VerifiabilityResult {
  const base = scoreVerifiability(draft);
  const hasHighRedactionRisk = draft.redactionRisks.some((r) => r.severity === "high");
  const hasHighPublicationRisk = draft.allegations.some((a) => a.publicationRisk === "high");

  let verdict: VerifiabilityResult["verdict"] = base.verdict;
  const flags = [...base.flags];

  if (hasHighRedactionRisk) {
    verdict = "queue_review";
    flags.push("High-severity PII risk — requires human redaction review before publication");
  }
  if (hasHighPublicationRisk) {
    verdict = "queue_review";
    flags.push("High publication risk allegation — requires editorial review");
  }
  if (base.score < PUBLIC_AUTO_PUBLISH_THRESHOLD) {
    verdict = "queue_review";
    flags.push(`Score ${base.score} below public auto-publish threshold (${PUBLIC_AUTO_PUBLISH_THRESHOLD})`);
  }

  return { ...base, verdict, flags };
}
