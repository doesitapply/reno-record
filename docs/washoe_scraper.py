#!/usr/bin/env python3
"""
washoe_scraper.py — Washoe County Second Judicial District Court
Public Docket Scraper for Judicial Pattern Analysis

PURPOSE:
  Downloads publicly available minute orders and docket entries for cases
  assigned to a specific judge from the Washoe County court portal.
  Output is a folder of PDFs ready for Goblin ingest.

USAGE:
  python3 washoe_scraper.py --judge "Breslow" --output ./output/breslow_dockets
  python3 washoe_scraper.py --case-number "CR23-0657" --output ./output/cr23

TRANSPARENCY NOTE:
  This script accesses only publicly available court records via the same
  interface available to any member of the public. All requests are logged
  locally. This is not a "stealth" operation — it is standard public records
  research. If you are submitting an NPRA request in parallel, note that
  in your request letter.

REQUIREMENTS:
  pip install requests beautifulsoup4 playwright
  playwright install chromium

RATE LIMITING:
  Default: 3-second delay between requests. Do not reduce this.
  The Washoe County portal is a public resource. Be respectful.

PORTAL:
  https://www.washoecourts.com/
  Case search: https://www.washoecourts.com/Case/CaseSearch
"""

import argparse
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path

# ── Dependencies ──────────────────────────────────────────────────────────────
try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Missing dependencies. Run: pip install requests beautifulsoup4")
    raise

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("washoe_scraper.log"),
    ],
)
log = logging.getLogger("washoe_scraper")

# ── Constants ─────────────────────────────────────────────────────────────────
BASE_URL = "https://www.washoecourts.com"
CASE_SEARCH_URL = f"{BASE_URL}/Case/CaseSearch"
RATE_LIMIT_SECONDS = 3  # Do not reduce
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; PublicRecordsResearcher/1.0; "
        "+https://therenorecord.manus.space/privacy)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# ── Session ───────────────────────────────────────────────────────────────────
session = requests.Session()
session.headers.update(HEADERS)


def rate_limit():
    """Enforce minimum delay between requests."""
    time.sleep(RATE_LIMIT_SECONDS)


def search_by_judge(judge_name: str, year_start: int = 2020, year_end: int = 2026) -> list[dict]:
    """
    Search for cases assigned to a specific judge.
    Returns a list of case metadata dicts.

    NOTE: The Washoe County portal may require JavaScript rendering for
    some search features. If this function returns empty results, use
    the Playwright-based fallback (search_by_judge_playwright).
    """
    log.info(f"Searching for cases: judge='{judge_name}', years={year_start}-{year_end}")
    cases = []

    try:
        resp = session.get(CASE_SEARCH_URL, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Extract CSRF token if present
        csrf = None
        csrf_input = soup.find("input", {"name": "__RequestVerificationToken"})
        if csrf_input:
            csrf = csrf_input.get("value")
            log.debug(f"Found CSRF token: {csrf[:20]}...")

        # Build search payload
        payload = {
            "JudgeName": judge_name,
            "FilingDateFrom": f"01/01/{year_start}",
            "FilingDateTo": f"12/31/{year_end}",
            "CaseType": "CR",  # Criminal
        }
        if csrf:
            payload["__RequestVerificationToken"] = csrf

        rate_limit()
        search_resp = session.post(CASE_SEARCH_URL, data=payload, timeout=30)
        search_resp.raise_for_status()

        result_soup = BeautifulSoup(search_resp.text, "html.parser")
        case_rows = result_soup.select("table.case-results tr[data-case-id], tr.case-row")

        for row in case_rows:
            case_id = row.get("data-case-id") or ""
            cells = row.find_all("td")
            if len(cells) >= 3:
                cases.append({
                    "case_id": case_id,
                    "case_number": cells[0].get_text(strip=True),
                    "parties": cells[1].get_text(strip=True),
                    "filing_date": cells[2].get_text(strip=True),
                    "judge": judge_name,
                    "source_url": f"{BASE_URL}/Case/Details/{case_id}" if case_id else "",
                })

        log.info(f"Found {len(cases)} cases for judge '{judge_name}'")

    except requests.RequestException as e:
        log.error(f"Search request failed: {e}")
        log.info("The portal may require JavaScript. Try the Playwright fallback.")

    return cases


def search_by_case_number(case_number: str) -> dict | None:
    """Look up a specific case by number."""
    log.info(f"Looking up case: {case_number}")
    try:
        payload = {"CaseNumber": case_number}
        rate_limit()
        resp = session.post(CASE_SEARCH_URL, data=payload, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Try to find the case detail link
        link = soup.find("a", href=lambda h: h and "/Case/Details/" in h)
        if link:
            case_id = link["href"].split("/")[-1]
            return {
                "case_id": case_id,
                "case_number": case_number,
                "source_url": f"{BASE_URL}{link['href']}",
            }
    except requests.RequestException as e:
        log.error(f"Case lookup failed: {e}")
    return None


def get_case_documents(case_id: str, case_number: str) -> list[dict]:
    """
    Fetch the list of documents/minute orders for a case.
    Returns list of document metadata dicts with download URLs.
    """
    url = f"{BASE_URL}/Case/Details/{case_id}"
    log.info(f"Fetching documents for case {case_number} ({case_id})")

    try:
        rate_limit()
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        documents = []
        # Look for document links — common patterns in court portals
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if any(x in href.lower() for x in ["/document/", "/pdf/", "/download/", "docid="]):
                doc_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                documents.append({
                    "case_id": case_id,
                    "case_number": case_number,
                    "title": link.get_text(strip=True) or "Untitled Document",
                    "url": doc_url,
                    "scraped_at": datetime.utcnow().isoformat(),
                })

        log.info(f"Found {len(documents)} documents for case {case_number}")
        return documents

    except requests.RequestException as e:
        log.error(f"Document fetch failed for case {case_id}: {e}")
        return []


def download_document(doc: dict, output_dir: Path) -> Path | None:
    """Download a single document PDF to the output directory."""
    safe_title = "".join(c if c.isalnum() or c in "._- " else "_" for c in doc["title"])[:80]
    filename = f"{doc['case_number']}_{safe_title}.pdf".replace(" ", "_")
    output_path = output_dir / filename

    if output_path.exists():
        log.debug(f"Already downloaded: {filename}")
        return output_path

    try:
        rate_limit()
        resp = session.get(doc["url"], timeout=60, stream=True)
        resp.raise_for_status()

        content_type = resp.headers.get("content-type", "")
        if "pdf" not in content_type.lower() and "octet-stream" not in content_type.lower():
            log.warning(f"Unexpected content type '{content_type}' for {doc['url']}")

        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)

        log.info(f"Downloaded: {filename} ({output_path.stat().st_size:,} bytes)")
        return output_path

    except requests.RequestException as e:
        log.error(f"Download failed for {doc['url']}: {e}")
        return None


def run_scrape(
    output_dir: Path,
    judge: str | None = None,
    case_number: str | None = None,
    year_start: int = 2020,
    year_end: int = 2026,
    max_cases: int = 200,
):
    """Main scrape orchestration."""
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "manifest.json"
    manifest = []

    log.info("=" * 60)
    log.info("Washoe County Court Scraper — Public Records Research")
    log.info(f"Output: {output_dir}")
    log.info(f"Rate limit: {RATE_LIMIT_SECONDS}s between requests")
    log.info("=" * 60)

    # Collect cases
    cases = []
    if case_number:
        result = search_by_case_number(case_number)
        if result:
            cases = [result]
    elif judge:
        cases = search_by_judge(judge, year_start, year_end)[:max_cases]
    else:
        log.error("Must specify --judge or --case-number")
        return

    if not cases:
        log.warning("No cases found. The portal may require manual navigation.")
        log.info("Manual alternative:")
        log.info(f"  1. Go to {CASE_SEARCH_URL}")
        log.info(f"  2. Search for judge: {judge or 'your target'}")
        log.info("  3. Download minute orders manually")
        log.info("  4. Place PDFs in the output directory")
        log.info("  5. Upload via Goblin ingest in the admin panel")
        return

    # Download documents for each case
    for case in cases:
        docs = get_case_documents(case["case_id"], case["case_number"])
        for doc in docs:
            path = download_document(doc, output_dir)
            if path:
                manifest.append({
                    **doc,
                    "local_path": str(path),
                    "ready_for_ingest": True,
                })

    # Write manifest
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    log.info(f"\nDone. {len(manifest)} documents downloaded to {output_dir}")
    log.info(f"Manifest: {manifest_path}")
    log.info("\nNext steps:")
    log.info("  1. Review the downloaded PDFs")
    log.info("  2. Upload via Admin → Goblin Ingest in the Reno Record")
    log.info("  3. The Goblin pipeline will extract violation tags automatically")


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Washoe County court docket scraper for public records research"
    )
    parser.add_argument("--judge", help="Judge name to search for (e.g. 'Breslow')")
    parser.add_argument("--case-number", help="Specific case number (e.g. 'CR23-0657')")
    parser.add_argument("--output", default="./output/washoe_dockets", help="Output directory")
    parser.add_argument("--year-start", type=int, default=2020, help="Start year for search")
    parser.add_argument("--year-end", type=int, default=2026, help="End year for search")
    parser.add_argument("--max-cases", type=int, default=200, help="Max cases to process")
    args = parser.parse_args()

    run_scrape(
        output_dir=Path(args.output),
        judge=args.judge,
        case_number=args.case_number,
        year_start=args.year_start,
        year_end=args.year_end,
        max_cases=args.max_cases,
    )
