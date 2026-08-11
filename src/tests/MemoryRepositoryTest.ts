import assert from 'node:assert/strict'
import type { Memory } from '../memory/Memory.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'

/**
 * Local, dependency-free test suite for InMemoryMemoryRepository.
 *
 * Exercises the repository only through the public MemoryRepository
 * contract (create/getById/getByOwner/update/delete) — no access to
 * internal storage, no network, no Gemini, no Discord.
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

// ---------------------------------------------------------------------
// Fixed test data helpers
// ---------------------------------------------------------------------

function makeUserProfile(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-user-profile-1',
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Prefers concise answers.',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  } as Memory
}

function makeExplicit(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-explicit-1',
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Remember that I prefer TypeScript.',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  } as Memory
}

function makeConversationSummary(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-summary-1',
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Discussed Phase 3 memory architecture.',
    conversationId: 'conv-42',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  } as Memory
}

// ---------------------------------------------------------------------
// 1. create()
// ---------------------------------------------------------------------

test('create() stores a memory and it can be retrieved afterward', async () => {
  const repo = new InMemoryMemoryRepository()
  const memory = makeUserProfile()

  const created = await repo.create(memory)
  assert.deepEqual(created, memory)

  const fetched = await repo.getById(memory.id)
  assert.deepEqual(fetched, memory)
})

// ---------------------------------------------------------------------
// 2. getById()
// ---------------------------------------------------------------------

test('getById() returns the correct memory for an existing id', async () => {
  const repo = new InMemoryMemoryRepository()
  const memory = makeExplicit()
  await repo.create(memory)

  const fetched = await repo.getById(memory.id)
  assert.deepEqual(fetched, memory)
})

test('getById() returns undefined for a nonexistent id', async () => {
  const repo = new InMemoryMemoryRepository()
  const fetched = await repo.getById('does-not-exist')
  assert.equal(fetched, undefined)
})

// ---------------------------------------------------------------------
// 3. getByOwner()
// ---------------------------------------------------------------------

test("getByOwner() returns only the requested owner's memories", async () => {
  const repo = new InMemoryMemoryRepository()

  const ownerAMemory1 = makeUserProfile({ id: 'a-1', ownerId: 'owner-a' })
  const ownerAMemory2 = makeExplicit({ id: 'a-2', ownerId: 'owner-a' })
  const ownerBMemory1 = makeUserProfile({ id: 'b-1', ownerId: 'owner-b' })

  await repo.create(ownerAMemory1)
  await repo.create(ownerAMemory2)
  await repo.create(ownerBMemory1)

  const ownerAResults = await repo.getByOwner('owner-a')
  assert.equal(ownerAResults.length, 2)
  const ownerAIds = ownerAResults.map((m) => m.id).sort()
  assert.deepEqual(ownerAIds, ['a-1', 'a-2'])

  const ownerBResults = await repo.getByOwner('owner-b')
  assert.equal(ownerBResults.length, 1)
  assert.equal(ownerBResults[0]?.id, 'b-1')
})

test('getByOwner() returns an empty array for an owner with no memories', async () => {
  const repo = new InMemoryMemoryRepository()
  await repo.create(makeUserProfile({ id: 'a-1', ownerId: 'owner-a' }))

  const results = await repo.getByOwner('owner-with-no-memories')
  assert.deepEqual(results, [])
})

// ---------------------------------------------------------------------
// 4. Multiple memory types
// ---------------------------------------------------------------------

test('repository stores and retrieves USER_PROFILE, EXPLICIT, and CONVERSATION_SUMMARY memories', async () => {
  const repo = new InMemoryMemoryRepository()

  const profile = makeUserProfile({
    id: 'type-profile',
    ownerId: 'owner-types',
  })
  const explicit = makeExplicit({ id: 'type-explicit', ownerId: 'owner-types' })
  const summary = makeConversationSummary({
    id: 'type-summary',
    ownerId: 'owner-types',
  })

  await repo.create(profile)
  await repo.create(explicit)
  await repo.create(summary)

  const fetchedProfile = await repo.getById('type-profile')
  assert.equal(fetchedProfile?.type, 'USER_PROFILE')

  const fetchedExplicit = await repo.getById('type-explicit')
  assert.equal(fetchedExplicit?.type, 'EXPLICIT')

  const fetchedSummary = await repo.getById('type-summary')
  assert.equal(fetchedSummary?.type, 'CONVERSATION_SUMMARY')
  assert.equal(
    fetchedSummary && 'conversationId' in fetchedSummary
      ? fetchedSummary.conversationId
      : undefined,
    'conv-42',
  )

  const allForOwner = await repo.getByOwner('owner-types')
  assert.equal(allForOwner.length, 3)
})

// ---------------------------------------------------------------------
// 5. update()
// ---------------------------------------------------------------------

test('update() replaces content/updatedAt while keeping the id the same', async () => {
  const repo = new InMemoryMemoryRepository()
  const original = makeExplicit({ id: 'update-me', ownerId: 'owner-1' })
  await repo.create(original)

  const updated: Memory = {
    ...original,
    content: 'Updated content after change.',
    updatedAt: 2000,
  }

  const result = await repo.update(updated)
  assert.deepEqual(result, updated)

  const fetched = await repo.getById('update-me')
  assert.deepEqual(fetched, updated)
  assert.equal(fetched?.id, 'update-me')
})

// ---------------------------------------------------------------------
// 6. update() with nonexistent id
// ---------------------------------------------------------------------

test('update() rejects when the memory id does not exist', async () => {
  const repo = new InMemoryMemoryRepository()
  const ghost = makeExplicit({ id: 'never-created', ownerId: 'owner-1' })

  await assert.rejects(() => repo.update(ghost))
})

// ---------------------------------------------------------------------
// 7. delete()
// ---------------------------------------------------------------------

test('delete() removes an existing memory and returns true', async () => {
  const repo = new InMemoryMemoryRepository()
  const memory = makeUserProfile({ id: 'delete-me', ownerId: 'owner-1' })
  await repo.create(memory)

  const result = await repo.delete('delete-me')
  assert.equal(result, true)

  const fetched = await repo.getById('delete-me')
  assert.equal(fetched, undefined)
})

// ---------------------------------------------------------------------
// 8. delete() with nonexistent id
// ---------------------------------------------------------------------

test('delete() returns false for a nonexistent id without throwing', async () => {
  const repo = new InMemoryMemoryRepository()
  const result = await repo.delete('never-existed')
  assert.equal(result, false)
})

// ---------------------------------------------------------------------
// 9. Isolation
// ---------------------------------------------------------------------

test('operations on one memory do not affect another memory', async () => {
  const repo = new InMemoryMemoryRepository()

  const memoryA = makeUserProfile({ id: 'iso-a', ownerId: 'owner-iso' })
  const memoryB = makeExplicit({ id: 'iso-b', ownerId: 'owner-iso' })

  await repo.create(memoryA)
  await repo.create(memoryB)

  const updatedA: Memory = {
    ...memoryA,
    content: 'Changed only A.',
    updatedAt: 3000,
  }
  await repo.update(updatedA)

  const fetchedB = await repo.getById('iso-b')
  assert.deepEqual(fetchedB, memoryB)

  const deleteResult = await repo.delete('iso-a')
  assert.equal(deleteResult, true)

  const fetchedBAfterDelete = await repo.getById('iso-b')
  assert.deepEqual(fetchedBAfterDelete, memoryB)
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
