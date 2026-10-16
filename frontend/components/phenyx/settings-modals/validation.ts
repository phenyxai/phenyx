/** Verbatim v67 modal errors. Never `alert`. */

export const DELETE_PHRASE = 'delete my account'

/** PHE-97: the emailed confirm code replaced the passphrase. */
export const CODE_MISSING = 'enter the code we sent to your email.'

export function closeAccountClientError(
  code: string,
  confirmation: string,
): string | null {
  if (!code.trim()) return CODE_MISSING
  if (confirmation.trim().toLowerCase() !== DELETE_PHRASE) {
    return `type ${DELETE_PHRASE} exactly, to confirm.`
  }
  return null
}

export function profileEditClientError(code: string): string | null {
  if (!code.trim()) return CODE_MISSING
  return null
}
