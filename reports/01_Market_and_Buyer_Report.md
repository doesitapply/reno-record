# The Reno Record — Market & Buyer Report

**Subject:** Who pays for this, why they need it, and the larger segment that needs it but does not yet know it exists.
**Prepared for:** Cameron Church
**Author:** Manus AI
**Version:** 1.0 — Grounded in the live v7.2 system

---

## 1. What the product actually is

The Reno Record is not a "legal blog" and not a generic document repository. It is a **document-to-structured-intelligence engine** wrapped in a public accountability archive. A user drops a raw legal document — a court filing, a police report, a public-records response — and the system extracts the text, classifies the document type, pulls the real filing-stamp date (rather than guessing), maps the named people and agencies, tags the procedural and constitutional violations with source quotes, scores how verifiable the document is, and either publishes it or queues it for human review. Every change is versioned immutably and every action is written to an append-only audit log.

In its current form it runs a single live case (the Church matter, State `CR23-0657` and Federal `3:24-cv-00579`) with **50 documents, 17 actors, 80 timeline events, 15 violation tag types applied 137 times, and 14 public-records requests**, all classified and snapshotted. That is the demonstrable artifact: a working, populated forensic archive, not a slide deck.

The strategic point that matters for positioning: the case archive is the *showcase*, but the *engine* is the product. The same pipeline that built this archive can build one for any litigant, journalist, or oversight body sitting on a pile of documents they cannot turn into a narrative.

---

## 2. The core buyers — people who will pay because they feel the pain today

There are four segments that already have the problem this solves acutely enough to pay. They are ranked by willingness-to-pay and clarity of need, not by market size.

### 2.1 Pro se and under-resourced litigants in active disputes

This is the sharpest pain and the clearest wedge. A person fighting a court, an agency, or an institution without a large legal team is drowning in documents and has no way to convert them into a defensible, organized, time-ordered record. They are emotionally invested, time-pressured, and frequently spending money on lawyers who bill hourly to do exactly the organizing-and-timelining work this system automates.

They need it for three concrete outcomes: a chronological record that holds up, a violation map that shows pattern rather than isolated incident, and a public-facing archive that creates external pressure and a permanent, tamper-evident record. The product replaces dozens of hours of paralegal time and gives a non-lawyer the structural output of a legal team.

### 2.2 Investigative journalists and newsroom accountability desks

Reporters working court and government beats face the same document-overload problem at scale, on deadline. They need to ingest filings fast, identify who the actors are, build a timeline, and surface the pattern that becomes the story. The version history and audit log matter here for a second reason beyond convenience: **provenance**. A newsroom needs to prove that a document was not altered after collection, and that the timeline reflects filing-stamp reality. The immutable snapshot system and append-only audit log are exactly the editorial-defensibility features a newsroom legal team asks for before publication.

### 2.3 Civil-rights, watchdog, and oversight organizations

Public-defender adjacent nonprofits, civil-rights litigation shops, police-accountability groups, and government-oversight organizations run on documents and patterns. Their entire theory of impact is "this is not one bad incident, it is a systemic pattern" — which is precisely what the violation-tagging + pattern-metrics layer is built to demonstrate. They also live and die on public-records requests; the built-in PRR tracking maps directly onto a workflow they currently run in spreadsheets. For these organizations the public archive is not a side feature, it is the deliverable: it is how they make the pattern legible to funders, courts, and the press.

### 2.4 Solo and small-firm attorneys who want leverage, not headcount

Small firms cannot afford the document-intelligence tooling that large firms buy (Relativity, Everlaw, and similar e-discovery platforms run into five and six figures and assume a litigation-support staff). A solo attorney wants the 80% of that value at a price and complexity they can actually adopt. The Reno Record's ingest-classify-timeline-tag loop is the high-frequency work they currently do by hand or push to an overworked paralegal. The public API and ingest endpoint mean it can also slot behind their existing tools rather than replacing them.

| Segment | Pain today | What they pay for | Adoption friction |
|---|---|---|---|
| Pro se / under-resourced litigants | Document overload, no structure, no leverage | Timeline, violation map, public pressure archive | Lowest — acute, personal, urgent |
| Investigative journalists | Speed + provenance under deadline | Fast structuring, tamper-evident record | Low — but needs editorial trust |
| Watchdog / oversight orgs | Proving systemic pattern, PRR sprawl | Pattern metrics, PRR tracking, public archive | Medium — procurement cycles |
| Solo / small-firm attorneys | Big-firm tooling priced out of reach | Affordable document intelligence + API | Medium — workflow integration |

---

## 3. The latent market — people who need it but do not know it exists

This is the segment the question is really pointing at, and it is where the larger value sits. These are people experiencing the symptom without naming the cause. They are not searching for "legal document intelligence platform." They are searching for relief from a feeling.

### 3.1 The person who thinks they just need to "stay organized"

Most people in a long-running dispute believe their problem is organizational — that if they could just get their documents into the right folders, they would be fine. They buy binders, they make spreadsheets, they keep a Google Drive. They do not realize that organization is not the bottleneck: **structure and pattern are the bottleneck.** A folder of 50 PDFs is not an argument. A timeline that shows a procedural violation recurring across four filings is an argument. This person needs the product but is shopping for the wrong category. The marketing job is to reframe their problem from "I need to be organized" to "I need my documents to make my case for me."

### 3.2 The person who has been told "you need a lawyer for that" and stopped

A large population has a legitimate grievance, has been quoted a retainer they cannot pay, and has simply given up on creating a record. They have effectively been priced out of being heard. They do not know that the structural work a lawyer would charge for — the timeline, the violation analysis, the organized exhibit set — can now be largely automated. This is a latent demand pool measured in the millions: every year far more people have justiciable problems than ever get legal help, a gap documented repeatedly in access-to-justice research [1] [2]. The product's reframing message to them is blunt: *you were told the door was closed; the structural part of what they were charging for is now a tool.*

### 3.3 The small newsroom that killed a story because it could not verify fast enough

Local and regional newsrooms routinely abandon investigative threads not because the story is not there, but because the document-processing cost to stand it up exceeds the shrinking budget. They do not know they need a structuring engine; they think they need more reporters. They need the thing that makes one reporter as productive as three on a document-heavy beat.

### 3.4 The community group sitting on a pattern they cannot prove

Neighborhood coalitions, tenant unions, and advocacy groups frequently *sense* a pattern — repeated agency misconduct, a recurring procedural failure — but cannot assemble the evidentiary structure that turns a feeling into a claim. They are the textbook latent user: high motivation, real underlying data, zero tooling, and no vocabulary for what they are missing.

> The unifying insight across the latent market: **these users are framing a structural-intelligence problem as an effort problem.** They believe the answer is to work harder or hire someone. The product's entire go-to-market hinges on reframing the category from "do more work" to "the work is now automated, and the output is leverage."

---

## 4. Why they need it — the value in plain terms

Strip away the feature list and the product delivers four things people will actually pay for:

**Leverage from documents they already have.** The raw material is sitting on their hard drive. The product converts dead PDFs into a live, queryable, pattern-revealing record without new effort.

**Defensibility.** Immutable version history and an append-only audit log mean the record can withstand a "you altered this" challenge. For litigants, journalists, and oversight groups, that is not a nice-to-have; it is the difference between a record that is admissible/publishable and one that is not.

**Pattern, not anecdote.** A single incident is dismissible. The violation-tagging and pattern-metrics layer is engineered to convert a pile of incidents into a demonstrable, counted, sourced pattern — which is what moves courts, editors, and funders.

**Public pressure as infrastructure.** The public archive turns a private grievance into a permanent, shareable, search-indexed record. That changes the power dynamic with any institution on the other side.

---

## 5. Positioning and message by audience

| Audience | Category they think they're in | Category to sell them | One-line hook |
|---|---|---|---|
| Pro se litigant | "Document organizer" | Case-building engine | "Your documents already contain your case. Make them prove it." |
| Journalist | "Another research tool" | Verifiable structuring engine | "Stand up a document-heavy story in a day, with provenance built in." |
| Watchdog / oversight | "Database we'll build ourselves" | Pattern-evidence platform | "Turn scattered incidents into a counted, sourced, public pattern." |
| Solo attorney | "Can't afford Everlaw" | Affordable document intelligence + API | "Big-firm document leverage, solo-firm price, fits behind your stack." |
| Latent user | "I just need to get organized" | Leverage from what you already have | "Organizing isn't the problem. Proving the pattern is. That part is now automated." |

---

## 6. Go-to-market priority

The fastest path to revenue is the **pro se / under-resourced litigant** wedge, because the pain is acute, personal, and unmet, and because the existing live case is a credible, emotionally resonant proof point. From there, the **watchdog/oversight** and **journalism** segments are natural expansions that share the same engine and add credibility and recurring institutional revenue. The **solo-attorney + API** motion is the durable B2B layer that monetizes the engine independently of any single archive.

The product should lead with the archive as proof and sell the engine as the product. The archive shows what the engine can do; the engine is what scales.

---

## References

[1] Legal Services Corporation, "The Justice Gap: The Unmet Civil Legal Needs of Low-Income Americans." https://justicegap.lsc.gov/

[2] World Justice Project, "Measuring the Justice Gap." https://worldjusticeproject.org/our-work/research-and-data/access-justice/measuring-justice-gap
