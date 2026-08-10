const MAX_CHUNK_LENGTH = 1900

// Separator strategies in priority order: prefer splitting on paragraph
// breaks, fall back to single newlines, then spaces.
const SEPARATORS = ['\n\n', '\n', ' '] as const

/**
 * Splits text into chunks no longer than MAX_CHUNK_LENGTH, preferring to
 * break on paragraph breaks, then newlines, then spaces. Only splits in the
 * middle of a word if that word alone exceeds the limit.
 *
 * Pure function: no side effects, no external dependencies.
 */
export function splitMessage(text: string): string[] {
  if (!text.trim()) {
    return []
  }

  return splitBySeparator(text, 0)
}

// Recursively splits `text` using the separator at `separatorIndex`,
// falling back to the next separator (or a hard character split) as needed.
function splitBySeparator(text: string, separatorIndex: number): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text]
  }

  if (separatorIndex >= SEPARATORS.length) {
    // No separators left to try — the remaining text is a single unbreakable
    // unit (e.g. one long word) that exceeds the limit on its own.
    return splitHard(text)
  }

  const separator = SEPARATORS[separatorIndex]
  const parts = text.split(separator)

  if (parts.length === 1) {
    // This separator doesn't occur in the text; try the next one.
    return splitBySeparator(text, separatorIndex + 1)
  }

  const chunks: string[] = []
  let current = ''

  for (const part of parts) {
    if (part.length > MAX_CHUNK_LENGTH) {
      // This part is too big on its own — flush what we have, then split
      // it independently so we don't insert a misleading separator inside it.
      if (current.length > 0) {
        chunks.push(current)
        current = ''
      }
      chunks.push(...splitBySeparator(part, separatorIndex + 1))
      continue
    }

    const candidate =
      current.length > 0 ? `${current}${separator}${part}` : part

    if (candidate.length <= MAX_CHUNK_LENGTH) {
      current = candidate
    } else {
      chunks.push(current)
      current = part
    }
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}

// Last resort: split a single oversized, unbreakable chunk by raw length.
function splitHard(text: string): string[] {
  const chunks: string[] = []

  for (let i = 0; i < text.length; i += MAX_CHUNK_LENGTH) {
    chunks.push(text.slice(i, i + MAX_CHUNK_LENGTH))
  }

  return chunks
}
