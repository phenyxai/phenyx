// Central source of truth for every visible string on the public landing page.
export const BRAND = "PHENYX";

export const SECTION_IDS = {
  top: "s0-top",
  about: "s0-about",
  how: "s0-how",
  mission: "s0-mission",
  polaris: "s0-polaris",
  cta: "s0-cta",
  footer: "footer",
} as const;

export const navCopy = {
  brand: BRAND,
  logoAlt: "PHENYX",
  menuLabel: "menu",
  links: [
    { label: "a first look", targetId: SECTION_IDS.about },
    { label: "how it works", targetId: SECTION_IDS.how },
    { label: "your constellation", targetId: SECTION_IDS.mission },
    { label: "polaris", targetId: SECTION_IDS.polaris },
  ],
  enter: "enter",
} as const;

export const heroCopy = {
  preHeadline: "you have been leaving evidence for years.",
  brand: BRAND,
  tagline: "an identity observatory.",
  enter: "enter",
  scroll: "scroll",
} as const;

export const manifestoCopy = {
  eyebrow: "a first look",
  headline: "you have come further than you can see.",
  paragraphs: [
    "linkedin made you a professional. instagram made you an aesthetic. tiktok made you a moment. x made you an opinion.",
    "every account holds a piece. none of them hold the shape.",
  ],
  emphasis: "PHENYX reads the accounts you already have and puts all of it in one place. one view of how far you have come.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how it works",
  headline: "connect. synthesize. reveal.",
  subline: "you connect the accounts you already use. PHENYX reads them and builds the rest. there is nothing to fill out.",
  cards: [
    {
      layer: "layer one",
      title: "connect",
      body: "you link the accounts you already use. spotify, instagram, linkedin, chatgpt and more, as many or as few as you want. you can disconnect any of them at any time.",
    },
    {
      layer: "layer two",
      title: "synthesize",
      body: "everything you connect goes onto one timeline. who you have been, what you kept making, when it changed, and where it came from.",
    },
    {
      layer: "layer three",
      title: "reveal",
      body: "the timeline becomes your constellation, dated, with the sources behind every point. ask polaris about any of it and the answer comes from your record, not a guess.",
    },
  ],
  analyzeLabel: "what we analyze",
  analyzePills: [
    "tone and voice",
    "pivotal moments",
    "content evolution",
    "career transitions",
    "creative output",
    "network patterns",
    "language over time",
  ],
  privacyLabel: "what we never do",
  privacyItems: [
    {
      promise: "keep your raw signals.",
      detail: "read once. only the observations stay, with the dates behind them.",
    },
    {
      promise: "reach anything you have not opened.",
      detail: "every connection is yours to revoke.",
    },
    {
      promise: "sort you into a type.",
      detail: "no archetype, no score, no label you did not write.",
    },
    {
      promise: "let one thing stand for all of it.",
      detail: "no single point is a verdict.",
    },
  ],
} as const;

export const constellationCopy = {
  eyebrow: "your constellation",
  headline: "an outline of who you are.",
  lines: [
    "the week your taste changed. the month you stopped finishing things. the year you started again.",
    "seven points hold all of it, dated, with what sat around each one. the seven are the same for everyone. what fills them is not.",
    "this is the first time you see it drawn.",
  ],
  visualizationLabel: "constellation, seven points of identity",
  // Kept for the unrendered legacy ProductPreviewSection module. The v66 page
  // intentionally does not mount that fake product frame.
  previewHeadline: "your identity. finally in one place.",
  previewSubline: "we help you connect it all through moments of reflection.",
  previewBrandLabel: BRAND,
  previewConstellationLabel: "your constellation",
  reflectLabel: "reflect.",
  polarisHeading: "explore with polaris",
  polarisLead:
    "every other ai starts by asking who you are. polaris starts with what you want to understand, because it has already read the rest.",
  polarisExamples: [
    {
      pillar: "convergence",
      question: '"why does my work feel like two different people made it?"',
      answer:
        "the split is dated. everything before june reads one way and everything after reads another, and the turn took about three weeks.",
      emphasis: "june",
      sources: ["instagram", "youtube"],
      span: "june 2025 / 4 years",
    },
    {
      pillar: "becoming",
      question: '"is there any warning before something shifts in me?"',
      answer:
        "yes. what you listen to drops in tempo about nine days before you go quiet. it has held 14 of the last 17 times.",
      emphasis: "nine days",
      sources: ["spotify", "instagram"],
      span: "17 releases / 3 years",
    },
    {
      pillar: "origin",
      question: '"what was actually going on with me in 2019?"',
      answer:
        "march 2019 is where it turns. shoegaze fell from 40% of your listening to under 3%, and what replaced it is what you still play today.",
      emphasis: "march 2019",
      sources: ["spotify", "pinterest"],
      span: "march 2019 / 11 years",
    },
    {
      pillar: "recognition",
      question: '"how do people actually see my work?"',
      answer:
        "twelve people across youtube and instagram described your work as patient this year. you have never used the word yourself.",
      emphasis: "patient",
      sources: ["youtube", "instagram"],
      span: "12 people / 6 months",
    },
  ],
} as const;

export const ctaCopy = {
  headline: "what does it add up to?",
  subline: "you already have the answer. this is where you see it.",
  enter: "enter",
} as const;

export const footerCopy = {
  copyright: "© 2026 PHENYX INC.",
  contactEmail: "contact@phenyxai.com",
  privacyLabel: "privacy",
  termsLabel: "terms",
  privacyHref: "/privacy-policy",
  termsHref: "/terms",
} as const;

export const entryModalCopy = {
  title: "welcome to PHENYX.",
  subtitle: "have you been here before?",
  returning: {
    primary: "i'm a returning user",
    secondary: "sign in to your constellation",
    href: "/signin",
  },
  newcomer: {
    primary: "i'm new here",
    secondary: "create your account",
    href: "/join",
  },
  closeLabel: "close",
} as const;
