import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** PHE-163: the type roles are font sizes, so a color class beside one never drops it. */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['display', 'title', 'heading', 'reading', 'item', 'body', 'meta'] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
