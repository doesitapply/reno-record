# The Reno Record — Project TODO

Receipts for Due Process. A public-interest accountability archive for Washoe County.

## Foundations
- [x] Initialize full-stack project (web-db-user)
- [x] Define DB schema: stories, documents, timeline_events, actors, public_records_requests, agent_tasks
- [x] Apply migrations
- [x] Editorial design tokens (deep navy, bone, neon amber, muted red) + serif/sans pairing in index.css
- [x] Global site shell: top nav (Home, The Church Record, Timeline, Evidence, Public Records, Actors, Election, Patterns, Submit, Admin) + footer

## Public site
- [x] Home page (hero, what this is, why it matters, core pattern, featured timeline preview, submit CTA, evidence preview, election preview, footer)
- [x] The Church Record (main story page) with sectioned narrative + key actors
- [x] Interactive Timeline page with category filters
- [x] Evidence Archive: search, filter by type, inline PDF viewer
- [x] Submit Your Story page (intake form + multi-file upload + redaction warnings + consent checkboxes)
- [x] Public Records Tracker (table + status badges)
- [x] Actor pages (profile cards + index)
- [x] Election & Accountability page (neutral, public-record only)
- [x] Pattern Dashboard (aggregate metrics, anonymized)
- [x] Privacy / Terms page + Redaction warnings

## Admin
- [x] Admin login (Manus OAuth) + admin-only routes
- [x] Moderation queue (stories, documents) — approve / reject / request changes
- [x] Admin: create/edit timeline events, actors, public records requests
- [x] Admin: upload evidence documents and link to stories

## Docket Goblin AI
- [x] Server: invokeLLM-based tag + summary draft for documents/stories
- [x] UI: "Run Docket Goblin" button in admin moderation; output stored as advisory only
- [x] Strict guard: never auto-publishes; admin approval required (covered by tests)

## Quality
- [x] Seed: Church Record case, key actors, sample timeline events, sample public records requests
- [x] Vitest specs for moderation flow + AI advisory guard (8/8 passing)
- [x] Responsive layout
- [x] SEO meta tags on public pages
- [ ] Save checkpoint
