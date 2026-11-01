/**
 * PHE-75 / PHE-163 — account close confirmation.
 *
 * Closing is irreversible and cascades every owned row. The signed-in session
 * says it is you, and the typed sentence `delete my account` says you read
 * what you are doing (PHE-163 dropped the emailed code). The phrase is
 * compared lowercased and trimmed; any other value is rejected before
 * anything is touched.
 */
export const DELETE_CONFIRMATION_PHRASE = "delete my account";

export interface AccountCloseDto {
  confirmation?: unknown;
}

/** True only when the body carries the typed confirmation phrase. */
export function isDeleteConfirmed(body: AccountCloseDto | undefined): boolean {
  return normalizeConfirmation(body?.confirmation) === DELETE_CONFIRMATION_PHRASE;
}

export function normalizeConfirmation(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** The close-account error when the phrase isn't typed, else null. */
export function closeAccountError(confirmation: unknown): string | null {
  if (normalizeConfirmation(confirmation) !== DELETE_CONFIRMATION_PHRASE) {
    return `type ${DELETE_CONFIRMATION_PHRASE} exactly, to confirm.`;
  }
  return null;
}
