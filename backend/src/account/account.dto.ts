/**
 * PHE-75 / PHE-97 — account close confirmation.
 *
 * Closing is irreversible and cascades every owned row, so it requires two
 * gates: a one-time code emailed to the account (it is you; PHE-97 replaced the
 * passphrase) and the typed sentence `delete my account` (you read what you are
 * doing). The phrase is compared lowercased and trimmed; any other value is
 * rejected before anything is touched.
 */
export const DELETE_CONFIRMATION_PHRASE = "delete my account";

export interface AccountCloseDto {
  code?: unknown;
  confirmation?: unknown;
}

/** True only when the body carries the typed confirmation phrase. */
export function isDeleteConfirmed(body: AccountCloseDto | undefined): boolean {
  return normalizeConfirmation(body?.confirmation) === DELETE_CONFIRMATION_PHRASE;
}

export function normalizeConfirmation(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Client/server close-account errors, in fill order (code then phrase). */
export function closeAccountError(
  code: string,
  confirmation: unknown
): string | null {
  if (!code.trim()) {
    return "enter the code we sent to your email.";
  }
  if (normalizeConfirmation(confirmation) !== DELETE_CONFIRMATION_PHRASE) {
    return `type ${DELETE_CONFIRMATION_PHRASE} exactly, to confirm.`;
  }
  return null;
}
