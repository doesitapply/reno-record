/**
 * Insert 2026 timeline events for CR23-0657 (State v. Church)
 * Based on the 41 uploaded 2026 filings
 * Run: npx tsx scripts/insert-2026-events.mjs
 */
import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

const events = [
  // ── JANUARY 2026 ──
  {
    event_date: '2026-01-05',
    title: 'Substitution of attorney — Joel Merchant withdraws; defendant proceeds pro se',
    category: 'state_case',
    summary: 'Substitution of attorney filed. Joel Merchant is relieved as counsel of record. Defendant Cameron Church proceeds pro se. This is the fifth attorney to exit the case. No trial date is set.',
    actors: JSON.stringify(['Joel Merchant', 'Cameron Church']),
    issue_tags: JSON.stringify(['faretta_self_representation', 'ineffective_assistance_of_counsel']),
    status: 'confirmed',
    narrative: 'Five attorneys in under three years. Each exit followed the same pattern: counsel either declared conflict, moved to withdraw citing repugnant motions, or left the APD entirely. The court never conducted a Faretta inquiry — the constitutionally required colloquy to ensure a defendant knowingly and voluntarily waives counsel. Without that inquiry, every subsequent proceeding where Church appeared without counsel is structurally defective. The court knew this. It struck his pro se filings when he had counsel. It never gave him the Faretta hearing when he didn\'t.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-01-10',
    title: 'Defendant files motion for written findings on speedy trial status',
    category: 'motion',
    summary: 'Pro se motion demanding written findings on speedy trial calculation, basis for outstanding warrant, and identification of the operative legal authority governing the case. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['speedy_trial_delay', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'This motion is asking one question: under what law is this case proceeding? The amended complaint, the Nunc Pro Tunc order, and the bindover sequence created a structural ambiguity about which charging instrument controls. The court has never answered. Not because the question is complex — it isn\'t. Because answering it requires acknowledging the Nunc Pro Tunc defect.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-01-19',
    title: 'Defendant files notice of unresolved structural errors and request for submission',
    category: 'motion',
    summary: 'Notice identifying unresolved structural errors in the case record, requesting the court rule on pending motions before setting new hearings. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'access_to_courts_interference']),
    status: 'confirmed',
    narrative: 'The pattern of non-response is not administrative backlog. The court has responded to State motions within days throughout this case. Defense motions — particularly those that identify structural defects — go unanswered for months. This is the mechanism: silence is not neutral. Silence on a structural defect motion is a ruling by inaction that preserves the defect.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-01-26',
    title: 'Defendant files motion for written findings on speedy trial status and warrant basis',
    category: 'motion',
    summary: 'Renewed motion demanding written findings on speedy trial calculation and the legal basis for the outstanding bench warrant. The warrant has been outstanding since August 22, 2025. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['speedy_trial_delay', 'warrant_or_bail_defect', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The bench warrant issued August 22, 2025 was conditioned on a Faretta hearing that never happened. The court conditioned Faretta on arrest — meaning the defendant must be re-arrested before he can exercise his constitutional right to self-representation. That is not a condition; that is coercion. The motion is asking the court to explain the legal basis for this posture. The court\'s silence is the answer.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-01-31',
    title: 'Official notice of record absurdity, disqualifying conflict, and request for immediate intervention',
    category: 'motion',
    summary: 'Notice identifying what defendant characterizes as a disqualifying conflict of interest in the court\'s handling of the case, requesting immediate intervention. No response from court.',
    actors: JSON.stringify(['Cameron Church', 'Judge Barry L. Breslow']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The conflict identified here is structural: Judge Breslow presided over the competency proceedings that generated the Nunc Pro Tunc order, struck every pro se challenge to that order, and then continued to preside over the case. A judge cannot be both the author of a challenged procedure and the neutral arbiter of whether that procedure was lawful. The NRS 1.230 disqualification standard does not require proof of subjective bias — it requires only that a reasonable person would question the judge\'s impartiality. That standard is met on the face of the record.',
    source_docs: null,
    public_status: 1
  },
  // ── FEBRUARY 2026 ──
  {
    event_date: '2026-02-04',
    title: 'Defendant files motion to dismiss for non-curable structural error',
    category: 'motion',
    summary: 'Motion to dismiss arguing the case contains structural constitutional errors that cannot be cured by further proceedings — specifically the Nunc Pro Tunc amended complaint defect, the lack of a valid preliminary hearing waiver, and the speedy trial violation. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['nunc_pro_tunc_concern', 'due_process_defect', 'speedy_trial_delay', 'faretta_self_representation']),
    status: 'confirmed',
    narrative: '"Non-curable structural error" is a specific legal term. It means the defect is not harmless — it cannot be fixed by a new hearing or a corrective order. The Nunc Pro Tunc amended complaint is the clearest example: a court cannot use a retroactive order to create jurisdiction it did not have at the time of the original act. If the amended complaint was defective when filed, it was defective. A Nunc Pro Tunc order entered months later does not cure that. The court has never addressed this argument on the merits. It has only struck the motions that raise it.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-02-13',
    title: 'Notice of constitutional non-compliance and demand for written findings',
    category: 'motion',
    summary: 'Notice documenting the court\'s failure to comply with constitutional requirements and demanding written findings on all pending motions. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'access_to_courts_interference']),
    status: 'confirmed',
    narrative: 'By February 2026, the defendant has filed over a dozen motions demanding written findings. The court has issued zero written findings on any constitutional challenge. This is not oversight. Nevada Rules of Civil Procedure and due process require courts to make findings when ruling on constitutional motions. The absence of findings is itself a constitutional violation — it denies the defendant the ability to appeal, because there is nothing to appeal from.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-02-27',
    title: 'Defendant files motion to dismiss and threshold notice of controlling law',
    category: 'motion',
    summary: 'Motion to dismiss accompanied by a threshold notice identifying the controlling legal authority the court has failed to apply. The notice cites specific Nevada and federal precedents governing speedy trial, Faretta rights, and Nunc Pro Tunc limitations. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['speedy_trial_delay', 'faretta_self_representation', 'nunc_pro_tunc_concern', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The threshold notice is a strategic document. It is not asking the court to rule — it is creating a record that the court was explicitly informed of the controlling law before it failed to apply it. This matters for appeal and for any subsequent federal habeas petition: the defendant exhausted state remedies not just by filing motions, but by citing the specific authority the court was required to follow. The court\'s non-response is now a documented failure to apply cited controlling law.',
    source_docs: null,
    public_status: 1
  },
  // ── MARCH 2026 ──
  {
    event_date: '2026-03-18',
    title: 'Defendant files motion to dismiss for cumulative constitutional violations',
    category: 'motion',
    summary: 'Motion to dismiss arguing that the cumulative effect of individual constitutional violations — each potentially harmless in isolation — rises to a level that requires dismissal with prejudice. Cites three years of delay, five attorney failures, competency abuse, and Nunc Pro Tunc defect as a pattern. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['speedy_trial_delay', 'due_process_defect', 'competency_proceeding_abuse', 'nunc_pro_tunc_concern', 'ineffective_assistance_of_counsel']),
    status: 'confirmed',
    narrative: 'Cumulative error doctrine is well-established in the Ninth Circuit and Nevada Supreme Court. Individual errors that might be harmless in isolation can, when aggregated, constitute a due process violation requiring reversal. The defendant is not just cataloging grievances — he is making a specific legal argument that the court has an obligation to address. The court\'s silence on this motion is particularly significant: it cannot be explained by complexity (the doctrine is settled), by pending resolution of other issues (no other issues are pending), or by administrative backlog (the State\'s motions are answered promptly). The only remaining explanation is avoidance.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-03-29',
    title: 'Defendant files notice of non-response',
    category: 'motion',
    summary: 'Notice formally documenting the court\'s failure to respond to pending motions. By this date, over ten motions filed since January 2026 remain unanswered. The notice requests a ruling or an explanation for the delay.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'access_to_courts_interference']),
    status: 'confirmed',
    narrative: 'This is the document that makes the silence visible. The defendant is not just filing motions — he is filing a notice that the motions exist and have not been answered. This creates a clean record for appeal: the court was notified of its own non-response and still did not respond. The notice of non-response is itself evidence of the pattern. Courts that are merely backlogged respond to notices of non-response by scheduling hearings. Courts that are deliberately avoiding a question do not.',
    source_docs: null,
    public_status: 1
  },
  // ── APRIL 2026 ──
  {
    event_date: '2026-04-17',
    title: 'Defendant files motion for written clarification',
    category: 'motion',
    summary: 'Motion requesting written clarification on the operative charging instrument, the legal basis for the outstanding warrant, and the current procedural posture of the case. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'warrant_or_bail_defect']),
    status: 'confirmed',
    narrative: 'Three years into a case, the defendant does not know what he is charged with — not because the charges are complex, but because the charging instrument has been amended, the amendment was entered Nunc Pro Tunc, and the court has never clarified which version controls. This is not a procedural technicality. A defendant has a constitutional right to know the charges against him. The court\'s failure to clarify is a Sixth Amendment violation on its face.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-04-28',
    title: 'Defendant files supplemental notice of obvious procedural defects absent findings',
    category: 'motion',
    summary: 'Supplemental notice identifying additional procedural defects that have accumulated without court findings. Requests submission on all pending motions. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'access_to_courts_interference', 'faretta_self_representation']),
    status: 'confirmed',
    narrative: 'The word "obvious" in the title is deliberate. The defendant is not claiming the defects are subtle or require expert analysis. He is saying they are visible on the face of the record to any attorney or judge who reads it. The failure to address obvious defects is harder to explain as negligence than the failure to address complex ones. This is the process of elimination in action: negligence explains missing a subtle issue. It does not explain missing an obvious one.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-04-30',
    title: 'State files motion to disqualify Judge Breslow — conflict identified',
    category: 'state_case',
    summary: 'The State of Nevada files a motion to disqualify Judge Barry L. Breslow from presiding over CR23-0657, citing a conflict of interest. This is the State\'s own motion — not the defendant\'s. Exhibit A filed simultaneously.',
    actors: JSON.stringify(['Amos Stege', 'Judge Barry L. Breslow']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias']),
    status: 'confirmed',
    narrative: 'This is the most significant event in the 2026 record. The State — the party that has benefited from Judge Breslow\'s rulings throughout this case — is now moving to disqualify him. The defendant has been filing disqualification motions since 2024. Every one was struck or ignored. Now the State files the same motion and it is treated as a legitimate legal proceeding. The asymmetry is the evidence. If the disqualification grounds were frivolous when the defendant raised them, they are frivolous now. If they are legitimate now, they were legitimate then — and every ruling Breslow made after the defendant first raised disqualification is subject to challenge.',
    source_docs: null,
    public_status: 1
  },
  // ── MAY 2026 ──
  {
    event_date: '2026-05-06',
    title: 'Defendant files motion for merits rulings on all pending constitutional motions',
    category: 'motion',
    summary: 'Motion demanding the court rule on the merits of all pending constitutional motions rather than disposing of them procedurally. By this date, over fifteen motions remain unanswered. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'access_to_courts_interference']),
    status: 'confirmed',
    narrative: 'A merits ruling is different from a procedural ruling. The court has been disposing of the defendant\'s motions procedurally — striking them for hybrid representation, dismissing them for lack of standing, or simply not responding. A merits ruling requires the court to engage with the substance of the constitutional argument. The defendant is asking for that engagement. The court\'s refusal to engage on the merits is itself the constitutional violation: due process requires a meaningful opportunity to be heard, not just the formal opportunity to file.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-05-08',
    title: 'Two-year anniversary notice filed — case still pending, no trial',
    category: 'motion',
    summary: 'Defendant files a notice marking the two-year anniversary of the case\'s transfer to district court with no trial date set, no merits rulings on constitutional motions, and no resolution of the structural defects identified in the record.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['speedy_trial_delay', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The two-year mark in district court is significant under Nevada speedy trial law. NRS 178.556 provides that a defendant not brought to trial within one year of arraignment may move for dismissal. The defendant was arraigned in September 2023. By May 2026, the case has been pending for over two and a half years in district court. The State\'s response to every speedy trial motion has been to point to the competency stay as tolling the clock. But the competency stay itself was the product of a proceeding the defendant challenged as pretextual. If the competency stay was improper, it does not toll the speedy trial clock.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-05-14',
    title: 'Defendant files motion for written findings identifying operative legal authority',
    category: 'motion',
    summary: 'Motion demanding the court identify in writing the operative legal authority governing the case — specifically, which charging instrument controls, what speedy trial calculation applies, and what procedural rules govern pro se filings. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'nunc_pro_tunc_concern', 'faretta_self_representation']),
    status: 'confirmed',
    narrative: 'This motion is asking the court to do something any first-year law student could do in an afternoon: identify the controlling law. The court\'s failure to do so after three years is not explained by complexity. It is explained by the fact that identifying the controlling law requires acknowledging the Nunc Pro Tunc defect, the Faretta failure, and the speedy trial violation — all at once, in writing, on the record.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-05-15',
    title: 'Supplemental notice of record contradiction, ordinary procedure comparison, and continued non-response',
    category: 'motion',
    summary: 'Supplemental notice comparing the court\'s treatment of this case to ordinary procedural standards in comparable Nevada cases, documenting the deviation and requesting explanation. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'judicial_disqualification_bias']),
    status: 'confirmed',
    narrative: 'The comparison to ordinary procedure is the process of elimination made explicit. If the court\'s behavior in this case is consistent with how it handles all cases, then the pattern is systemic and the defendant is not being singled out. If the court\'s behavior deviates from ordinary procedure in ways that consistently disadvantage the defendant and advantage the State, then the deviation requires explanation. The notice documents the deviation. The court\'s silence in response to the notice confirms it.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-05-20',
    title: 'Defendant files companion notice and master structural-injury motion for specific written findings',
    category: 'motion',
    summary: 'Companion notice and master motion consolidating all structural constitutional challenges into a single comprehensive filing, demanding specific written findings on each. This is the most comprehensive single filing in the 2026 record. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'nunc_pro_tunc_concern', 'speedy_trial_delay', 'faretta_self_representation', 'competency_proceeding_abuse', 'warrant_or_bail_defect']),
    status: 'confirmed',
    narrative: 'The master structural-injury motion is the defendant\'s clearest statement of the full case. It consolidates every constitutional challenge — Nunc Pro Tunc, Faretta, speedy trial, competency abuse, warrant defect — into a single document with specific findings requested on each. A court that is operating in good faith would respond to this motion with a hearing and written findings. A court that is avoiding the issues would not respond at all. The court did not respond.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-05-21',
    title: 'Defendant files renewed motion for Faretta hearing',
    category: 'motion',
    summary: 'Renewed motion for a Faretta self-representation hearing. The defendant has been proceeding pro se since January 2026 without a formal Faretta inquiry. The motion requests the court conduct the constitutionally required colloquy. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['faretta_self_representation', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'Faretta v. California, 422 U.S. 806 (1975) requires that before a defendant proceeds pro se, the court must conduct a colloquy to ensure the waiver of counsel is knowing, voluntary, and intelligent. The defendant has been proceeding pro se since January 2026. No Faretta hearing has been conducted. Every proceeding since January 2026 in which the defendant appeared without counsel — without a valid Faretta waiver — is structurally defective. The court knows this. The motion is asking the court to fix it. The court\'s silence means it is choosing not to.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-05-29',
    title: 'Defendant files renewed motion to compel production or disclaimer, short notice on docket clarification, and renewed motion for written findings on Faretta',
    category: 'motion',
    summary: 'Three filings on the same day: (1) renewed motion to compel discovery production or a formal disclaimer of its existence; (2) short notice requesting docket clarification and written findings; (3) renewed motion for written findings on Faretta status or dismissal for Faretta avoidance. No response from court on any.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['brady_discovery_issue', 'faretta_self_representation', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'Three motions in one day, each targeting a different structural defect. The discovery motion is asking the State to either produce the materials or formally disclaim their existence — either answer is acceptable, but silence is not. The Faretta motion is asking the court to either conduct the hearing or explain why it won\'t. The docket clarification notice is asking the court to explain the current procedural posture. None of these are complex requests. All of them remain unanswered.',
    source_docs: null,
    public_status: 1
  },
  // ── JUNE 2026 ──
  {
    event_date: '2026-06-02',
    title: 'Defendant files notice of failure to adjudicate, notice of obvious governing law, and notice of intent',
    category: 'motion',
    summary: 'Three-part notice: (1) formal notice of the court\'s failure to adjudicate pending motions; (2) notice of obvious governing law the court has failed to apply; (3) notice of intent regarding next steps. No response from court.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'access_to_courts_interference', 'judicial_disqualification_bias']),
    status: 'confirmed',
    narrative: 'The notice of "obvious governing law" is a specific rhetorical and legal strategy. By characterizing the applicable law as "obvious," the defendant is foreclosing the court\'s ability to claim it was unaware or that the question was unsettled. If the law is obvious and the court still fails to apply it, the failure is not ignorance — it is choice. This is the process of elimination applied to judicial conduct: eliminate inadvertence, eliminate complexity, eliminate unsettled law. What remains is deliberate non-application of known law.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-04',
    title: 'Court issues order setting hearing and pausing bench warrant for 24 hours',
    category: 'warrant',
    summary: 'Court issues order setting a hearing and pausing the outstanding bench warrant for 24 hours. This is the first court-initiated action in response to the 2026 filings. The 24-hour pause suggests the court is aware of the defendant\'s position but has not resolved it.',
    actors: JSON.stringify(['Judge Barry L. Breslow', 'Cameron Church']),
    issue_tags: JSON.stringify(['warrant_or_bail_defect', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The 24-hour warrant pause is significant for what it reveals: the court is capable of acting quickly when it chooses to. The bench warrant has been outstanding since August 22, 2025 — over nine months. In response to the defendant\'s escalating filings, the court pauses it for 24 hours. Not resolves it. Not vacates it. Pauses it. This is not a substantive response to the constitutional challenges. It is a procedural maneuver that preserves the coercive posture of the warrant while creating the appearance of engagement.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-04',
    title: 'Defendant files notice of intent to participate remotely',
    category: 'motion',
    summary: 'Defendant files notice of intent to appear at the scheduled hearing remotely. The court has conditioned the Faretta hearing on physical arrest. The defendant is asserting his right to participate without submitting to arrest.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['faretta_self_representation', 'warrant_or_bail_defect', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The court\'s position — that the defendant must be arrested before he can have a Faretta hearing — inverts the constitutional logic. Faretta protects the right to self-representation. The right cannot be conditioned on arrest. Conditioning a constitutional right on submission to custody is a coercive waiver, not a voluntary one. The defendant is calling the court\'s bluff: he is willing to appear, but not to be arrested as a precondition for exercising a constitutional right.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-10',
    title: 'Court issues order to appear in person, denying remote participation',
    category: 'state_case',
    summary: 'Court issues order denying the defendant\'s notice of intent to appear remotely and ordering in-person appearance. The outstanding bench warrant remains active. Defendant files request for submission and remote summary review on the same date.',
    actors: JSON.stringify(['Judge Barry L. Breslow', 'Cameron Church']),
    issue_tags: JSON.stringify(['faretta_self_representation', 'warrant_or_bail_defect', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The order to appear in person, with an active bench warrant, is functionally an order to submit to arrest. The court is using the procedural requirement of in-person appearance to enforce the coercive posture of the warrant. This is the mechanism by which the warrant operates as leverage: the defendant cannot appear without being arrested, and the court will not resolve the constitutional issues without an appearance. The loop is closed. The only way out is submission.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-11',
    title: 'Defendant files affidavit of bias under NRS 1.235 and NRS 1.230, and response to June 10 order',
    category: 'motion',
    summary: 'Formal affidavit of bias filed under Nevada\'s judicial disqualification statutes. Simultaneously files response to the June 10 order denying remote appearance. The affidavit identifies specific acts and omissions by Judge Breslow as evidence of bias.',
    actors: JSON.stringify(['Cameron Church', 'Judge Barry L. Breslow']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'NRS 1.230 and 1.235 are Nevada\'s judicial disqualification statutes. An affidavit of bias under these statutes triggers a specific procedural obligation: the judge must either recuse or certify the affidavit to another judge for determination. Judge Breslow has not recused. He has not certified the affidavit. He has continued to preside. This is not a discretionary choice — it is a mandatory procedural obligation. The failure to follow the mandatory procedure is itself a due process violation, independent of whether the underlying bias claim has merit.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-12',
    title: 'Court issues order vacating hearing and extinguishing 24-hour pause on bench warrant',
    category: 'warrant',
    summary: 'Court vacates the scheduled hearing and extinguishes the 24-hour pause on the bench warrant. The warrant is now fully active again. No hearing has been held. No constitutional motions have been addressed.',
    actors: JSON.stringify(['Judge Barry L. Breslow']),
    issue_tags: JSON.stringify(['warrant_or_bail_defect', 'due_process_defect', 'access_to_courts_interference']),
    status: 'confirmed',
    narrative: 'The sequence is: court schedules hearing → pauses warrant → defendant refuses to submit to arrest as precondition → court cancels hearing → reinstates warrant. This is not a judicial response to constitutional motions. This is a coercive cycle. The warrant is the mechanism. The hearing is the carrot. The defendant\'s refusal to submit to arrest as a precondition for a constitutional hearing is treated as a basis for canceling the hearing entirely. The constitutional motions remain unanswered. The warrant remains active. Nothing has changed except the defendant has now documented the court\'s use of the warrant as leverage.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-15',
    title: 'Defendant files docket unreconciled settlement conference explanation',
    category: 'motion',
    summary: 'Filing addressing an unreconciled docket entry regarding a settlement conference that appears in the record without explanation. Requests clarification on the basis for and outcome of any settlement conference proceedings.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['due_process_defect', 'record_integrity_issue']),
    status: 'confirmed',
    narrative: 'A settlement conference in a criminal case is unusual. Criminal cases are not settled — they are dismissed, pled, or tried. The appearance of a settlement conference entry in the docket without explanation raises questions about what was discussed and with whom. The defendant is asking for clarification. The court\'s failure to provide it is consistent with the broader pattern of non-response to questions about the record\'s integrity.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-16',
    title: 'Court issues answer to affidavit of bias and order staying case',
    category: 'state_case',
    summary: 'Court issues answer to the defendant\'s affidavit of bias — the first substantive response to a disqualification challenge in the case history. Simultaneously issues an order staying the case. The stay is issued without explanation of its basis or duration.',
    actors: JSON.stringify(['Judge Barry L. Breslow']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The court\'s answer to the affidavit of bias is not a recusal — it is a response. Under NRS 1.235, the judge may respond to the affidavit before it is certified to another judge. The simultaneous stay of the case is the operative move: by staying the case, the court removes the immediate pressure to rule on the constitutional motions while preserving its own jurisdiction. The stay is not a resolution. It is a pause that benefits the court by eliminating the urgency of the defendant\'s pending motions without addressing any of them.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-17',
    title: 'Defendant files response to June 16 answer — binary 9.5 analysis',
    category: 'motion',
    summary: 'Defendant files response to the court\'s June 16 answer to the affidavit of bias, characterizing the answer as a binary choice between recusal and certification. Argues the court has no third option under Nevada law.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias', 'due_process_defect']),
    status: 'confirmed',
    narrative: 'The "binary 9.5" characterization is precise: under NRS 1.235, the judge\'s options are recusal or certification to another judge. There is no option to simply respond and continue presiding. The defendant is identifying the court\'s procedural error in real time. The court\'s answer to the affidavit — rather than recusing or certifying — is itself a violation of the mandatory procedure. This filing creates the record for a mandamus petition or an appellate challenge to any subsequent ruling by Judge Breslow.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-06-22',
    title: 'Order referring disqualification question to general jurisdiction — Judge Breslow recused',
    category: 'state_case',
    summary: 'Court issues order referring the disqualification question to the general jurisdiction department. Judge Breslow is effectively recused from the disqualification determination. The case is stayed pending resolution of the disqualification question. This is the first judicial action consistent with the mandatory procedure under NRS 1.235.',
    actors: JSON.stringify(['Judge Barry L. Breslow']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias']),
    status: 'confirmed',
    narrative: 'This order is the first time in the case history that the court has followed the mandatory procedure triggered by a disqualification challenge. The defendant has been filing disqualification motions since 2024. Every prior motion was struck or ignored. The State\'s April 30 disqualification motion — filed by the same party that has benefited from Breslow\'s rulings — is what finally triggered the mandatory referral. The asymmetry is stark and documented: the defendant\'s identical legal argument was invalid when he raised it and valid when the State raised it. That asymmetry is the evidence of bias.',
    source_docs: null,
    public_status: 1
  },
  // ── JULY 2026 ──
  {
    event_date: '2026-07-02',
    title: 'Dept. 6 issues notice — disqualification referral received',
    category: 'state_case',
    summary: 'Department 6 issues notice confirming receipt of the disqualification referral from Judge Breslow\'s court. The disqualification question is now pending before a different judge.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias']),
    status: 'confirmed',
    narrative: 'The case is now in a structural limbo: stayed by Breslow, with the disqualification question pending before Dept. 6. Every constitutional motion filed since January 2026 remains unanswered. The stay does not resolve them — it suspends the obligation to address them. If Breslow is disqualified, a new judge inherits a case with over twenty unanswered constitutional motions, a defective charging instrument, a Faretta failure, and a speedy trial violation that has been running for over three years. The new judge will face the same choice Breslow avoided: engage with the substance or find a procedural way around it.',
    source_docs: null,
    public_status: 1
  },
  {
    event_date: '2026-07-07',
    title: 'Defendant files case summary and NRS 1.235 consolidated notice in Dept. 6',
    category: 'motion',
    summary: 'Defendant files a comprehensive case summary and consolidated NRS 1.235 notice in Department 6, providing the new judge with a complete record of the constitutional challenges, the pattern of non-response, and the structural defects that require resolution.',
    actors: JSON.stringify(['Cameron Church']),
    issue_tags: JSON.stringify(['judicial_disqualification_bias', 'due_process_defect', 'speedy_trial_delay', 'nunc_pro_tunc_concern', 'faretta_self_representation']),
    status: 'confirmed',
    narrative: 'This is the most recent filing in the record. The defendant is doing what any competent litigant would do: introducing himself to the new judge with a complete, organized statement of the case. The case summary is not just a procedural document — it is the defendant\'s opportunity to present the full pattern to a judge who has not been part of it. Whether Dept. 6 engages with the substance or finds a procedural way to avoid it will determine whether the pattern continues or breaks.',
    source_docs: null,
    public_status: 1
  }
];

let inserted = 0;
let skipped = 0;

for (const ev of events) {
  // Check for duplicate by date + title
  const [existing] = await conn.query(
    'SELECT id FROM timeline_events WHERE event_date = ? AND title = ? LIMIT 1',
    [ev.event_date, ev.title]
  );
  if (existing.length > 0) {
    console.log(`  SKIP (exists): ${ev.title.slice(0, 60)}`);
    skipped++;
    continue;
  }

  await conn.query(`
    INSERT INTO timeline_events 
      (event_date, title, summary, category, actors, issue_tags, status, public_status, story_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
  `, [
    ev.event_date,
    ev.title,
    // Combine summary + narrative into the summary field for now
    `${ev.summary}\n\n[WHAT WAS REALLY HAPPENING] ${ev.narrative}`,
    ev.category,
    ev.actors,
    ev.issue_tags,
    ev.status,
    ev.public_status
  ]);
  console.log(`  ✓ inserted: ${ev.title.slice(0, 70)}`);
  inserted++;
}

console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);
await conn.end();
