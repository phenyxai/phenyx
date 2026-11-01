/** Verbatim v67 modal errors. Never `alert`. */

export const DELETE_PHRASE = 'delete my account'

/** PHE-163: closing asks only for the typed phrase; the emailed code is gone. */
export function closeAccountClientError(confirmation: string): string | null {
  if (confirmation.trim().toLowerCase() !== DELETE_PHRASE) {
    return `type ${DELETE_PHRASE} exactly, to confirm.`
  }
  return null
}
