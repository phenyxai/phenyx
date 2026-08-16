/**
 * PHE-75 — account close confirmation.
 *
 * Closing is irreversible and cascades every owned row, so it requires two
 * gates: the current passphrase (it is you) and the typed sentence
 * `delete my account` (you read what you are doing). The phrase is compared
 * lowercased and trimmed; any other value is rejected before anything is touched.
 */
export const DELETE_CONFIRMATION_PHRASE = "delete my account";

export interface AccountCloseDto {
  passphrase?: unknown;
  confirmation?: unknown;
}

export interface AccountPassphraseChangeDto {
  currentPassphrase?: unknown;
  newPassphrase?: unknown;
}

/** True only when the body carries the typed confirmation phrase. */
export function isDeleteConfirmed(body: AccountCloseDto | undefined): boolean {
  return normalizeConfirmation(body?.confirmation) === DELETE_CONFIRMATION_PHRASE;
}

export function normalizeConfirmation(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function readPassphrase(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Client/server close-account errors, in fill order (passphrase then phrase). */
export function closeAccountError(
  passphrase: string,
  confirmation: unknown
): string | null {
  if (!passphrase.trim()) {
    return "enter your passphrase to confirm it is you.";
  }
  if (normalizeConfirmation(confirmation) !== DELETE_CONFIRMATION_PHRASE) {
    return `type ${DELETE_CONFIRMATION_PHRASE} exactly, to confirm.`;
  }
  return null;
}

/** Passphrase-change errors, in fill order. */
export function passphraseChangeError(
  current: string,
  next: string,
  again?: string
): string | null {
  if (!current.trim()) {
    return "enter your current passphrase to confirm it is you.";
  }
  if (!next.trim()) {
    return "enter a new passphrase.";
  }
  if (again !== undefined && next !== again) {
    return "the two new passphrases do not match.";
  }
  if (next === current) {
    return "that is your current passphrase. choose a different one.";
  }
  return null;
}
