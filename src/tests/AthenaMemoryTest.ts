import assert from 'node:assert/strict'
import type { AIProvider } from '../ai/providers/AIProvider.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'
import type { MemoryRepository } from '../memory/MemoryRepository.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'

/**
 * Local, dependency-free test suite for Athena's long-term memory API:
 * remember(), listMemories(), forget().
 *
 * Uses a fake AIProvider that fails the test if it is ever called (these
 * methods must never call the AI provider), and InMemoryMemoryRepository
 * behind MemoryManager. No network, no Gemini, no RPD consumed.
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
 * Fake AIProvider that records whether it was called and fails loudly if
 * it is. remember()/listMemories()/forget() must never reach the AI
 * provider — this double lets tests assert that directly.
 */
class NeverCalledAIProvider implements AIProvider {
  callCount = 0

  async generateResponse(): Promise<string> {
    this.callCount++
    throw new Error(
      'AIProvider.generateResponse() must not be called by the memory API',
    )
  }
}

/** Fresh Athena instance for each test, backed by a real in-memory repository. */
function makeAthena(): {
  athena: Athena
  provider: NeverCalledAIProvider
  conversationManager: ConversationManager
  memoryManager: MemoryManager
} {
  const provider = new NeverCalledAIProvider()
  const conversationManager = new ConversationManager()
  const repository: MemoryRepository = new InMemoryMemoryRepository()
  const memoryManager = new MemoryManager(repository)
  const athena = new Athena(provider, conversationManager, memoryManager)

  return { athena, provider, conversationManager, memoryManager }
}

// ---------------------------------------------------------------------
// 1. remember() creates an EXPLICIT memory
// ---------------------------------------------------------------------

test('remember() creates an EXPLICIT memory owned by the given user', async () => {
  const { athena, provider } = makeAthena()

  const created = await athena.remember('user-1', 'My favorite color is blue.')

  assert.equal(created.type, 'EXPLICIT')
  assert.equal(created.ownerId, 'user-1')
  assert.equal(created.content, 'My favorite color is blue.')
  assert.equal(provider.callCount, 0)
})

// ---------------------------------------------------------------------
// 2. remember() trims content
// ---------------------------------------------------------------------

test('remember() trims leading/trailing whitespace from content', async () => {
  const { athena } = makeAthena()

  const created = await athena.remember(
    'user-1',
    '   My favorite color is blue.   ',
  )

  assert.equal(created.content, 'My favorite color is blue.')
})

// ---------------------------------------------------------------------
// 3. remember() rejects empty/whitespace-only content
// ---------------------------------------------------------------------

test('remember() rejects empty content', async () => {
  const { athena } = makeAthena()

  await assert.rejects(() => athena.remember('user-1', ''))
})

test('remember() rejects whitespace-only content', async () => {
  const { athena } = makeAthena()

  await assert.rejects(() => athena.remember('user-1', '   \n\t  '))
})

// ---------------------------------------------------------------------
// 4. Different users get independent memories
// ---------------------------------------------------------------------

test("remember() keeps different users' memories independent", async () => {
  const { athena } = makeAthena()

  const memoryA = await athena.remember('user-a', "Owner A's memory.")
  const memoryB = await athena.remember('user-b', "Owner B's memory.")

  assert.notEqual(memoryA.id, memoryB.id)
  assert.equal(memoryA.ownerId, 'user-a')
  assert.equal(memoryB.ownerId, 'user-b')

  const ownerAMemories = await athena.listMemories('user-a')
  const ownerBMemories = await athena.listMemories('user-b')

  assert.equal(ownerAMemories.length, 1)
  assert.equal(ownerAMemories[0]?.id, memoryA.id)
  assert.equal(ownerBMemories.length, 1)
  assert.equal(ownerBMemories[0]?.id, memoryB.id)
})

// ---------------------------------------------------------------------
// 5. listMemories() returns only the requesting user's EXPLICIT memories
// ---------------------------------------------------------------------

test("listMemories() returns only the requesting user's EXPLICIT memories", async () => {
  const { athena, memoryManager } = makeAthena()

  // A profile and a conversation summary for the same owner, plus two
  // explicit memories — only the two explicit memories should be listed.
  await memoryManager.upsertUserProfile('user-1', 'A profile, not explicit.')
  await memoryManager.create({
    ownerId: 'user-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'A summary, not explicit.',
    conversationId: 'conv-1',
    sourceMessageCount: 0,
  })
  const explicitOne = await athena.remember('user-1', 'First explicit memory.')
  const explicitTwo = await athena.remember('user-1', 'Second explicit memory.')

  // Another user's explicit memory should not leak into user-1's list.
  await athena.remember('user-2', "Someone else's memory.")

  const results = await athena.listMemories('user-1')

  assert.equal(results.length, 2)
  const resultIds = results.map((m) => m.id).sort()
  assert.deepEqual(resultIds, [explicitOne.id, explicitTwo.id].sort())
  assert.ok(results.every((m) => m.type === 'EXPLICIT'))
})

// ---------------------------------------------------------------------
// 6. listMemories() returns [] when none exist
// ---------------------------------------------------------------------

test('listMemories() returns an empty array when the user has no memories', async () => {
  const { athena } = makeAthena()

  const results = await athena.listMemories('user-with-no-memories')
  assert.deepEqual(results, [])
})

// ---------------------------------------------------------------------
// 7. forget() deletes an owned memory
// ---------------------------------------------------------------------

test('forget() deletes a memory the user owns and returns true', async () => {
  const { athena } = makeAthena()

  const created = await athena.remember('user-1', 'To be forgotten.')

  const result = await athena.forget('user-1', created.id)
  assert.equal(result, true)

  const remaining = await athena.listMemories('user-1')
  assert.equal(remaining.length, 0)
})

// ---------------------------------------------------------------------
// 8. forget() returns false for a nonexistent memory
// ---------------------------------------------------------------------

test('forget() returns false for a nonexistent memory id', async () => {
  const { athena } = makeAthena()

  const result = await athena.forget('user-1', 'does-not-exist')
  assert.equal(result, false)
})

// ---------------------------------------------------------------------
// 9. forget() returns false for another user's memory and leaves it
// intact
// ---------------------------------------------------------------------

test("forget() returns false for another user's memory and does not delete it", async () => {
  const { athena } = makeAthena()

  const ownerAMemory = await athena.remember('user-a', "Owner A's memory.")

  const result = await athena.forget('user-b', ownerAMemory.id)
  assert.equal(result, false)

  const ownerAMemories = await athena.listMemories('user-a')
  assert.equal(ownerAMemories.length, 1)
  assert.equal(ownerAMemories[0]?.id, ownerAMemory.id)
})

// ---------------------------------------------------------------------
// 10. remember() does not modify ConversationManager
// ---------------------------------------------------------------------

test('remember() does not touch ConversationManager', async () => {
  const { athena, conversationManager } = makeAthena()

  // A conversation that already exists for this user, with no messages.
  const conversation = conversationManager.getOrCreate('conv-1')
  assert.equal(conversation.getMessages().length, 0)

  await athena.remember('user-1', 'A memory unrelated to any conversation.')

  assert.equal(conversation.getMessages().length, 0)

  // No new conversation should have been implicitly created either.
  assert.equal(conversationManager.get('conv-1'), conversation)
})

// ---------------------------------------------------------------------
// 11. No Gemini/AIProvider calls from any of the three methods
// ---------------------------------------------------------------------

test('remember(), listMemories(), and forget() never call AIProvider', async () => {
  const { athena, provider } = makeAthena()

  const created = await athena.remember('user-1', 'Some memory.')
  await athena.listMemories('user-1')
  await athena.forget('user-1', created.id)

  assert.equal(provider.callCount, 0)
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
