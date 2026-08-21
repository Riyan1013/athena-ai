import assert from 'node:assert/strict'
import type { AIProvider } from '../ai/providers/AIProvider.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'
import type { MemoryRepository } from '../memory/MemoryRepository.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'

type TestFn = () => Promise<void> | void

interface TestCase {
  name: string
  fn: TestFn
}

const tests: TestCase[] = []

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn })
}

/** Waits a macrotask tick so fire-and-forget background work can settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A summarization prompt (built by the real buildSummaryPrompt()) always contains this. */
const SUMMARY_PROMPT_MARKER = 'Transcript:'

/**
 * Fake AIProvider that dispatches by prompt content into two independent
 * queues/delays/failure-triggers — one for ordinary ask() calls, one for
 * summarization calls — so tests can control each independently without
 * relying on call ordering.
 */
class FakeAIProvider implements AIProvider {
  readonly capturedPrompts: string[] = []
  readonly capturedMaxOutputTokens: number[] = []

  private readonly askResponseQueue: string[] = []
  private readonly summaryResponseQueue: string[] = []
  private askDelayMs = 0
  private summaryDelayMs = 0
  private failNextSummary = false
  private failNextSummaryError: Error = new Error('Simulated summary failure')

  async generateResponse(
    prompt: string,
    maxOutputTokens: number,
  ): Promise<string> {
    this.capturedPrompts.push(prompt)
    this.capturedMaxOutputTokens.push(maxOutputTokens)

    const isSummaryCall = prompt.includes(SUMMARY_PROMPT_MARKER)

    if (isSummaryCall) {
      if (this.summaryDelayMs > 0) {
        await delay(this.summaryDelayMs)
      }
      if (this.failNextSummary) {
        this.failNextSummary = false
        throw this.failNextSummaryError
      }
      return this.summaryResponseQueue.shift() ?? 'Fixed summary response.'
    }

    if (this.askDelayMs > 0) {
      await delay(this.askDelayMs)
    }
    return this.askResponseQueue.shift() ?? 'Fixed response.'
  }

  queueAskResponse(response: string): void {
    this.askResponseQueue.push(response)
  }

  queueSummaryResponse(response: string): void {
    this.summaryResponseQueue.push(response)
  }

  /** Sets the delay for BOTH ask and summary calls (used for concurrency tests). */
  setDelay(ms: number): void {
    this.askDelayMs = ms
    this.summaryDelayMs = ms
  }

  setSummaryDelay(ms: number): void {
    this.summaryDelayMs = ms
  }

  failOnNextSummaryCall(
    error: Error = new Error('Simulated summary failure'),
  ): void {
    this.failNextSummary = true
    this.failNextSummaryError = error
  }

  get callCount(): number {
    return this.capturedPrompts.length
  }

  get summaryCallCount(): number {
    return this.capturedPrompts.filter((p) => p.includes(SUMMARY_PROMPT_MARKER))
      .length
  }

  get askCallCount(): number {
    return this.callCount - this.summaryCallCount
  }
}

/** Fresh Athena instance for each test, backed by a real in-memory repository. */
function makeAthena(): {
  athena: Athena
  provider: FakeAIProvider
  conversationManager: ConversationManager
  memoryManager: MemoryManager
} {
  const provider = new FakeAIProvider()
  const conversationManager = new ConversationManager()
  const repository: MemoryRepository = new InMemoryMemoryRepository()
  const memoryManager = new MemoryManager(repository)
  const athena = new Athena(provider, conversationManager, memoryManager)

  return { athena, provider, conversationManager, memoryManager }
}

/**
 * Sends `askCount` ask() calls sequentially for the given
 * conversation/user. Produces `askCount * 2` conversation messages
 * (one user + one assistant message per call).
 */
async function askTimes(
  athena: Athena,
  conversationId: string,
  athenaUserId: string,
  askCount: number,
): Promise<void> {
  for (let i = 0; i < askCount; i++) {
    await athena.ask(conversationId, athenaUserId, `Message ${i + 1}`)
  }
}

// ---------------------------------------------------------------------
// 1. No trigger before threshold
// ---------------------------------------------------------------------

test('no automatic summary is created before the threshold is reached', async () => {
  const { athena, memoryManager } = makeAthena()

  // 4 ask() calls = 8 total messages (fewer than the threshold of 10).
  await askTimes(athena, 'conv-1', 'user-1', 4)
  await flush()

  const summary = await memoryManager.getConversationSummary('user-1', 'conv-1')
  assert.equal(summary, undefined)
})

// ---------------------------------------------------------------------
// 2. First automatic summary at threshold
// ---------------------------------------------------------------------

test('the first automatic summary is generated once the conversation reaches 10 messages', async () => {
  const { athena, provider, memoryManager } = makeAthena()

  provider.queueSummaryResponse('Automatic summary at 10 messages.')

  // 5 ask() calls = 10 total messages, exactly the threshold.
  await askTimes(athena, 'conv-1', 'user-1', 5)
  await flush()

  const summary = await memoryManager.getConversationSummary('user-1', 'conv-1')
  assert.ok(summary)
  assert.equal(summary?.content, 'Automatic summary at 10 messages.')
  assert.equal(summary?.sourceMessageCount, 10)
})

// ---------------------------------------------------------------------
// 3. Trigger again after 10 NEW messages, not 10 total
// ---------------------------------------------------------------------

test('a second automatic summary triggers after 10 new messages, not 10 total', async () => {
  const { athena, provider, memoryManager } = makeAthena()

  provider.queueSummaryResponse('First automatic summary.')
  await askTimes(athena, 'conv-1', 'user-1', 5) // 10 messages -> triggers
  await flush()

  const firstSummary = await memoryManager.getConversationSummary(
    'user-1',
    'conv-1',
  )
  assert.equal(firstSummary?.sourceMessageCount, 10)

  // 4 more ask() calls = 8 more messages (18 total). Only 8 new messages
  // have accumulated since sourceMessageCount 10, so this must NOT
  // trigger a second summary.
  await askTimes(athena, 'conv-1', 'user-1', 4)
  await flush()

  const stillFirstSummary = await memoryManager.getConversationSummary(
    'user-1',
    'conv-1',
  )
  assert.equal(stillFirstSummary?.content, 'First automatic summary.')
  assert.equal(stillFirstSummary?.sourceMessageCount, 10)
  assert.equal(provider.summaryCallCount, 1)
  assert.equal(provider.askCallCount, 9) // 5 + 4 ask() calls

  // One more ask() call = 2 more messages (20 total). Now 10 new
  // messages have accumulated since sourceMessageCount 10, so this
  // should trigger the second automatic summary.
  provider.queueSummaryResponse('Second automatic summary.')
  await athena.ask('conv-1', 'user-1', 'Message 10')
  await flush()

  const secondSummary = await memoryManager.getConversationSummary(
    'user-1',
    'conv-1',
  )
  assert.equal(secondSummary?.content, 'Second automatic summary.')
  assert.equal(secondSummary?.sourceMessageCount, 20)
  assert.equal(provider.summaryCallCount, 2)
})

// ---------------------------------------------------------------------
// 4. sourceMessageCount updates to the new total; existing summary is
// updated in place, not duplicated
// ---------------------------------------------------------------------

test('the existing summary is updated in place rather than a new one being created', async () => {
  const { athena, provider, memoryManager } = makeAthena()

  provider.queueSummaryResponse('First automatic summary.')
  await askTimes(athena, 'conv-1', 'user-1', 5) // 10 messages -> triggers
  await flush()

  const first = await memoryManager.getConversationSummary('user-1', 'conv-1')
  assert.ok(first)

  provider.queueSummaryResponse('Second automatic summary.')
  await askTimes(athena, 'conv-1', 'user-1', 5) // +10 messages (20 total) -> triggers again
  await flush()

  const second = await memoryManager.getConversationSummary('user-1', 'conv-1')

  assert.equal(second?.id, first?.id)
  assert.equal(second?.ownerId, first?.ownerId)
  assert.equal(second?.conversationId, first?.conversationId)
  assert.equal(second?.createdAt, first?.createdAt)
  assert.equal(second?.content, 'Second automatic summary.')
  assert.equal(second?.sourceMessageCount, 20)
})

// ---------------------------------------------------------------------
// 5. ask() does not wait for automatic summarization
// ---------------------------------------------------------------------

test('ask() returns before a slow background summarization completes', async () => {
  const { athena, provider } = makeAthena()

  // Only the summarization call is slow; ordinary ask() calls resolve
  // immediately, so any delay observed in the triggering ask() call's
  // own timing can only come from waiting on the background summary.
  provider.setSummaryDelay(60)

  // 4 ask() calls = 8 messages (below threshold, no trigger).
  await askTimes(athena, 'conv-1', 'user-1', 4)

  const callCountBeforeTrigger = provider.callCount

  const start = Date.now()
  // 5th ask() call = 10 messages total -> triggers background summarization.
  const response = await athena.ask('conv-1', 'user-1', 'Message 5')
  const elapsedForAsk = Date.now() - start

  assert.equal(response, 'Fixed response.')
  assert.ok(
    elapsedForAsk < 30,
    `expected ask() to return quickly (not wait on the 60ms summary delay), took ${elapsedForAsk}ms`,
  )
  // Only the ask()'s own call has happened so far — the background
  // summarization has not completed (it's still inside its 60ms delay).
  assert.equal(provider.callCount, callCountBeforeTrigger + 1)

  // After waiting past the summary's delay, the background
  // summarization should have completed, producing one more call.
  await delay(100)
  assert.equal(provider.callCount, callCountBeforeTrigger + 2)
})

// ---------------------------------------------------------------------
// 6. Background summarization failure does not break ask()
// ---------------------------------------------------------------------

test('a background summarization failure does not break ask() or cause it to reject', async () => {
  const { athena, provider, memoryManager } = makeAthena()

  // 4 ask() calls = 8 messages (below threshold, no trigger).
  await askTimes(athena, 'conv-1', 'user-1', 4)

  provider.failOnNextSummaryCall(
    new Error('Simulated background summary failure'),
  )

  // 5th ask() call = 10 messages total -> triggers a background
  // summarization that is configured to fail. The ask() call itself
  // must still succeed normally.
  const response = await athena.ask('conv-1', 'user-1', 'Message 5')
  assert.equal(response, 'Fixed response.')

  await flush()

  // No summary should have been created, since the background
  // generation failed before it could be stored.
  const summary = await memoryManager.getConversationSummary('user-1', 'conv-1')
  assert.equal(summary, undefined)
})

// ---------------------------------------------------------------------
// 7. Different users remain isolated
// ---------------------------------------------------------------------

test("different users' automatic summaries remain isolated", async () => {
  const { athena, provider, memoryManager } = makeAthena()

  provider.queueSummaryResponse("User A's automatic summary.")
  await askTimes(athena, 'conv-shared', 'user-a', 5) // 10 messages -> triggers
  await flush()

  const summaryA = await memoryManager.getConversationSummary(
    'user-a',
    'conv-shared',
  )
  const summaryB = await memoryManager.getConversationSummary(
    'user-b',
    'conv-shared',
  )

  assert.equal(summaryA?.content, "User A's automatic summary.")
  assert.equal(summaryB, undefined)
})

// ---------------------------------------------------------------------
// 8. Different conversation IDs remain isolated
// ---------------------------------------------------------------------

test("different conversation IDs' automatic summaries remain isolated", async () => {
  const { athena, provider, memoryManager } = makeAthena()

  provider.queueSummaryResponse('Summary of conversation A.')
  await askTimes(athena, 'conv-a', 'user-1', 5) // 10 messages -> triggers
  await flush()

  const summaryA = await memoryManager.getConversationSummary(
    'user-1',
    'conv-a',
  )
  const summaryB = await memoryManager.getConversationSummary(
    'user-1',
    'conv-b',
  )

  assert.equal(summaryA?.content, 'Summary of conversation A.')
  assert.equal(summaryB, undefined)
})

// ---------------------------------------------------------------------
// 9. Manual summarizeConversation() still works
// ---------------------------------------------------------------------

test('manual summarizeConversation() still works correctly alongside automatic triggering', async () => {
  const { athena, provider, conversationManager } = makeAthena()

  conversationManager.getOrCreate('conv-1').addMessage('user', 'Hi.')

  provider.queueSummaryResponse('Manually generated summary.')

  const result = await athena.summarizeConversation('conv-1', 'user-1')

  assert.equal(result.content, 'Manually generated summary.')
  assert.equal(result.sourceMessageCount, 1)
})

// ---------------------------------------------------------------------
// 10. Existing ask() behavior remains intact
// ---------------------------------------------------------------------

test('ask() regression: returns the provider response and commits the conversation turn', async () => {
  const { athena, provider, conversationManager } = makeAthena()

  provider.queueAskResponse('An ordinary ask() reply.')
  const response = await athena.ask('conv-1', 'user-1', 'Hello there.')

  assert.equal(response, 'An ordinary ask() reply.')

  const conversation = conversationManager.get('conv-1')
  const messages = conversation?.getMessages() ?? []
  assert.equal(messages.length, 2)
  assert.equal(messages[0]?.role, 'user')
  assert.equal(messages[0]?.content, 'Hello there.')
  assert.equal(messages[1]?.role, 'assistant')
  assert.equal(messages[1]?.content, 'An ordinary ask() reply.')

  await flush()
})

// ---------------------------------------------------------------------
// 11. Rapid/consecutive ask() calls do not corrupt conversation or
// summary state
// ---------------------------------------------------------------------

test('rapid concurrent ask() calls do not corrupt conversation history or summary state', async () => {
  const { athena, provider, conversationManager, memoryManager } = makeAthena()

  provider.setDelay(5)
  provider.queueSummaryResponse('Summary from rapid triggering.')

  // Fire 10 ask() calls concurrently (not sequentially) for the same
  // conversation, all of which will race to commit conversation turns
  // and race to check/trigger automatic summarization.
  const promises = Array.from({ length: 10 }, (_, i) =>
    athena.ask('conv-1', 'user-1', `Rapid message ${i + 1}`),
  )
  const responses = await Promise.all(promises)

  assert.equal(responses.length, 10)
  assert.ok(responses.every((r) => typeof r === 'string' && r.length > 0))

  // Conversation history must have exactly 20 messages (10 user + 10
  // assistant) — no lost or duplicated turns despite the concurrent
  // calls and the in-progress background summarization.
  const conversation = conversationManager.get('conv-1')
  const messages = conversation?.getMessages() ?? []
  assert.equal(messages.length, 20)

  await delay(50)

  // At most one summary record should exist for this conversation, and
  // if one was created its sourceMessageCount must be a valid,
  // non-corrupted number reflecting an actual conversation length at
  // some point in time (never NaN, never negative, never exceeding the
  // final total).
  const summary = await memoryManager.getConversationSummary('user-1', 'conv-1')
  if (summary) {
    assert.ok(Number.isFinite(summary.sourceMessageCount))
    assert.ok(summary.sourceMessageCount > 0)
    assert.ok(summary.sourceMessageCount <= 20)
  }

  const allSummaries = await memoryManager.getMemories('user-1', {
    type: 'CONVERSATION_SUMMARY',
  })
  const summariesForThisConversation = allSummaries.filter(
    (m) => 'conversationId' in m && m.conversationId === 'conv-1',
  )
  assert.ok(
    summariesForThisConversation.length <= 1,
    'expected at most one summary record for the conversation, found ' +
      summariesForThisConversation.length,
  )
})

// ---------------------------------------------------------------------
// 12. Existing conversation-summary injection remains intact
// ---------------------------------------------------------------------

test('conversation-summary injection into the prompt still works after automatic triggering exists', async () => {
  const { athena, provider, memoryManager } = makeAthena()

  await memoryManager.upsertConversationSummary(
    'user-1',
    'conv-1',
    'A manually stored prior summary.',
    3,
  )

  provider.queueAskResponse('An ordinary reply.')
  await athena.ask('conv-1', 'user-1', 'Hello.')

  const lastPrompt = provider.capturedPrompts.at(-1)
  assert.ok(lastPrompt?.includes('Summary of this conversation so far'))
  assert.ok(lastPrompt?.includes('A manually stored prior summary.'))
})

// ---------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------

async function run(): Promise<void> {
  let passed = 0
  let failed = 0

  for (const { name, fn } of tests) {
    try {
      await fn()
      passed++
      console.log(`✅ ${name}`)
    } catch (error) {
      failed++
      console.log(`❌ ${name}`)
      console.log(error instanceof Error ? error.message : String(error))
    }
  }

  const total = passed + failed
  console.log(`🦉 Results: ${passed} passed, ${failed} failed, ${total} total`)

  if (failed > 0) {
    process.exit(1)
  }
}

run()
