import { Logger } from "@nestjs/common";

const logger = new Logger("VoiceStandard");

/**
 * Plain-text guard + voice post-processing for every piece of prose Claude
 * writes (PHE-20, PHE-105).
 *
 * The dashboard renders model output via `textContent`, so any markup the model
 * slips into a response must be stripped before it is persisted or displayed.
 * Strips HTML tags, stray angle brackets, asterisks (markdown bold/italic), and
 * underscores — the markup forbidden by the Voice Standard's plain-text rule.
 *
 * Then applies the voice fixes that are safe to make blind: all lowercase with
 * PHENYX in caps, typographic apostrophes, and em dashes (or spaced hyphens and
 * en dashes) turned into commas. Year spans keep the spaced en dash (PHE-88).
 * Every other voice rule can't be fixed blind, so `voiceViolations` reports it
 * and `sanitizeProse` logs it for review when the caller names the surface.
 *
 * Exported as pure functions (no NestJS DI) so they are unit-testable in isolation.
 */
export function sanitizeProse(text: string, surface?: VoiceSurface): string {
  if (!text) return text;
  const clean = text
    .replace(/<[^>]*>/g, "") // strip HTML tags (<b>, <br>, etc.)
    .replace(/[<>]/g, "") // strip any remaining stray angle brackets
    .replace(/\*/g, "") // strip asterisks (markdown bold/italic markers)
    .replace(/_/g, "") // strip underscores (markdown emphasis markers)
    .toLowerCase()
    .replace(/\bphenyx\b/g, "PHENYX")
    // ponytail: every straight quote becomes ’, so a rare opening single quote does too
    .replace(/'/g, "’")
    .replace(DATE_SPAN, "$1 – $2") // year spans read "2016 – 2026"
    .replace(/(\d)\s*—\s*(\d)/g, "$1–$2") // other number ranges keep a dash
    .replace(/\s*—\s*|\s+[-–]\s+(?!\d)/g, ", ") // dashes between clauses become commas
    .replace(/,\s*([,.;:!?])/g, "$1") // a dash before punctuation leaves no stray comma
    .replace(/^,\s*/gm, "")
    .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces left by removals
    .trim();
  if (surface) {
    for (const v of voiceViolations(clean, surface)) {
      // Rule + a short excerpt only, never the full text or the user id.
      logger.warn(`[voice] ${surface} ${v.rule}: "${v.excerpt.slice(0, 60)}"`);
    }
  }
  return clean;
}

const DATE_SPAN = /\b(\d{4})\s*[-–—]\s*(\d{4})\b/g;

/** Visible year spans use the spaced en dash ("2016 – 2026"), never a hyphen or em dash. */
export function normalizeDateSpan(span: string): string {
  return span.replace(DATE_SPAN, "$1 – $2");
}

/** Every surface whose generated prose passes through `sanitizeProse`. */
export type VoiceSurface =
  | "pillar"
  | "portrait"
  | "trait"
  | "mantra"
  | "foresight"
  | "observation"
  | "polaris";

/** Sentence caps that match each surface's task prompt. Unlisted surfaces cap by lines or paragraphs instead. */
const SENTENCE_LIMITS: Partial<Record<VoiceSurface, number>> = {
  trait: 3,
  observation: 3,
  polaris: 3,
};

/** Rules a regex can spot but not safely rewrite. Text is already lowercased with ’ apostrophes. */
const RULES: Array<[rule: string, pattern: RegExp]> = [
  ["not-x-but-y", /\bnot\s+(?:just|only|merely|simply)\b[^.!?]*?\bbut\b/],
  ["not-x-but-y", /\b(?:it|this|that)’s\s+not\b[^.!?]*?[,;:]\s*(?:it|this|that)’s\b/],
  ["not-x-but-y", /\bnot\s+(?:a\s+|an\s+|the\s+)?\w+\s+but\s/],
  ["accounts", /\baccounts?\b/],
  ["record", /\brecord(?:s|ed|ing)?\b/],
  ["place-abbreviation", /\b(?:la|nyc|ny|sf|dc)\b|\b(?:l\.a|d\.c)\./],
  ["declares", /\byou(?:\s+are|’re)\s+(?:a|an|someone|somebody|the\s+(?:kind|type|sort)\s+of)\b/],
];

/**
 * Voice violations left in already-sanitized text. Each one names the rule and
 * the text that broke it. Empty when the text passes.
 */
export function voiceViolations(
  text: string,
  surface?: VoiceSurface
): Array<{ rule: string; excerpt: string }> {
  const out: Array<{ rule: string; excerpt: string }> = [];
  for (const [rule, pattern] of RULES) {
    const m = text.match(pattern);
    if (m) out.push({ rule, excerpt: m[0] });
  }

  // Choppy: three or more sentences in a row of four words or fewer.
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let run = 0;
  for (let i = 0; i < sentences.length; i++) {
    run = sentences[i].split(/\s+/).length <= 4 ? run + 1 : 0;
    if (run === 3) {
      out.push({ rule: "choppy", excerpt: sentences.slice(i - 2, i + 1).join(" ") });
    }
  }

  const limit = surface && SENTENCE_LIMITS[surface];
  if (limit && countSentences(text) > limit) {
    out.push({ rule: "length", excerpt: `${countSentences(text)} sentences, limit ${limit}` });
  }
  return out;
}

/**
 * Count sentence terminators (., !, ?), collapsing runs like "..." or "?!" into
 * one. Text with terminators but a trailing fragment still counts each terminator;
 * non-empty text with no terminator counts as a single sentence.
 */
export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  if (matches) return matches.length;
  return text.trim() ? 1 : 0;
}
