import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}
const conn = await mysql.createConnection(url);

console.log("[seed] clearing prior seed rows…");
await conn.query("DELETE FROM stories WHERE submitter_name = 'Reno Record Editorial' OR alias = 'Editorial'");
await conn.query("DELETE FROM actors WHERE slug LIKE 'seed-%'");
await conn.query("DELETE FROM timeline_events WHERE summary LIKE 'SEED:%'");
await conn.query("DELETE FROM public_records_requests WHERE title LIKE 'SEED:%'");

console.log("[seed] inserting Church Record story (featured)…");
await conn.query(
  `INSERT INTO stories
   (submitter_name, alias, email, case_number, court, department, judge, prosecutor, defense_attorney,
    charges, custody_days, still_pending, trial_held, requested_trial, counsel_waived_time,
    filings_blocked, asked_self_rep, faretta_handled, competency_raised, competency_context,
    discovery_missing, warrants_used, family_harm, summary, main_issue,
    public_permission, redaction_confirmed, status, featured, slug)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    "Reno Record Editorial",
    "Editorial",
    "editor@therenorecord.org",
    "CR21-XXXX",
    "Second Judicial District Court, Washoe County",
    "Dept. ___",
    "—",
    "Washoe County District Attorney",
    "Washoe County Public Defender / private counsel of record",
    "Multiple felony counts (originally charged); see public docket.",
    420,
    true,
    false,
    true,
    true,
    true,
    true,
    false,
    true,
    "Competency was raised after the defendant repeatedly demanded a speedy trial, requested self-representation, and filed pro se motions challenging counsel's waivers of time. The competency proceedings followed those assertions in close temporal proximity.",
    true,
    true,
    "Loss of caregiver income for dependents; family separation across multiple custody periods; missed employment cycles; documented mental-health and medical impact during pretrial detention.",
    `The Church Record is the canonical case file documented by The Reno Record. The defendant repeatedly invoked a constitutional right to a speedy trial. Counsel of record waived statutory time without express on-record consent. Pro se filings — including motions to dismiss for speedy-trial violations and to permit self-representation — were filed, then either struck, ignored, or treated as legal nullities while counsel remained on record. Competency was raised after these assertions, not before. Pretrial detention extended past one year without trial, with collateral harm to dependents documented contemporaneously. This summary describes the issues on the public record; specific filings and orders are linked from the Evidence Archive as they are reviewed and approved for publication.`,
    "Speedy trial demanded for over a year while filings were blocked and competency was used to interrupt assertion of constitutional rights.",
    true,
    true,
    "approved",
    true,
    "the-church-record",
  ],
);

console.log("[seed] inserting actors…");
const actorsSeed = [
  {
    slug: "seed-2jdc-washoe",
    name: "Second Judicial District Court of Nevada",
    role: "State trial court (Washoe County)",
    agency: "Washoe County",
    bio: "The Second Judicial District Court of Nevada is the state trial court of general jurisdiction for Washoe County. Felony criminal matters arising in the county are filed and tried here.",
    notes:
      "Documented in The Church Record: pretrial detention extending beyond one year on a non-capital felony case; pro se filings struck or unruled while counsel remained of record; speedy-trial demands recorded but not reflected in trial setting.",
  },
  {
    slug: "seed-washoe-da",
    name: "Washoe County District Attorney's Office",
    role: "County prosecutor (elected office)",
    agency: "Washoe County",
    bio: "The Washoe County District Attorney is an elected officeholder responsible for state criminal prosecutions in Washoe County. The office controls charging, plea, and trial-readiness positions.",
    notes:
      "Position taken in the documented case: prosecution declined to oppose continuance requests that resulted in pretrial detention exceeding one year; competency was raised after the defendant invoked speedy-trial and self-representation rights.",
  },
  {
    slug: "seed-washoe-pd",
    name: "Washoe County Public Defender's Office",
    role: "Indigent defense agency",
    agency: "Washoe County",
    bio: "The Washoe County Public Defender's Office provides indigent criminal defense for people charged with felonies and certain misdemeanors in Washoe County.",
    notes:
      "Documented in this archive: continuances and time waivers entered while the client on the record asserted, in writing, that he did not consent and demanded trial. Documents tied to those waivers are referenced in the Evidence Archive.",
  },
  {
    slug: "seed-washoe-sheriff",
    name: "Washoe County Sheriff's Office",
    role: "Sheriff (elected office) — operates Washoe County Detention Facility",
    agency: "Washoe County",
    bio: "The Washoe County Sheriff is an elected officeholder. The agency operates the Washoe County Detention Facility, where pretrial detainees are held.",
    notes:
      "The sheriff's office is documented in this archive in its custodial capacity for pretrial detention referenced in The Church Record.",
  },
  {
    slug: "seed-nv-ag",
    name: "Nevada Attorney General",
    role: "State attorney general (elected statewide office)",
    agency: "State of Nevada",
    bio: "The Nevada Attorney General is the state's chief law-enforcement officer and represents the state in certain criminal and civil matters of statewide significance.",
    notes:
      "Listed for accountability context. Communications and public-records inquiries directed to this office regarding statewide patterns of pretrial detention and Faretta-canvass practice are tracked in the Public Records Tracker.",
  },
];
for (const a of actorsSeed) {
  await conn.query(
    `INSERT INTO actors (slug, name, role, agency, bio, notes, status, public_status)
     VALUES (?, ?, ?, ?, ?, ?, 'documented', 1)`,
    [a.slug, a.name, a.role, a.agency, a.bio, a.notes],
  );
}

console.log("[seed] inserting timeline events…");
const events = [
  {
    date: "2021-08-01",
    title: "Initial felony charging in Washoe County",
    summary: "SEED: Charging documents filed; defendant taken into pretrial custody.",
    cat: "state_case",
    status: "confirmed",
  },
  {
    date: "2021-09-15",
    title: "Defendant invokes speedy-trial right on record",
    summary:
      "SEED: First on-record demand for trial within statutory time; oral and written assertions documented.",
    cat: "motion",
    status: "confirmed",
  },
  {
    date: "2021-11-02",
    title: "Counsel waives time over recorded objection",
    summary:
      "SEED: Continuance entered; defendant's contemporaneous written objection filed and noted in subsequent filings.",
    cat: "motion",
    status: "confirmed",
  },
  {
    date: "2022-02-10",
    title: "Pro se motion to dismiss for speedy-trial violation filed",
    summary:
      "SEED: Pro se motion filed while counsel remained of record. Motion's disposition is among the records being publicly tracked.",
    cat: "motion",
    status: "alleged",
  },
  {
    date: "2022-04-22",
    title: "Defendant requests self-representation (Faretta)",
    summary:
      "SEED: On-record request to represent himself. Documentation of any subsequent canvass is being sought via public records.",
    cat: "motion",
    status: "confirmed",
  },
  {
    date: "2022-06-05",
    title: "Competency raised by counsel after rights assertions",
    summary:
      "SEED: Competency proceedings initiated following speedy-trial and self-representation requests. Temporal proximity documented.",
    cat: "competency",
    status: "alleged",
  },
  {
    date: "2022-09-19",
    title: "Pretrial detention exceeds one year without trial",
    summary:
      "SEED: Custody count surpasses 365 days; no trial date set or held.",
    cat: "custody",
    status: "confirmed",
  },
  {
    date: "2023-01-30",
    title: "Public records request filed with court administration",
    summary:
      "SEED: PRR seeking docket time-to-trial and pro se filing acceptance practices in Dept. ___ for the prior 24 months.",
    cat: "public_records",
    status: "confirmed",
  },
  {
    date: "2024-05-04",
    title: "Family-harm documentation collected",
    summary:
      "SEED: Caregiver-impact and dependent-care documentation collected during ongoing pretrial detention.",
    cat: "communications",
    status: "confirmed",
  },
];
for (const e of events) {
  await conn.query(
    `INSERT INTO timeline_events (event_date, title, summary, category, status, public_status, case_number)
     VALUES (?, ?, ?, ?, ?, 1, 'CR21-XXXX')`,
    [new Date(e.date), e.title, e.summary, e.cat, e.status],
  );
}

console.log("[seed] inserting public records requests…");
const prrs = [
  {
    title: "SEED: Time-to-trial data, Washoe County non-capital felonies, 2022–2024",
    agency: "Second Judicial District Court — Court Administration",
    description:
      "Aggregate data on average time from arraignment to trial for non-capital felony cases in Washoe County, calendar years 2022–2024, broken down by department.",
    dateSent: "2024-11-04",
    deadline: "2024-11-19",
    status: "awaiting_response",
  },
  {
    title: "SEED: Department-level standing orders re: pro se filings while counsel of record",
    agency: "Second Judicial District Court — Court Administration",
    description:
      "All standing orders, departmental policies, or written practices governing handling of pro se motions filed by represented defendants.",
    dateSent: "2024-11-04",
    deadline: "2024-11-19",
    status: "overdue",
  },
  {
    title: "SEED: Continuance and time-waiver records, CR21-XXXX",
    agency: "Washoe County Public Defender",
    description:
      "All written waivers of statutory time and continuance requests filed in CR21-XXXX, including any client objections of record.",
    dateSent: "2024-11-12",
    deadline: "2024-11-27",
    status: "partial_response",
  },
  {
    title: "SEED: Pretrial detention duration data, Washoe County Detention Facility",
    agency: "Washoe County Sheriff's Office",
    description:
      "Aggregated, anonymized counts of pretrial detainees held longer than 90, 180, and 365 days in the Washoe County Detention Facility, 2022–2024.",
    dateSent: "2024-11-12",
    deadline: "2024-11-27",
    status: "denied",
  },
];
for (const r of prrs) {
  await conn.query(
    `INSERT INTO public_records_requests
     (title, agency, description, date_sent, deadline, status, public_status)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [r.title, r.agency, r.description, new Date(r.dateSent), new Date(r.deadline), r.status],
  );
}

console.log("[seed] done.");
await conn.end();
