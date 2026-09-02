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
    { label: "first look", targetId: SECTION_IDS.about },
    { label: "how it works", targetId: SECTION_IDS.how },
    { label: "your constellation", targetId: SECTION_IDS.mission },
    { label: "polaris", targetId: SECTION_IDS.polaris },
  ],
  enter: "enter",
} as const;

export const heroCopy = {
  brand: BRAND,
  tagline: "your life, taking form",
  description: "see who you've been, across everything you already use.",
  enter: "enter",
  scroll: "scroll",
} as const;

export const manifestoCopy = {
  eyebrow: "first look",
  headline: "you were never in pieces, only in places",
  paragraphs: [
    "every place you use asks for one part of you: the listener, the maker, the one who saves things for later.",
    "each one keeps a version of you that is true, but not one shows what it all adds up to.",
    "so there has never been one place that holds all of you at once. every moment came from the same life, but nothing has ever gathered them in the same place.",
  ],
  thesis: "so we made one.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how it works",
  headline: "connect, assemble, reveal",
  lede: "three layers, and nothing invented in any of them.",
  layers: [
    {
      layer: "layer one",
      title: "connect",
      body: "what you listen to, watch, save, post and build, from only the places you choose.",
    },
    {
      layer: "layer two",
      title: "assemble",
      body: "everything lands on one timeline, so repeats and shifts finally sit next to each other.",
    },
    {
      layer: "layer three",
      title: "reveal",
      body: "the shape no single account could show, with the moments and evidence that made it visible.",
    },
  ],
  whatComesIntoViewLabel: "what comes into view",
  whatComesIntoView: [
    "what keeps returning",
    "what overlaps",
    "creative rhythms",
    "turning points",
    "how you decide",
    "what stays with you",
  ],
  whatStaysYoursLabel: "what stays yours",
  whatStaysYours: [
    {
      heading: "your control.",
      detail: "choose what comes in. disconnect whenever you want.",
    },
    {
      heading: "your privacy.",
      detail: "PHENYX keeps what it learned from your accounts, never a second copy of them.",
    },
    {
      heading: "your meaning.",
      detail: "PHENYX can show what is there. what it means stays yours.",
    },
  ],
} as const;

export const constellationCopy = {
  eyebrow: "your constellation",
  headline: "see how the parts of your life relate",
  paragraphs: [
    "a constellation is not the stars. it is the shape they make once you see them together.",
    "seven points run from where you began to where you are heading, each looking at one question through the evidence of your life.",
    "it is not a profile you finish. new things appear, old ones return, some fall away, and the shape keeps enough of you to notice when you change.",
  ],
  thesis: "the points stay the same. what fills them is yours.",
  visualizationLabel: "constellation, seven points of identity",
  exampleEyebrow: "the same seven, seen by time",
  exampleNote: "an example. yours is built only from the accounts you connect.",
  sevenPoints: ["origin", "emergence", "self-creation", "convergence", "becoming", "recognition", "transcendence"],
  // Legacy fields kept for unmounted components (ask-polaris-widget, product-preview-section) so tsc passes
  previewHeadline: "your identity. finally in one place.",
  previewSubline: "we help you connect it all through moments of reflection.",
  previewBrandLabel: BRAND,
  previewConstellationLabel: "your constellation",
  reflectLabel: "reflect.",
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

export const polarisCopy = {
  eyebrow: "polaris",
  headline: "follow one thread all the way through",
  paragraphs: [
    "the constellation lets you see yourself. polaris lets you use what you see. ask about something you keep returning to, or where it might be leading. polaris answers from the context already here, so you never start by explaining yourself.",
    "and when you arrive with no question, a few things come forward on their own.",
  ],
  thesis: "you bring the question. the context is already here.",
  defaultExample: {
    pillar: "convergence",
    question: "am i moving as fast as i think i am?",
    answer: "you tend to describe the work as fast, but what you save and return to has slowed steadily across three years, on both accounts.",
    sources: ["spotify", "pinterest"],
    span: "3 years / 2 sources",
  },
} as const;

export const ctaCopy = {
  headline: "look again",
  subline: "there is more of you here than you can currently see.",
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
  title: "come in",
  subtitle: "return to your view, or look around before you connect anything.",
  returning: {
    primary: "i have been here",
    secondary: "return to the view you already built",
    href: "/signin",
  },
  newcomer: {
    primary: "this is my first time",
    secondary: "nothing connects until you choose it",
    href: "/join",
  },
  closeLabel: "close",
} as const;
