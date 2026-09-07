# v244 launch prototype: integration plan

Status: reviewed 2026-09-07, ready to execute. Baseline: `origin/mvp` @ a7afc43.

## 0. Sources and baselines

| role | file | date | internal pass |
|---|---|---|---|
| new prototype | `~/Downloads/PHENYX_v244_launch.html` (16,862 lines) | 2026-09-06 | v244 |
| previous reference (what mvp's landing was ported from) | `~/Downloads/PHENYX landing.html` (14,939 lines) | 2026-09-01 | v235, landing-only export |
| product baseline (what PHE-68..85 were built from) | `~/Documents/Phenyx/v67/phenyx_product_v67.html` | 2026-08-25 | v67 |

Working copies used for diffing sit in the session scratchpad as `old.html`, `new.html`, `v67.html`.

Both the old and new files carry the same stale header comment ("prototype v110: blueprint framing pass"); the real pass number is the last `<style id="vNNN-...">` block. The old file stops at v235; the new file adds v236 through v244.

The old file has **no product or onboarding markup** in its body (only `#s0` landing plus the entry modal), but its `<script>` blocks still contain the full product JS at the v235 state. So:

- landing changes are diffed old vs new (exact),
- product **behavior** changes are diffed old-JS vs new-JS (exact, small: 207 lines removed, 2,130 added, most of it CSS passes),
- product and onboarding **markup** changes are diffed v67 vs new (the only markup baseline that exists), then cross-checked against what the app actually implements.

Known gap outside this plan: product JS drifted between v67 (Aug 25) and v235 (Sep 1) by ~9,900 diff lines that were never audited because the Sep 1 drop was treated as landing-only. Items from that drift that surfaced during this audit are listed in section 1 under "older drift" and folded into the tickets where they are small; the rest is deferred to a separate parity ticket.

## 1. What changed (diff catalog)

Prototype references are `new.html:<line>`.

### 1.1 Landing (`#s0`, new.html 2157-2374)

| id | change | old | new |
|---|---|---|---|
| L1 | about thesis | "so we made one." | "here they are read together." |
| L2 | how-it-works headline | "connect, assemble, reveal" | "the same life, at three magnifications" |
| L2 | how-it-works lede | "three layers, and nothing invented in any of them." | "you are the thing being looked at, and the looking is done with what you already made." |
| L3 | card 1 | layer one / connect / "what you listen to, watch, save, post and build, from only the places you choose." | close up / the moment / "one night you kept working, one song you wore out, one thing you saved and never mentioned to anyone." |
| L3 | card 2 | layer two / assemble / "everything lands on one timeline, so repeats and shifts finally sit next to each other." | further back / the pattern / "every moment lands on one timeline, so the things that keep coming back finally sit close enough to be read together." |
| L3 | card 3 | layer three / reveal / "the shape no single account could show, with the moments and evidence that made it visible." | the whole field / the shape / "seven points, and the line your life has been drawing between them the entire time." |
| L4 | second band label | "what stays yours" | "what the evidence is" |
| L4 | band items | your control. / your privacy. / your meaning. | "a moment." "one thing you made, saved or went back to, with the day it happened still attached to it." / "a return." "the same moment arriving again, years later, in a medium you had not used the first time." / "a shape." "what all of that returning has been building toward, without ever announcing itself." |
| L5 | constellation third paragraph | "it is not a profile you finish. new things appear, old ones return, some fall away, and the shape keeps enough of you to notice when you change." | "new things appear, old ones return, some fall away, and the shape holds enough of you to show when you have changed." |
| L6 | entry modal targets | both buttons went to phenyxai.com | returning -> sign in, first time -> account creation |
| L7 | nav scroll-spy (new.html 8843-8915) | IntersectionObserver picking the best changed entry; s0-cta listed as a link | rAF-throttled midline pick over ORDER [s0-top, s0-about, s0-how, s0-mission, s0-polaris, s0-cta]; only about/how/mission/polaris own a link; `aria-current="true"` on the active link; dropdown links get the same active state |
| L8 | nav underline (v239, new.html ~16690) | underline pinned to bottom of a 44px tap target | `::after` at `bottom:calc(50% - 0.7em - 5px); right:.05em`; hover previews the same rule at opacity .42, no text-decoration; mobile dropdown active link gets `inset 2px 0 0` accent |
| L9 | entry modal overlay (v240) | grey | `rgba(4,5,8,.78)` + `backdrop-filter: blur(6px)` |
| L10 | hero on mobile (v238h) | left aligned | centered, hero-desc max-width 30ch |
| L11 | nav markup | hidden | logo + links + enter, plus "sign in" / "create an account" buttons on non-landing screens (product-only, n/a for the app) |

Unchanged on the landing: hero, about paragraphs, signals list, constellation example data, polaris section, CTA, footer, entry modal copy.

### 1.2 Onboarding and auth (new.html 2379-2578; diffed against v67)

| id | screen | new copy / behavior |
|---|---|---|
| A1 | account creation sub | "just enough to make this space yours. you can change these later." |
| A2 | email field | placeholder "you@email.com"; hint "we send a code here to confirm it is you." |
| A3 | passphrase field | placeholder "a private phrase you will remember"; hint "you will use this with your name when you return." |
| A4 | OTP | error "that one did not match. no rush, have another look."; expired "that code has run out. we can send a fresh one."; row "didn't get it? resend code"; button "continue"; back |
| A5 | welcome (stellar) | button "continue" (was "i'm ready"); orb, greeting and sub centered |
| S1 | sign in | error "we need both of these to know it is you." |
| S2 | reset | unchanged copy vs v67 |
| O1 | fork (3B) | eyebrow "before you begin"; h1 "want to look around before you connect anything?"; sub "you can connect now, or look around first. nothing moves until you choose it."; primary "see how it works"; secondary "connect my accounts" |
| O2 | intro gentle (4B) | eyebrow "your life so far"; h1 "most of it is already written down somewhere."; sub "spotify knows what you listen to. instagram knows what you post. neither of them knows the other, so no one has ever put the pieces together, including you."; principles: "a night you kept" / "the work you stayed up for, and the thing you saved that afternoon without telling anyone why."; "the same night, returning" / "it comes back four years later in something you had not tried before, and you do not remember choosing it twice."; "the shape it made" / "seven chapters, and the line your life has been drawing between them the whole time."; continue -> 4C; back |
| O3 | intro manifesto (4A) | lines: "you have been writing this down for years / without meaning to." ; "a night you stayed up, a song you wore out, / something you saved and never mentioned." ; "it is all still there, kept in places that were / never meant to be read together." ; accent "so the one person who has never read it whole is you."; continue -> 4C |
| O4 | NEW 4C constellation explainer | eyebrow "your constellation"; h1 "seven chapters, from where you began to where you are going."; sub "open any one of them and the moments it was built from are still sitting there underneath."; seven rows: origin "what grounded you", emergence "what began to appear", self-creation "what you chose to make your own", convergence "what started connecting", becoming "what is taking shape", recognition "what became visible", transcendence "what you may be outgrowing"; continue -> polaris intro; back -> intro. No divider lines between rows (v237 A4) |
| O5 | polaris gentle (5B) | h1 "ask from where you are now."; sub "polaris already has the chapters, so you can begin anywhere and it will follow the question back through them and bring the moments that answer it."; example q "why do i keep starting over?", a "you have returned to the same three ideas across nine projects since 2021. the projects changed; those ideas kept finding their way back.", src "claude, pinterest · 2021 – 2026"; back -> 4C |
| O6 | polaris manifesto (5A) | "you should not have to / retell your whole history every time." ; "polaris already knows the chapters, so you can start in the middle." ; "ask about something you keep circling, and it follows the thread back through the years and brings the moments that answer it." ; "those moments come back with the answer, so you can see what it was reading when it said so."; same example; button "continue" |
| O7 | onairos (6) | h1 "connect only the accounts that feel right."; sub "onairos handles the connection itself. you decide which accounts come with you."; bullets "bring in one account at a time, in whatever order you want." / "every observation keeps the moment it came from, so you can always trace it back to the day it happened." / "connect and disconnect whenever you want."; legal "you can read the details in the privacy policy."; button "connect with onairos" |
| O8 | entrance cadence (new.html 3843-3950, v242) | delays derived from element position: OB_LEAD 90ms, OB_STEP 135ms between ordinary elements, OB_READ 620ms between manifesto lines, CTA arrives after 2 x OB_STEP; buttons fade on the same .75s curve as copy; forms (join, OTP, sign in, reset, 4C) rise in with inline styles and a 1.4s safety timer; `prefers-reduced-motion` shows everything at once |
| O9 | onboarding headings (v238b Z2) | `clamp(23px, 2.5vw, 30px)`, max 2 lines (`max-width: 20ch`, `text-wrap: balance`); 22px on mobile |
| O10 | form spacing (v237 A2) | first field sits `clamp(24px, 3.8vh, 40px)` below the sub line on join / sign in / reset |
| F1 | formation (scrC) | node stagger 950ms -> 1400ms; connecting lines drawn as endpoints lock; narrow screens base both scales on width. **No port:** the app's formation (`lib/constellation-reveal.ts`) already draws lines and was deliberately re-timed in PHE-81 |

### 1.3 Product shell (new.html 2580-2660; sidebar CSS 15727-15800)

| id | change |
|---|---|
| P1 | fourth tab renamed `profile` -> `you` (label "you"); settings is a fifth panel opened from a gear, not a tab |
| P2 | sidebar: top block = 18px orb in the user's stellar color (radial gradient) + "PHENYX" (12.5px, letter-spacing .14em) + plan pill ("full" / "free", 10px uppercase, accent border, right aligned), 1px bottom rule; nav links; bottom account row (`margin-top:auto`, 1px top rule) = first name (13.5px, 500) + 32px gear button (aria-label "settings"), gear gets `.on` (accent tint) while the settings panel is open |
| P3 | plan naming: "full" replaces "pro" in every user-facing string ("full ✦" lock marker, "what full opens", "upgrade to full · $12.99/month", plan pill, tier badge) |
| P4 | mobile (<=760px): sidebar hidden; fixed bottom nav (daily, polaris, stars, you, menu) + bottom sheet (daily, polaris, constellation, you, divider, settings); bar only inside the product (`body.in-demo`); active tab mirrored; content clears the bar (new.html 16780-16860 + CSS v238g) |
| P5 | `body #s3` / welcome centering, `.a11y-skip` "skip to content" link |

### 1.4 Daily (new.html 5236-5340, 5728-5740; CSS v241)

| id | change |
|---|---|
| D1 | `DAILY_COUNT = 4` for **both** plans (was 4 full / 3 free); the grey locked observation cards are removed entirely ("withholding whole observations sold 'more of yourself', which is the weakest thing this product has to sell") |
| D2 | at most one observation per pillar per day |
| D3 | the day is a slice of a deck shuffled with a seeded LCG (seed = (floor(dayNum / cycleLen) + 1) * 2654435761 mod 2^31-1; step 16807), cycleLen = ceil(pool / 4), start = (dayNum mod cycleLen) * 4; if one-per-pillar cannot fill four, the day is short rather than padded; a headline observation still leads when the pool is larger than four |
| D4 | only the pro daily-focus observation starts open; index 0 no longer auto-opens |
| D5 | mantra header: label "mantra of the day" above the line (10.5px uppercase, letter-spacing .18em, accent 72%), and a visible sub line "drawn from <pillar> in your constellation" where pillar = PILLARS[(dayNum mod quotes.length) mod 7] lowercased |
| D6 | observation card head: text fills width, pillar banner and chevron hug the right edge; on mobile (<=760px) the banner sits on its own top row with the chevron, text spans full width (v237c/e) |

### 1.5 Depth gating on free (new.html 5639-5654, 5757-5769, 5855-5860; CSS v243)

| id | change |
|---|---|
| E1 | evidence: on free the whole trace is replaced by one button `.ev.ev-locked > .ev-btn`: kind label (`o.sig`), line "where this comes from", marker "full ✦", chevron; click opens the upgrade modal. Full keeps the existing trace |
| E2 | underneath reading: on free replaced by `.und.und-locked > .und-open`: dot, "what sits under this", "full ✦"; click opens the upgrade modal |
| E3 | source row: on free shows only the time span (`when`), never the account names; full unchanged |
| E4 | locked styling: `.ev-locked .ev-btn, .und-locked .und-open { opacity:.72 }` hover 1; `.ev-lock { margin-left:auto; font-size:9px; letter-spacing:.08em; color:var(--s); opacity:.75 }` |
| E5 | timeline entries no longer carry `locked:true` (free sees the full timeline) |

### 1.6 Modals and plan (new.html 7256-7320; CSS v240)

| id | change |
|---|---|
| M1 | upgrade ("pro") modal: title "what full opens"; sub "free shows you what is true. every observation of the day, and all seven points of your constellation. full is how you find out why it is true, what it means, and what to do about it."; bullets "where every observation came from, traced back to the day it happened" / "what sits under it, set against what you say about yourself" / "your seven points read together rather than one at a time" / "polaris, to ask about any of it in your own words" / "a weekly look at what shifted, and a yearly look back"; CTA "continue with full, $12.99/month" (the diff hunk says "upgrade to full · $12.99/month"; a later pass changed it, and the rendered text wins); foot "or $99/year. cancel any time."; the line "anything PHENYX shows you is shown whole. the source context behind an observation stays available on free." is removed |
| M2 | NEW subscription modal (settings > subscription): plan name + price ("$12.99 / month" or "free"), renew line ("renews <date> · or $99/year" / "no billing on free"), "what's included" (full: every daily observation, more polaris room each week, a daily point to stay close to, a weekly look at what shifted, a yearly look across your timeline; free: one daily observation, your seven-point constellation, three polaris questions each week, the evidence behind everything shown), action ("switch to free" / "upgrade to full · $12.99/month"), foot ("cancel any time. you keep full until the period ends." / "or $99/year. cancel any time.") |
| M3 | modal chrome: overlay fixed full-viewport `rgba(4,5,8,.78)` blur 6px, exempt from the reading-column width cap; box `min(440px, 100vw - 40px)`, background `radial-gradient(120% 88% at 50% -18%, rgba(--s-rgb,.10), transparent 66%), linear-gradient(180deg,#0c0f16,#090b10)`, border `1px rgba(--s-rgb,.20)`, radius 16px; primary button accent tinted (`rgba(--s-rgb,.10)` fill, `.38` border, radius 10, weight 500); top-up footnote `rgba(255,253,253,.52)` instead of #888 |
| M4 | modal body may be a function (so the subscription modal renders from live plan state) |

### 1.7 Constellation (new.html 2714-2815, 4797-4818, 6758, 6793-6802, 6888-6958; CSS v237 A5, v237d, v238 Z8)

| id | change |
|---|---|
| C1 | pillar hover no longer prints the pillar question under the point (it heads the panel once open) |
| C2 | cluster label clamping: `halfPill = lw/2 + pad`; `lx` in `[halfPill+4, W-halfPill-4]`; `ly` in `[14, H-6]`; sub-node positions clamped with `SUBNODE_PAD_X=64, TOP=30, BOTTOM=40` |
| C3 | synthesis line above the areas (`.node-source-insight`): full = "<a>, <b> and <c> all sit under <pillar>, and they hold together across N years of your life, on M things you did rather than anything you said about yourself." (needs >=2 named areas; year span from the observations' time/span strings; falls back to ", and they hold together" when no years); free = "these N areas are read together with full ✦" with `.is-locked` (accent 62%, 11.5px) when N>1, else empty |
| C4 | desktop (>=981px) layout: `.const-main` is `grid-template-columns: minmax(0,1fr) var(--panel-w,400px); gap:30px; align-items:start`; canvas wrap `position:sticky; top:20px; height:clamp(520px,68vh,760px)`; panel static, `overflow:visible`, **no** border / background / blur / shadow / inner scroll. Mobile (<=980px): block; panel `margin-top:22px`; canvas static `clamp(420px,52vh,560px)` |
| C5 | portrait label "what you are made of" (was "what your constellation is showing") |
| C6 | keyboard help "seven points in your constellation. use the arrow keys to move between them, enter to open one, and escape to close it." |
| C7 | pillar cards `.cps-row / .cps-story` padding 18px 20px (16px 18px mobile) |
| C8 | older drift (v68..v235): projection toggle "sort by stage" / "sort by date" with note "seven stages, from where you began toward where it is heading." + age line; timeline view under "sort by date"; "your timeline" and "what moved" sections removed from the constellation tab |

### 1.8 Polaris (new.html 2649-2713; CSS v238f)

| id | change |
|---|---|
| Q1 | idle hero is a centered column: star, name "polaris" (13px, uppercase, letter-spacing .24em, accent 85%), tagline "what are you curious about today?", then the allowance badge static below (not absolute) |
| Q2 | allowance badge reads "<n> of 40 questions left this week" (full) / "<n> of 3 questions left this week" (free); click = top-up modal on full, upgrade modal on free (`openPolarisAllowance`) |
| Q3 | input placeholder "ask from where you are. polaris already has the context." (idle and chat) |
| Q4 | explore tab "questions from your constellation" (was "questions from your record") |
| Q5 | mobile (<=760px): question cards stack full-width, explore tabs wrap, hero input fills width |

### 1.9 You and settings (new.html 2816-2916; CSS v236, v236b, v238e)

| id | change |
|---|---|
| Y1 | you header: eyebrow "you", title "everything gathered here so far" |
| Y2 | section labels lowercased: "connected platforms", "your color", "your constellation", "what has stayed with you"; tier badge "full" |
| Y3 | NEW "your constellation" stats block: rows age ("from <first year> to now"), moments ("across N years"), turning points ("where several accounts changed at once"), accounts ("connected and contributing"); each row `grid-template-columns: minmax(0,140px) auto minmax(0,1fr)`; label 12px uppercase 50%, value 17px 92%, note 13px 55% |
| G1 | settings header: eyebrow "settings", title "your account and controls", sub "the machinery behind PHENYX. what you connect, what it keeps, and how you sign in, all yours to change." (prototype uses an em dash here; brand rule forbids it, so the comma form is used) |
| G2 | settings rows: group "account & plan": subscription "your plan, billing, and what's included" (-> subscription modal, right side shows the plan), account "edit your details, or close your account"; group "access": passphrase "change how you sign in", connected accounts "add or disconnect accounts", notifications "choose what PHENYX sends you"; group "what's yours": your information "export a copy, or delete everything"; then "get in touch" (contact@phenyxai.com · share feedback · privacy policy · terms) |
| G3 | you/settings content column max-width 820px, headers 640px; row arrows 24px past the text; hairlines at `rgba(255,253,253,.045)` |
| G4 | shared header style `.you-eyebrow` (11px, 600, .18em, accent 90%) / `.you-title` (300 weight, `clamp(24px,2.6vw,34px)`) / `.you-sub` (15px, 60%) |

### 1.10 Not portable

Persona demo data (mara / james / sasha / nicholas observation copy edits, new.html 3010-3080 and the v108 content pass) drives the prototype's fake accounts only. The app renders synthesized observations, so nothing to port. The prototype account/plan switcher bar is a review control and is hidden by default in v244.

## 2. App audit summary

Three read-only audits of `origin/mvp` (full reports in the session scratchpad: `audit-landing.md`, `audit-constellation.md`, `audit-daily.md`) plus a headless render of the prototype at 1440x900 and 390x844 to confirm what actually displays.

Rendered-state findings that override the markup:

- The projection toggle, its note and the whole timeline view (`tl-view`) are **dead markup**: `new.html:15303` hides them and the v234 script pins the stage view. Do not build them.
- The field hints under join / sign in / reset inputs are hidden (`new.html:15579`, "redundant with the placeholder"). Port the placeholders only.
- The pillar-row depth bar (`.cps-depth`) is hidden. Do not build it.
- The upgrade modal CTA renders as "continue with full, $12.99/month" (a later pass), not the "upgrade to full · $12.99/month" in the diff hunk. Use the rendered text.
- The settings "subscription" row's right label reads "full · downgrade" on full (and the plan name plus "upgrade" on free).
- The prototype account/plan switcher bar is review-only chrome. Never build it.

Where the app already matches: entry modal copy and routes, polaris landing section, CTA, footer, reset flow copy, sign-in headings, OTP structure, welcome-screen centering, no hover question on the canvas, no timeline tier gating, polaris question cards already stack on mobile, chat-header badge shares the idle badge component.

## 3. Tickets and execution spec

All tickets live in a new Linear project **"v244 launch"** (workspace `phenyx`, team PHE), base PRs on `mvp` (see `ship-workflow-phenyx` memory). Brand rules apply to every string: lowercase, no em dashes, "data" never user-facing except the settings "your data" row (now "your information"), "observations" never "reflections", "full" never "pro" in copy.

Gate for every PR: `cd frontend && npx tsc --noEmit` clean. CI lint is advisory. Stage files explicitly (`.agents/`, `.cursor/`, `schema.sql`, `skills-lock.json` are local noise).

Branch and PR plan:

Linear project: https://linear.app/phenyx/project/v244-launch-c6c2e9bbe7ac

| ticket | Linear | branch | PR base | depends on |
|---|---|---|---|---|
| A landing | PHE-89 | `ashwinshan2001/phe-89-v244-landing` (PR #97) | mvp | none. Cherry-picked onto `main` as `ashwinshan2001/phe-89-v244-landing-main` (main carries an identical landing port, PRs #90-#96) |
| B onboarding + auth | PHE-90 | `ashwinshan2001/phe-90-v244-onboarding` (PR #99) | mvp | none; the enum migration must reach staging before the frontend deploys |
| C shell | PHE-91 | `ashwinshan2001/phe-91-v244-product` (integration branch) | mvp | none |
| D daily + gating | PHE-92 | commits on the product branch | | C (plan naming, modal ids) |
| E constellation | PHE-93 | commits on the product branch | | C |
| F polaris | PHE-94 | commits on the product branch | | C |
| G you + settings | PHE-95 | commits on the product branch | | C |

D, E, F, G are built in parallel worktrees branched from C's last commit and merged back into the product branch; one PR carries C-G with one commit per ticket and "Closes PHE-x" lines for each. If review prefers smaller PRs, the commits split cleanly by ticket.

### Ticket A: landing copy, nav scroll-spy, modal chrome

Files: `frontend/lib/landing-copy.ts`, `frontend/components/phenyx/navigation.tsx`, `frontend/components/phenyx/how-it-works-section.tsx`, `frontend/app/globals.css`.

1. `landing-copy.ts`
   - `manifestoCopy.emphasis` -> "here they are read together."
   - `howItWorksCopy.headline` -> "the same life, at three magnifications"; `subline` -> "you are the thing being looked at, and the looking is done with what you already made."
   - `howItWorksCopy.cards` -> rename the field `layer` to `kicker` and set the three cards to the L3 values (update `key={card.layer}` in `how-it-works-section.tsx:45` to `card.title`).
   - `howItWorksCopy.privacyLabel` -> rename to `evidenceLabel` = "what the evidence is"; `privacyItems` -> `evidenceItems` with the three L4 pairs (update the two consumers in `how-it-works-section.tsx:69-76`).
   - `constellationCopy.lines[2]` -> "new things appear, old ones return, some fall away, and the shape holds enough of you to show when you have changed."
2. `navigation.tsx`: replace both IntersectionObservers with a midline picker. `ORDER = [top, about, how, mission, polaris, cta]`, `OWNED = {about, how, mission, polaris}`. On scroll/resize/load (rAF-throttled, passive listeners on `window`), find the first section whose rect straddles `innerHeight / 2`; if none, the last section whose top is above the midline; `setActiveId(OWNED[id] ? id : null)`. Bail out of state updates when unchanged. Render `aria-current="true"` on the active desktop link and pass `data-active` to the dropdown links too.
3. `globals.css`
   - `.landing-vnext__nav-links a::after`: `bottom: calc(50% - 0.7em - 5px); top: auto; right: 0.05em; left: 0`.
   - add `.landing-vnext__nav-links a:hover::after { opacity: 0.42; transform: scaleX(1) }` and `.landing-vnext__nav-links a[data-active="true"]:hover::after { opacity: 0.85 }`.
   - `.landing-vnext__nav-dropdown a[data-active="true"] { color: rgba(255,253,253,.96); box-shadow: inset 2px 0 0 rgba(155,188,255,.7) }`.
   - `.landing-vnext__modal-overlay`: `background: rgba(4,5,8,.78); backdrop-filter: blur(6px)`.
   - mobile `.landing-vnext__hero-description` max-width 34ch -> 30ch.

Acceptance: strings match section 1.1 verbatim; scrolling from the hero through the CTA lights first look, how it works, your constellation, polaris in turn and nothing above the first section or below polaris; dropdown link mirrors the state; tsc clean.

### Ticket B: onboarding and auth copy, constellation explainer step, entrance cadence

Files: `frontend/app/join/page.tsx`, `frontend/app/signin/signin-client.tsx`, `frontend/app/welcome/page.tsx`, `frontend/app/onboarding/page.tsx`, new migration under `supabase/migrations/`.

1. Migration `supabase/migrations/20260907000000_onboarding_step_constellation_intro.sql`, its own file, no transaction wrapper: `alter type onboarding_step add value if not exists 'constellation_intro' before 'polaris_intro';`. Apply on staging with `supabase db push` before the frontend deploy (see `staging-db-migrations` memory).
2. `onboarding/page.tsx` step machine: add `"constellation_intro"` to `OnboardingStep`; `NEXT_STEP.manifesto = "constellation_intro"`, `NEXT_STEP.constellation_intro = "polaris_intro"`; `PREV_STEP.constellation_intro = "manifesto"`, `PREV_STEP.polaris_intro = "constellation_intro"`; add the screen-announcer line "your constellation, seven chapters"; add the render branch.
3. New `ConstellationIntroScreen` (4C): eyebrow "your constellation"; h1 "seven chapters, from where you began to where you are going."; sub "open any one of them and the moments it was built from are still sitting there underneath."; a seven-row rail (name in uppercase small caps 11px letter-spaced, then the small description), no divider lines; continue and back. Reuse the onboarding block layout (`.onb-block`).
4. Copy per section 1.2: fork (O1, including both aria-labels), 4B blocks (O2: eyebrow, heading without `emphasis`, one body, then a new `principles` RevealBlock kind rendering three heading/body pairs), 4A lines (O3), 5B (O5: heading, body, `POLARIS_EXAMPLE.a` and `.src`), 5A lines and CTA "continue" (O6), connect screen (O7: h1 as one text node, sub, `ONAIROS_PROMISES`, legal sentence, `buttonText="connect with onairos"`).
5. `join/page.tsx`: sub line (A1); email placeholder "you@email.com" (A2, no hint); passphrase placeholder "a private phrase you will remember" and existing hint text -> "you will use this with your name when you return." (A3); OTP error strings (A4).
6. `signin-client.tsx`: the three `setError("enter your name and passphrase to continue.")` call sites -> one `SIGNIN_ERROR = "we need both of these to know it is you."` constant.
7. `welcome/page.tsx`: button "continue".
8. Entrance cadence: stop hand-authoring `d` offsets. Add `cadenceOffsets(blocks)` that returns delays in array order (the block arrays already list elements in visual order, CTA and back last): first element at `OB_LEAD = 90`; each following element adds `OB_READ = 620` when the previous block is a `line`, otherwise `OB_STEP = 135`; a `cta` or `back` adds `2 * OB_STEP`. Feed that into `useStaggeredReveal` with `lead: 0`. `revealStyle` transition -> `opacity .75s cubic-bezier(.22,.61,.36,1), transform .65s cubic-bezier(.22,.61,.36,1)`. The fork and connect screens replace their hardcoded `animationDelay` values with the same constants (90, 225, 360, ...). Reduced motion keeps everything visible immediately (existing behavior). No DOM measurement.
9. Headings on onboarding cards: `font-size: clamp(23px, 2.5vw, 30px); line-height: 1.16; max-width: 20ch; text-wrap: balance` (22px under 760px). Join / sign in / reset: first field sits `clamp(24px, 3.8vh, 40px)` below the sub line.

Acceptance: every string in section 1.2 present verbatim; a new user goes fork -> intro -> seven chapters -> polaris -> connect, back links reverse it, the skip path still lands on connect; refreshing on the new step resumes there; reduced-motion shows screens whole; tsc clean.

### Ticket C: shell, you tab, sidebar identity block, plan naming, mobile bottom nav

Files: `frontend/components/phenyx/dashboard-sidebar.tsx`, `frontend/app/dashboard/layout.tsx`, `frontend/lib/use-tier.ts`, `frontend/app/dashboard/profile/*` -> `frontend/app/dashboard/you/*`, new `frontend/app/dashboard/settings/page.tsx`, `frontend/app/settings/settings-client.tsx`, `frontend/components/phenyx/intro-banner.tsx`, new `frontend/components/phenyx/mobile-bottom-nav.tsx`, `frontend/app/dashboard/daily/page.tsx` (import path only).

1. Routes. `git mv app/dashboard/profile app/dashboard/you`; layout title "You"; `IntroBanner` key `profile` -> `you` (keep its existing copy). Add a "skip to content" link (`.sr-only` until focused) at the top of the dashboard layout targeting the main column. Add back `app/dashboard/profile/page.tsx` as `redirect("/dashboard/you")`. Create `app/dashboard/settings/page.tsx` (+ layout title "Settings") and move the settings groups and the "get in touch" block out of the you page into it (ticket G restyles both). `app/settings/settings-client.tsx` redirects to `/dashboard/settings`. Fix the daily page import of `held.ts`. The analytics tab id becomes `you` (note in the PR).
2. Sidebar (`dashboard-sidebar.tsx`), top to bottom:
   - brand block: 18px orb painted with the user's stellar color (`radial-gradient(circle at 42% 42%, var(--s) 0%, var(--s) 42%, color-mix(in srgb, var(--s) 55%, transparent) 60%, transparent 100%)`, `box-shadow: 0 0 10px color-mix(in srgb, var(--s) 40%, transparent)`), the word "PHENYX" (12.5px, 600, letter-spacing .14em), plan pill pushed right ("full" / "free"; 10px uppercase, letter-spacing .12em, `rgba(var(--s-rgb),.9)` text, 1px `rgba(var(--s-rgb),.3)` border, radius 999px, padding 3px 9px); 1px `rgba(255,253,253,.07)` rule under it (padding-bottom 18px, margin-bottom 8px).
   - nav: daily, polaris, constellation, you (`/dashboard/you`); links 14px, padding 11px 12px, radius 12px, `rgba(255,253,253,.5)`; hover `.7` on `rgba(255,253,253,.04)`; active `.9`, weight 500, `rgba(255,253,253,.05)`.
   - remove the "upgrade to pro" button and the logo footer.
   - account row (`mt-auto`, 1px top rule, padding-top 14px): first name (13.5px, 500, ellipsis) from `user_profiles.display_name` (fetch once with the Supabase browser client, fall back to "you"), and a 32px gear button (`aria-label="settings"`, 1px `rgba(255,253,253,.1)` border, radius 8px, 16px stroke-1.7 gear icon, `rgba(255,253,253,.7)`) that pushes `/dashboard/settings`; when the `settings` segment is active the gear gets white icon, `rgba(var(--s-rgb),.10)` background, `rgba(var(--s-rgb),.35)` border.
   - `applyTierUI`: badge text `isPro ? "full" : "free"`; the upgrade-button branch becomes a no-op when the element is null.
   - make sure `--s` and `--s-rgb` are set on `document.documentElement` inside the dashboard shell (the `SettingsModalsProvider` already knows `stellarColor`; set the variables there if they are not set already, otherwise the orb has no color on a fresh load).
3. Mobile (`max-width: 760px`): hide the sidebar; render `MobileBottomNav` from the dashboard layout: fixed bottom bar (`rgba(8,8,8,.94)`, blur 14px, 1px `rgba(255,253,253,.07)` top rule, padding `6px 4px calc(6px + env(safe-area-inset-bottom))`) with five items daily / polaris / stars (-> constellation) / you / menu, 20px stroke-1.7 icons from the prototype paths (`new.html:16810-16818`), 10px labels, active item in the accent; the menu item opens a bottom sheet (scrim `rgba(0,0,0,.5)`, panel `#0c0c0c` with 20px top radius and a grip) listing daily, polaris, constellation, you, a divider, settings; the sheet closes on scrim tap, Escape, or a row tap; the active tab mirrors the route segment; the main column gets `padding-bottom: calc(72px + env(safe-area-inset-bottom))` on mobile so content clears the bar.

Acceptance: at 1440px the sidebar reads PHENYX + plan pill at the top, four links, and the name + gear at the bottom; the gear lights up on `/dashboard/settings`; `/dashboard/profile` and `/settings` redirect; at 390px the sidebar is gone and the bottom bar drives navigation; the word "pro" appears nowhere in the shell; tsc clean.

### Ticket D: daily feed rules, mantra attribution, depth gating on free, upgrade modal copy

Frontend: `frontend/app/dashboard/daily/page.tsx`, `frontend/components/phenyx/daily-header.tsx`, `frontend/components/phenyx/observation-card.tsx`, `frontend/components/phenyx/evidence-trace.tsx`, `frontend/components/phenyx/underneath-reading.tsx`, `frontend/components/phenyx/settings-modals/upgrade.tsx`, new `frontend/app/dashboard/daily/select-daily.ts` (+ test). Backend: `backend/src/stripe/billing.service.ts`, `backend/src/observations/gating.ts` (+ its tests).

1. Selection (`select-daily.ts`, pure, unit-tested with the runner the neighbouring `held.test.ts` uses): `DAILY_COUNT = 4` for every tier. Pool of four or fewer: all of them. Otherwise: one headline (`is_new`) leads, chosen by `dayNum % headlines.length`; the rest fill from a deck of the remaining observations shuffled with the seeded LCG in section 1.4 D3 (`cycleLen = ceil(src.length / 4)`, `seed = ((floor(dayNum / cycleLen) + 1) * 2654435761) % 2147483647`, `next = (seed * 16807) % 2147483647`, Fisher-Yates), sliced from `start = (dayNum % cycleLen) * 4`, skipping any observation whose pillar is already taken; a thin pool yields a short day, never a repeat. Focus (full only): if the focused pillar is absent, drop the last pick and put the first pool observation of that pillar at the top; then stable-sort the focused pillar first. Replace the pillar-only filter the page uses today.
2. Nothing opens by default except the focused card. Verify the page's `expanded` state starts as the focused observation id or null.
3. Header (`daily-header.tsx`): label "mantra of the day" above the line (10.5px, uppercase, letter-spacing .18em, 500, `rgba(var(--s-rgb),.72)`, margin 18px 0 8px) and a sub line under it "drawn from <pillar> in your constellation" (12.5px, `rgba(255,253,253,.44)`, margin 9px 0 30px) where pillar = `PILLARS[(dayNumber % DAILY_LINES.length) % 7]` in lowercase with its hyphen (`self-creation`). The line itself still rotates through `DAILY_LINES`.
4. Card head: text fills the width, the pillar banner and chevron hug the right edge; under 760px the banner sits on its own top row with the chevron and the text spans the full width.
5. Locked evidence (`evidence-trace.tsx`, the `!chain` branch): kind label (`evidence.sig`), line "where this comes from", marker "full ✦" (9px, letter-spacing .08em, accent, opacity .75, `margin-left: auto`), chevron "›"; the wrapper sits at opacity .72 and goes to 1 on hover (no `.phenyx-ev-locked` rule exists today; write it into the injected style block); click keeps `rememberProReturn` + upgrade modal. Drop "the N entries behind this" and the "◆" glyph. The **unlocked** button line becomes "what this rests on" (the prototype swapped the two lines: the door says where it comes from, the open trace says what it rests on).
6. Locked underneath (`underneath-reading.tsx`): dot, "what sits under this", "full ✦"; same opacity treatment. The unlocked label is also "what sits under this" (was "something sits under this one").
6b. Feedback block (`observation-feedback.tsx`): question "how does this read to you?" (was "does this land?"); the three buttons stay; confirm lines become "noted as something you had not seen. we will keep that in mind when choosing what to bring forward next." / "noted as something you already knew. we will keep that in mind when choosing what to bring forward next." / "noted: the source details may be right, but this observation does not feel like you. we will keep that in mind when choosing what to bring forward next."; undo stays "change it".
6c. Remove `StillTrueToday` from the daily page (the prototype switched the held line off with `if(false)` and the rendered day shows none); keep the component file and the `/profile/overview` held data, which the you tab still uses.
7. Source row: the time span shows on every tier; account names only when the trace is unlocked. Drop the `observation.locked ? "" : ...` guard on `span` in `observation-card.tsx`; keep it on `sources`. aria-label degrades to the span alone.
8. Backend: `FREE_CAPABILITIES.evidenceTracesPerDay: 0` (free never receives a trace body). `attachEvidenceHierarchy` in `observations.service.ts` takes that number too: make sure every served row still carries `evidence: { sig, recs }` on free (attach for all rows, then let `redactEvidence(..., traceUnlocked)` strip the chain), otherwise the lock has no kind label. `applyReadGate` serves `span: formatSpan(row)` for every tier and keeps `sources` / `meta_line` behind `traceUnlocked`; update the v67 comments in `billing.service.ts` and `gating.ts` to the v244 model and the gating tests.
9. Upgrade modal (`upgrade.tsx`): title "what full opens"; sub "free shows you what is true. every observation of the day, and all seven points of your constellation. full is how you find out why it is true, what it means, and what to do about it."; the five bullets from section 1.6 M1; CTA "continue with full, $12.99/month"; foot "or $99/year. cancel any time." (the current "your first month is free" line goes unless a Stripe trial is actually configured; see decisions). Checkout behavior unchanged.

Acceptance: a free account sees four observations, no grey cards, every card collapsed, each evidence row reading "<kind> where this comes from full ✦" and opening the upgrade modal, the time span visible and no account names; a full account sees the trace ("<kind> what this rests on") and sources; the mantra carries its label and attribution; no "still true today" block; feedback asks "how does this read to you?"; the selection test covers one-per-pillar, short days, day-to-day non-overlap within a cycle, and focus floating; backend tests pass; tsc clean.

### Ticket E: constellation docked panel, synthesis line, story rows, age line

Files: `frontend/app/dashboard/constellation/page.tsx`, `frontend/components/phenyx/constellation-panel.tsx`, `frontend/components/phenyx/constellation-canvas.tsx`, `frontend/components/phenyx/intro-banner.tsx` (copy only), `frontend/lib/constellation.ts` (helper only).

1. Layout (`page.tsx:74-102`): container `grid grid-cols-1 min-[981px]:grid-cols-[minmax(0,1fr)_400px] gap-[22px] min-[981px]:gap-[30px] items-start px-6 lg:px-10`; canvas wrap `h-[clamp(420px,52vh,560px)] min-[981px]:sticky min-[981px]:top-5 min-[981px]:h-[clamp(520px,68vh,760px)]`; aside loses `border-*`, `max-h-*`, `overflow-y-auto`, `px-6 py-8`, `overscroll-contain`; it is a plain column that flows with the page. Under 981px, when a point opens, scroll the panel into view (`scrollIntoView({behavior:"smooth", block:"nearest"})` after 200ms).
2. Header above the grid: eyebrow "your constellation" and the age line "<N years, M months> of your life, from <year> to now." Year = the first 4-digit year in `data.timeline.span`, else the year of `data.tenure.since`; months counted from January of that year to now; omit the months part when zero; "1 year" / "1 month" singular; render nothing when neither source has a year. Put the helper (`constellationAge(data)`) in `lib/constellation.ts` so ticket G reuses it. Keep `IntroBanner` and its existing constellation copy.
3. Overview panel: drop "tap any point to explore"; portrait label -> "what you are made of"; replace the "pillars" list with story rows: for each of the seven points a card (`px-5 py-[18px]`, `max-[760px]:px-[18px] max-[760px]:py-4`, 1px hairline `rgba(255,253,253,.045)`, radius 12px) holding an uppercase accent pill with the point name, an optional "<n> new" badge (count of `is_new` observations in the point), and one story line: the first sentence of the point's lead observation (`clusters[0].observations[0].body`, stripped of tags, cut at the first `. ? !`), falling back to `cluster.preview`, then to the fixed lens copy: origin "what has been with you the longest", emergence "what began to appear", self-creation "what you chose to make your own", convergence "what has started to connect", becoming "what is taking shape now", recognition "what others have started to see", transcendence "the question you have not answered yet".
4. Point detail: insert the synthesis line above the "clusters" section (rename that label to "areas"). `pillarSynthesis(detail)`: named = clusters whose label is set and not "core signals"; if fewer than two, no line; list = "a and b" or "a, b and c"; years = every 4-digit year found in `span` or `surfaced_at` of the clusters' observations; count = total observations across those clusters. Full tier: "<list> all sit under <point>, and they hold together across <hi-lo> years of your life, on <count> thing(s) you did rather than anything you said about yourself." (when hi == lo or no years: ", and they hold together, on ..."). Free tier: "these <n> areas are read together with full ✦" in accent 62%, 11.5px, letter-spacing .04em, when n > 1. Style the full line 13px, line-height 1.75, 50% white, italic. Tier comes from `useTier()` (import into the panel); never use the per-observation `locked` flag as a tier proxy.
5. Canvas: clamp the pillar label x so the text stays inside the canvas (`safeX = 14`, switch `textAlign` to left/right near the edges) and y to `[16, H-12]`; keyboard help text -> "seven points in your constellation. use the arrow keys to move between them, enter to open one, and escape to close it."
6. Remove `RecordTimelineView` and `WhatMoved` from the constellation tab (`page.tsx:104-109` and the two imports). Leave the component files in place; a follow-up decides whether the weekly look returns elsewhere. Keep `data.timeline` because the you tab stats (ticket G) read it.

Acceptance: at 1440px the sky and the panel sit side by side with no box around the panel, the sky stays put while the panel scrolls; at 390px the panel sits under the sky; a full user sees the composed sentence above the areas of any point with two or more named areas, a free user sees the locked line; story rows show a sentence, not a count; tsc clean.

### Ticket F: polaris centered hero, questions-left allowance, copy

Files: `frontend/components/phenyx/polaris-tab.tsx` (and `polaris-badge.tsx` if the pill lives there).

1. Idle hero (`polaris-tab.tsx:591-623`): column, centered, `gap: 10`; star 30px; new name element "polaris" (13px, uppercase, letter-spacing .24em, weight 600, `rgba(var(--s-rgb),.85)`); tagline "what are you curious about today?"; the allowance badge sits static below the tagline (`margin: 6px auto 0`); delete the `[data-polaris-hero-row]` padding and `[data-polaris-hero-token]` absolute rules (`polaris-tab.tsx:354-372`).
2. Allowance badge text: `"<remaining> of <limit> questions left this week"`, both numbers from the backend allowance (`limit` 40 on full, 3 on free after item 7). Click: full -> the existing top-up sheet; free -> the upgrade modal. The Radix popover explaining tokens is removed; its explanatory sentence moves into the top-up sheet body (see item 7 for the rewrite).
3. `COMPOSER_PLACEHOLDER` -> "ask from where you are. polaris already has the context."
4. Explore tab label "questions from your record" -> "questions from your constellation" (keep the internal key; fix the header comment).
5. Explore tab row: `flexWrap: "wrap"`, `gap: "8px 16px"`; tab buttons `flexShrink: 0`.
6. Chat header badge inherits the new text automatically.
6b. Top-up sheet (`TopupSheet` inside `polaris-tab.tsx`): title "add more this week"; sub "your weekly amount resets on its own. if you want more room before then, you can add a little extra."; CTA "add a little more for $4.99"; footnote "one time only. your usual weekly amount will still reset as normal."; sub and footnote in `rgba(255,253,253,.52)`; the sheet takes the same chrome as ticket G's modals (overlay `rgba(4,5,8,.78)` blur 6px, blue-black gradient box, `1px rgba(var(--s-rgb),.20)` border, radius 16px, tinted primary button). The CTA still has no backend (it only closes); leave that as is and note it in the PR.

7. Allowance model (backend, same ticket): the prototype counts questions, not tokens: 40 a week on full, 3 a week on free. In `billing.service.ts` add `paid: boolean` to `TierCapabilities` and derive `hasFullAccess` from it; set `polarisAccess: true` on both tiers; replace `polarisWeeklyTokens` with `polarisWeeklyQuestions` (40 / 3). In `token-budget.service.ts` the meter counts questions: `debit` adds 1 per completed ask (the Anthropic usage is still logged, never used for the meter); `WeeklyAllowance` keeps its field names. Remove the free short-circuit in `polaris.service.ts` that assumed `polarisAccess` false (grep every `polarisAccess` read). The `polaris_token_usage.tokens_used` column is reused as the question count; add a comment, no migration. Frontend: `V67_PRICING.polarisWeeklyTokens` -> `polarisWeeklyQuestions: { full: 40, free: 3 }`; `polarisWeeklyTokenLabel` -> `polarisAllowanceLabel(remaining, tier)`; the free-locked composer view ("polaris is on pro") goes away, free asks up to 3 and then gets the upgrade modal; the `TOKEN_NOTE` sentence is rewritten as "questions reset every week. a top-up adds a few more before then and does not change the reset." inside the top-up sheet.

Acceptance: strings from section 1.8 verbatim; at 390px the tabs wrap instead of overflowing; the badge reads "<n> of 40 questions left this week" on full and "<n> of 3 questions left this week" on free, opens top-up on full and the upgrade modal on free; a free account can ask three questions in a week and the fourth is refused with the at-limit copy; backend tests pass; tsc clean.

### Ticket G: you tab, settings panel, subscription modal, modal chrome, plan naming

Files: `frontend/app/dashboard/you/page.tsx`, `frontend/app/dashboard/settings/page.tsx`, `frontend/components/phenyx/settings-modals/modal-host.tsx`, new `frontend/components/phenyx/settings-modals/subscription.tsx`, `frontend/app/upgrade/page.tsx`, `frontend/lib/constellation.ts` (helper only), backend `backend/src/profile/profile.service.ts`.

1. Shared header style for both panels: eyebrow (11px, 600, letter-spacing .18em, uppercase, `rgba(var(--s-rgb),.9)`, margin-bottom 14px), title (300 weight, `clamp(24px, 2.6vw, 34px)`, line-height 1.16, letter-spacing -.02em, `rgba(255,253,253,.96)`), sub (15px, line-height 1.7, `rgba(255,253,253,.6)`, max-width 52ch); content column max-width 820px, header 640px.
2. You page: eyebrow "you", title "everything gathered here so far"; identity row (name, tier badge "full" / "free", pencil -> `edit-profile`, email, "with PHENYX since <month year>"); sections labelled "connected platforms", "your color", "your constellation", "what has stayed with you"; the settings groups and "get in touch" are gone from this page (ticket C moved them).
3. "your constellation" stats (from `/constellation` and `/profile/overview`): rows age = "<N years, M months>" with note "from <year> to now" (use `constellationAge(data)` from ticket E); moments = total observations across the seven points with note "across <years> years"; turning points = `timeline.breaks.length` with note "where several accounts changed at once"; accounts = connected platform count with note "connected and contributing". A row with no value is omitted. Row grid `minmax(0,140px) auto minmax(0,1fr)`, gap 4px 16px, baseline aligned, padding 10px 0, hairline `rgba(255,253,253,.06)`; label 12px letter-spacing .12em uppercase 50%; value 17px 92%; note 13px 55%; under 640px `1fr auto` with the note on its own line.
4. Settings page: eyebrow "settings", title "your account and controls", sub "the machinery behind PHENYX. what you connect, what it keeps, and how you sign in, all yours to change."; groups and rows from section 1.9 G2 with modal ids `subscription`, `account`, `passphrase`, `my-connections`, `notifications`, `data-management`; the subscription row's trailing label reads "full · downgrade" or "free · upgrade" in the accent; then "get in touch" (contact email · share feedback -> `feedback` · privacy policy · terms). Rows keep their arrows 24px past the text; hairlines `rgba(255,253,253,.045)`.
5. Subscription modal (new id `subscription`): plan name (22px) + price ("$12.99 / month" on a monthly subscription, "$99 / year" on `yearly_paid`, "free"); renew line ("renews <d month yyyy> · or $99/year" when `renews_at` is known, "paid for the year" on yearly, "no billing on this plan" on gifted, "no billing on free" on free); "what's included" list (full: every daily observation, more polaris room each week, a daily point to stay close to, a weekly look at what shifted, a yearly look across your timeline; free: every observation of the day, your seven-point constellation, three polaris questions each week, the span of time behind each observation. The prototype's free list still says "one daily observation" and "the evidence behind everything shown", both contradicted by its own v243 gating, so the two lines are reconciled with the upgrade modal's "free shows you what is true" framing; see decisions); action: full monthly -> "switch to free" (opens the Stripe billing portal via the existing `/stripe/billing-portal` call; gifted and yearly show no action); free -> "upgrade to full · $12.99/month" (the rendered subscription modal keeps this wording; same checkout as the upgrade modal); foot "cancel any time. you keep full until the period ends." on full, "or $99/year. cancel any time." on free.
6. Backend: `GET /profile/overview` gains `renews_at: string | null` and `billing_period: "monthly" | "yearly" | null`; when `stripe_subscription_id` is set, read `current_period_end` from Stripe (cache-free, best effort, null on error).
7. Modal chrome (`modal-host.tsx`): overlay `rgba(4,5,8,.78)` with `backdrop-filter: blur(6px)` covering the full viewport; content `min(440px, calc(100vw - 40px))`, background `radial-gradient(120% 88% at 50% -18%, rgba(var(--s-rgb),.10), transparent 66%), linear-gradient(180deg, #0c0f16 0%, #090b10 100%)`, `1px solid rgba(var(--s-rgb),.20)`, radius 16px, shadow `0 0 0 1px rgba(255,253,253,.03), 0 30px 80px -20px rgba(0,0,0,.75)`; title `#FFFDFD`, sub `rgba(255,253,253,.70)`; `PrimaryButton` becomes the tinted style (`rgba(var(--s-rgb),.10)` fill, `1px solid rgba(var(--s-rgb),.38)`, white text, radius 10px, weight 500). The top-up sheet footnote uses `rgba(255,253,253,.52)`.
8. Plan naming sweep, "pro" -> "full" in copy only (identifiers stay): you page badge and labels, `/upgrade` page (card title "full", "one full membership unlocks everything. choose monthly, pay yearly and save, or gift a constellation to someone.", CTA "continue with full, $12.99/month", "or $99/year", the gifted line "your gifted constellation already includes full access", delete the "signal & observatory experience modes" sentences, which describe settings that no longer exist, and replace the free card's stale list ("1 daily reflection prompt", "7 pillar framework", "basic constellation view", "30-day history") with the subscription modal's free list; "reflection" is a banned word). The `/upgrade` page's "first month free" line follows decision 3.

Acceptance: `/dashboard/you` shows the four sections with the stats block; `/dashboard/settings` shows three groups plus get in touch; the subscription row opens the new modal with the right plan, price, renew line and action for free, monthly, yearly and gifted accounts; every modal uses the blue-black chrome; no user-facing "pro" remains (`grep -rn "\bpro\b" frontend/app frontend/components frontend/lib` returns identifiers and comments only); tsc clean.

## 4. Decisions and flags

1. **Free tier now asks Polaris.** The prototype gives free three questions a week (subscription modal, allowance label, `freePolarisRemaining`). Today free is locked out. Ticket F changes the backend meter from tokens to questions. Reversible by setting the free allowance to 0.
2. **Evidence is fully behind full on free.** v67 gave free two traces a day; v244 shows the door on every card and opens none. Ticket D sets `evidenceTracesPerDay` to 0 for free.
3. **"your first month is free"** is app copy with no prototype counterpart. It is removed unless the Stripe monthly price has a trial configured; check before merge.
4. **Timeline and "what moved" leave the constellation tab** (prototype removed them). The components stay in the repo, unmounted. The weekly look is still advertised in the subscription modal, so a follow-up should decide where it lives.
5. **No upgrade button in the sidebar.** The prototype relies on the locks, the settings row and the subscription modal. Conversion paths shrink; flagging.
6. **Dead prototype markup is not built:** projection toggle and timeline view, `cps-depth` bars, field hints.
7. **`main` carries the same landing.** Ticket A lands on `mvp`; cherry-pick the landing commit onto `main` in a second PR.
8. **Top-up purchases still credit nothing** (`stripe.controller.ts` only logs them). Pre-existing gap, out of scope, worth its own ticket.
9. **Analytics tab id** changes from `profile` to `you`; dashboards keyed on the old value need updating.
10. **Onboarding gains a persisted step**, so the enum migration must reach staging before the frontend deploy.
11. **Formation timing** (node stagger, lines) is not re-ported; PHE-81 tuned it deliberately.
12. **"still true today" leaves the daily page.** The prototype disabled the held line (`if(false)` at new.html:8670) and the rendered day has none. The component stays in the repo; the held constants still show on the you tab.
13. **The prototype's subscription modal free list is stale** ("one daily observation", "the evidence behind everything shown" contradict its own v243 gating and the upgrade modal). Ticket G ships the reconciled list; if the designer meant the stale lines, it is two strings to revert.
14. **Unguarded Stripe endpoints.** `POST /stripe/checkout` and `POST /stripe/billing-portal` take `userId` from the body with no `SupabaseAuthGuard`; anyone with a user id can mint that user's portal URL. Pre-existing, out of scope, needs its own ticket before launch.

## 5. Execution order and verification

1. Create the Linear project and tickets A-G; branch A and B from `origin/mvp`; branch the product integration branch from `origin/mvp`.
2. A and B run in parallel with C.
3. When C is committed, D, E, F, G run in parallel in worktrees branched from C; each returns a single commit; merge them into the product branch in the order D, E, F, G, resolving overlaps (expected only in `modal-host.tsx` and the you page).
4. Gates per branch: `cd frontend && npx tsc --noEmit`; `cd backend && npm run build` and the backend unit tests for D and F; the frontend selection test for D.
5. Visual check: run `next dev`, screenshot the landing at 1440 and 390 with Playwright (no auth needed); the dashboard needs a signed-in account, so the product PR ships with the prototype screenshots in the scratchpad as the reference and a manual QA checklist (free and full, 1440 and 390) in the PR body.
6. Open PRs against `mvp`: A, B, and the product branch. Then the `main` cherry-pick of A.
