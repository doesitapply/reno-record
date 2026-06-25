import { describe, it, expect } from "vitest";
import { qcReview, QC_CLASS_ACCEPT, QC_DATE_ACCEPT } from "./_goblin";

/** Base classification result with confident, on-record-federal defaults. */
function base(overrides: Partial<Parameters<typeof qcReview>[0]> = {}) {
  return {
    filingStampDate: "2026-01-08",
    dateSource: "filing_stamp" as const,
    dateConfidence: 100,
    dateSourceQuote: "FILED 01/08/2026",
    recordStatus: "on_record_federal" as const,
    recordStatusConfidence: 100,
    recordStatusReason: "Federal docket entry with filing stamp.",
    docketEntryNo: "ECF 12",
    caseNumber: "3:24-cv-00579",
    ...overrides,
  };
}

describe("evidence engine — QC supervisor (deterministic)", () => {
  it("auto-accepts a clean, confident, stamped on-record document with no review flags", () => {
    const d = qcReview(base());
    expect(d.needsDateReview).toBe(false);
    expect(d.needsClassificationReview).toBe(false);
    expect(d.recordStatus).toBe("on_record_federal");
    expect(d.recordStatusSource).toBe("goblin");
  });

  it("Rule 1: corrects state→federal when case number is clearly federal", () => {
    const d = qcReview(base({ recordStatus: "on_record_state", caseNumber: "3:24-cv-00579" }));
    expect(d.recordStatus).toBe("on_record_federal");
    expect(d.recordStatusSource).toBe("qc");
    expect(d.qcNotes.join(" ")).toMatch(/state→federal/);
  });

  it("Rule 1: corrects federal→state when case number is clearly state (CR##-####)", () => {
    const d = qcReview(base({ recordStatus: "on_record_federal", caseNumber: "CR23-0657", docketEntryNo: null }));
    expect(d.recordStatus).toBe("on_record_state");
    expect(d.recordStatusSource).toBe("qc");
    expect(d.qcNotes.join(" ")).toMatch(/federal→state/);
  });

  it("Rule 2: downgrades on-record→supporting when no docket entry, no stamp, and low confidence", () => {
    const d = qcReview(
      base({
        recordStatus: "on_record_state",
        caseNumber: null,
        docketEntryNo: null,
        dateSource: "inferred",
        recordStatusConfidence: QC_CLASS_ACCEPT - 10,
      }),
    );
    expect(d.recordStatus).toBe("supporting");
    expect(d.recordStatusSource).toBe("qc");
  });

  it("Rule 2: does NOT downgrade on-record when a filing stamp is present even if confidence is low", () => {
    const d = qcReview(
      base({
        recordStatus: "on_record_state",
        caseNumber: null,
        docketEntryNo: null,
        dateSource: "filing_stamp",
        recordStatusConfidence: QC_CLASS_ACCEPT - 10,
      }),
    );
    // stamp present → not downgraded to supporting by Rule 2
    expect(d.recordStatus).toBe("on_record_state");
  });

  it("Rule 3: flags UNDATED when no filing stamp is found", () => {
    const d = qcReview(base({ filingStampDate: null, dateSource: "undated", dateConfidence: 0 }));
    expect(d.needsDateReview).toBe(true);
    expect(d.qcNotes.join(" ")).toMatch(/UNDATED/);
  });

  it("Rule 3: file_metadata date is never authoritative — always flagged for review", () => {
    const d = qcReview(base({ dateSource: "file_metadata", dateConfidence: 100 }));
    expect(d.needsDateReview).toBe(true);
  });

  it("Rule 3: low date confidence below threshold is flagged", () => {
    const d = qcReview(base({ dateSource: "filing_stamp", dateConfidence: QC_DATE_ACCEPT - 1 }));
    expect(d.needsDateReview).toBe(true);
  });

  it("Rule 4: escalates unclassified to human review", () => {
    const d = qcReview(base({ recordStatus: "unclassified", recordStatusConfidence: 0 }));
    expect(d.needsClassificationReview).toBe(true);
    expect(d.qcNotes.join(" ")).toMatch(/escalated to human/);
  });

  it("Rule 4: escalates classification confidence below threshold", () => {
    const d = qcReview(
      base({ recordStatus: "supporting", recordStatusConfidence: QC_CLASS_ACCEPT - 1, docketEntryNo: null }),
    );
    expect(d.needsClassificationReview).toBe(true);
  });

  it("preserves the filing stamp date and quote through QC unchanged", () => {
    const d = qcReview(base({ filingStampDate: "2025-12-10", dateSourceQuote: "FILED 12/10/2025" }));
    expect(d.filingStampDate).toBe("2025-12-10");
    expect(d.dateSourceQuote).toBe("FILED 12/10/2025");
  });

  it("supporting material with high confidence is accepted without escalation", () => {
    const d = qcReview(
      base({
        recordStatus: "supporting",
        recordStatusConfidence: 95,
        docketEntryNo: null,
        dateSource: "undated",
        filingStampDate: null,
        dateConfidence: 0,
      }),
    );
    // classification is fine; only the date is flagged
    expect(d.needsClassificationReview).toBe(false);
    expect(d.needsDateReview).toBe(true);
    expect(d.recordStatus).toBe("supporting");
  });
});
