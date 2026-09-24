// Landing copy, ported from the Sept 23 landing export (internal pass v740).
//
// Source of record: `PHENYX main landing new.html` (2026-09-23), the landing-only
// export that supersedes the Sept 15 drop (ph550). v740 folds the separate
// constellation and polaris chapters into one orbit under "how it works",
// adds insights as a fourth part, and replaces the "what stays yours" band
// with an "our vision" chapter that walks the life of your data.
//
// Voice note: every string here is stored lowercase. Uppercase is a CSS concern
// (`text-transform`), matching how the prototype does it.
export const BRAND = "PHENYX";

export const SECTION_IDS = {
  top: "s0-top",
  about: "s0-about",
  how: "s0-how",
  promise: "s0-promise",
  cta: "s0-cta",
} as const;

/** The page's chapters, top to bottom. Scroll-spy and chapter focus both walk this. */
export const SECTION_ORDER = [
  SECTION_IDS.top,
  SECTION_IDS.about,
  SECTION_IDS.how,
  SECTION_IDS.promise,
  SECTION_IDS.cta,
] as const;

export const navCopy = {
  brand: BRAND,
  menuLabel: "menu",
  links: [
    { label: "your life", targetId: SECTION_IDS.about },
    { label: "how it works", targetId: SECTION_IDS.how },
    { label: "our vision", targetId: SECTION_IDS.promise },
  ],
  enter: "enter",
} as const;

export const heroCopy = {
  brand: BRAND,
  tagline: "your life, taking form.",
  // Two deliberate lines, not one wrapped sentence — the prototype splits these
  // into separate spans so the break survives every viewport.
  descriptionLines: ["see who you’ve been, understand who you are,", "and follow who you’re becoming."],
  enter: "enter",
} as const;

export const manifestoCopy = {
  eyebrow: "your life",
  headline: "parts of you are out there.",
  paragraphs: [
    "in the music you replay, the work you make, the things you save and the questions you ask, each place holding one piece of you.",
  ],
  emphasis: "PHENYX shows you what they make together.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how phenyx works",
  headline: "see the whole of who you are.",
  subline: "connect the places you choose. PHENYX uses them to answer four questions about your life.",
  orbitLabel: "the four parts of PHENYX",
  /** Prefix for each orbit point's accessible name: "show constellation". */
  orbitNodeLabel: "show",
  // Orbit order: 12, 3, 6 and 9 o'clock. The trail sweeps a quarter per slide.
  slides: [
    {
      kicker: "constellation",
      title: "how did i get here?",
      line: "your life in seven stages, built from your data, with the source behind every moment.",
    },
    {
      kicker: "insights",
      title: "why do i keep coming back to this?",
      line: "the patterns running across your accounts, and where each one came from.",
    },
    {
      kicker: "discover",
      title: "what else might i love?",
      line: "something new from beyond your data, chosen because of it.",
    },
    {
      kicker: "polaris",
      title: "what should i do next?",
      line: "ask about a decision or a plan. you never start from the beginning.",
    },
  ],
  stageMapLabel: "seven stages",
  stageHint: "click any point to open the years inside it.",
} as const;

export interface ConstellationStage {
  name: string;
  year: string;
  question: string;
  /** [source, moment]. Two per stage: the viewer lays them out side by side. */
  rows: readonly (readonly [string, string])[];
}

// The prototype's dataset carries a third row per stage for the full demo; the
// landing viewer only ever shows the first two, so only those are kept.
export const constellationStages: readonly ConstellationStage[] = [
  {
    name: "origin",
    year: "2016–17",
    question: "what was already there before i had words for it?",
    rows: [
      ["youtube", "you watched how title sequences were made, then called it wasting time."],
      ["spotify", "one album, played through every exam week since."],
    ],
  },
  {
    name: "emergence",
    year: "2018–20",
    question: "what started taking shape before i named it?",
    rows: [
      ["instagram", "you started posting the flyers instead of the nights out."],
      ["figma", "you opened it for a class project and never closed it."],
    ],
  },
  {
    name: "self-creation",
    year: "2020–22",
    question: "what did i begin choosing on purpose?",
    rows: [
      ["figma", "forty-one posters for campus events, all of them yours."],
      ["notion", "you started keeping a real project list, and finishing things."],
    ],
  },
  {
    name: "convergence",
    year: "2023",
    question: "which parts of my life started moving together?",
    rows: [
      ["chatgpt", "cognitive science questions and design questions in the same chats."],
      ["spotify", "the same three albums under every studio night."],
    ],
  },
  {
    name: "becoming",
    year: "2024–25",
    question: "what is changing in me right now?",
    rows: [
      ["figma", "posters give way to screens, and screens to prototypes."],
      ["chatgpt", '"is product design a real job for someone like me?" keeps returning.'],
    ],
  },
  {
    name: "recognition",
    year: "2025–now",
    question: "what has stayed with me the whole time?",
    rows: [
      ["pinterest", "you have been saving type since you were fifteen."],
      ["notion", "what you finish is what you start before noon on a sunday."],
    ],
  },
  {
    name: "transcendence",
    year: "ahead",
    question: "what larger direction is taking shape?",
    rows: [
      ["figma + chatgpt", "you keep making things that explain themselves."],
      ["instagram", "you explain the work now, and people reply."],
    ],
  },
];

/** Star positions in a 300×170 box, one per stage, and the lines between them by star index. */
export const constellationMap = {
  stars: [
    [48.2, 139.0],
    [115.2, 137.5],
    [64.2, 80.7],
    [117.8, 87.8],
    [179.5, 82.2],
    [230.4, 69.4],
    [251.8, 31.0],
  ],
  lines: [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ],
} as const satisfies { stars: readonly (readonly [number, number])[]; lines: readonly (readonly [number, number])[] };

export type InsightVisual =
  /** One character per finished project: "1" if it was started before 9am. */
  | { kind: "bars"; pattern: string }
  | { kind: "return"; points: readonly { at: number; label: string }[] };

export interface InsightPattern {
  claim: string;
  visual: InsightVisual;
  proof: string;
  sources: readonly string[];
  span: string;
}

export const insightPatterns: readonly InsightPattern[] = [
  {
    claim: "your best work happens before anyone else is awake.",
    visual: { kind: "bars", pattern: "11011101111101111" },
    proof: "14 of your last 17 finished projects were started before 9am. you have never once planned it that way.",
    sources: ["figma", "notion", "spotify"],
    span: "18 months",
  },
  {
    claim: "you have been saving the same thing since you were fifteen.",
    visual: {
      kind: "return",
      points: [
        { at: 5, label: "2018" },
        { at: 34, label: "2021" },
        { at: 62, label: "2023" },
        { at: 90, label: "now" },
      ],
    },
    proof: "type and posters, through three phones, two majors, and every app you moved into.",
    sources: ["pinterest", "instagram", "figma"],
    span: "7 years",
  },
];

export const discoverFinds = [
  {
    kind: "a rabbit hole",
    name: "kinetic typography",
    description: "type that moves, and why it reads differently once it does.",
    why: "because your saves keep drifting from posters to motion",
  },
  {
    kind: "an idea",
    name: "affordances",
    description: "why a door tells you to push before you touch it.",
    why: "because your two majors keep meeting in the same chats",
  },
  {
    kind: "a dare",
    name: "redesign the worst screen you used today",
    description: "one hour, one screen, before class.",
    why: "because your best work starts early and small",
  },
] as const;

export const polarisExample = {
  ask: "should i apply for the product design internship, or keep freelancing?",
  answer:
    "apply. the posters already taught you the craft, and the internship gives you the one thing freelancing cannot, which is watching someone senior make the calls you are still guessing at.",
  sources: ["figma", "linkedin", "notion", "chatgpt"],
  span: "7 years",
  evidence: {
    label: "show me the evidence",
    title: "what this is built on",
    rows: [
      ["figma", "forty-one posters, nine screens, and a prototype you rebuilt three times."],
      ["chatgpt", "you have asked whether this counts as a real job eleven times since march."],
      ["notion + spotify", "everything you finished began on a quiet sunday morning."],
    ],
  },
  plan: {
    label: "turn it into a plan",
    title: "your next four weeks",
    steps: [
      "keep sunday mornings for your own work. every project you finished started there.",
      "three screens from your own week, redesigned and written up, since your posts that explain the thinking are the ones people answer.",
      "apply by the fourteenth. we will ask again after, with the work in hand.",
    ],
  },
  backLabel: "back to the answer",
} as const;

export type PromiseVisual =
  | { kind: "choose"; toggles: readonly { name: string; state: "on" | "flip" }[] }
  | { kind: "protect" }
  | { kind: "show"; observation: string; sources: readonly string[] }
  | { kind: "decide"; observation: string; yes: string; no: string }
  | { kind: "leave"; accounts: readonly string[] };

export interface PromiseStation {
  title: string;
  body: string;
  visual: PromiseVisual;
}

// Privacy claims below are product promises, not decoration. What backs them
// today: source payloads and Polaris turns are AES-256-GCM at rest
// (`backend/src/common/encryption.service.ts`), and `/account/export` returns
// the whole account (settings → data management). "never sold" is policy.
export const promiseCopy = {
  eyebrow: "our vision",
  headline: "your life should stay yours.",
  lede: "what happens to your data, from the moment you connect to the moment you decide to go.",
  stations: [
    {
      title: "you choose.",
      body: "only the places you connect, one at a time.",
      visual: {
        kind: "choose",
        toggles: [
          { name: "spotify", state: "on" },
          { name: "instagram", state: "flip" },
          { name: "figma", state: "on" },
        ],
      },
    },
    {
      title: "we protect.",
      body: "encrypted wherever it rests or travels, and never sold.",
      visual: { kind: "protect" },
    },
    {
      title: "we show.",
      body: "every observation opens onto where it came from.",
      visual: { kind: "show", observation: "your best work starts early.", sources: ["figma", "notion"] },
    },
    {
      title: "you decide.",
      body: "whether something fits is always yours to say.",
      visual: { kind: "decide", observation: "type keeps coming back.", yes: "this is me", no: "not quite" },
    },
    {
      title: "you can leave.",
      body: "disconnect one account, or take all of it with you.",
      visual: { kind: "leave", accounts: ["spotify", "instagram", "figma"] },
    },
  ] as readonly PromiseStation[],
  close: "what's yours has always been yours.",
} as const;

export const ctaCopy = {
  headline: "see who you are becoming.",
  subline: "it is all already yours. come and see it whole.",
  enter: "enter",
} as const;

export const footerCopy = {
  brand: BRAND,
  copyright: "© 2026 PHENYX INC.",
  contactEmail: "contact@phenyxai.com",
} as const;

export const entryModalCopy = {
  title: "come in",
  subtitle: "return to your view, or look around before you connect anything.",
  returning: { primary: "i have been here", secondary: "return to the view you already built", href: "/signin" },
  newcomer: { primary: "this is my first time", secondary: "nothing connects until you choose it", href: "/join" },
  closeLabel: "close",
} as const;
