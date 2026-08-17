import assert from 'node:assert/strict'
import type { AIProvider } from '../ai/providers/AIProvider.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'

/**
 * Deterministic test suite for Athena's Conversation Summary API.
 *
 * These tests verify that Athena correctly exposes the conversation-summary
 * lifecycle provided by MemoryManager.
 *
 * No Gemini calls, no network, and no Discord.
 */

type TestFn = () => Promise<void> | void

interface TestCase {
  name: string
  fn: TestFn
}

const tests: TestCase[] = []

function test(name: string, fn: TestFn): void {
  tests.push({ name, fn })
}

/**
 * AIProvider test double that must never be called.
 */
class NeverCalledAIProvider implements AIProvider {
  async generateResponse(): Promise<string> {
    throw new Error('AIProvider must not be called by Conversation Summary API')
  }
}

/**
 * Fresh Athena instance for each test.
 */
function makeAthena(): Athena {
  const provider = new NeverCalledAIProvider()
  const conversationManager = new ConversationManager()
  const memoryRepository = new InMemoryMemoryRepository()
  const memoryManager = new MemoryManager(memoryRepository)

  return new Athena(provider, conversationManager, memoryManager)
}

// ---------------------------------------------------------------------
// 1. upsertConversationSummary() — create
// ---------------------------------------------------------------------

test('upsertConversationSummary() creates a summary', async () => {
  const athena = makeAthena()

  const summary = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Discussed the Athena memory architecture.',
    4,
  )

  assert.equal(summary.type, 'CONVERSATION_SUMMARY')
  assert.equal(summary.ownerId, 'user-1')
  assert.equal(summary.conversationId, 'conversation-1')
  assert.equal(summary.content, 'Discussed the Athena memory architecture.')
  assert.equal(summary.sourceMessageCount, 4)
  assert.ok(summary.id.length > 0)
})

// ---------------------------------------------------------------------
// 2. getConversationSummary() — retrieve
// ---------------------------------------------------------------------

test('getConversationSummary() retrieves an existing summary', async () => {
  const athena = makeAthena()

  const created = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Initial conversation summary.',
    3,
  )

  const retrieved = await athena.getConversationSummary(
    'user-1',
    'conversation-1',
  )

  assert.deepEqual(retrieved, created)
  assert.equal(retrieved?.sourceMessageCount, 3)
})

// ---------------------------------------------------------------------
// 3. getConversationSummary() — nonexistent
// ---------------------------------------------------------------------

test('getConversationSummary() returns undefined when no summary exists', async () => {
  const athena = makeAthena()

  const result = await athena.getConversationSummary('user-1', 'conversation-1')

  assert.equal(result, undefined)
})

// ---------------------------------------------------------------------
// 4. upsertConversationSummary() — update
// ---------------------------------------------------------------------

test('upsertConversationSummary() replaces existing summary content', async () => {
  const athena = makeAthena()

  const first = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Original summary.',
    3,
  )

  const second = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Updated summary.',
    7,
  )

  assert.equal(second.content, 'Updated summary.')
  assert.equal(second.id, first.id)
  assert.equal(second.sourceMessageCount, 7)
})

// ---------------------------------------------------------------------
// 5. Update preserves identity
// ---------------------------------------------------------------------

test('updating a summary preserves id, createdAt, ownerId, and conversationId', async () => {
  const athena = makeAthena()

  const first = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Original summary.',
    3,
  )

  const second = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Updated summary.',
    9,
  )

  assert.equal(second.id, first.id)
  assert.equal(second.createdAt, first.createdAt)
  assert.equal(second.ownerId, first.ownerId)
  assert.equal(second.conversationId, first.conversationId)
  assert.ok(second.updatedAt >= first.updatedAt)

  // sourceMessageCount is identity-independent metadata: unlike id,
  // createdAt, ownerId, and conversationId, it is expected to change on
  // every update to reflect the current conversation length.
  assert.equal(first.sourceMessageCount, 3)
  assert.equal(second.sourceMessageCount, 9)
})

// ---------------------------------------------------------------------
// 6. Different conversations remain independent
// ---------------------------------------------------------------------

test('different conversations remain independent', async () => {
  const athena = makeAthena()

  const summaryA = await athena.upsertConversationSummary(
    'user-1',
    'conversation-a',
    'Summary A.',
    5,
  )

  const summaryB = await athena.upsertConversationSummary(
    'user-1',
    'conversation-b',
    'Summary B.',
    8,
  )

  assert.notEqual(summaryA.id, summaryB.id)

  const retrievedA = await athena.getConversationSummary(
    'user-1',
    'conversation-a',
  )

  const retrievedB = await athena.getConversationSummary(
    'user-1',
    'conversation-b',
  )

  assert.equal(retrievedA?.content, 'Summary A.')
  assert.equal(retrievedB?.content, 'Summary B.')
  assert.equal(retrievedA?.sourceMessageCount, 5)
  assert.equal(retrievedB?.sourceMessageCount, 8)
})

// ---------------------------------------------------------------------
// 7. Different users remain isolated
// ---------------------------------------------------------------------

test('different users remain isolated even when conversationId is the same', async () => {
  const athena = makeAthena()

  await athena.upsertConversationSummary(
    'user-a',
    'conversation-shared',
    'User A summary.',
    6,
  )

  await athena.upsertConversationSummary(
    'user-b',
    'conversation-shared',
    'User B summary.',
    10,
  )

  const userA = await athena.getConversationSummary(
    'user-a',
    'conversation-shared',
  )

  const userB = await athena.getConversationSummary(
    'user-b',
    'conversation-shared',
  )

  assert.equal(userA?.content, 'User A summary.')
  assert.equal(userB?.content, 'User B summary.')
  assert.equal(userA?.sourceMessageCount, 6)
  assert.equal(userB?.sourceMessageCount, 10)
})

// ---------------------------------------------------------------------
// 8. deleteConversationSummary() — delete
// ---------------------------------------------------------------------

test('deleteConversationSummary() deletes an existing summary', async () => {
  const athena = makeAthena()

  await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Summary to delete.',
    2,
  )

  const deleted = await athena.deleteConversationSummary(
    'user-1',
    'conversation-1',
  )

  assert.equal(deleted, true)

  const retrieved = await athena.getConversationSummary(
    'user-1',
    'conversation-1',
  )

  assert.equal(retrieved, undefined)
})

// ---------------------------------------------------------------------
// 9. deleteConversationSummary() — nonexistent
// ---------------------------------------------------------------------

test('deleteConversationSummary() returns false when no summary exists', async () => {
  const athena = makeAthena()

  const deleted = await athena.deleteConversationSummary(
    'user-1',
    'conversation-1',
  )

  assert.equal(deleted, false)
})

// ---------------------------------------------------------------------
// 10. No AIProvider or ConversationManager side effects
// ---------------------------------------------------------------------

test('Conversation Summary API does not call AIProvider or touch ConversationManager', async () => {
  const athena = makeAthena()

  const created = await athena.upsertConversationSummary(
    'user-1',
    'conversation-1',
    'Summary content.',
    4,
  )

  assert.equal(created.type, 'CONVERSATION_SUMMARY')
  assert.equal(created.sourceMessageCount, 4)

  const retrieved = await athena.getConversationSummary(
    'user-1',
    'conversation-1',
  )

  assert.equal(retrieved?.content, 'Summary content.')

  const deleted = await athena.deleteConversationSummary(
    'user-1',
    'conversation-1',
  )

  assert.equal(deleted, true)
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
