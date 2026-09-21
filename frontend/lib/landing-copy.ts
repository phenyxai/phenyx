// Landing copy, ported from the Sept 15 drop (internal pass ph550).
//
// Source of record: ~/Documents/Phenyx/Sept 15/PHENYX_main_landing (1).html —
// the landing-only export, which is the canonical marketing dataset. The full
// demo carries the same landing markup but a different constellation example
// (Mara's persona); the standalone export wins for the marketing site.
//
// Voice note: every string here is stored lowercase. Uppercase is a CSS concern
// (`text-transform`), matching how the prototype does it — see
// `.landing-vnext__polaris-mode` and `.landing-vnext__evidence-rows span`.
export const BRAND = "PHENYX";

export const SECTION_IDS = {
  top: "s0-top",
  about: "s0-about",
  how: "s0-how",
  mission: "s0-mission",
  polaris: "s0-polaris",
  cta: "s0-cta",
} as const;

export const navCopy = {
  brand: BRAND,
  menuLabel: "menu",
  links: [
    { label: "your life", targetId: SECTION_IDS.about },
    { label: "how it works", targetId: SECTION_IDS.how },
    { label: "your constellation", targetId: SECTION_IDS.mission },
    { label: "polaris", targetId: SECTION_IDS.polaris },
  ],
  enter: "enter",
} as const;

export const heroCopy = {
  brand: BRAND,
  tagline: "your life, taking form.",
  // Two deliberate lines, not one wrapped sentence — the prototype splits these
  // into separate spans so the break survives every viewport.
  descriptionLines: ["see who you've been. understand who you are.", "follow who you're becoming."],
  enter: "enter",
} as const;

export const manifestoCopy = {
  eyebrow: "your life",
  headline: "parts of you are out there.",
  paragraphs: [
    "in the music you return to, the work you make, the things you save, the people you meet, the questions you ask, and the way you spend your time.",
    "each place holds a different part of you. none of them shows how those parts connect, or what they make up together.",
  ],
  emphasis: "PHENYX shows you what those parts make up together.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how phenyx works",
  headline: "see the whole of who you are.",
  subline:
    "connect the places you choose. PHENYX uses the data already there to show how the different parts of your life connect across time.",
  // One card per product surface. Card order mirrors the product's own tab order.
  cards: [
    {
      kicker: "who you've been",
      title: "constellation",
      body: "move through seven stages built from your data, with the moments and original evidence behind each one.",
    },
    {
      kicker: "what you missed",
      title: "discover",
      body: "resurface forgotten saves, unexpected connections, unfinished threads, and moments worth seeing again.",
    },
    {
      kicker: "clarity + direction",
      title: "polaris",
      body: "clarify what something means, weigh a decision, or build a path around how you actually live.",
    },
    {
      kicker: "who you are now",
      title: "you",
      body: "see the themes, patterns, and eras that seem to hold across change.",
    },
  ],
  signalsLabel: "what comes into view",
  // Exactly six — HowItWorksSection pairs these positionally with SIGNAL_Y.
  signals: [
    "what shaped you",
    "what keeps returning",
    "what changed",
    "what overlaps",
    "what matters now",
    "what may be next",
  ],
  staysYoursLabel: "what stays yours",
  // UNVERIFIED PRIVACY CLAIM — do not publish until someone signs this off.
  // "without keeping a copy of your raw data" is not obviously true of the
  // shipped backend: `source_records` retains per-record rows keyed by
  // `external_record_id` with an encrypted `payload_ciphertext` and
  // `provenance_status = 'retained_source'`, and the Sept 15 source trail leans
  // on exactly that ("open exact record"). The Onairos path is defensible —
  // `trait_object` arrives already derived and `redactOnairosForProfile` only
  // strips credential keys — but `source_records` is the harder half.
  // Ported verbatim from the designer's export; wording is a legal call.
  staysYoursItems: [
    { title: "your data.", body: "choose what comes in, what stays connected, and when anything leaves." },
    { title: "your privacy.", body: "PHENYX keeps derived context without keeping a copy of your raw data." },
    {
      title: "your truth.",
      body: "PHENYX can surface the evidence and patterns. you decide what they mean and what you do with them.",
    },
  ],
} as const;

export const constellationCopy = {
  eyebrow: "your constellation",
  headline: "see how your life takes shape.",
  lines: [
    "each point captures a different stage of your life. inside it, PHENYX brings together what was happening across your interests, work, relationships, habits, ideas, and the changes taking shape around you.",
    "open a stage to see the moments that made it up, how different parts of your life overlapped, when they happened, and the original sources behind them.",
  ],
  emphasis: "start with the whole. follow what pulls you closer.",
  visualizationLabel:
    "Seven-point constellation: origin, emergence, self-creation, convergence, becoming, recognition, and transcendence.",
  // The note now sits ABOVE the example rather than below it, so the reader is
  // told it is an example before reading one.
  exampleNote: "an example of what can surface within each stage",
  exampleToggleLabel: "see what shapes each point",
  previewHeadline: "your identity. finally in one place.",
  previewSubline: "we help you connect it all through moments of reflection.",
  previewBrandLabel: BRAND,
  previewConstellationLabel: "your constellation",
  reflectLabel: "reflect.",
} as const;

export interface ConstellationPoint {
  name: string;
  year: string;
  question: string;
  summary: string;
  /**
   * [label, source, evidence]. The first cell used to be a date; in the Sept 15
   * dataset it is a category label ("curiosity", "making", "recovery") and the
   * source cell may name more than one platform ("oura + strava").
   */
  rows: readonly (readonly [string, string, string])[];
  observation: string;
}

export const constellationPoints: readonly ConstellationPoint[] = [
  {
    name: "origin",
    year: "2016–17",
    question: "what was already there before i had words for it?",
    summary: "your earliest record already shows a pull toward self-directed learning and making things your own.",
    rows: [
      ["curiosity", "youtube", "saved videos keep returning to cognitive psychology, film breakdowns, and learning systems"],
      ["focus", "spotify", "“Instant Crush” by Daft Punk keeps returning across your exam-period playlists"],
      ["influence", "netflix", "Black Mirror, The Good Place, and Abstract: The Art of Design are among the titles you return to most"],
    ],
    observation: "before there was a plan, there was already a consistent way you learned and focused.",
  },
  {
    name: "emergence",
    year: "2018–20",
    question: "what started taking shape before i named it?",
    summary: "your attention shifts from learning about other people’s work to testing ideas of your own.",
    rows: [
      ["making", "github", "side projects shift from tutorial clones to original interface prototypes"],
      ["taste", "instagram", "saved posts begin mixing interaction details with live-show photography, interiors, and personal style"],
      ["direction", "linkedin", "internships and your portfolio begin using product design as the consistent role and project focus"],
    ],
    observation: "the interest becomes more specific once learning, making, and career choices start moving together.",
  },
  {
    name: "self-creation",
    year: "2020–22",
    question: "what did i begin choosing on purpose?",
    summary: "you start building a life around the kind of work you want to keep doing.",
    rows: [
      ["commitment", "github", "the projects you keep returning to are interfaces and tools built around people"],
      ["routine", "strava", "morning runs keep showing up before the days when you settle into your longest work sessions"],
      ["recovery", "netflix", "comfort rewatches like The Good Place and Spirited Away keep showing up after your heaviest project weeks"],
    ],
    observation: "the change here is not just more activity. your choices start reinforcing one another.",
  },
  {
    name: "convergence",
    year: "2023",
    question: "which parts of my life started moving together?",
    summary: "career questions, environment, and daily rhythm all shift within the same six weeks.",
    rows: [
      ["direction", "chatgpt", "questions increasingly center on what to build next, how to make decisions, and what kind of work feels worth doing"],
      ["environment", "pinterest", "saved references mix wearable concepts with interiors, objects, typography, and spaces you want to live in"],
      ["perspective", "reddit", "saved threads keep circling HCI, city life, music gear, and how technology changes everyday behavior"],
    ],
    observation: "what felt like separate changes reads more clearly as one turn toward greater independence.",
  },
  {
    name: "becoming",
    year: "2024–25",
    question: "what is changing in me right now?",
    summary: "the record shows less exploration for its own sake and more commitment to a direction.",
    rows: [
      ["language", "claude", "“what kind of designer do i want to become?” keeps returning alongside questions about the kind of life you want around the work"],
      ["energy", "oura", "your strongest weeks tend to follow steadier sleep and more consistent mornings"],
      ["expression", "x + instagram", "you share less just to post and more when you actually have something you want to say"],
    ],
    observation: "the pattern is getting clearer: less searching, more choosing and finishing.",
  },
  {
    name: "recognition",
    year: "2025–now",
    question: "what has held long enough for me to trust it?",
    summary: "your best work keeps appearing under the same conditions across different years and projects.",
    rows: [
      ["focus", "spotify", "“Instant Crush,” “Hard Times,” and “Everything in Its Right Place” keep returning during your strongest work weeks"],
      ["method", "github", "finished projects tend to come from weeks when one problem stays in focus"],
      ["support", "oura + strava", "steadier sleep and morning movement repeatedly show up around your best work"],
    ],
    observation: "the record now shows a repeatable way you work well, not a one-time burst.",
  },
  {
    name: "transcendence",
    year: "ahead",
    question: "what larger direction is taking shape?",
    summary:
      "your work is beginning to converge around a broader vision: designing products that shape how people experience technology.",
    rows: [
      ["direction", "github + claude", "recent projects and prompts keep returning to interfaces, wearables, and human experience"],
      ["voice", "linkedin + x", "your public work increasingly connects technology with identity, culture, and everyday experience"],
      ["environment", "pinterest + netflix", "saved references and watched titles keep returning to speculative interfaces, physical spaces, sci-fi, and human-centered technology"],
    ],
    observation:
      "the thread is becoming clearer: not just making products, but shaping how people experience technology.",
  },
] as const;

export interface PolarisExample {
  /** A Polaris mode — clarify / understand / decide — not a constellation pillar. */
  mode: string;
  question: string;
  answer: string;
  sources: readonly string[];
  span: string;
}

export const polarisCopy = {
  eyebrow: "polaris",
  headline: "clarify what matters. decide what comes next.",
  lead: "polaris starts with the same context. clarify what a pattern means, weigh a decision, or build a path around how you actually live.",
  thesis: "you do not have to explain yourself from the beginning.",
  examples: [
    {
      mode: "clarify",
      question: '"why do i keep coming back to film if i built my career in product?"',
      answer:
        "film never really left. it stayed inside the images you saved, the projects you sustained, and the language that appeared in your private AI conversations years before it reached your professional identity.",
      sources: ["pinterest", "github", "linkedin", "claude"],
      span: "7 years",
    },
    {
      mode: "decide",
      question: '"what conditions keep showing up when i do my best work?"',
      answer:
        "steadier sleep, an earlier start, and one project held in focus keep showing up around the days you actually finish what you started.",
      sources: ["github", "oura", "spotify"],
      span: "31 of 40 days",
    },
    {
      mode: "decide",
      question: '"what kind of routine am i most likely to actually keep?"',
      answer:
        "shorter morning workouts, steadier sleep, and one lighter day before the weekend show up in your most consistent weeks. start with that rhythm.",
      sources: ["oura", "strava", "chatgpt"],
      span: "18 months",
    },
  ] as readonly PolarisExample[],
} as const;

export const ctaCopy = {
  headline: "see who you are becoming.",
  subline: "your data already holds the context.",
  enter: "enter",
} as const;

export const footerCopy = {
  brand: BRAND,
  copyright: "© 2026 PHENYX INC.",
  contactEmail: "contact@phenyxai.com",
  privacyLabel: "privacy",
  termsLabel: "terms",
  privacyHref: "/privacy-policy",
  termsHref: "/terms",
} as const;

export const entryModalCopy = {
  title: "come in",
  subtitle: "return to your view, or look around before you connect anything.",
  returning: { primary: "i have been here", secondary: "return to the view you already built", href: "/signin" },
  newcomer: { primary: "this is my first time", secondary: "nothing connects until you choose it", href: "/join" },
  closeLabel: "close",
} as const;
