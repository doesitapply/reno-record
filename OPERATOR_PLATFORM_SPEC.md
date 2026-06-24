# Operator Platform — Content Spec (for the agent)

This document tells an AI agent (or a human) exactly what content is needed to fully populate
the **Artificially Educated** operator platform built into The Reno Record. Everything below is
editable through the admin UI — **no code changes required**.

## Where to edit

Admin UI: `/admin/manage` → three new tabs:
- **Operator Profile** — bio, thesis, tagline, links
- **Build Log** — capabilities / things engineered
- **Projects** — the project catalog

Public pages it drives:
- `/operator` — bio, thesis, build log, flagship callout
- `/projects` — catalog grid (flagship pinned)
- `/projects/:slug` — individual project detail

All three are also reachable from the top nav under **"The Operator"** and from the footer.

---

## 1. What is already seeded (verify / refine)

**Profile** (one row, edit in place):
- Brand: `Artificially Educated`
- Name: `Cameron Church`
- Role: `Systems Architect · Strategic Operator`
- Tagline: `I build with gravity. Structural. Undeniable. It brings broken systems down.`
- Thesis + bio: placeholder text — **needs the real origin story** (see §2).

**Projects** (5 seeded):
| Name | Slug | Status | Flagship | Needs |
|---|---|---|---|---|
| The Reno Record | `the-reno-record` | live | YES | nothing — it's this site |
| Artificially Educated | `artificially-educated` | live | no | real description, live URL |
| Due Process AI | `due-process-ai` | in_development | no | description, link, screenshot |
| Gaslight Goblin | `gaslight-goblin` | in_development | no | description, link, screenshot |
| FAULTLINE | `faultline` | concept | no | description |

**Build Log**: 6 placeholder capability entries — refine titles/outcomes to match reality.

---

## 2. What the agent needs to collect / write

For **each** item below, gather the info and enter it via the admin UI.

### A. Operator bio (the origin story) — REQUIRED
Write 3–6 short paragraphs in Markdown answering:
1. Who is Cameron Church and what does he actually do (legal-systems auditing + AI automation).
2. How he got here — the path that led to building these systems (keep it real, not resume fluff).
3. The thesis: why "gravity" — structural leverage that collapses broken systems.
4. The proof: The Reno Record as Exhibit A — a live forensic audit of a sitting court, built solo.

Enter in: **Operator Profile → Bio / origin story (Markdown)**.

### B. Per-project content — REQUIRED for each non-flagship project
For each of: Artificially Educated, Due Process AI, Gaslight Goblin, FAULTLINE — collect:
- **One-line tagline** (what it does in a sentence)
- **Description** (Markdown, 2–4 paragraphs: problem, what it does, how it's built, status)
- **Status**: live / in_development / beta / concept / archived
- **Tech stack** (comma-separated)
- **Live URL** (if deployed) and/or **Repo URL** (if public)
- **Internal path** (only if the project lives on this site, e.g. `/the-church-record`)
- **Thumbnail** (see §3 for images)

### C. Build log entries — REFINE
Rewrite the 6 seeded entries (or add new) so each is a real capability with a concrete **outcome**.
Format per entry: Title, Category, Summary (1–2 sentences), Outcome (the measurable result).
Categories available: AI Automation, AI Agents, Systems Architecture, Legal Tech, Data Pipeline,
Web Platform, Infrastructure, Other.

---

## 3. Images / screenshots (how to add)

Project thumbnails and detail-page screenshots are stored by **storage key**, not uploaded through
the UI directly. To add an image:

1. Get the image file.
2. Upload it to this project's storage (ask the developer/agent to run
   `manus-upload-file --webdev <path>` or use the storage helper). This returns a key like
   `image_ab12cd34.png`.
3. In the admin Projects form, paste that key into **Thumbnail key**.
4. For multiple detail screenshots, those are stored in the `screenshots` JSON field
   (`[{ "key": "...", "caption": "..." }]`) — currently set via DB/API, not the basic form.
   If you need a screenshots editor in the UI, request it.

---

## 4. External data the agent can pull (optional, improves quality)

- **GitHub**: the bot token only sees `doesitapply/reno-record`. To list Cameron's other repos,
  either connect "My Browser" (drives his logged-in GitHub) or provide repo URLs directly. Use the
  repo description + README to write each project's description and tech stack.
- **Google AI Studio builds**: behind Google login — requires My Browser or a manual export. Pull
  app names, one-liners, and screenshots to seed additional catalog entries.

---

## 5. Acceptance checklist

- [ ] Operator bio reads as a real origin story, not placeholder.
- [ ] Tagline + thesis finalized.
- [ ] Profile links point to real destinations (GitHub, etc.).
- [ ] Every project has a tagline + description + correct status.
- [ ] Projects with public URLs have Live/Repo links set.
- [ ] At least the flagship + 2 projects have thumbnails.
- [ ] Build log entries each have a concrete outcome.
- [ ] `/operator` and `/projects` reviewed on desktop + mobile.

---

## 6. Data model reference (for engineers)

Tables: `operator_profile` (singleton, id=1), `build_log_entries`, `projects`.
tRPC namespace: `operator.*` (public reads: `profile`, `buildLog`, `projects`, `projectBySlug`;
admin writes: `updateProfile`, `create/update/deleteBuildLog`, `create/update/deleteProject`).
Admin writes are gated by `adminProcedure` (role = `admin`). Tests: `server/operator.test.ts`.
