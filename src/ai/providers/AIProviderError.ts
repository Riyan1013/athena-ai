/**
 * Categorizes why an AIProvider failed, so callers can react
 * appropriately (e.g. retry, surface a user-facing message) without
 * depending on any specific provider's error shapes.
 */
export type AIProviderErrorCode =
  | 'RATE_LIMITED'
  | 'MODEL_UNAVAILABLE'
  | 'AUTHENTICATION'
  | 'NETWORK'
  | 'INVALID_REQUEST'
  | 'UNKNOWN'

/**
 * Error thrown by any AIProvider implementation.
 *
 * Wrapping provider-specific errors in this single, provider-independent
 * type lets the rest of the application handle AI failures generically.
 */
export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode
  readonly retryAfterSeconds?: number

  constructor(
    code: AIProviderErrorCode,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message)

    this.name = 'AIProviderError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}
