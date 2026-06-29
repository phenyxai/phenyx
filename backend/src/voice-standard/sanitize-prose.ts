/**
 * Plain-text guard for Polaris/observation/synthesis prose (PHE-20).
 *
 * The dashboard renders model output via `textContent`, so any markup the model
 * slips into a response must be stripped before it is persisted or displayed.
 * Strips HTML tags, stray angle brackets, asterisks (markdown bold/italic), and
 * underscores — the markup forbidden by the Voice Standard's plain-text rule.
 *
 * Exported as a pure function (no NestJS DI) so it is unit-testable in isolation.
 */
export function sanitizeProse(text: string): string {
  if (!text) return text;
  return text
    .replace(/<[^>]*>/g, "") // strip HTML tags (<b>, <br>, etc.)
    .replace(/[<>]/g, "") // strip any remaining stray angle brackets
    .replace(/\*/g, "") // strip asterisks (markdown bold/italic markers)
    .replace(/_/g, "") // strip underscores (markdown emphasis markers)
    .replace(/[ \t]{2,}/g, " ") // collapse runs of spaces left by removals
    .trim();
}
