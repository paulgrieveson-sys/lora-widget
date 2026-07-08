# CLAUDE.md — lora-widget

Documentation and status board for this project. **Read this FIRST. Update the status board LAST in every session.**

---

## STATUS BOARD

- **What this is:** Lora — an AI estimating chat widget for JDCM (commercial shopfitting). Single-page widget + two serverless API functions. Deployed to Vercel, aliased to `lora.jdcmanagement.co.uk`.
- **Deploy:** `cd /c/Users/p_gri/lora-widget && npx vercel --prod --yes` (must run from repo root, PowerShell — the tool does not auto-cd). Production alias: `lora-widget.vercel.app`.
- **Vercel project:** `pauls-projects-0035b3fe/lora-widget` (`prj_0xFEWXQCILGhv1rqhuvGqMeuLDIQ`).
- **Known issue (unfixed):** duplicate GHL contact creation — see "GHL contact creation" below. `createOrUpdateGHLContact` is called fire-and-forget and guards only on an in-memory `ghlContactId`, so rapid or concurrent syncs can each POST a new contact.
- **Last touched (2026-07-08):** merge filter at line 1055 now drops `false`/`0`/`''` for normal fields but keeps `false` for `isRetail`/`outOfHours`/`callBooked` (`allowedEmpty`) — fixes spurious falsy values (e.g. `floorArea: 0`) counting as answered and skipping quick-reply steps. Committed `c17a104`, deployed `dpl_3Jz1a3x…`. Earlier same day: opening-message wording locked; `getQuickReplies` compacted + `isRetail` buttons simplified to Yes/No.

---

## File map

| File | Purpose |
|---|---|
| `public/index.html` | The entire widget — HTML, CSS, and all client-side JS in one file (1157 lines). Config constants, system prompt, session storage, validation, GHL sync, chat loop, quick-reply logic. |
| `api/chat.js` | Serverless proxy to the Anthropic Messages API. Adds CORS, injects `ANTHROPIC_API_KEY` server-side, forwards `req.body` verbatim to `https://api.anthropic.com/v1/messages`. Keeps the API key off the client. |
| `api/gbp-post.js` | **Unrelated to Lora.** GBP caption generator. Receives a GHL webhook note (`req.body.note.body`), strips a `GBP:` prefix, generates a Google Business Profile post via Claude Haiku, then SMSes it to Paul via the GHL conversations API. |
| `vercel.json` | `{ version: 2, outputDirectory: "public" }`. |
| `.vercel/project.json` | Vercel project + org IDs. |
| `.gitignore` | Ignores `.vercel`. |

### Environment variables (Vercel)
- `ANTHROPIC_API_KEY` — used by both `api/chat.js` and `api/gbp-post.js`.
- `GHL_API_KEY`, `GHL_LOCATION_ID`, `PAUL_CONTACT_ID` — used by `api/gbp-post.js` only.
- Note: the **Lora widget's** GHL key + location are **hardcoded in `public/index.html`** (client-side), NOT env vars — see Security notes.

---

## How Lora works (`public/index.html`)

### Config (lines 344-349)
- `GHL_API_KEY` = `pit-a1e...` (hardcoded, client-side)
- `GHL_LOCATION` = `BdjHSjtmKmRyeQKIIDqe`
- `GHL_PIPELINE_NAME` = `Lead to Job Pipeline`
- `ANTHROPIC_MODEL` = `claude-haiku-4-5-20251001`
- `ANTHROPIC_PROXY` = `/api/chat`

### System prompt (lines 351-614)
Defines Lora as a JDCM estimating consultant. Contains: company info, pricing data, region multipliers, the fixed **qualification flow**, pre-estimate contact-capture rules, estimate presentation format, booking flow (Mon-Fri 10am-2pm), material recognition, and the `<DATA>` JSON extraction contract appended to every reply.

### State (lines 664-668)
Module-level globals: `conversationHistory`, `collectedData`, `ghlContactId`, `totalQuestions = 17`, `questionsAnswered`.

### Session persistence (lines 618-648)
`localStorage` key `lora_jdcm_session_v4`, 24h expiry. Saves history, collected data, `ghlContactId`, progress.

### Chat loop
- `init()` (1088-1141) — fires `lora_opened`; restores a saved session (with a "Welcome back" resume) or sends a seed `"Hello"` to get the opening message; renders space-type quick replies.
- `sendMessage()` (1005-1085) — `"start fresh"` resets everything; otherwise pushes the user turn, calls `/api/chat`, then processes the reply (below).
- `api/chat.js` proxies the request to Anthropic with the server-side key.

### Reply processing (1052-1074) — the core pipeline
```
extractData(fullText)                          // parse <DATA>{...}</DATA>
→ merge into collectedData (preserving false)  // 1055
→ countAnswered → updateProgress
→ trackEvent (qualified / converted)
→ if shouldSyncToGHL(collectedData): createOrUpdateGHLContact(...)   // 1063-1064  ⚠ not awaited
→ strip markdown/DATA, render, saveSession
→ getQuickReplies(extracted) → render buttons
```

### Validation (670-692)
- `sanitisePhone` — accepts UK mobile `07…`, landline `0[123]…`, `+447…`, or `7…` (prepends 0); else `undefined`.
- `sanitiseEmail` — basic regex; lowercases/trims.

---

## Conversation flow (prompt order + quick-reply buttons)

Order is enforced by the prompt (494-514); buttons are state-driven by `getQuickReplies` (883-911), which offers buttons for the **next unanswered field**. Stage (`capturing_contact` / `pricing` / `booking` / `complete`) overrides and suppresses buttons.

| Step | Question | Buttons | Field |
|---|---|---|---|
| 0 | Opening → space type | Office · Shop / Retail · Warehouse office · Commercial unit | `spaceType` |
| 0b | "Great — and who am I speaking with?" | *(free text)* | `name` |
| 1 | Site location | Manchester · Bolton · Liverpool · Birmingham · London | `location` |
| 2 | Level of work | Light refresh · Partial strip-out & refit · Full strip-out & refit | `workLevel` |
| 3 | Floor area m² | *(free text)* | `floorArea` |
| 4 | Partitions | Remove only · Add only · Both · No partitions | `partitions` |
| 5 | Ceilings / lighting | Suspended grid · MF plasterboard · Both · No new ceilings | `ceilings` |
| 6 | Door openings / alterations | Yes · No · Not sure yet | `doorOpenings` |
| 7 | Service penetrations | None · 1–5 · 6–15 · 15–30 · 30+ | `penetrations` |
| 8 | Flooring | Vinyl / LVT · Carpet tiles · Ceramic / tile · Keep existing | `flooring` |
| 9 | Decoration | Basic repaint · Full prep & finish · Feature finishes · No decoration | `decoration` |
| 10 | Plumbing | Yes · No · Not sure yet | `plumbing` |
| 11 | Retail / pharmacy | Yes · No | `isRetail` |
| 12 | Full site management | Yes please · No, we have trades · Not sure yet | `siteManagement` |
| 13 | Timeline | Within 30 days · 30–60 days · 60–90 days · 90+ days | `timeline` |
| 14 | Budget range | Under £25k · £25k–£60k · £60k–£120k · £120k+ | `budget` |
| 15 | Decision maker | Yes, I am · No, need sign-off · Joint decision | `decisionMaker` |
| 16 | Anything else | *(free text)* | — |

Then: **`capturing_contact`** (email first, then phone — mandatory, no buttons) → **`pricing`/`complete`** (estimate with TOTAL GUIDE RANGE, no buttons) → **`booking`** (Yes, book a call · Not right now).

---

## GHL contact creation (where + how it's triggered)

**Trigger gate — `shouldSyncToGHL` (998-1003):** returns true if a valid email OR valid phone exists, OR (`name` AND `spaceType`) exist. So sync can fire **early**, before contact details.

**Fire site (1063-1064):**
```javascript
if (shouldSyncToGHL(collectedData)) {
  createOrUpdateGHLContact(collectedData);   // ⚠ NOT awaited — fire-and-forget
}
```

**`createOrUpdateGHLContact` (725-867):** keyed on module-level `ghlContactId`.
- **Create branch** (`!ghlContactId`, 807-831): `POST /contacts/` → stores returned id in `ghlContactId` → posts a transcript note → `getPipelineId()` → `POST /opportunities/` into "Lead to Job Pipeline" (stage `new enquiry`, or `appointment booked` if booked), `monetaryValue` from budget.
- **Update branch** (832-861): `PUT /contacts/{id}` with fresh custom fields; if `callBooked`, searches the contact's opportunity and moves it to `appointment booked`; appends an `[UPDATE]` note.

**Auth:** `ghlRequest` (696-713) → `https://services.leadconnectorhq.com`, `Bearer GHL_API_KEY`, Version `2021-07-28`.

### ⚠ DUPLICATE CONTACT CREATION — root cause
The create branch dedupes ONLY on the in-memory `ghlContactId`, which is set **after** the awaited `POST /contacts/` resolves. Because the call at line 1064 is **not awaited** by `sendMessage`, and `POST /contacts/` does not upsert server-side, the following produce duplicate GHL contacts:
1. Two syncs fire before the first `POST` resolves → both see `ghlContactId === null` → two contacts created.
2. A returning visitor whose `localStorage` restored `ghlContactId` is fine — but a fresh session that syncs on `name + spaceType`, then again once email arrives, is only safe if the first POST resolved and set `ghlContactId` in time.
Fix direction (NOT yet applied): await the sync / add an in-flight lock, or switch the create branch to GHL's upsert endpoint (`POST /contacts/upsert`) keyed on email/phone.

---

## Security notes
- The Lora widget ships a **live GHL private-integration token and location ID in client-side JS** (`public/index.html` 345-346). Anyone viewing source can read/write that GHL sub-account. Documented, not changed.
- `api/chat.js` is an **open proxy** to Anthropic (CORS `*`, no auth/rate limit) — any site can spend the Anthropic key. Documented, not changed.

---

## Related
See user memory: [[jdcm-lora-ghl]] (token/location, widget repo → `lora.jdcmanagement.co.uk`, 2026-07 lead-capture fix), [[construction-media-deploy-ghl]] (Vercel + GHL wrong-sub-account gotcha).
