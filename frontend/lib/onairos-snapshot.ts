export function redactOnairosForProfile(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") {
    return {};
  }
  const o = { ...(input as Record<string, unknown>) };
  delete o.token;
  return o;
}
