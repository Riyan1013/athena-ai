import assert from 'node:assert/strict'

import {
  AIProviderError,
  type AIProviderErrorCode,
} from '../ai/providers/AIProviderError.js'

// Lightweight, dependency-free test runner. No Gemini API calls, no network,
// no API key required — this only exercises the AIProviderError class.

type Test = {
  name: string
  run: () => void
}

const tests: Test[] = []

function test(name: string, run: () => void): void {
  tests.push({ name, run })
}

const ALL_CODES: AIProviderErrorCode[] = [
  'RATE_LIMITED',
  'MODEL_UNAVAILABLE',
  'AUTHENTICATION',
  'NETWORK',
  'INVALID_REQUEST',
  'UNKNOWN',
]

for (const code of ALL_CODES) {
  test(`constructs an AIProviderError with code ${code}`, () => {
    const message = `Test message for ${code}`
    const error = new AIProviderError(code, message)

    assert.equal(error instanceof Error, true, 'should be instanceof Error')
    assert.equal(
      error instanceof AIProviderError,
      true,
      'should be instanceof AIProviderError',
    )
    assert.equal(error.code, code, 'should store the given code')
    assert.equal(error.message, message, 'should store the given message')
    assert.equal(
      error.retryAfterSeconds,
      undefined,
      'retryAfterSeconds should be undefined when not provided',
    )
  })
}

test('stores retryAfterSeconds when provided', () => {
  const error = new AIProviderError('RATE_LIMITED', 'Rate limited', 23)

  assert.equal(error.code, 'RATE_LIMITED')
  assert.equal(error.message, 'Rate limited')
  assert.equal(
    error.retryAfterSeconds,
    23,
    'retryAfterSeconds should be stored when provided',
  )
})

test('leaves retryAfterSeconds undefined when omitted', () => {
  const error = new AIProviderError('NETWORK', 'Network failure')

  assert.equal(error.retryAfterSeconds, undefined)
})

test('sets the error name to AIProviderError', () => {
  const error = new AIProviderError('UNKNOWN', 'Something went wrong')

  assert.equal(error.name, 'AIProviderError')
})

// --- Runner ---------------------------------------------------------------

let passed = 0
let failed = 0

console.log('🦉 Running AIProviderError tests\n')

for (const { name, run } of tests) {
  try {
    run()
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
