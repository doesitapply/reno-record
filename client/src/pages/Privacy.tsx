import { useSEO } from "@/hooks/useSEO";
import SiteShell from "@/components/SiteShell";

export default function PrivacyPage() {
  useSEO({
    title: "Privacy, Methodology & Legal Notice",
    description:
      "How The Reno Record handles submissions, protects sources, maintains editorial standards, and what this archive is and is not.",
    canonicalPath: "/privacy",
  });
  return (
    <SiteShell>
      <section className="container py-14 md:py-20 max-w-3xl">
        <div className="eyebrow">Privacy · Methodology · Legal Notice</div>
        <h1 className="display-serif text-5xl mt-3 leading-[1.02]">
          What this is. What it isn't. What we do with your information.
        </h1>
        <p className="mt-5 text-muted-foreground leading-relaxed">
          Last updated: May 2026. This page governs your use of therenorecord.manus.space and any
          subdomains operated by this project.
        </p>

        <div className="mt-10 space-y-10 text-foreground/85 leading-relaxed">
          <Block title="What this archive is.">
            <p>
              The Reno Record is a public-interest documentation project organized around two intertwined
              cases: <strong>State of Nevada v. Cameron Church (CR23-0657)</strong>, pending in Washoe
              County District Court, Department 8, before Judge Barry L. Breslow; and{" "}
              <strong>Church v. Breslow et al. (3:24-cv-00579-ART-CSD)</strong>, a federal civil rights
              action filed in the District of Nevada, dismissed without prejudice on Rooker-Feldman
              grounds with a Rule 59(e) motion pending.
            </p>
            <p className="mt-3">
              Every document in this archive is either a public court filing, a public records response,
              or a communication to or from a public official acting in their official capacity. Nothing
              has been fabricated. Every claim is source-cited. You are encouraged to pull the docket
              yourself and verify.
            </p>
          </Block>

          <Block title="What this archive is not.">
            <p>
              This site is not a law firm. Nothing here is legal advice. Visiting this site or submitting
              material does not create an attorney-client relationship with anyone. The operator of this
              archive is a pro se litigant, not an attorney.
            </p>
            <p className="mt-3">
              This archive does not claim that any named individual has committed a crime. It documents
              what the public record shows. Readers are expected to draw their own conclusions from the
              source materials.
            </p>
          </Block>

          <Block title="Named public officials.">
            <p>
              This archive names judges, prosecutors, defense counsel, forensic evaluators, and other
              public officials in their official capacities. Their conduct in their official roles is a
              matter of public record and is subject to public scrutiny. The First Amendment and the
              common law right of access to court records support this publication.
            </p>
            <p className="mt-3">
              If you are a named official and believe a specific factual claim is inaccurate, submit a
              documented correction through the intake form. We respond to specific, documented
              corrections. We do not respond to demands to remove accurate public-record citations.
            </p>
          </Block>

          <Block title="What we publish and how.">
            <p>
              Documents uploaded to this archive are reviewed before publication. Allegations are
              presented as reported or as reflected in the source document. The Docket Goblin AI
              assistant drafts tags, summaries, and pattern signals — it cannot publish anything
              autonomously. Every AI-assisted tag requires a source quote from the underlying document.
            </p>
            <p className="mt-3">
              Violation tags applied to documents represent the operator's characterization of what the
              document shows. They are not legal conclusions. They are organizational labels grounded in
              source quotes.
            </p>
          </Block>

          <Block title="Submissions from third parties.">
            <p>
              If you submit a story, document, or tip through this site, you represent that you have the
              right to share the material and that it does not contain sealed records, protected health
              information, minor-children PII, Social Security numbers, financial account numbers, or
              other material you are legally prohibited from disclosing.
            </p>
            <p className="mt-3">
              <strong>Redact before you upload.</strong> We will reject submissions containing
              unredacted sensitive PII. We are not responsible for material you upload that you were
              legally prohibited from disclosing.
            </p>
            <p className="mt-3">
              Submissions are stored on secure infrastructure. We do not sell or share your contact
              information. Your submission may be published in whole or in part after editorial review.
              You will be notified of the editorial decision.
            </p>
          </Block>

          <Block title="Data we collect.">
            <p>
              If you create an account, we store your name, email address, and OAuth identifier from
              your login provider. We store your submissions and their review status. We log
              administrative actions for audit purposes.
            </p>
            <p className="mt-3">
              We use standard web analytics to understand site traffic. We do not use advertising
              trackers. We do not sell data.
            </p>
            <p className="mt-3">
              You may request deletion of your account and any pending (unreviewed) submissions by
              contacting the operator through the site. Published records that are part of the public
              archive may be retained consistent with the editorial mission.
            </p>
          </Block>

          <Block title="Corrections and right of reply.">
            <p>
              If you believe a specific factual claim in this archive is inaccurate, submit a correction
              through the intake form with the specific claim, the document or page where it appears, and
              the evidence supporting your correction. We will review documented corrections and publish
              a correction notice if warranted.
            </p>
            <p className="mt-3">
              We do not publish unverified denials. We do publish documented corrections. There is a
              difference.
            </p>
          </Block>

          <Block title="Copyright and fair use.">
            <p>
              Court filings are public records and are not subject to copyright protection. Communications
              from public officials acting in their official capacity are similarly public records.
              Reproduction of these materials for purposes of public accountability, journalism, legal
              research, and education is protected fair use.
            </p>
            <p className="mt-3">
              Original editorial content on this site (summaries, analysis, commentary) is copyright
              the operator. You may quote and link with attribution.
            </p>
          </Block>

          <Block title="Contact.">
            <p>
              This archive is operated by Cameron Church, pro se litigant in the above-referenced cases.
              For corrections, legal notices, or press inquiries, use the contact form on this site.
              For legal service, consult the public docket for the applicable case.
            </p>
          </Block>
        </div>
      </section>
    </SiteShell>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="display-serif text-2xl rule-amber mb-3">{title}</h2>
      {children}
    </div>
  );
}
