// Landing copy. Source of record: the Oct 4 reference `phenyx_landing.html`
// (spec section 8), which supersedes the Sept 23 export. Its strings are used
// as they are, including the sample life inside the slides, which is
// illustrative and not a real person. The hero keeps its earlier copy.
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

export const navCopy = {
  brand: BRAND,
  menuLabel: "menu",
  links: [
    { label: "your life", targetId: SECTION_IDS.about },
    { label: "how it works", targetId: SECTION_IDS.how },
    { label: "your space", targetId: SECTION_IDS.promise },
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
  // one line from tablet up (see the CSS)
  headline: "your story is out there, scattered.",
  paragraphs: [
    "each platform holds a different side of you: your work on linkedin, the moments you share on instagram, the songs you return to on spotify.",
  ],
  emphasis: "PHENYX brings them together, so you can see your story across all of them.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how it works",
  headline: "follow what makes you curious.",
  subline: "look back, find connections, and explore what could come next.",
  orbitLabel: "the four parts of PHENYX",
  /** Prefix for each orbit point's accessible name: "show constellation". */
  orbitNodeLabel: "show",
  // Orbit order: 12, 3, 6 and 9 o'clock. The trail sweeps a quarter per slide.
  slides: [
    {
      kicker: "constellation",
      title: "how did i get here?",
      line: "revisit the moments when something began, changed, or found its way back",
    },
    {
      kicker: "insights",
      title: "what is starting to connect?",
      line: "step back and see what different parts of your life might have in common",
    },
    {
      kicker: "discover",
      title: "what else might i love?",
      line: "something you haven’t come across yet, but might be glad you did",
    },
    {
      kicker: "polaris",
      title: "where do i want to go next?",
      line: "a place to think it through, with some of your story already there",
    },
  ],
  stageMapLabel: "seven stages",
  /** Shown once the constellation has formed; touch screens have no hover. */
  stageHint: {
    hover: "hover over any point to see that part of your story.",
    touch: "tap any point to see that part of your story.",
  },
} as const;

export interface ConstellationStage {
  name: string;
  era: string;
  /** Empty for the point that hasn't happened yet. */
  years: string;
  question: string;
  /** One sentence reading the phase back to the person. */
  reading: string;
  /** Two dated signals, laid out side by side under the reading. */
  signals: readonly { when: string; platform: string; what: string }[];
}

// One example life read from platforms, newest from the top-down sources
// (latest linkedin post, recent chatgpt chats) back to the oldest (first
// likes on youtube, first saves on spotify). From the Oct 4 reference
// (phenyx_landing.html, v1600); illustrative, not a real person.
export const constellationStages: readonly ConstellationStage[] = [
  {
    name: "origin",
    era: "childhood",
    years: "2008–15",
    question: "who was i before anyone told me who to be?",
    reading: "you were curious and quiet, happiest making something on your own and then showing it to the people you loved.",
    signals: [
      { when: "first like, 2012", platform: "youtube", what: "a video on how film title sequences are made, watched long past bedtime." },
      { when: "first save, 2013", platform: "spotify", what: "the first song you ever saved is still in your library." },
    ],
  },
  {
    name: "emergence",
    era: "teenage years",
    years: "2016–19",
    question: "what did i start caring about on my own?",
    reading: "music and making became the way you understood yourself, and the way you found your first real friends.",
    signals: [
      { when: "2016", platform: "spotify", what: "the playlists you made for friends outnumber the ones you made for yourself." },
      { when: "2018", platform: "instagram", what: "your first posts are other people’s shows, shot from the front row." },
    ],
  },
  {
    name: "self-creation",
    era: "leaving home",
    years: "2020–22",
    question: "who did i become once i was on my own?",
    reading: "away from home, you started choosing your own rhythms, your own people, and the things you would never give up.",
    signals: [
      { when: "2020", platform: "pinterest", what: "a board for your first place, mostly warm light and secondhand chairs." },
      { when: "2021", platform: "reddit", what: "the local threads you joined became where you found your people." },
    ],
  },
  {
    name: "convergence",
    era: "a turning point",
    years: "2023",
    question: "when did the separate parts of me start to meet?",
    reading: "in one season, the work you loved, the people around you, and the way you spent your days all began pointing the same way.",
    signals: [
      { when: "spring 2023", platform: "chatgpt", what: "more of your questions turned to what you wanted to make next." },
      { when: "summer 2023", platform: "spotify", what: "one album played under almost every late night that year." },
    ],
  },
  {
    name: "becoming",
    era: "finding your voice",
    years: "2024–25",
    question: "how am i changing right now?",
    reading: "you are worrying less about how things look to others and trusting more of what feels true to you.",
    signals: [
      { when: "2024", platform: "instagram", what: "fewer posts and longer captions, with more of your own words." },
      { when: "2025", platform: "tiktok", what: "you started talking to the camera instead of filming around yourself." },
    ],
  },
  {
    name: "recognition",
    era: "today",
    years: "2025–now",
    question: "what has stayed with me the whole time?",
    reading: "the curious kid who made things to share is still here, only now you are teaching others to do the same.",
    signals: [
      { when: "latest post", platform: "linkedin", what: "you wrote about why you make things in public, and people shared it." },
      { when: "this month", platform: "chatgpt", what: "your questions keep circling back to how to teach what you know." },
    ],
  },
  {
    name: "transcendence",
    era: "what’s next",
    years: "",
    question: "where is this all leading?",
    reading: "everything so far seems to point toward making things that help people feel more understood.",
    signals: [
      { when: "lately", platform: "linkedin", what: "people keep reaching out to ask how you see their work." },
      { when: "recent chats", platform: "chatgpt", what: "you have started asking what it would take to build something of your own." },
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
    claim: "your quiet mornings are where things begin.",
    visual: { kind: "bars", pattern: "11011101111101111" },
    proof: "14 of the last 17 things you made and shared started before 9am, most of them on a sunday.",
    sources: ["instagram", "youtube", "spotify"],
    span: "18 months",
  },
  {
    claim: "you have always made things to share.",
    visual: {
      kind: "return",
      points: [
        { at: 5, label: "2014" },
        { at: 34, label: "2018" },
        { at: 62, label: "2023" },
        { at: 90, label: "now" },
      ],
    },
    proof: "from your first account at fourteen to the videos you post now, you keep making something and showing it to the people you love.",
    sources: ["instagram", "tiktok", "youtube"],
    span: "11 years",
  },
];

export const discoverFinds = [
  {
    kind: "a connection",
    name: "music for opening titles",
    description: "the composers who set the mood in the film openings you watched as a kid",
    why: "from youtube and your late-night playlists",
  },
  {
    kind: "a new direction",
    name: "sharing your process",
    description: "short videos of how something comes together, the kind you have watched since you were twelve",
    why: "from tiktok and your youtube mornings",
  },
  {
    kind: "something to try",
    name: "a zine for your city",
    description: "a few printed pages about the places and people that made somewhere new feel like home",
    why: "from pinterest and your local reddit threads",
  },
] as const;

export const polarisExample = {
  ask: "should i start sharing my process, or keep making things quietly for now?",
  answer:
    "you have been moving toward this for a while. your captions have grown longer, you talk to the camera more, and people keep asking how you see their work. what would feel like a small first step?",
  sources: ["instagram", "tiktok", "linkedin", "youtube"],
  span: "11 years",
  evidence: {
    label: "show me the evidence",
    title: "what this is built on",
    rows: [
      ["instagram", "fewer posts and longer captions since 2024, with more of your own words."],
      ["tiktok", "you started talking to the camera in 2025, and those are the videos people save."],
      ["linkedin", "people keep reaching out to ask how you see their work."],
    ],
  },
  plan: {
    label: "turn it into a plan",
    title: "your next four weeks",
    steps: [
      "week 1: pick one thing you are making and film how it comes together.",
      "weeks 2–3: share two short process videos and notice which moments people respond to.",
      "week 4: look back at what felt natural, then decide whether to keep going.",
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

// The stations are product promises, not decoration. What backs them today:
// each platform connects on its own in onboarding, settings → connections
// disconnects any of them, settings → data management exports everything
// (`/account/export`), and closing the account deletes it.
export const promiseCopy = {
  eyebrow: "your space",
  headline: "built around you.",
  lede: "built around your choices, your perspective, and your pace.",
  stations: [
    {
      title: "start with what feels right.",
      body: "choose which platforms to connect.",
      visual: {
        kind: "choose",
        toggles: [
          { name: "spotify", state: "on" },
          { name: "instagram", state: "flip" },
          { name: "youtube", state: "on" },
        ],
      },
    },
    {
      title: "here for you.",
      body: "the purpose is personal: to help you understand your life more clearly.",
      visual: { kind: "protect" },
    },
    {
      title: "trace the connections.",
      body: "see the sources behind every observation.",
      visual: { kind: "show", observation: "your mornings are where things begin", sources: ["instagram", "youtube"] },
    },
    {
      title: "your perspective matters.",
      body: "say what resonates, and add your own view.",
      visual: { kind: "decide", observation: "you have always made things to share", yes: "this is me", no: "not quite" },
    },
    {
      title: "room for change.",
      body: "change your mind anytime: disconnect platforms, export your data, or delete your account.",
      visual: { kind: "leave", accounts: ["spotify", "instagram", "youtube"] },
    },
  ] as readonly PromiseStation[],
} as const;

export const ctaCopy = {
  headline: "meet every version of you.",
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
