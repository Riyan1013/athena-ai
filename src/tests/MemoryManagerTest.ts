import assert from 'node:assert/strict'
import type { Memory } from '../memory/Memory.js'
import type { MemoryRepository } from '../memory/MemoryRepository.js'
import { InMemoryMemoryRepository } from '../memory/InMemoryMemoryRepository.js'
import { MemoryManager } from '../memory/MemoryManager.js'

/**
 * Local, dependency-free test suite for MemoryManager.
 *
 * Exercises MemoryManager only through its public API (create/getById/
 * getByOwner/update/delete). The manager is constructed against the
 * MemoryRepository abstraction — not InMemoryMemoryRepository directly
 * — so these tests also confirm that dependency stays interface-level.
 * No network, no Gemini, no Discord.
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

/** Fresh manager for each test, built against the repository abstraction. */
function makeManager(): MemoryManager {
  const repository: MemoryRepository = new InMemoryMemoryRepository()
  return new MemoryManager(repository)
}

function assertValidTimestamp(value: unknown, label: string): void {
  assert.equal(typeof value, 'number', `${label} should be a number`)
  assert.ok(
    Number.isFinite(value as number),
    `${label} should be a finite number`,
  )
}

// ---------------------------------------------------------------------
// 1. create() — USER_PROFILE
// ---------------------------------------------------------------------

test('create() creates a USER_PROFILE memory with generated id and timestamps', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Prefers concise answers.',
  })

  assert.equal(created.type, 'USER_PROFILE')
  assert.equal(created.ownerId, 'owner-1')
  assert.equal(created.content, 'Prefers concise answers.')
  assert.equal(typeof created.id, 'string')
  assert.ok(created.id.length > 0)
  assertValidTimestamp(created.createdAt, 'createdAt')
  assertValidTimestamp(created.updatedAt, 'updatedAt')

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 2. create() — EXPLICIT
// ---------------------------------------------------------------------

test('create() creates an EXPLICIT memory with generated id and timestamps', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Remember that I prefer TypeScript.',
  })

  assert.equal(created.type, 'EXPLICIT')
  assert.equal(created.ownerId, 'owner-1')
  assert.equal(created.content, 'Remember that I prefer TypeScript.')
  assert.equal(typeof created.id, 'string')
  assert.ok(created.id.length > 0)
  assertValidTimestamp(created.createdAt, 'createdAt')
  assertValidTimestamp(created.updatedAt, 'updatedAt')

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 3. create() — CONVERSATION_SUMMARY
// ---------------------------------------------------------------------

test('create() creates a CONVERSATION_SUMMARY memory preserving conversationId', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Discussed Phase 3 memory architecture.',
    conversationId: 'conv-42',
  })

  assert.equal(created.type, 'CONVERSATION_SUMMARY')
  assert.equal(created.ownerId, 'owner-1')
  assert.equal(created.content, 'Discussed Phase 3 memory architecture.')
  assert.equal(typeof created.id, 'string')
  assert.ok(created.id.length > 0)
  assert.equal(
    'conversationId' in created ? created.conversationId : undefined,
    'conv-42',
  )

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

// ---------------------------------------------------------------------
// 4. Unique IDs
// ---------------------------------------------------------------------

test('create() generates unique ids across multiple memories', async () => {
  const manager = makeManager()

  const first = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'First memory.',
  })
  const second = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Second memory.',
  })
  const third = await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Third memory.',
    conversationId: 'conv-1',
  })

  const ids = [first.id, second.id, third.id]
  const uniqueIds = new Set(ids)
  assert.equal(uniqueIds.size, ids.length)
})

// ---------------------------------------------------------------------
// 5. getById()
// ---------------------------------------------------------------------

test('getById() returns the correct memory for an existing id', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Some explicit memory.',
  })

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
})

test('getById() returns undefined for a nonexistent id', async () => {
  const manager = makeManager()
  const fetched = await manager.getById('does-not-exist')
  assert.equal(fetched, undefined)
})

// ---------------------------------------------------------------------
// 6. getByOwner()
// ---------------------------------------------------------------------

test("getByOwner() returns only the requested owner's memories", async () => {
  const manager = makeManager()

  const ownerAMemory1 = await manager.create({
    ownerId: 'owner-a',
    type: 'USER_PROFILE',
    content: 'Owner A profile.',
  })
  const ownerAMemory2 = await manager.create({
    ownerId: 'owner-a',
    type: 'EXPLICIT',
    content: 'Owner A explicit.',
  })
  const ownerBMemory1 = await manager.create({
    ownerId: 'owner-b',
    type: 'USER_PROFILE',
    content: 'Owner B profile.',
  })

  const ownerAResults = await manager.getByOwner('owner-a')
  assert.equal(ownerAResults.length, 2)
  const ownerAIds = ownerAResults.map((m) => m.id).sort()
  assert.deepEqual(ownerAIds, [ownerAMemory1.id, ownerAMemory2.id].sort())

  const ownerBResults = await manager.getByOwner('owner-b')
  assert.equal(ownerBResults.length, 1)
  assert.equal(ownerBResults[0]?.id, ownerBMemory1.id)
})

// ---------------------------------------------------------------------
// 7. update()
// ---------------------------------------------------------------------

test('update() changes content while preserving id, ownerId, type, and createdAt', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'EXPLICIT',
    content: 'Original content.',
  })

  const { id, ownerId, type, createdAt } = created

  const updated = await manager.update({
    id: created.id,
    content: 'Updated content.',
  })

  assert.equal(updated.content, 'Updated content.')
  assert.equal(updated.id, id)
  assert.equal(updated.ownerId, ownerId)
  assert.equal(updated.type, type)
  assert.equal(updated.createdAt, createdAt)
  assertValidTimestamp(updated.updatedAt, 'updatedAt')
})

// ---------------------------------------------------------------------
// 8. Conversation summary preservation
// ---------------------------------------------------------------------

test('update() preserves conversationId on a CONVERSATION_SUMMARY memory', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'CONVERSATION_SUMMARY',
    content: 'Original summary.',
    conversationId: 'conv-99',
  })

  const updated = await manager.update({
    id: created.id,
    content: 'Updated summary.',
  })

  assert.equal(updated.type, 'CONVERSATION_SUMMARY')
  assert.equal(updated.content, 'Updated summary.')
  assert.equal(
    'conversationId' in updated ? updated.conversationId : undefined,
    'conv-99',
  )
})

// ---------------------------------------------------------------------
// 9. update() with nonexistent id
// ---------------------------------------------------------------------

test('update() rejects when the memory id does not exist', async () => {
  const manager = makeManager()

  await assert.rejects(() =>
    manager.update({ id: 'never-created', content: 'Does not matter.' }),
  )
})

// ---------------------------------------------------------------------
// 10. delete()
// ---------------------------------------------------------------------

test('delete() removes an existing memory and returns true', async () => {
  const manager = makeManager()

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'To be deleted.',
  })

  const result = await manager.delete(created.id)
  assert.equal(result, true)

  const fetched = await manager.getById(created.id)
  assert.equal(fetched, undefined)
})

// ---------------------------------------------------------------------
// 11. delete() with nonexistent id
// ---------------------------------------------------------------------

test('delete() returns false for a nonexistent id without throwing', async () => {
  const manager = makeManager()
  const result = await manager.delete('never-existed')
  assert.equal(result, false)
})

// ---------------------------------------------------------------------
// 12. Repository abstraction
// ---------------------------------------------------------------------

test('MemoryManager is constructed against the MemoryRepository abstraction', async () => {
  const repository: MemoryRepository = new InMemoryMemoryRepository()
  const manager = new MemoryManager(repository)

  const created = await manager.create({
    ownerId: 'owner-1',
    type: 'USER_PROFILE',
    content: 'Works through the abstraction.',
  })

  const fetched = await manager.getById(created.id)
  assert.deepEqual(fetched, created)
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
