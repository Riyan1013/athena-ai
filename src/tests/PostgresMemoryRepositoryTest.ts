/**
 * Integration test for PostgresMemoryRepository — CHECKPOINT 3.
 *
 * Requires a real, migrated PostgreSQL database:
 *   DATABASE_URL must be set (prismaClient.ts enforces this) and the
 *   Checkpoint 2 migration must have been applied.
 *
 * Run:  pnpm db:test:postgres-repository
 *
 * Isolation: PostgreSQL persists between runs, so every run embeds a unique
 * RUN_TAG in its owner ids and memory ids. Rows are swept by the
 * `pg-memrepo-` owner-id prefix BEFORE the test (debris from crashed runs)
 * and AFTER it, in a finally block, followed by a count assert proving the
 * sweep succeeded. Assumes serial execution — concurrent runs would sweep
 * each other's rows.
 */
import assert from 'node:assert/strict'
import { prisma } from '../memory/postgres/prismaClient.js'
import { PostgresMemoryRepository } from '../memory/postgres/PostgresMemoryRepository.js'
import type { MemoryRepository } from '../memory/MemoryRepository.js'
import type { AthenaUserId, Memory } from '../memory/Memory.js'

const TEST_OWNER_PREFIX = 'pg-memrepo-'
const RUN_TAG = `${Date.now()}-${process.pid}`

const OWNER_A = `${TEST_OWNER_PREFIX}${RUN_TAG}-a` as AthenaUserId
const OWNER_B = `${TEST_OWNER_PREFIX}${RUN_TAG}-b` as AthenaUserId
const OWNER_C = `${TEST_OWNER_PREFIX}${RUN_TAG}-c` as AthenaUserId // malformed-row owner
const OWNER_EMPTY = `${TEST_OWNER_PREFIX}${RUN_TAG}-empty` as AthenaUserId

// Distinctive epoch-millisecond values (far below Number.MAX_SAFE_INTEGER,
// so the BigInt ↔ number round-trip is exact). Different createdAt/updatedAt
// values also catch a column swap.
const CREATED_AT = 1719876543210
const UPDATED_AT = 1719876543999

interface Timestamps {
  readonly createdAt: number
  readonly updatedAt: number
}

const DEFAULT_TIMESTAMPS: Timestamps = {
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
}
const UPDATED_TIMESTAMPS: Timestamps = {
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT + 1000,
}
const REPLACEMENT_TIMESTAMPS: Timestamps = {
  createdAt: CREATED_AT + 1,
  updatedAt: UPDATED_AT + 1,
}

// Unique offsets keep every timestamp in this file distinct, so a stale or
// swapped value can never pass deepStrictEqual by coincidence.
const SUMMARY_UPDATED_TIMESTAMPS: Timestamps = {
  createdAt: CREATED_AT + 2,
  updatedAt: UPDATED_AT + 2,
}

function userProfile(
  id: string,
  ownerId: AthenaUserId,
  content: string,
  timestamps: Timestamps = DEFAULT_TIMESTAMPS,
): Memory {
  return {
    id,
    ownerId,
    type: 'USER_PROFILE',
    content,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  }
}

function explicitMemory(
  id: string,
  ownerId: AthenaUserId,
  content: string,
  timestamps: Timestamps = DEFAULT_TIMESTAMPS,
): Memory {
  return {
    id,
    ownerId,
    type: 'EXPLICIT',
    content,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  }
}

function summaryMemory(
  id: string,
  ownerId: AthenaUserId,
  content: string,
  conversationId: string,
  sourceMessageCount: number,
  timestamps: Timestamps = DEFAULT_TIMESTAMPS,
): Memory {
  return {
    id,
    ownerId,
    type: 'CONVERSATION_SUMMARY',
    content,
    conversationId,
    sourceMessageCount,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  }
}

async function sweepTestRows(): Promise<void> {
  await prisma.memory.deleteMany({
    where: { ownerId: { startsWith: TEST_OWNER_PREFIX } },
  })
}

async function runTests(): Promise<void> {
  // Pre-sweep: remove debris from previously crashed runs. (Requirement 14.)
  await sweepTestRows()

  // Typed as the interface: compile-time proof of contract compliance.
  const repo: MemoryRepository = new PostgresMemoryRepository()

  // --- 1–3. create() for every Memory variant -----------------------------
  console.log('[1-3] create: USER_PROFILE, EXPLICIT, CONVERSATION_SUMMARY')
  const profile = userProfile(
    `${RUN_TAG}-profile`,
    OWNER_A,
    'Likes rust and quiet mornings',
  )
  const explicit = explicitMemory(
    `${RUN_TAG}-explicit`,
    OWNER_A,
    'User said explicitly: call me Doc',
  )
  const summary = summaryMemory(
    `${RUN_TAG}-summary`,
    OWNER_A,
    'Talked about database migrations',
    `${RUN_TAG}-conversation`,
    42,
  )

  assert.deepStrictEqual(
    await repo.create(profile),
    profile,
    'create(USER_PROFILE) round-trips',
  )
  assert.deepStrictEqual(
    await repo.create(explicit),
    explicit,
    'create(EXPLICIT) round-trips',
  )
  assert.deepStrictEqual(
    await repo.create(summary),
    summary,
    'create(CONVERSATION_SUMMARY) round-trips',
  )

  // --- 4. getById() --------------------------------------------------------
  console.log('[4] getById: hit and miss')
  assert.deepStrictEqual(
    await repo.getById(profile.id),
    profile,
    'getById returns the stored memory',
  )
  assert.strictEqual(
    await repo.getById(`${RUN_TAG}-does-not-exist`),
    undefined,
    'getById returns undefined (not null) for a missing id',
  )

  // --- 5. getByOwner() -----------------------------------------------------
  console.log("[5] getByOwner: exactly this owner's memories")
  assert.deepStrictEqual(
    new Set((await repo.getByOwner(OWNER_A)).map((m) => m.id)),
    new Set([profile.id, explicit.id, summary.id]),
    "getByOwner returns exactly owner A's three memories",
  )

  // --- 6. owner isolation --------------------------------------------------
  console.log('[6] owner isolation')
  const ownerBMemory = explicitMemory(
    `${RUN_TAG}-owner-b`,
    OWNER_B,
    'Belongs to owner B',
  )
  await repo.create(ownerBMemory)

  const ownerBMemories = await repo.getByOwner(OWNER_B)
  assert.deepStrictEqual(
    new Set(ownerBMemories.map((m) => m.id)),
    new Set([ownerBMemory.id]),
    "getByOwner(B) returns exactly owner B's memories",
  )
  assert.ok(
    !ownerBMemories.some((m) => m.id === profile.id),
    "owner B never sees owner A's memories",
  )
  assert.deepStrictEqual(
    await repo.getByOwner(OWNER_EMPTY),
    [],
    'getByOwner returns [] for an owner with no memories',
  )

  // --- 7. update() on an existing memory -----------------------------------
  console.log('[7] update: existing memory')
  const updatedProfile = userProfile(
    profile.id,
    OWNER_A,
    'Updated: also likes TypeScript',
    UPDATED_TIMESTAMPS,
  )
  assert.deepStrictEqual(
    await repo.update(updatedProfile),
    updatedProfile,
    'update returns the updated memory',
  )
  assert.deepStrictEqual(
    await repo.getById(profile.id),
    updatedProfile,
    'update persists',
  )

  // --- 7b. update() on an existing CONVERSATION_SUMMARY --------------------

  console.log('[7b] update: existing CONVERSATION_SUMMARY')
  const updatedSummary = summaryMemory(
    summary.id,
    OWNER_A,
    'Updated summary: covered Prisma migrations and integration testing',
    `${RUN_TAG}-conversation-updated`,
    137,
    SUMMARY_UPDATED_TIMESTAMPS,
  )
  assert.deepStrictEqual(
    await repo.update(updatedSummary),
    updatedSummary,
    'update returns the updated CONVERSATION_SUMMARY',
  )
  assert.deepStrictEqual(
    await repo.getById(summary.id),
    updatedSummary,
    'getById returns the updated CONVERSATION_SUMMARY',
  )

  // --- 8. update() on a missing memory -------------------------------------
  console.log('[8] update: missing memory throws the contract error')
  const neverCreated = userProfile(`${RUN_TAG}-never-created`, OWNER_A, 'ghost')
  await assert.rejects(
    () => repo.update(neverCreated),
    (error: unknown) =>
      error instanceof Error &&
      error.message ===
        `Cannot update memory: no memory found with id "${neverCreated.id}"`,
    'update of a missing id throws the exact contract error',
  )

  // --- 9. delete() on an existing memory -----------------------------------
  console.log('[9] delete: existing memory')
  assert.strictEqual(
    await repo.delete(explicit.id),
    true,
    'delete returns true for an existing memory',
  )
  assert.strictEqual(
    await repo.getById(explicit.id),
    undefined,
    'deleted memory is gone',
  )

  // --- 10. delete() on a missing memory ------------------------------------
  console.log('[10] delete: missing memory')
  assert.strictEqual(
    await repo.delete(explicit.id),
    false,
    'delete returns false the second time',
  )
  assert.strictEqual(
    await repo.delete(`${RUN_TAG}-does-not-exist`),
    false,
    'delete returns false for a never-created id',
  )

  // --- 11. duplicate-id create() replaces (Map.set semantics) --------------
  console.log('[11] duplicate-id create replaces the row')
  // Re-creating an existing id with a DIFFERENT variant must fully replace
  // the row — type, content, timestamps — and clear the summary columns.
  const replacement = explicitMemory(
    summary.id,
    OWNER_A,
    'Replaced by an EXPLICIT memory',
    REPLACEMENT_TIMESTAMPS,
  )
  assert.deepStrictEqual(
    await repo.create(replacement),
    replacement,
    'duplicate-id create returns the replacement',
  )
  assert.deepStrictEqual(
    await repo.getById(summary.id),
    replacement,
    'duplicate-id create replaced the stored row',
  )
  assert.deepStrictEqual(
    new Set((await repo.getByOwner(OWNER_A)).map((m) => m.id)),
    new Set([profile.id, summary.id]),
    'duplicate-id create replaced in place (no extra row for owner A)',
  )

  // --- 12. BigInt ↔ number round-trip ---------------------------------------
  console.log('[12] BigInt ↔ number round-trip')
  // Every deepStrictEqual above already asserts strict === on the timestamps;
  // these two checks document the intent explicitly.
  const stored = await repo.getById(profile.id)
  assert.ok(stored !== undefined, 'updated profile must exist')
  assert.strictEqual(
    stored.createdAt,
    CREATED_AT,
    'createdAt survives BigInt → number exactly',
  )
  assert.strictEqual(
    stored.updatedAt,
    UPDATED_AT + 1000,
    'updatedAt survives BigInt → number exactly',
  )

  // --- 13. conversation-summary fields, incl. malformed-row guard -----------
  console.log('[13] summary fields + malformed-row guard')
  // Happy path is covered above (create/getById/getByOwner/update of `summary`
  // and its replacement). Here: a row violating the summary invariant — the
  // schema permits it, the Memory model does not — must fail loudly on read.
  await prisma.memory.create({
    data: {
      id: `${RUN_TAG}-malformed-summary`,
      ownerId: OWNER_C,
      type: 'CONVERSATION_SUMMARY',
      content: 'malformed on purpose',
      conversationId: null, // schema allows null; the domain does not
      sourceMessageCount: null,
      createdAt: BigInt(CREATED_AT),
      updatedAt: BigInt(UPDATED_AT),
    },
  })
  await assert.rejects(
    () => repo.getById(`${RUN_TAG}-malformed-summary`),
    /Invalid CONVERSATION_SUMMARY row/,
    'getById throws on a malformed summary row',
  )
  await assert.rejects(
    () => repo.getByOwner(OWNER_C),
    /Invalid CONVERSATION_SUMMARY row/,
    'getByOwner throws on a malformed summary row',
  )
}

async function main(): Promise<void> {
  try {
    await runTests()
  } finally {
    // 14. Post-sweep: remove every row this test created (or left behind
    // mid-run by a failure), then prove the table is clean.
    await sweepTestRows()
    const remaining = await prisma.memory.count({
      where: { ownerId: { startsWith: TEST_OWNER_PREFIX } },
    })
    assert.strictEqual(
      remaining,
      0,
      'cleanup must remove every test-created row',
    )
  }
}

main()
  .then(() => {
    console.log('PostgresMemoryRepositoryTest: all checks passed.')
  })
  .catch((error: unknown) => {
    console.error('PostgresMemoryRepositoryTest FAILED:', error)
    process.exitCode = 1
  })
  .finally(() => {
    // Always release the pool so tsx exits cleanly. Swallow disconnect
    // errors: if the database is unreachable, the test has already failed.
    void prisma.$disconnect().catch(() => {})
  })
