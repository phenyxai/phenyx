/** Longest display name we keep from a provider profile. */
const MAX_DISPLAY_NAME = 80;

/**
 * PHE-97 — the display name for a first-time OAuth (Google) user, read from the
 * provider's user_metadata as GoTrue stores it. Google sends `full_name` and
 * `name`; `given_name` / `family_name` are the fallback some accounts carry.
 * Returns null when the profile has no usable name, so the welcome screen falls
 * back to its generic greeting rather than showing an email local part.
 */
export function displayNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const read = (key: string): string => {
    const value = metadata[key];
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  };

  const name =
    read("full_name") ||
    read("name") ||
    [read("given_name"), read("family_name")].filter(Boolean).join(" ");

  return name ? name.slice(0, MAX_DISPLAY_NAME) : null;
}
