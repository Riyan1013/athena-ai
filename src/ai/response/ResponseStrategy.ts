export type ResponseMode = 'short' | 'normal' | 'detailed'

export function determineResponseMode(message: string): ResponseMode {
  const normalized = message.toLowerCase()

  const detailedIndicators = [
    'in detail',
    'detailed',
    'deep dive',
    'comprehensive',
    'step by step',
    'analyze',
    'analysis',
    'thoroughly',
  ]

  if (detailedIndicators.some((indicator) => normalized.includes(indicator))) {
    return 'detailed'
  }

  const shortIndicators = [
    'what is',
    'what are',
    'who is',
    'who are',
    'define',
    'what does',
    'meaning of',
  ]

  if (shortIndicators.some((indicator) => normalized.startsWith(indicator))) {
    return 'short'
  }

  return 'normal'
}
