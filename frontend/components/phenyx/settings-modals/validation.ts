/** Verbatim v67 modal errors. Never `alert`. */

export const DELETE_PHRASE = 'delete my account'

export function closeAccountClientError(
  passphrase: string,
  confirmation: string,
): string | null {
  if (!passphrase.trim()) {
    return 'enter your passphrase to confirm it is you.'
  }
  if (confirmation.trim().toLowerCase() !== DELETE_PHRASE) {
    return `type ${DELETE_PHRASE} exactly, to confirm.`
  }
  return null
}

export function passphraseChangeClientError(
  current: string,
  next: string,
  again: string,
): string | null {
  if (!current.trim()) {
    return 'enter your current passphrase to confirm it is you.'
  }
  if (!next.trim()) return 'enter a new passphrase.'
  if (next !== again) return 'the two new passphrases do not match.'
  if (next === current) {
    return 'that is your current passphrase. choose a different one.'
  }
  return null
}

export function profileEditClientError(passphrase: string): string | null {
  if (!passphrase.trim()) {
    return 'enter your passphrase to confirm the change.'
  }
  return null
}
