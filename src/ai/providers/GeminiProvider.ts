import { ApiError, GoogleGenAI } from '@google/genai'
import type { GenerateContentResponse } from '@google/genai'

import { env } from '../../config/env.js'
import type { AIProvider } from './AIProvider.js'
import { AIProviderError } from './AIProviderError.js'
import type { AIProviderErrorCode } from './AIProviderError.js'

const MODEL_NAME = 'gemini-2.5-flash'

// System-level error codes (Node.js / undici) that reliably indicate a
// genuine network/connection/timeout failure rather than an application error.
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
])

/**
 * Google Gemini implementation of the AIProvider contract.
 */
export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured.')
    }

    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  }

  async generateResponse(
    prompt: string,
    maxOutputTokens?: number,
  ): Promise<string> {
    const startedAt = Date.now()

    // Short-response requests (a maxOutputTokens cap is set) don't need
    // Gemini's extended reasoning, so thinking is disabled for them.
    // Unbounded requests keep the model's default thinking behavior.
    const thinkingBudget = maxOutputTokens === undefined ? undefined : 0

    let result: GenerateContentResponse

    try {
      result = await this.client.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          maxOutputTokens,
          thinkingConfig:
            thinkingBudget === undefined ? undefined : { thinkingBudget },
        },
      })
    } catch (error) {
      // Full detail goes to the logs; the thrown error stays provider-neutral.
      console.error('Gemini request failed:', error)
      throw toAIProviderError(error)
    }

    const latency = Date.now() - startedAt
    const usage = result.usageMetadata

    if (usage) {
      console.log(`
🦉 Athena Usage
────────────────────────────────
Model            : ${MODEL_NAME}
Prompt Tokens    : ${usage.promptTokenCount}
Response Tokens  : ${usage.candidatesTokenCount}
Total Tokens     : ${usage.totalTokenCount}
Latency          : ${latency} ms
────────────────────────────────
`)
    }

    return result.text ?? ''
  }
}

// Translates a Gemini/@google/genai error into our provider-independent
// AIProviderError. Kept file-local since only GeminiProvider needs it.
function toAIProviderError(error: unknown): AIProviderError {
  if (error instanceof ApiError) {
    const code = mapStatusToCode(error.status)
    const retryAfterSeconds =
      code === 'RATE_LIMITED'
        ? extractRetryAfterSeconds(error.message)
        : undefined

    return new AIProviderError(
      code,
      messageForCode(code, error.status),
      retryAfterSeconds,
    )
  }

  if (error instanceof Error) {
    // Only a confirmed network/connection/timeout failure is classified as
    // NETWORK. A generic JavaScript Error with no known cause is UNKNOWN —
    // we don't guess based on error message text.
    if (isNetworkError(error)) {
      return new AIProviderError(
        'NETWORK',
        'A network error occurred while contacting the AI provider.',
      )
    }

    return new AIProviderError(
      'UNKNOWN',
      'An unexpected error occurred while contacting the AI provider.',
    )
  }

  return new AIProviderError(
    'UNKNOWN',
    'An unexpected error occurred while contacting the AI provider.',
  )
}

// Detects a genuine network/connection/timeout failure via structured,
// well-known error signals (Node/undici error codes, DOM abort/timeout
// names) — never by matching on error message text.
function isNetworkError(error: Error): boolean {
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return true
  }

  const cause = (error as { cause?: unknown }).cause

  if (cause && typeof cause === 'object' && 'code' in cause) {
    const code = (cause as { code?: unknown }).code
    return typeof code === 'string' && NETWORK_ERROR_CODES.has(code)
  }

  return false
}

function mapStatusToCode(status: number): AIProviderErrorCode {
  switch (status) {
    case 429:
      return 'RATE_LIMITED'
    case 404:
      return 'MODEL_UNAVAILABLE'
    case 401:
    case 403:
      return 'AUTHENTICATION'
    case 400:
      return 'INVALID_REQUEST'
    default:
      return 'UNKNOWN'
  }
}

function messageForCode(code: AIProviderErrorCode, status: number): string {
  switch (code) {
    case 'RATE_LIMITED':
      return 'The AI provider is rate limiting requests.'
    case 'MODEL_UNAVAILABLE':
      return 'The requested AI model is unavailable.'
    case 'AUTHENTICATION':
      return 'Authentication with the AI provider failed.'
    case 'INVALID_REQUEST':
      return 'The AI provider rejected the request as invalid.'
    default:
      return `The AI provider returned an unexpected error (HTTP ${status}).`
  }
}

// Attempts to read a google.rpc.RetryInfo-style "retryDelay" (e.g. "23s")
// out of a Gemini error message. Returns undefined if it isn't present or
// can't be safely parsed — retry info is never assumed to exist.
function extractRetryAfterSeconds(rawMessage: string): number | undefined {
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: { details?: Array<Record<string, unknown>> }
    }

    const details = parsed.error?.details ?? []
    const retryDelay = details
      .map((detail) => detail.retryDelay)
      .find((value): value is string => typeof value === 'string')

    if (!retryDelay) {
      return undefined
    }

    const match = /^(\d+(?:\.\d+)?)s$/.exec(retryDelay)
    if (!match) {
      return undefined
    }

    return Math.ceil(Number(match[1]))
  } catch {
    return undefined
  }
}
