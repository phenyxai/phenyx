// ============================================================================
// landing-copy.ts — central source of truth for the PHENYX landing page (PHE-5)
// ----------------------------------------------------------------------------
// Every visible landing string lives here, verbatim and lowercase. Keeping the
// copy in one constants module guarantees a component library (or an editor
// auto-format pass) can never silently title-case load-bearing marketing copy.
//
// Brand note: "collective" is cut — the brand is just PHENYX. Inline brand
// mentions are rendered uppercase by the consuming component via `BRAND`.
// ============================================================================

export const BRAND = "PHENYX";

// Section anchor ids — the single continuous landing screen (prototype `s0`).
// Nav links smooth-scroll to these; never a route change.
export const SECTION_IDS = {
  about: "s0-about",
  how: "s0-how",
  mission: "s0-mission",
  cta: "s0-cta",
  footer: "footer",
} as const;

export const navCopy = {
  brand: BRAND,
  logoAlt: "PHENYX",
  links: [
    { label: "a first look", targetId: SECTION_IDS.about },
    { label: "how it works", targetId: SECTION_IDS.how },
    { label: "your constellation", targetId: SECTION_IDS.mission },
    { label: "stay connected", targetId: SECTION_IDS.footer },
  ],
  enter: "enter",
} as const;

export const heroCopy = {
  preHeadline: "you are not one thing.",
  brand: BRAND,
  tagline: "where identity takes form",
  enter: "enter",
} as const;

export const manifestoCopy = {
  eyebrow: "a first look",
  paragraphs: [
    "you have built a life across the internet. no platform has ever shown you what it adds up to.",
    "every platform gave you a box. linkedin made you a resume. instagram made you an aesthetic. tiktok made you a moment. x made you an opinion.",
    "none of them made you whole.",
    "you have been fragmenting yourself for years, shrinking to fit, performing for algorithms that were never designed to understand you. just to engage you.",
    "this is not a personality quiz. this is not a report. this is a mirror.",
  ],
  // Emphasis line renders as: <BRAND> shows you who you actually are.
  emphasisSuffix: "shows you who you actually are.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how it works",
  headline: "we synthesize who you are across everything you have built.",
  // Subline renders as: <prefix><BRAND><suffix>
  sublinePrefix: "connect your platforms or tell us your story. either way ",
  sublineSuffix:
    " reads the patterns others miss and reflects back a portrait only you could have.",
  cards: [
    {
      layer: "layer one",
      title: "connect",
      body: "oauth integrations with instagram, linkedin, tiktok, x, spotify, youtube, github, and more. we read what you have already made, said, and shared across the internet.",
      radiusDesktop: "12px 0 0 0",
      radiusMobile: "12px",
    },
    {
      layer: "layer two",
      title: "synthesize",
      body: "our AI analyzes tone, language patterns, content themes, and pivotal moments across all sources. it finds the through-line in everything you have built and maps it to the seven pillars of your identity formation.",
      radiusDesktop: "0",
      radiusMobile: "0",
    },
    {
      layer: "layer three",
      title: "reflect",
      body: "the AI returns not a summary but a pattern. something that lands as i did not have words for that until now. it asks questions earned from your data, not generated from a template.",
      radiusDesktop: "0 12px 0 0",
      radiusMobile: "12px",
    },
  ],
  analyzeLabel: "what we analyze",
  analyzePills: [
    "tone and voice",
    "pivotal moments",
    "content evolution",
    "career transitions",
    "creative output",
    "the people you keep returning to.",
    "language over time",
  ],
  neverDoLabel: "what we never do",
  neverDoItems: [
    "store raw platform data. we process and discard. only synthesized insights are retained.",
    "access without consent. every connection is oauth-authorized and revocable at any time.",
    "assign you a label. PHENYX reflects. it never categorizes.",
  ],
} as const;

// The "your constellation" section is composed of MissionSection (intro copy +
// constellation canvas) and ProductPreviewSection (the live preview frame).
export const constellationCopy = {
  eyebrow: "your constellation",
  missionParagraphs: [
    "identity is not discovered. it is formed.",
    "what pulled you before you had words for it. who others saw before you did. what you built on purpose. where your worlds began to meet. what you are still becoming.",
    "you are not one thing. you are a pattern. most platforms only ever saw one piece of you.",
  ],
  // Emphasis line renders as: <BRAND> maps all of it.
  missionEmphasisSuffix: "maps all of it.",
  previewHeadline: "your identity. finally in one place.",
  previewSubline: "we help you connect it all through moments of reflection.",
  previewBrandLabel: BRAND,
  previewConstellationLabel: "your constellation",
  reflectLabel: "reflect.",
  // Lead copy for the Ask-Polaris Q&A widget (PHE-25). This module only owns the
  // copy + mount placement; the widget behavior is built in PHE-25.
  polarisLead: "dig deeper with polaris",
} as const;

export const ctaCopy = {
  headline: "see who you actually are.",
  subline: "connect your platforms and let the pattern reveal itself.",
  enter: "enter",
} as const;

export const footerCopy = {
  headline: "follow the build.",
  // Subline renders as: updates from inside the making of <BRAND>.
  sublinePrefix: "updates from inside the making of ",
  sublineSuffix: ".",
  emailPlaceholder: "your email",
  submitIdle: "i'm in",
  submitLoading: "...",
  followingSuccess: "you're following the build.",
  followingAlready: "you're following.",
  errorMessage: "something went wrong. try again.",
  errorRetry: "try again",
  copyright: "© 2026 PHENYX",
  contactEmail: "contact@phenyxai.com",
  logoAlt: "PHENYX",
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
