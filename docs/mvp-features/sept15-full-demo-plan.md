# Sept 15 full demo: integration plan

Status: drafted 2026-09-20, **not yet reviewed**. Baseline: `mvp` (v244 launch lane, all merged 2026-09-07).

## 0. Sources and baselines

| role | file | date | internal pass |
|---|---|---|---|
| new product | `~/Documents/Phenyx/Sept 15/PHENYX_full_demo.html` (28,971 lines) | 2026-09-18 | **ph550** |
| new landing | `~/Documents/Phenyx/Sept 15/PHENYX_main_landing (1).html` (19,271 lines) | 2026-09-18 | ph550, landing-only export |
| palette reference | `~/Documents/Phenyx/Sept 15/PHENYX_stellar_palette.png` | 2026-09-18 | — |
| previous prototype (what `mvp` was built from) | `~/Downloads/PHENYX_v244_launch.html` (16,862 lines) | 2026-09-06 | v244 |

Working copies in the session scratchpad as `new_demo.html`, `new_landing.html`, `v244.html`.

### How to read these files

Three traps, all confirmed:

1. **The header comment lies.** Both files still say `prototype v110`. The real pass is the last `<style id="…">` — `ph550-settings-accent`. The jump is **v244 → ph550: ~300 internal passes.** This is not a polish delta; it is a product replacement.
2. **The static markup in `<body>` is largely dead.** 28 stacked `<script>` passes (v400 → ph535) progressively rebuild the product shell at runtime. `#dt-daily` still sits in the body markup and is never shown; the v238 mobile bottom nav still lists a `daily` tab that no longer exists. **The last owner wins** — for the product shell that is `v461-product-system-refinement-script` (line 24978), wrapped by six later passes.
3. **Read the rendered DOM, not the file.** Everything in §1–§2 below was captured by driving the prototype headlessly (Playwright via the `verdict-cli` module) and dumping `innerText` per tab, not by reading markup.

### The two new files

`PHENYX_main_landing (1).html` contains only `#s0` — it is the marketing-site export. Its landing is **byte-equivalent to the demo's landing except for the constellation example dataset**: the landing file uses a generic curiosity/focus/influence persona (YouTube, Spotify, Netflix); the demo uses Mara's taste/light/place persona (Spotify, Pinterest, Instagram). Everything else — copy, structure, CSS — is identical. Its entry-modal buttons call `chooseEntryPath()`, which calls `go('signin')` / `go(1)` against screens that do not exist in that file, so the marketing export's entry targets have to be wired to real routes by us (same as the Sep 1 drop).

---

## 1. What changed — landing (`#s0`)

The landing was rewritten end to end. The v244 voice (abstract, literary: "the moment", "the pattern", "the shape") is replaced by concrete product language ("constellation", "discover", "polaris", "you"). The product's own nouns are now on the landing page.

| id | area | v244 (live on `mvp`) | Sept 15 |
|---|---|---|---|
| L1 | nav / eyebrow | "first look" | "your life" |
| L2 | hero headline | "your life, taking form" | "your life, taking form." |
| L3 | hero desc | one line: "see who you've been, across everything you already use." | two spans: "see who you've been. understand who you are." / "follow who you're becoming." |
| L4 | hero | scroll cue label "scroll" | removed |
| L5 | nav dot | inline SVG `<img>` | `<span class="landing-nav-dot-img">` |
| L6 | about headline | "you were never in pieces, only in places" | "parts of you are out there." |
| L7 | about body | 3 paragraphs, "each one keeps a version of you that is true…" | 2 paragraphs, enumerated: "in the music you return to, the work you make, the things you save, the people you meet, the questions you ask, and the way you spend your time." |
| L8 | about thesis | "here they are read together." | "PHENYX shows you what those parts make up together." |
| L9 | how-it-works label | "how it works" | "how phenyx works" |
| L10 | how-it-works headline | "the same life, at three magnifications" | "see the whole of who you are." |
| L11 | how-it-works lede | "you are the thing being looked at…" | "connect the places you choose. PHENYX uses the data already there to show how the different parts of your life connect across time." |
| L12 | **cards: 3 → 4** | close up/the moment · further back/the pattern · the whole field/the shape | who you've been/**constellation** · what you missed/**discover** · clarity + direction/**polaris** · who you are now/**you** |
| L13 | signals list | what keeps returning · what overlaps · creative rhythms · turning points · how you decide · what stays with you | what shaped you · what keeps returning · what changed · what overlaps · what matters now · what may be next |
| L14 | second band | "what the evidence is" → a moment. / a return. / a shape. | **reverted to** "what stays yours" → your data. / your privacy. / your truth. |
| L15 | constellation headline | "see how the parts of your life relate" | "see how your life takes shape." |
| L16 | constellation copy | "a constellation is not the stars…" + "seven points run from where you began…" + "new things appear, old ones return…" | "each point captures a different stage of your life…" + "open a stage to see the moments that made it up, how different parts of your life overlapped, when they happened, and the original sources behind them." |
| L17 | constellation caption | "the points stay the same. what fills them is yours." / example note at the bottom | "start with the whole. follow what pulls you closer." / example note moved **above** the example ("an example of what can surface within each stage") |
| L18 | constellation toggle | "the same seven, seen by time" | "see what shapes each point" |
| L19 | polaris headline | "follow one thread all the way through" | "clarify what matters. decide what comes next." |
| L20 | polaris example | eyebrow "convergence"; Q "am i moving as fast as i think i am?"; 3 sources; "3 years / 2 sources" | eyebrow "**CLARIFY**"; Q "why do i keep coming back to film if i built my career in product?"; sources "pinterest · github · linkedin · claude"; "7 years" |
| L21 | CTA | "look again" / "there is more of you here than you can currently see." | "see who you are becoming." / "your data already holds the context." |
| L22 | footer | dot + wordmark loose | `.footer-brand-row` wrapping stellar dot + `PHENYX` |
| L23 | entry modal | `closeEntryModal();go('signin')` / `go(1)` | `chooseEntryPath('returning')` / `chooseEntryPath('new')`; `role="dialog"`, `aria-modal`, `aria-labelledby` |

Unchanged: mission section structure, hero starfield, nav scroll-spy, nav underline, modal overlay treatment.

**Cost note:** the app centralises landing copy in `frontend/lib/landing-copy.ts` (190 lines, 11 exports). L1–L23 are mostly a copy-table rewrite plus one new card in `how-it-works-section.tsx` and one span split in `hero-section.tsx`. This lane is cheap and independent of everything else.

---

## 2. What changed — product

### 2.1 Information architecture — the headline change

| | v244 (live) | Sept 15 |
|---|---|---|
| tabs | **daily** · polaris · constellation · you | **constellation** · polaris · **discover** · you |
| default tab | daily | **constellation** |
| settings | gear in the account row | dedicated item pinned at the sidebar bottom |
| sidebar | orb + PHENYX + plan pill; text links; account row (first name + gear) | orb + PHENYX + **plan word button** (opens plan modal); **icon + label** nav; bottom row = `settings` + **collapse toggle** |

**Daily is gone.** No daily tab, no daily route, no mantra, no daily observation cards, no "observation of the day". The prototype still carries dead `#dt-daily` markup and a v433 "add this to Daily" chat path — both are internal drift, not a spec.

### 2.2 Constellation — now the home surface, and a different object

v244's constellation was a physics-revealed canvas of 7 pillar points with a side panel of pillar text, areas and a synthesis line.

Sept 15 is a **fixed-layout stage field**: 7 nodes at hard-coded percentage positions joined by drawn lines, hover/focus illuminating adjacent lines, and a "new signal" badge on the stage that has one.

- **Whole view** (no stage selected): a "a new connection" signal card (`kicker / title / text / see what changed →`), then a large headline and context paragraph. For Mara: *"your worlds are meeting." … "the parts of you that once lived separately are beginning to meet."*
- **Stage view**: back arrow, stage name + **`period` · `place`** (e.g. `2022–24 · Bay Area`), a `story` paragraph, an **area filter row** (`all` + the stage's areas — making / language / rhythm / network), and a **timeline of dated moments**.
- **Moment** (expandable): `date` · `area` · `title`, then three labelled blocks — **what happened / why it matters / what connects from here** — a source chip row, `see source trail`, a reaction row (`this feels true` / `not quite`), `follow this thread` (+ an `i` explainer popover), and `ask polaris about this`.
- **Source trail modal**: per source record — `date · platform`, record title, a detail line (`saved at 5:42pm · practical amber lamp, left window, low floor line`), an engagement line (`340 saves · 61 shares`), and **`open exact record`** (full-only). Then a `synthesis` block: **"why these were connected"** + a match-type chip (`cross-platform match`) + `explore this in polaris`.

Data shape in the prototype:

```js
{ id:'origin', name:'origin', period:'2015–18', place:'Los Angeles',
  story:'…', areas:['taste','place','visual language','early making'],
  moments:[ { date:'sep 2015', area:'taste', title:'…',
              happened:'…', why:'…', next:'…', sources:['Spotify'], signal:true } ] }
```

### 2.3 Discover — a new tab

A single-card deck with a `1 / 7` pager, prev/next arrows and dot indicators. Each card: a **type kicker**, a headline line, `what surfaced`, a gap chip (`returned after 8 years`), `why it surfaced now`, a `sources` chip row, and three actions — `explore with polaris`, `see source trail`, `show me another`.

Seven discovery types in the data (`resurfaced`, `connection`, `unfinished thread`, `rhythm`, `identity`, `response`, `possibility`); onboarding advertises four (`resurfaced`, `connection`, `pattern`, `possibility`).

```js
{ type:'resurfaced', line:'…', detail:'…', sources:['Pinterest','Instagram'], stage:'origin' }
```

Free gets a limited number of `show me another` replaces (`state.freeReplaces`), then `v461BuyReplaces`. The plan modal states free gets **"one new discovery every 24 hours"**, full gets **"unlimited new discoveries"**.

### 2.4 Polaris — modes and credits

v244: a hero star, a tagline, one textarea, an allowance badge reading "N of 40 questions left this week", and an explore strip (questions from your constellation / starting points / your chats).

Sept 15:

- Hero: star, **"what's been on your mind?"**, textarea placeholder **"what have you been wondering about?"**.
- **Three modes** under the input, as a 3-column rule-separated row: **clarify** ("untangle a question") · **understand** ("explore a recurring pattern") · **decide** ("choose a direction and shape next steps"). Choosing a mode reveals mode-specific starter paths (e.g. decide → "help me plan a small creative project around my working week").
- **`past conversations`** collapsible + a **`search chats`** input. History entries carry `mode · title · topic`.
- Chat view: back arrow, `polaris`, a focus chip (`your connected history`), and staged streamed answers. Moments and discoveries open chat pre-seeded with their context (`v461MomentPolaris`, `v461DiscoverPolaris`).
- **The weekly question allowance is replaced by a credit balance.** Full grants **250 Polaris credits per month**; credits can be bought (`add credits · from $4.99`, with quantity selection via `v539SetCreditQuantity`).
- **Phone integration** (settings): send chosen check-ins and active paths by message, "only when i choose".

### 2.5 You — an identity report

v244: header, connected platforms, your color, a constellation stats block, "what has stayed with you", tier badge.

Sept 15 is a full report:

- **Header**: display name, stellar dot + **colour name** ("solar amber"), `last updated · 3 days ago`, and three stats — `8 connected places` / `11 years represented` / `Mar 2026 with PHENYX since`.
- **Two-column tension block**: `what is becoming clearer` and `what still needs shape`, each with a body line and a link-out (`the distance between them keeps shrinking →`).
- **`what matters to you`** — 4 value cards (title + paragraph).
- **`what you return to`** — 4 behaviour cards.
- **`chapters of your life`** — eras: `2015–20 · Los Angeles / private foundations`, `2020–24 · Bay Area / finding your footing`, `2024–now / integration`.
- **`what you return to in polaris`** — topic clusters with counts (`creative direction — 11 related chats`).

### 2.6 Settings — rebuilt IA plus real account machinery

Header `SETTINGS` / "your account, connections, data, and membership." + `log out`. Six groups:

| group | rows |
|---|---|
| ACCOUNT MANAGEMENT | profile & sign-in · my subscription plan · deactivate or delete |
| CONNECTIONS & DATA | my connections · export my data · **rebuild my constellation** |
| POLARIS | **phone integration** · **usage & credits** |
| HELP | share feedback · contact us |
| LEGAL | privacy policy · terms of use |

Modals confirmed by driving them:

- **profile & sign-in** — name, email, **phone**, passphrase, save changes.
- **plan & billing** — three cards side by side: `free $0/month`, `full · monthly $12.99/month`, `full · annual $132.50/year` ("$11.04 / month equivalent · billed annually", "15% off compared with monthly billing"). Feature lists per plan. Current plan marked, others actionable.
- **polaris usage** — `42 conversations this month`, `14 ongoing threads`, a mode breakdown (clarify 29% / understand 31% / decide 24% / planning paths 16%), `WHAT YOU RETURN TO` topics, a `CREDITS USED BY MONTH` bar chart (apr–sep), `86 credits available`, `add credits · from $4.99`.
- **my connections** — 8 platforms with status, `manage connections with onairos` (handoff/return).
- **phone integration** — phone number, message toggles, "no unsolicited reminders or background nudges".
- **rebuild my constellation** — "rebuild from the connections you choose… rebuilding changes the synthesized view; it does not change the original data in your connected services", with `export first`.

### 2.7 Plan and gating — a reversal

v244 gated depth hard on free: the whole evidence trace replaced by an upgrade button, underneath reading locked, source account names hidden, 3 Polaris questions a week.

Sept 15 gates almost nothing structural. Confirmed from the final passes:

- free **sees the source trail**; only **`open exact record`** is full-only (and only on the first two records)
- free gets **one new discovery per 24h**; extra replaces are purchasable
- Polaris runs on **credits**, granted monthly with full
- constellation, stages, moments, the You report and the source trail are **open on free**

Pricing also moves: **annual goes $99 → $132.50** (framed as 15% off monthly), and the "40 questions a week" meter is gone.

### 2.8 Auth — phone or email

Every identifier field becomes **"phone number or email"**:

- signup: `<input type="text" id="suEmail" placeholder="phone number or email" autocomplete="username" inputmode="email">`, hint "we'll send your sign-in code here.", plus an inline `ph540-contact-error` region
- OTP: `autocomplete="one-time-code"`, back returns to sign-in or signup depending on `_otpFlowContext`
- sign in: "sign in with a code instead" → `openContactSignin()`
- reset: "enter the phone number or email tied to your account."
- settings profile: name, email, **phone**, passphrase

**The backend has no phone or SMS anywhere.** `grep -ri "phone|sms|twilio" backend/src` returns nothing but a false positive; `signup_drafts.email` is `text not null`; `OtpService.sendCode({ email, purpose })` is email-only. This is new capability, not a copy change.

### 2.9 Stellar palette — 14 → 24

| | v244 (`frontend/lib/stellar.ts`) | Sept 15 (`<script id="ph550-stellar-palette">`) |
|---|---|---|
| size | 14 | **24** |
| structure | flat red→blue ramp | **6 families × 4**: rose, violet, verdant, tide, gold, ember |
| names | literal ("deep red", "cornflower blue" ×2 — a duplicate) | evocative + unique ("rose veil", "nova rose", "iris halo", "solar amber") |
| shape | `string[]` + `Record<hex,name>` | `[{ id, name, hex, family }]`, frozen |
| welcome copy | "your color is {name}." | **"your stellar color is `solar amber`."** |

Assignment stays deterministic and server-side. `STELLAR` is currently required to stay byte-identical across `frontend/lib/stellar.ts`, `backend/src/common/stellar.util.ts` and the `stellar_color_for` SQL backfill — so this is a three-way coordinated change.

### 2.10 Onboarding — one track, not two

v244 ran a fork with **manifesto** (4A/5A) and **gentle** (4B/5B) variants. Sept 15 collapses to a single structured track (`v525-structured-onboarding`): `go(4)` now lands on `s4B`, `go(5)` on `s5B`. The manifesto screens still exist in markup but are unreachable.

| screen | Sept 15 |
|---|---|
| s1 create account | "let's start with some basics." · your name ("what you'd like to be called") · phone number or email · your passphrase |
| s2 OTP | "check your email." + masked recipient · resend · continue · back |
| s3 welcome | orb, "welcome, mara.", **"your stellar color is solar amber."**, `enter` |
| s3b fork | "BEFORE YOU BEGIN" / **"already know how PHENYX works?"** / "take a quick look around, or go straight to connecting…" → `show me around` · `i know PHENYX · connect my accounts` |
| s4B constellation | "see how the moments, places, and interests in your life connect." → **stages** (the larger arc) · **moments** (what happened) · **sources** (where it came from) |
| s4C **discover** | "something you once loved. a connection you hadn't noticed. see what finds its way back." → resurfaced · connection · pattern · possibility |
| s5B polaris | "bring a question. polaris helps you explore it with the context of your life." + example Q&A + `clarify · understand · decide` |
| s6 onairos | "connect the places that hold pieces of your life. you choose what to bring here." → you choose what connects · you can see where each connection comes from · **raw signals are not kept** |

The seven-chapter explainer (origin → transcendence with one-line glosses) is **gone** from onboarding; the constellation is now explained as stages/moments/sources instead.

---

## 3. Gap against what is built

| surface | built on `mvp` | needed |
|---|---|---|
| landing | `lib/landing-copy.ts` + 8 section components | copy rewrite, 4th card, band revert, example swap |
| auth | email-only OTP, passphrase, drafts | phone-or-email identifier end to end, SMS delivery |
| onboarding | two-track fork, 7-chapter explainer, `onboarding_step` enum incl. `constellation_intro` | single track, new 4B/4C/5B content, new enum values |
| daily | `/dashboard/daily`, `select-daily.ts`, `daily-focus`, `daily-header`, `still-true-today`, mantra | **delete** |
| constellation | canvas reveal, pillar panel, areas, synthesis line | stage field, period/place/story, dated moments, 3-part narrative, source trail, reactions, follow |
| discover | — | **entire tab** |
| polaris | single input, weekly question allowance (3/40) | modes, starter paths, history + search, **credits** |
| you | platforms, colour, stats, "what has stayed with you" | tension block, values, behaviours, chapters, polaris topics |
| settings | modal host + rows | 6-group IA, plan compare, usage & credits, phone integration, rebuild |
| billing | `V67_PRICING` 12.99 / 99 / 4.99 topup, `polarisWeeklyQuestions {40,3}` | 12.99 / **132.50** / credit packs, **credit ledger** |
| data model | `observations(body, meta_label, source_platforms, locked_for_free)`, `signals`, `source_records`, `areas`, `underneath_readings` | `moments(date, area, happened, why, next)`, stage `period/place/story`, `discoveries(type, line, detail, stage)`, you-report sections |
| stellar | 14 colours, 3 copies in sync | 24 colours in 6 families, named, + backfill policy |

The evidence hierarchy (`source_records → signals → areas → observations`) already built in PHE-51 is the right substrate for moments and source trails — that part survives. What does not survive is the *shape* of an observation: one prose body plus a meta label, versus a dated, area-tagged, three-part narrative.

---

## 4. Decisions needed before tickets

These are not implementation details; each one changes what gets built.

1. **Is Daily dead?** The prototype says yes. That deletes a route, a generation surface, `select-daily.ts`, three components and its analytics events.
2. **Credits replace the weekly question allowance?** `token-budget.service.ts` is currently the single authority for 3/40 questions a week. Credits are a different primitive (monthly grant, purchasable, consumed per conversation not per question) and need a ledger.
3. **Annual price $99 → $132.50?** This changes Stripe products, not just copy.
4. **Free gating reversal confirmed?** v244 shipped evidence fully locked on free after an explicit decision. Sept 15 opens it and gates only `open exact record`, discovery replaces, and credits.
5. **Phone auth in scope now, or deferred?** Full scope = SMS provider, identifier normalisation, dedupe across identifier types, reset by phone, and a settings phone field. A deferred version keeps email-only auth and adds phone only in settings for Polaris messaging.
6. **Stellar palette: migrate existing accounts or grandfather them?** The colour is documented as permanent and immutable (there is a DB trigger enforcing it). Moving to a 24-colour palette either breaks that promise or leaves early users on colours that no longer have names.
7. **Which constellation example is canonical on the landing** — the demo's Mara dataset or the landing file's curiosity/focus/influence one?
8. **Does the landing become the signup front door on `main`?** `main` is currently the waitlist deploy (Vercel). `chooseEntryPath` routes straight to sign-in / account creation.

---

## 5. Proposed lanes

Ordered for parallelism. Lane A is independent and can ship immediately; C blocks B; D blocks E/F/G.

### Lane A — landing (independent, cheap)
- **A1** copy table rewrite in `lib/landing-copy.ts` (L1–L11, L15–L21)
- **A2** fourth how-it-works card ("you") + card content swap to product nouns
- **A3** signals list rewrite (L13)
- **A4** revert second band to "what stays yours" / your data · your privacy · your truth (L14)
- **A5** constellation example dataset swap + example-note reposition (decision 7)
- **A6** polaris preview rewrite — CLARIFY eyebrow, new Q/A, 4-source row, "7 years"
- **A7** hero two-span desc, scroll cue removal, footer brand row, nav dot markup
- **A8** entry modal → `/signin` / `/join`, dialog a11y attributes (decision 8)

### Lane B — auth and onboarding
- **B1** phone-or-email identifier: frontend fields + validation, `signup_drafts` identifier column, `OtpService` dispatch, reset flow, dedupe (decision 5)
- **B2** SMS delivery provider + rate limiting
- **B3** onboarding single track: retire 4A/5A, new s4B / s4C / s5B / s6 content, `onboarding_step` enum additions
- **B4** s3b fork copy + "show me around" path
- **B5** welcome screen colour-name copy
- **B6** "sign in with a code instead"

### Lane C — stellar palette (blocks B5, D, G)
- **C1** 24-colour 6-family palette + names, kept byte-identical across `frontend/lib/stellar.ts`, `backend/src/common/stellar.util.ts`, and the SQL palette
- **C2** assignment function over the new palette; backfill or grandfather policy (decision 6)

### Lane D — constellation (the new home)
- **D1** IA: constellation becomes the default tab; sidebar rebuild (icon nav, plan word, settings pinned bottom, collapse)
- **D2** stage field: fixed node layout, drawn lines, hover/focus illumination, new-signal badge, keyboard traversal
- **D3** whole view: signal card + headline + context
- **D4** stage view: period/place/story, area filter row
- **D5** moment card: 3-part narrative, sources, reactions, follow thread, ask polaris
- **D6** source trail modal: per-record detail, engagement line, `open exact record` (full-gated), synthesis block
- **D7** schema + generation: stage `period/place/story/areas`, moment `date/area/title/happened/why/next/sources/signal`

### Lane E — discover (new tab)
- **E1** route, tab, card deck, pager
- **E2** discovery schema + generation (7 types), `stage` linkage
- **E3** free 1-per-24h + replace ledger; full unlimited
- **E4** explore-with-polaris and source-trail handoffs

### Lane F — polaris
- **F1** modes UI + mode starter paths
- **F2** chat: staged streaming, seeded context from moments/discoveries, focus chip
- **F3** past conversations + search
- **F4** **credit ledger** replacing the weekly question meter; monthly grant on full; purchase flow
- **F5** phone integration settings

### Lane G — you
- **G1** header + three stats + colour name
- **G2** becoming-clearer / needs-shape tension block
- **G3** values and behaviours sections
- **G4** chapters of your life
- **G5** polaris topic clusters with counts

### Lane H — settings and billing
- **H1** six-group settings IA against the existing modal host
- **H2** profile & sign-in (incl. phone), deactivate / delete
- **H3** connections (Onairos handoff/return), export, rebuild constellation
- **H4** plan compare modal + annual price + Stripe products (decision 3)
- **H5** usage & credits: mode breakdown, monthly credit chart, balance, purchase
- **H6** **close the v244 follow-up gaps first** — top-ups credit nothing, `POST /stripe/checkout` and `/stripe/billing-portal` have no auth guard, billing portal 400s for gift/yearly, Polaris debit is not atomic. Credits make all four worse.

### Lane I — removals
- **I1** delete `/dashboard/daily`, `select-daily.ts`, `daily-focus`, `daily-header`, `still-true-today`, mantra generation, daily analytics events (decision 1)
- **I2** retire free-tier depth gating: `locked_for_free`, evidence lock button, underneath lock, source-row masking (decision 4)
- **I3** mobile bottom nav rebuild for the four new tabs

---

## 6. Known hazards

- **Do not port the prototype's own drift.** Dead `#dt-daily` markup, the v238 mobile bottom nav still listing `daily`, the v433 "add this to Daily" chat path, and unreachable 4A/5A manifesto screens are all leftovers from earlier passes, not intent.
- **Verify in a browser, not in the file.** With 28 stacked script passes and late `display:none!important` rules, reading markup gives the wrong answer. Drive it headlessly and dump the rendered DOM.
- **`setPlan()` from the prototype's dev bar no longer drives plan state** — the final passes read `state.plan`, set through `v461OpenPlan` / `v538SelectPlan`. Toggling the old bar appears to do nothing; that is the harness being stale, not the gating being absent.
- **Scope.** The v244 lane was 7 tickets in a day. This is a different order of magnitude: two new tabs, one deleted tab, a new billing primitive, a new auth identifier, a new palette, and a reshaped observation model. Expect ~30 tickets, and sequence the decisions in §4 before any of them are written.
- **`git` is currently broken in this checkout** — every invocation fails with "You have not agreed to the Xcode license agreements." Run `sudo xcodebuild -license` before branch or PR work.

---

## 7. Repro

```bash
# headless walk of the new demo (verdict-cli's bundled Playwright)
node -e "
const {chromium}=require('/usr/local/lib/node_modules/verdict-cli/node_modules/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.goto('file:///path/to/PHENYX_full_demo.html');await p.waitForTimeout(2500);
await p.evaluate(()=>startDemo());await p.waitForTimeout(1200);
for(const t of ['constellation','polaris','discover','you','settings']){
  await p.evaluate(t=>setDemoTab(t,null),t);await p.waitForTimeout(800);
  console.log('###',t,'\n',await p.evaluate(t=>document.getElementById('dt-'+t).innerText,t));}
await b.close();})()"
```
