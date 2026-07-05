/**
 * PHE-42 — account DELETE confirmation.
 *
 * Delete is irreversible and cascades every owned row, so it requires an explicit
 * typed confirmation. The client must send exactly `confirmation: "DELETE"`; any
 * other value (or an absent field) is rejected before any data is touched.
 */
export const DELETE_CONFIRMATION_PHRASE = "DELETE";

export interface AccountDeleteDto {
  confirmation?: unknown;
}

/** True only when the body carries the exact literal confirmation phrase. */
export function isDeleteConfirmed(body: AccountDeleteDto | undefined): boolean {
  return body?.confirmation === DELETE_CONFIRMATION_PHRASE;
}
