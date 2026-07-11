#!/usr/bin/env python3
"""
Enrich timeline events with the [WHAT WAS REALLY HAPPENING] narrative layer.
Uses process-of-elimination reasoning to produce the strongest possible
analytical conclusions, sourced to the record.

Model: gpt-5 with medium reasoning — this is nuanced legal analysis, not summarization.
"""

import os
import json
import time
import concurrent.futures as cf
import mysql.connector
from openai import OpenAI

client = OpenAI()

# Case context injected into every prompt
CASE_CONTEXT = """
CASE: State of Nevada v. Cameron Church, CR23-0657
Court: Second Judicial District Court, Washoe County, Dept. 8 (Judge Breslow)
Federal parallel: Church v. Breslow et al., 3:24-cv-00579-ART-CSD (D. Nev.)

KEY FACTS:
- Arrested May 8, 2023. Original charge: misdemeanor battery domestic violence.
- August 18, 2023: Amended complaint filed SAME DAY as preliminary hearing. Bindover to district court on amended charge. Defendant did not waive preliminary hearing on the amended charge — only on the original. This is the Nunc Pro Tunc defect.
- Five defense attorneys cycled through (Merchant, Brinson, Cooper, Figueroa, Sambar). Each withdrew under circumstances that benefited the prosecution's delay strategy.
- Competency proceedings initiated by the court — not the defense — after defendant began filing effective pro se motions. Competency order entered nunc pro tunc to December 5, 2023.
- Brady material: Hicks (arresting officer) destroyed his personal cell phone containing communications relevant to the arrest. DA's office was notified. No sanctions sought, no disclosure made.
- 1,200+ days without trial as of mid-2026. Nevada NRS 178.556 requires trial within 60 days of arraignment absent good cause. No good cause finding on the record.
- Defendant has filed 40+ pro se motions since 2024. Court has not ruled on the merits of a single one.
- June 2026: State files motion to disqualify Judge Breslow. Case stayed. Referred to Dept. 6.
- Federal civil case dismissed without prejudice Dec 2025. Rule 59(e) pending.

ACTORS:
- Judge Breslow: Presiding judge. Has struck pro se motions, entered nunc pro tunc orders, initiated competency proceedings, refused to rule on pending motions.
- DDA Aziz Merchant: Lead prosecutor. Signed the amended complaint. Named in criminal referral motion.
- Joel Merchant (defense): First retained counsel. Withdrew Jan 2026 after substitution of attorney filed.
- Cooper/Brinson: Earlier defense counsel. Discovery packs show limited engagement.
- Figueroa: Defense counsel 2024-2025. Emails show communication gaps.
- Hicks: Arresting officer. Destroyed personal cell phone post-arrest.

CORE LEGAL ARGUMENTS:
1. Brady violation: Hicks phone destruction = suppression of material evidence.
2. Nunc Pro Tunc defect: Bindover on amended charge without proper preliminary hearing = jurisdictional defect.
3. Speedy trial: 1,200+ days, no good cause finding, no trial date.
4. Faretta/self-representation: Pro se motions struck while defendant was without effective counsel.
5. Competency weaponization: Competency proceedings initiated to neutralize effective pro se advocacy.
6. Counsel ineffectiveness: Pattern of withdrawal at strategic moments, failure to preserve issues.
7. Judicial bad faith: Pattern of non-rulings, silence on pending motions, procedural manipulation.
"""

SYSTEM_PROMPT = f"""You are a legal analyst writing the "What Was Really Happening" layer for a public legal accountability archive about a criminal case in Washoe County, Nevada.

{CASE_CONTEXT}

Your task: For each timeline event, write a narrative analysis that:

1. ELIMINATES alternative explanations first. For each claim you make, explicitly walk through the innocent/benign explanations and show why the record rules them out. Use this structure: "One could argue [X]. But the record shows [Y], which eliminates that explanation because [Z]."

2. ARRIVES at the strongest defensible conclusion. After eliminating alternatives, state the conclusion directly: what was actually happening, who benefited, and what it means legally.

3. NAMES ACTORS and their specific conduct. Do not use passive voice. "The court struck the motion" is weaker than "Judge Breslow struck the motion without explanation, three days after the defendant filed a notice identifying the Nunc Pro Tunc defect."

4. CONNECTS to the larger pattern. Show how this event fits the systemic picture — delay, suppression, neutralization of effective advocacy, or protection of the prosecution's structural defects.

5. CITES the record. Reference specific dates, document types, and procedural postures. If the event itself IS the citation, say so.

TONE: Direct, analytical, legally precise. Not inflammatory. The goal is to make the conclusion feel INEVITABLE — like the reader has no choice but to agree once they see the eliminated alternatives.

LENGTH: 150-300 words. Dense, not padded.

OUTPUT FORMAT: Plain text only. No headers, no bullet points, no markdown. Just the narrative paragraph(s).
"""

def get_db_connection():
    url = os.environ['DATABASE_URL']
    # Parse mysql://user:pass@host:port/db?ssl=...
    import re
    m = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', url)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")
    user, password, host, port, database = m.groups()
    return mysql.connector.connect(
        host=host, port=int(port), user=user, password=password, database=database,
        ssl_disabled=False, ssl_verify_cert=False
    )

def fetch_events_needing_narrative():
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("""
        SELECT id, title, summary, event_date, category, actors, case_number
        FROM timeline_events
        WHERE (summary NOT LIKE '%WHAT WAS REALLY HAPPENING%' OR summary IS NULL)
        ORDER BY event_date ASC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

def update_event_summary(event_id, new_summary):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE timeline_events SET summary = %s WHERE id = %s",
        (new_summary, event_id)
    )
    conn.commit()
    cur.close()
    conn.close()

def enrich_event(event):
    event_id = event['id']
    title = event['title'] or ''
    existing_summary = event['summary'] or ''
    date = str(event['event_date']) if event['event_date'] else ''
    category = event['category'] or ''
    actors = event['actors'] or ''
    case_number = event['case_number'] or ''
    significance = ''

    user_prompt = f"""EVENT TO ANALYZE:
Date: {date}
Title: {title}
Category: {category}
Case: {case_number}
Actors: {actors}
Significance: {significance}
Official summary: {existing_summary}

Write the "What Was Really Happening" narrative analysis for this event. Apply the process-of-elimination framework. Be specific, be direct, name actors, eliminate benign explanations before arriving at the conclusion the record compels."""

    try:
        resp = client.chat.completions.create(
            model="gpt-5",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=600,
            extra_body={"reasoning": {"effort": "medium"}},
        )
        narrative = resp.choices[0].message.content.strip()
        
        # Build the combined summary
        if existing_summary and existing_summary.strip():
            new_summary = f"{existing_summary.strip()}\n\n[WHAT WAS REALLY HAPPENING]\n{narrative}"
        else:
            new_summary = f"[WHAT WAS REALLY HAPPENING]\n{narrative}"
        
        update_event_summary(event_id, new_summary)
        print(f"  ✓ [{event_id}] {title[:60]}")
        return {"id": event_id, "status": "ok"}
    except Exception as e:
        print(f"  ✗ [{event_id}] {title[:60]} — {e}")
        return {"id": event_id, "status": "error", "error": str(e)}

def main():
    events = fetch_events_needing_narrative()
    print(f"Found {len(events)} events needing narrative enrichment")
    
    results = []
    # Process in batches of 6 to avoid rate limits
    with cf.ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(enrich_event, ev): ev for ev in events}
        for future in cf.as_completed(futures):
            result = future.result()
            results.append(result)
    
    ok = sum(1 for r in results if r['status'] == 'ok')
    err = sum(1 for r in results if r['status'] == 'error')
    print(f"\nDone: {ok} enriched, {err} errors")
    
    with open('/tmp/narrative-enrich-results.json', 'w') as f:
        json.dump(results, f, indent=2)

if __name__ == '__main__':
    main()
