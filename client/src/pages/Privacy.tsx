import SiteShell from "@/components/SiteShell";

export default function PrivacyPage() {
  return (
    <SiteShell>
      <section className="container py-14 md:py-20 max-w-3xl">
        <div className="eyebrow">Privacy & Terms</div>
        <h1 className="display-serif text-5xl mt-3 leading-[1.02]">Ground rules.</h1>

        <div className="mt-8 space-y-8 text-foreground/85 leading-relaxed">
          <Block title="What this site is.">
            <p>
              The Reno Record is a public-interest documentation project. It collects and
              organizes records, submitter accounts, and public information about specific cases
              and officials. It is not a law firm. Nothing on this site is legal advice. Visiting
              this site or submitting a story does not create an attorney-client relationship.
            </p>
          </Block>

          <Block title="What we publish.">
            <p>
              Submissions are reviewed before publication. Allegations are presented as reported
              until corroborated by records. We do not publish content the submitter has not
              explicitly authorized. The Docket Goblin AI assistant only drafts tags and
              summaries — it cannot publish anything on its own.
            </p>
          </Block>

          <Block title="What you should never upload.">
            <p>
              Do not upload Social Security numbers, full birth dates, medical records,
              minor-children PII, financial account numbers, sealed records, or addresses of
              non-public people. Redact first. We will reject submissions containing this material.
            </p>
          </Block>

          <Block title="Corrections.">
            <p>
              If you are mentioned in this archive and believe a record is inaccurate, submit a
              correction through the standard intake form. We respond to specific, documented
              corrections.
            </p>
          </Block>

          <Block title="Election and accountability content.">
            <p>
              The Election &amp; Accountability page is non-partisan, sourced only from public
              records, and does not endorse candidates or coordinate with any campaign.
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
