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
  emphasis: "so we made one.",
} as const;

export const howItWorksCopy = {
  eyebrow: "how it works",
  headline: "connect, assemble, reveal",
  subline: "three layers, and nothing invented in any of them.",
  cards: [
    { layer: "layer one", title: "connect", body: "what you listen to, watch, save, post and build, from only the places you choose." },
    { layer: "layer two", title: "assemble", body: "everything lands on one timeline, so repeats and shifts finally sit next to each other." },
    { layer: "layer three", title: "reveal", body: "the shape no single account could show, with the moments and evidence that made it visible." },
  ],
  signalsLabel: "what comes into view",
  signals: ["what keeps returning", "what overlaps", "creative rhythms", "turning points", "how you decide", "what stays with you"],
  privacyLabel: "what stays yours",
  privacyItems: [
    { promise: "your control.", detail: "choose what comes in. disconnect whenever you want." },
    { promise: "your privacy.", detail: "PHENYX keeps what it learned from your accounts, never a second copy of them." },
    { promise: "your meaning.", detail: "PHENYX can show what is there. what it means stays yours." },
  ],
} as const;

export const constellationCopy = {
  eyebrow: "your constellation",
  headline: "see how the parts of your life relate",
  lines: [
    "a constellation is not the stars. it is the shape they make once you see them together.",
    "seven points run from where you began to where you are heading, each looking at one question through the evidence of your life.",
    "it is not a profile you finish. new things appear, old ones return, some fall away, and the shape keeps enough of you to notice when you change.",
  ],
  emphasis: "the points stay the same. what fills them is yours.",
  visualizationLabel: "Seven-point constellation: origin, emergence, self-creation, convergence, becoming, recognition, and transcendence.",
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
  rows: readonly (readonly [string, string, string])[];
  observation: string;
  star?: string;
  starSub?: string;
}

export const constellationPoints: readonly ConstellationPoint[] = [
  {
    name: "origin", year: "2016–17", question: "what has been with me longer than i realized?", summary: "four things arrive, none of them chosen.",
    rows: [
      ["mar 2016", "spotify", "one album, 214 plays that year, the one you still put on to work"],
      ["aug 2016", "youtube", "forty hours on colour grading, then nothing at all for three years"],
      ["feb 2017", "pinterest", "a board you name someday, nine saves, every one a room at dusk"],
      ["nov 2017", "instagram", "your first photograph with no people in it, taken at six in the morning"],
    ],
    observation: "none of these was a decision. three of the four are about light, and you would not say that word for another five years.",
  },
  {
    name: "emergence", year: "2018–20", question: "what was becoming important before i named it?", summary: "four accounts, one subject.",
    rows: [
      ["apr 2018", "pinterest", "three hundred and forty saves that spring, sixty-one of them the same doorway at different hours"],
      ["sep 2018", "letterboxd", "forty films rated, and the four you rewatched share one cinematographer"],
      ["jun 2019", "instagram", "you stop posting at midday and start posting within an hour of sunrise"],
      ["jan 2020", "youtube", "you stop watching interviews and start watching people light a set, six hours to seventy-one"],
    ],
    observation: "you called yourself a photographer in 2021. the evidence says colourist, and it starts in april 2018.",
  },
  {
    name: "self-creation", year: "2020–22", question: "what have i built on purpose?", summary: "the first thing that does not stop.",
    rows: [
      ["may 2020", "github", "your ninth repository, a grading tool, and the first with a commit after day thirty"],
      ["oct 2020", "instagram", "the ratio inverts, from eighty percent other people's frames to seventy-six percent your own"],
      ["jun 2021", "youtube", "four hundred and twelve hours on grading, ninety-one percent of it before nine in the morning"],
      ["mar 2022", "linkedin", "you put the word colourist in your title, five years after the first forty hours"],
    ],
    observation: "the eight repositories you abandoned are what make the ninth mean something. from first frame to naming yourself took five years.",
  },
  {
    name: "convergence", year: "2023", question: "which parts of my life are less separate than they seem?", summary: "six weeks where all of it moves at once.",
    rows: [
      ["feb 2023", "pinterest", "one hundred and ninety saves in fourteen days, every one an interior, then three the month after"],
      ["mar 2023", "spotify", "the album from 2016 becomes the only thing you play while grading"],
      ["mar 2023", "chatgpt", "the same question four times in seven days, about working for yourself"],
      ["apr 2023", "strava", "your first run in eleven months, then forty-three in twelve weeks, all before nine"],
    ],
    observation: "the reference, the music, the question and the hour all turned inside six weeks. none of the four accounts could see the other three, so at the time it felt like four unrelated moods.",
  },
  {
    name: "becoming", year: "2024–25", question: "what is changing in me right now?", summary: "the turn is still happening.",
    rows: [
      ["feb 2024", "strava", "distance up every month for eleven months, still before nine"],
      ["may 2024", "chatgpt", "how do i falls from sixty-eight percent of what you ask to thirty-one, and should i rises from four to twenty-nine"],
      ["sep 2024", "pinterest", "the someday board takes thirty-one saves after seven years of fewer than five"],
      ["feb 2025", "netflix", "three new series abandoned inside two episodes, and four you know rewatched for the lighting"],
    ],
    observation: "the questions changed four months before the work did, and the board that woke up is the one you named someday in 2017. this is a return, not a beginning.",
  },
  {
    name: "recognition", year: "2025–now", question: "what has stayed consistent long enough for me to see it?", summary: "what was never loud enough to notice in one year.",
    rows: [
      ["nine years", "spotify", "the 2016 album appears in every year since, never above three percent, never absent"],
      ["seven years", "pinterest", "three colours across nineteen boards, sixty-one percent of everything you save"],
      ["five years", "github", "thirty-four of your forty-one finished projects landed in november"],
      ["four years", "oura", "your steadiest sleep weeks are your highest output weeks, seventy-eight percent of the time"],
    ],
    observation: "you work at dawn, you finish in november, and you have saved the same three colours since before you owned a camera. this is the method you have been trying to describe since 2022.",
  },
  {
    name: "transcendence", year: "ahead", question: "who am i becoming, and where is this going?", summary: "where the other six are already pointing.",
    star: "someone who makes the thing they have been looking at since 2016.",
    starSub: "three directions are open, and this is the one with nine years behind it.",
    rows: [
      ["most evidence", "youtube, github", "the craft. forty hours in 2016 became four hundred in 2021, and it has not stopped"],
      ["gaining", "strava, oura", "the life around it. body and work have kept the same hours since 2023"],
      ["still open", "pinterest", "the someday board, named in 2017, opened again last year"],
    ],
    observation: "origin handed you four accidents and three of them were the same thing. every stage since has been that one thing getting clearer, and the direction you feed is the one that becomes you.",
  },
] as const;

export const polarisCopy = {
  eyebrow: "polaris",
  headline: "follow one thread all the way through",
  leadStrong: "the constellation lets you see yourself. polaris lets you use what you see.",
  lead: "ask about something you keep returning to, or where it might be leading. polaris answers from the context already here, so you never start by explaining yourself.",
  observation: "and when you arrive with no question, a few things come forward on their own.",
  thesis: "you bring the question. the context is already here.",
  examples: [
    { pillar: "convergence", question: '"am i moving as fast as i think i am?"', answer: "you tend to describe the work as fast, but what you save and return to has slowed steadily across three years, on both accounts.", emphasis: "three years", sources: ["spotify", "pinterest"], span: "3 years / 2 sources" },
    { pillar: "becoming", question: '"is there any warning before something shifts in me?"', answer: "yes. what you listen to drops in tempo about nine days before you go quiet. it has held 14 of the last 17 times.", emphasis: "nine days", sources: ["spotify", "instagram"], span: "17 releases / 3 years" },
    { pillar: "origin", question: '"what was actually going on with me in 2019?"', answer: "march 2019 is where it turns. shoegaze fell from 40% of your listening to under 3%, and what replaced it is what you still play today.", emphasis: "march 2019", sources: ["spotify", "pinterest"], span: "march 2019 / 11 years" },
  ],
} as const;

export const ctaCopy = { headline: "look again", subline: "there is more of you here than you can currently see.", enter: "enter" } as const;

export const footerCopy = {
  copyright: "© 2026 PHENYX INC.", contactEmail: "contact@phenyxai.com", privacyLabel: "privacy", termsLabel: "terms", privacyHref: "/privacy-policy", termsHref: "/terms",
} as const;

export const entryModalCopy = {
  title: "come in",
  subtitle: "return to your view, or look around before you connect anything.",
  returning: { primary: "i have been here", secondary: "return to the view you already built", href: "/signin" },
  newcomer: { primary: "this is my first time", secondary: "nothing connects until you choose it", href: "/join" },
  closeLabel: "close",
} as const;
