# CLAUDE.md — lora-widget

Documentation and status board for this project. **Read this FIRST. Update the status board LAST in every session.**

---

## STATUS BOARD

- **What this is:** Lora — an AI estimating chat widget for JDCM (commercial shopfitting). Single-page widget + two serverless API functions. Deployed to Vercel, aliased to `lora.jdcmanagement.co.uk`.
- **Deploy:** GitHub auto-deploy is LIVE (reconnected 2026-07-08). Just `git push` to `main` → Vercel auto-builds and deploys to `lora.jdcmanagement.co.uk`. No CLI needed. Fallback (only if the git integration breaks again): `cd /c/Users/p_gri/lora-widget && npx vercel --prod --yes` from repo root in PowerShell. Production alias: `lora-widget.vercel.app`.
  - **Verify git integration health:** a real auto-deploy carries `branchAlias: lora-widget-git-main-…` + `repoPushedAt` and NO `actor`/`gitDirty` in its Vercel meta. CLI deploys have `actor: claude-code…` + `gitDirty:1`. If pushes stop deploying, the Vercel-side git link is severed (CLI `vercel git connect` will wrongly say "already connected" from stale local metadata) — fix by reconnecting in Vercel dashboard → Settings → Git, NOT via CLI.
- **Vercel project:** `pauls-projects-0035b3fe/lora-widget` (`prj_0xFEWXQCILGhv1rqhuvGqMeuLDIQ`).
- **Known issue (STILL unfixed):** duplicate GHL contact creation — see "GHL contact creation" below. `createOrUpdateGHLContact` is fire-and-forget and guards only on in-memory `ghlContactId`, so rapid/concurrent syncs can each POST a new contact. **Confirmed live 2026-07-08:** a fresh test that answered `spaceType`+`name`, then reloaded and "Continue estimate", created a **second** contact (the create branch ran again) — restoring `ghlContactId` from `localStorage` did not prevent it. Fix direction still open: await the sync / add an in-flight lock, or switch create to GHL's `POST /contacts/upsert`.
- **GHL API gotcha (learned 2026-07-08):** the opportunities search endpoint takes **`contact_id`** (snake_case), NOT `contactId` — the camelCase form 422s with `"property contactId should not exist"`. Applies to `GET /opportunities/search?location_id=…&contact_id=…`.
- **CHECKPOINT (2026-07-29, HEAD `be6afd1`) — lead-capture + drop-off fixes, live via auto-deploy.** Triggered by Charlotte (a £50k dance studio, Westhoughton — JDCM's home town) who went through Lora, gave name/location/full-fit-out/mezzanine, then dropped at the partition question and left with NO email/phone. Two coordinated fixes (prompt + minimal JS, save logic untouched):
  1. **Capture email+phone EARLY** — new "CONTACT CAPTURE — EARLY" prompt section: capture once the project is clearly real (space type + location + work level), BEFORE the detailed questions, and ALWAYS the instant a visitor offers plans ("can I upload my plans?" → "pop your email in and I'll send you where to upload"). Old "after Q16" block demoted to a fallback. Was `commit 6266804` (CLI-deployed then pushed).
  2. **Trimmed the flow 16→8 questions + set expectations upfront + graceful "don't know."** Upfront frame after name: *"To give you a realistic guide rather than a wild guess, I'll run through about 8 quick questions — takes two minutes, the more you tell me the tighter the number."* Kept: space type, location, work level, floor area, partitions (rough — no m² demand), ceilings, plumbing, retail/OOH, timeline. **Cut to the consultant call:** door openings, service penetrations, flooring type, decoration, site management, budget, decision-maker, "anything else." Partitions no longer demands m² (that's what stalled Charlotte). New rule: never ask twice / never press a number they can't give → "we'll confirm that on the call." **Synced all three:** prompt flow + `getQuickReplies` buttons + `countAnswered` fields + `totalQuestions` 17→10. Fewer inputs = broader (honest) guide range, firmed on the call.
  - ⚠️ **STILL OPEN:** (a) the 11-notes-per-conversation bug — Lora writes a new `=== LORA AI ESTIMATE ENQUIRY ===` note on every message (one chat looked like 11 visits for Charlotte); (b) the duplicate-contact bug below. Both deliberately untouched (one theme at a time). (c) **TEST THE LIVE FLOW** — behaviour, not just that the text deployed.
- **2026-07-15 (JDCM ops — GHL/leads/pricing, NOT this repo's code):**
  1. **Reviewed Lora's live leads** in JDCM GHL. Two real ones: *Paul, Bolton, bespoke L-shaped counter → Lora quoted £3,200–£5,500* and *Indy, Bolton café refit, 30m², under £25k, confirmed decision maker, 30–60 days*. Both completed the estimate but did NOT book a call (the known "reveals price before locking the booking" gap). Both in automated follow-up.
  2. **Extracted Lora's full pricing** (the Section A supply-&-fit rate tables from the system prompt in `public/index.html`) → saved as a plain markup sheet for Jason: `C:\Users\p_gri\JDCM\lora-price-list-for-jason.txt`. Purpose: Paul suspects rates may be high (SSC-style). **Waiting on Jason's corrections, then update the rate tables in the system prompt + redeploy.**
  3. **SMS follow-up "Lora" fixed** (the timed drip that texts estimate leads who didn't book — a GHL workflow, not this widget). Was not bowing out when leads said "sorted / heard from Jason". Resolved: **"Stop on Response" ON** (any reply halts the drip) **+ a notify-Jason workflow** (trigger = Customer Replied → send Jason the reply via `{{message.body}}`, only populates on that trigger) so a human answers appropriately. Chose human-handles over a bot because the right reply "depends what they say". Smart future version = a Claude SMS handler (Ivy pattern, `api/sms.js` + GHL inbound webhook). Memory: `jdcm-lora-sms-followup`.
- **CHECKPOINT (2026-07-08, latest HEAD `1df30ce`):** Full session — all changes live via git auto-deploy. In order:
  1. **Auto-deploy reconnected & verified.** `git push` to `main` now deploys automatically (was severed; fixed in Vercel dashboard, not CLI — see Deploy note above).
  2. **Merge filter (line ~1055)** drops `false`/`0`/`''` for normal fields but keeps `false` for `isRetail`/`outOfHours`/`callBooked` (`allowedEmpty` list) — stops spurious falsy values (e.g. `floorArea:0`) counting as answered and skipping quick-reply steps.
  3. **Partition capture split** into separate one-at-a-time questions: `partitions` (direction) → `partitionRemovalM2` (if remove/both) → `partitionDetails` (add m²+type, if add/both). `getQuickReplies` (lines ~903-904) suppresses buttons while the relevant follow-up is outstanding; "Remove only" no longer stalls on `partitionDetails`. New DATA field `partitionRemovalM2`.
  4. **Retail question (Q11) reworded** to "retail space (shop/salon/restaurant/food outlet) vs pure commercial (office/warehouse)"; ALL "pharmacy" mentions removed from the system prompt (pricing/rate tables untouched).
  5. **DATA pre-fill guard** added after the DATA tag: only populate a field once the visitor explicitly states it; never assume/carry-forward; empty string otherwise.
  6. **Estimate-driven opportunity value.** New DATA fields `estimateLow`/`estimateHigh`/`estimateMidpoint` (plain numbers, AI-populated at estimate time). `estimateValue(budget)` now returns `collectedData.estimateMidpoint` if set, else the budget-band map (keyed case-insensitively).
  7. **⭐ THE BIG FIX — GHL opportunity `monetaryValue` was always £0.** Root cause: opportunity was created early (at `name`+`spaceType`, before budget/estimate) with value 0, and the update branch's opportunity **search used `contactId` — GHL rejects it with 422 `"property contactId should not exist"`; the correct param is `contact_id` (snake_case)**. So the search always errored, `opp` was never found, and value never updated (this ALSO silently broke the `callBooked` stage-move, same search). Fixed the param + generalised the update branch to refresh `monetaryValue = estimateValue(budget)` on any sync where value>0. **Verified end-to-end on a live lead: opportunity went £0 → £90,000.**
  8. **Opportunity name refresh** (lines ~858-859): update branch now rebuilds the name from current data and PUTs it when location is known and changed, so "…— Location TBC" self-corrects to the real location.
  - Debug `console.log`s used during (7) were stripped before finishing (`af7b307`).
  9. **`lastName` no longer defaults to "Enquiry"** — single-word names produced an empty surname that fell through to a literal `'Enquiry'`; now left blank (`615db91`).
  10. **Site management** question reworded ("we will handle the management, programme, trades coordination and deliveries") and its quick replies simplified to just **Yes / No** (`615db91`, `9a55415`).
  11. **Estimate email built** (customer-facing HTML at `D:\Agency\clients\jdcm\lora-estimate-email.html`): shows guide estimate range + one line per field (project type, location, area, ceiling, partition, flooring, decoration, timeline, budget) — NO personal contact fields. Added **3 new GHL custom fields** (`contact.location`, `contact.flooring`, `contact.estimate_range`) and the widget now writes them (`c3614ef`); `estimate_range` = "£low – £high" from AI `estimateLow`/`estimateHigh`. **Manual GHL steps left to Paul:** paste the HTML into the GHL email template + set subject `{{contact.first_name}} — Guide estimate {{contact.estimate_range}}`.
  - HEAD now `c3614ef`.
- **⚠ GHL SUB-ACCOUNT GOTCHA (critical, learned 2026-07-08):** the connected **GHL MCP (`mcp__claude_ai_ghl__*`) is bound to "Stockport Suspended Ceilings" (`5qR94tMJLezgECg5wpd9`), NOT JDCM.** So NEVER use the GHL MCP for JDCM changes — it hits the wrong CRM. For JDCM, use the widget's hardcoded key (`GHL_API_KEY` in `public/index.html`, location `BdjHSjtmKmRyeQKIIDqe`) via `curl`/`ghlRequest`. Creating custom fields via the browser `javascript_tool` is blocked by the auto-mode classifier (persistent shared-infra change) — do it via `curl` with explicit user approval instead.

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
