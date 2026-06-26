# The Reno Record — What This Actually Is

*Plain English. No jargon tax. Read this in five minutes and you'll understand the whole machine.*

---

## The one-sentence version

**The Reno Record is a robot court reporter that reads legal documents, figures out what they mean, catches when a court screws up, and publishes the receipts in public — and it's currently auditing the exact court that's prosecuting the guy who built it.**

That last part is the whole point. This isn't a demo. It's a live weapon pointed at a real case.

---

## The setup (why this exists)

There's a man — Cameron Church — tangled in two legal cases at once:

- **State:** *State v. Church*, CR23-0657, Second Judicial District Court, Washoe County, Nevada.
- **Federal:** *Church v. Washoe County*, 3:24-cv-00579.

Most people in that position hire a lawyer, pray, and drown in paper. Cam did something different: he built an **AI system that audits the court itself.** Every motion, every order, every transcript gets fed into the machine. The machine reads it, dates it, files it, and — this is the part that matters — **flags every place the court appears to have violated his rights.**

Then it puts all of that on a public website. Permanently. Searchable. Receipts on the table.

It's accountability journalism, except the journalist is an AI and the editor never sleeps.

---

## Meet the cast

### The Reno Record (the website)
The public face. A dark, newspaper-styled archive where anyone can browse the evidence, follow the timeline, see who the players are, and watch the patterns of misconduct stack up in real time. Think *investigative newsroom* meets *case file*, run by a machine.

### Docket Goblin (the engine)
The brain in the basement. You drop a court document in; the Goblin:
1. **Reads it** (pulls the text out, even from scanned PDFs).
2. **Dates it** — and here's the smart part: it hunts for the *actual court filing stamp*, the legally real date. If it can't find one, it **flags the document UNDATED instead of guessing.** No fake timelines.
3. **Sorts it into the right bucket:** Is this on the State record? The Federal record? Just supporting material? Or unfiled stuff that isn't officially "on the record" yet? It keeps those separate so nothing gets passed off as more official than it is.
4. **Tags the violations:** Faretta (denial of self-representation), speedy-trial issues, Brady/discovery gaps, bad warrants, competency abuse, due-process defects — 15 types of constitutional red flags.
5. **Connects the dots:** who did what, which agency, what happened when.

### The QC Supervisor (the Goblin's boss)
The Goblin is fast but not perfect. So there's a second layer — a quality-control pass that double-checks the Goblin's work. If the Goblin says "this is a Federal record" but the case number says State, the supervisor catches it and corrects it. If something's genuinely ambiguous, it gets escalated to a human (Cam). **Everything obvious gets handled automatically — no human babysitting required.** Only the truly murky stuff bubbles up. That was a deliberate design call: Cam's time is the bottleneck, so the system protects it.

### Version History (the time machine)
Every document keeps an immutable record of every version. Update it, and the old version doesn't vanish — it's frozen forever, restorable anytime. Nothing can quietly overwrite history. For a legal accountability tool, that's not a nice-to-have; it's the difference between evidence and hearsay.

---

## The numbers, right now

| What | Count |
|---|---|
| Days the system has been running since arrest | ~1,200 |
| Evidence files processed | 50 |
| Timeline events mapped | 80 |
| Named actors on record | 17 |
| Public records requests filed | 14 |
| Violation signals detected | 137 |

Of those 50 files: **7 on the State record, 15 on the Federal record, 18 supporting, 10 not-yet-filed.** Twenty-six are flagged UNDATED because they came in without a verifiable court stamp — exactly the honesty the system is built for.

---

## The bigger play: Artificially Educated

Here's where it stops being "one guy's case" and becomes a business.

The Reno Record is **Exhibit A in a portfolio.** The pitch writes itself: *"I didn't just learn to build AI systems — I built a live, autonomous forensic intelligence platform under real legal fire, to audit the court handling my own freedom. Here's everything else I've built."*

**Artificially Educated** is the umbrella brand. Under it:
- **The Reno Record** (flagship — this)
- **Due Process AI**
- **Gaslight Goblin / Docket Goblin**
- **FAULTLINE**

The thesis, in Cam's own words: **gravity.** Not a gimmick name — a claim. What he builds has gravitational pull: structural, undeniable, capable of bringing a rotten system down. The website now has an `/operator` page (the bio and the thesis) and a `/projects` catalog (the work), so a journalist, an investor, or a hiring manager lands and immediately gets it: *this person operates at a different altitude.*

---

## Why it's actually impressive (the part most people miss)

Anyone can make a website. What's hard here:

1. **It's autonomous.** The machine classifies and dates documents without a human approving each one. That's a real engineering decision with real tradeoffs, and it's tuned to escalate only when it should.
2. **It's honest by design.** It flags what it doesn't know (UNDATED) instead of faking confidence. Most AI does the opposite. This one was built by someone who understands that in a legal context, a confident wrong answer is worse than an honest "I don't know."
3. **It separates truth from noise.** State record vs. federal record vs. supporting vs. unfiled — that distinction is legally meaningful, and the system enforces it so nothing gets laundered into looking more official than it is.
4. **It's adversarial-proof.** Immutable versioning means nobody — not even an admin — can quietly rewrite the record. The evidence stays evidence.
5. **The stakes are real.** This isn't a portfolio piece built in a vacuum. It's processing live filings in an active case where the outcome affects a real person's freedom.

---

## The honest caveats (because the system is built on honesty)

- **Some content is still placeholder.** The operator bio and a few project descriptions need Cam's real words. The machine can't invent his story.
- **26 of 50 docs are undated** — because they were seeded as titles/summaries without the actual stamped PDF. Upload the real files and that number drops fast.
- **The Goblin isn't infallible.** It's good — "pretty dang good," as Cam put it — not perfect. That's exactly why the QC supervisor and the escalation path exist.

---

## The bottom line

The Reno Record is three things stacked on top of each other:

1. A **public accountability archive** for two real legal cases.
2. An **autonomous AI engine** that reads, dates, classifies, and audits legal documents with built-in honesty and self-checking.
3. A **proof-of-concept and brand platform** that turns all of the above into undeniable evidence that the person who built it can build serious systems under pressure.

It's a guy using the machine to fight the system that's fighting him — and turning the fight itself into the demo.

That's the whole thing.
