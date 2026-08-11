// src/tests/GeminiProviderErrorTest.ts
//
// Tests GeminiProvider's error translation (toAIProviderError) via its
// public generateResponse() method. The underlying Gemini SDK call is
// stubbed at the instance level — no real network request is made, no
// real API key is required, and no Gemini quota is consumed.

import assert from 'node:assert/strict'
import { ApiError } from '@google/genai'

import type { GeminiProvider as GeminiProviderType } from '../ai/providers/GeminiProvider.js'
import type {
  AIProviderError as AIProviderErrorType,
  AIProviderErrorCode,
} from '../ai/providers/AIProviderError.js'

type Test = {
  name: string
  run: () => Promise<void>
}

const tests: Test[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

// A fake key is enough — GeminiProvider only checks that it's truthy.
// generateContent is stubbed before any test runs, so this key is never
// actually sent anywhere.
process.env.GEMINI_API_KEY = 'test-key-for-gemini-provider-error-tests'

async function main(): Promise<void> {
  const { GeminiProvider } = await import('../ai/providers/GeminiProvider.js')
  const { AIProviderError } = await import('../ai/providers/AIProviderError.js')

  // Builds a GeminiProvider whose underlying SDK call is replaced with a
  // stub that rejects with `rejectWith`. `client` is TS-private only, so
  // it's still a plain runtime property we can reach via a cast — no
  // production code changes required.
  function createProviderRejectingWith(
    rejectWith: unknown,
  ): GeminiProviderType {
    const provider = new GeminiProvider()

    const internal = provider as unknown as {
      client: { models: { generateContent: unknown } }
    }

    internal.client.models.generateContent = () => Promise.reject(rejectWith)

    return provider
  }

  // Calls generateResponse() on a provider stubbed to fail with
  // `rejectWith`, and asserts it rejects with an AIProviderError.
  // Suppresses GeminiProvider's own console.error logging for clean output.
  async function captureAIProviderError(
    rejectWith: unknown,
  ): Promise<InstanceType<typeof AIProviderErrorType>> {
    const provider = createProviderRejectingWith(rejectWith)

    const originalConsoleError = console.error
    console.error = () => {}

    try {
      await provider.generateResponse('irrelevant test prompt')
      throw new Error('Expected generateResponse() to reject, but it resolved.')
    } catch (error) {
      assert.equal(
        error instanceof AIProviderError,
        true,
        `Expected an AIProviderError, got: ${String(error)}`,
      )

      return error as InstanceType<typeof AIProviderErrorType>
    } finally {
      console.error = originalConsoleError
    }
  }

  function assertCode(
    error: InstanceType<typeof AIProviderErrorType>,
    expected: AIProviderErrorCode,
  ): void {
    assert.equal(
      error.code,
      expected,
      `Expected code ${expected}, got ${error.code}`,
    )
  }

  // --- 1. HTTP 429 -> RATE_LIMITED, with retryDelay parsing --------------

  test('HTTP 429 maps to RATE_LIMITED', async () => {
    const apiError = new ApiError({
      status: 429,
      message: JSON.stringify({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota).',
          status: 'RESOURCE_EXHAUSTED',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.RetryInfo',
              retryDelay: '23s',
            },
          ],
        },
      }),
    })

    const error = await captureAIProviderError(apiError)

    assertCode(error, 'RATE_LIMITED')
    assert.equal(
      error.retryAfterSeconds,
      23,
      `Expected retryAfterSeconds 23, got ${error.retryAfterSeconds}`,
    )
  })

  test('HTTP 429 without retry info leaves retryAfterSeconds undefined', async () => {
    const apiError = new ApiError({
      status: 429,
      message: JSON.stringify({
        error: { code: 429, message: 'Too many requests' },
      }),
    })

    const error = await captureAIProviderError(apiError)

    assertCode(error, 'RATE_LIMITED')
    assert.equal(error.retryAfterSeconds, undefined)
  })

  // --- 2. HTTP 404 -> MODEL_UNAVAILABLE -----------------------------------

  test('HTTP 404 maps to MODEL_UNAVAILABLE', async () => {
    const apiError = new ApiError({ status: 404, message: 'Model not found' })
    const error = await captureAIProviderError(apiError)

    assertCode(error, 'MODEL_UNAVAILABLE')
  })

  // --- 3 & 4. HTTP 401 / 403 -> AUTHENTICATION ----------------------------

  test('HTTP 401 maps to AUTHENTICATION', async () => {
    const apiError = new ApiError({ status: 401, message: 'Invalid API key' })
    const error = await captureAIProviderError(apiError)

    assertCode(error, 'AUTHENTICATION')
  })

  test('HTTP 403 maps to AUTHENTICATION', async () => {
    const apiError = new ApiError({ status: 403, message: 'Permission denied' })
    const error = await captureAIProviderError(apiError)

    assertCode(error, 'AUTHENTICATION')
  })

  // --- 5. HTTP 400 -> INVALID_REQUEST -------------------------------------

  test('HTTP 400 maps to INVALID_REQUEST', async () => {
    const apiError = new ApiError({ status: 400, message: 'Invalid argument' })
    const error = await captureAIProviderError(apiError)

    assertCode(error, 'INVALID_REQUEST')
  })

  // --- 6. Genuine network-style error -> NETWORK --------------------------

  test('a structured ECONNRESET-style error maps to NETWORK', async () => {
    const cause = new Error('read ECONNRESET') as NodeJS.ErrnoException
    cause.code = 'ECONNRESET'

    const networkError = new Error('fetch failed', { cause })
    const error = await captureAIProviderError(networkError)

    assertCode(error, 'NETWORK')
  })

  // --- 7. Generic JS Error -> UNKNOWN (never NETWORK) ---------------------

  test('a generic Error with no known cause maps to UNKNOWN, not NETWORK', async () => {
    const genericError = new Error('Something unexpected broke')
    const error = await captureAIProviderError(genericError)

    assertCode(error, 'UNKNOWN')
  })

  // --- 8. Non-Error thrown value -> UNKNOWN -------------------------------

  test('a non-Error rejection value maps to UNKNOWN', async () => {
    const error = await captureAIProviderError(
      'a plain string rejection, not an Error',
    )

    assertCode(error, 'UNKNOWN')
  })

  // --- Runner --------------------------------------------------------------

  let passed = 0
  let failed = 0

  console.log('🦉 Running GeminiProvider error-translation tests\n')

  for (const { name, run } of tests) {
    try {
      await run()
      console.log(`  ✅ PASS: ${name}`)
      passed++
    } catch (error) {
      failed++
      console.log(`  ❌ FAIL: ${name}`)

      if (error instanceof Error) {
        console.log(`     ${error.message}`)
      } else {
        console.log(`     ${String(error)}`)
      }
    }
  }

  console.log(
    `\n🦉 Results: ${passed} passed, ${failed} failed, ${tests.length} total`,
  )

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Test runner crashed:', error)
  process.exit(1)
})
