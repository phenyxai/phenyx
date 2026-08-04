// Central source of truth for every visible string on the public landing page.
export const BRAND = "PHENYX";

export const SECTION_IDS = {
  top: "s0-top",
  about: "s0-about",
  how: "s0-how",
  mission: "s0-mission",
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
    { label: "stay connected", targetId: SECTION_IDS.cta },
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
  headline: "who are you, really?",
  paragraphs: [
    "every platform gave you a box.",
    "linkedin made you a professional. instagram made you an aesthetic. tiktok made you a moment. x made you an opinion.",
    "you have built a life across the internet, but no one has ever shown you what it all adds up to.",
  ],
  emphasis: "PHENYX does.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how it works",
  headline: "connect. synthesize. reveal.",
  subline: "three layers between what you have already done and what it says about you.",
  cards: [
    {
      layer: "layer one",
      title: "connect",
      body: "connect chatgpt, spotify, instagram, linkedin and more. connect as many as you want, whenever you want, and we take it from there. nothing to fill in, nothing to answer.",
    },
    {
      layer: "layer two",
      title: "synthesize",
      body: "we put everything on one timeline, so any week can be seen from every place you were at once. what one account misses, another one shows.",
    },
    {
      layer: "layer three",
      title: "reveal",
      body: "what we find becomes an observation on your constellation, with the dates and sources behind it. ask polaris about any of it and it answers from your record, not a guess.",
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
      promise: "take ownership of your records.",
      detail:
        "your encrypted source records remain yours. they are retained so every observation can be traced and regenerated, and deleted when you delete them.",
    },
    {
      promise: "retain your account credentials.",
      detail:
        "we never retain your account credentials. oauth and jwt access remain with the connection provider.",
    },
    {
      promise: "reach anything you have not opened.",
      detail:
        "every connection is authorized by you and revocable the moment you change your mind.",
    },
    {
      promise: "sort you into a type.",
      detail:
        "everything else here ends by putting you in a box. we end by showing you the evidence.",
    },
  ],
} as const;

export const constellationCopy = {
  eyebrow: "your constellation",
  headline: "an outline of who you are.",
  lines: [
    "the week your taste changed. the month you stopped finishing things. the year you started again.",
    "seven points hold all of it, dated, with what sat around each one.",
    "this is the first time you see it drawn.",
  ],
  visualizationLabel: "constellation — seven points of identity",
  // Kept for the unrendered legacy ProductPreviewSection module. The v66 page
  // intentionally does not mount that fake product frame.
  previewHeadline: "your identity. finally in one place.",
  previewSubline: "we help you connect it all through moments of reflection.",
  previewBrandLabel: BRAND,
  previewConstellationLabel: "your constellation",
  reflectLabel: "reflect.",
  polarisHeading: "explore with polaris",
  polarisLead:
    "every other ai starts by asking who you are. polaris starts with what you want to understand, because it already has the rest.",
  polarisExamples: [
    {
      pillar: "becoming",
      question: '"why does this keep happening?"',
      answer:
        "it's not separation. it's rehearsal. this is what you sound like before you're ready to say something out loud.",
      emphasis: "this is what you sound like before you're ready to say something out loud.",
      sources: ["search history", "spotify"],
      span: "19 months",
    },
    {
      pillar: "origin",
      question: '"why have the same three songs been on repeat for years whenever i’m overwhelmed?"',
      answer:
        "those songs were never comfort. they're a reset button. you reach for them right before your best decisions, not your worst ones.",
      emphasis: "you reach for them right before your best decisions, not your worst ones.",
      sources: ["spotify", "youtube"],
      span: "consistent pattern / 3+ years",
    },
    {
      pillar: "emergence",
      question: '"why did people start treating me differently before i felt like anything had changed?"',
      answer:
        "they weren't reacting to something new. they were finally catching up to something that had been building for a while. you were the last one to notice what everyone else could already see.",
      emphasis: "you were the last one to notice what everyone else could already see.",
      sources: ["instagram", "github"],
      span: "visible shift / building for months",
    },
    {
      pillar: "recognition",
      question: '"why do people open up to me so fast, even online?"',
      answer:
        "you ask one real question before anyone expects it. most people wait for permission to be that direct. you've just never needed it.",
      emphasis: "you've just never needed it.",
      sources: ["reddit", "linkedin"],
      span: "40+ threads / recurring",
    },
  ],
} as const;

export const ctaCopy = {
  headline: "ready to see what it adds up to?",
  subline: "join the beta and be among the first to see your constellation.",
  enter: "enter",
} as const;

export const footerCopy = {
  copyright: "© 2026 PHENYX",
  contactEmail: "contact@phenyxai.com",
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
