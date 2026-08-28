import { prisma } from './prismaClient.js'

/**
 * Schema-level smoke test for the `memories` table (Checkpoint 2).
 *
 * This intentionally uses the raw generated Prisma client directly —
 * NOT MemoryRepository or MemoryManager, which don't have a Postgres
 * implementation yet.
 *
 * Run explicitly via:
 *
 *   pnpm db:verify-schema
 *
 * All rows created here are deleted at the end.
 */

const TEST_OWNER_A = `verify-schema-owner-a-${Date.now()}`
const TEST_OWNER_B = `verify-schema-owner-b-${Date.now()}`
const TEST_CONVERSATION = `verify-schema-conv-${Date.now()}`

const createdIds: string[] = []

async function cleanup(): Promise<void> {
  if (createdIds.length > 0) {
    await prisma.memory.deleteMany({
      where: { id: { in: createdIds } },
    })
  }
}

async function main(): Promise<void> {
  let failed = false

  try {
    console.log('🔍 Verifying memories table schema...')

    const now = Date.now()

    // 1. Insert USER_PROFILE.
    const profile = await prisma.memory.create({
      data: {
        id: `${TEST_OWNER_A}-profile`,
        ownerId: TEST_OWNER_A,
        type: 'USER_PROFILE',
        content: 'Schema verification profile.',
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    })

    createdIds.push(profile.id)
    console.log('✅ Inserted USER_PROFILE row.')

    // 2. Insert EXPLICIT.
    const explicit = await prisma.memory.create({
      data: {
        id: `${TEST_OWNER_A}-explicit`,
        ownerId: TEST_OWNER_A,
        type: 'EXPLICIT',
        content: 'Schema verification explicit memory.',
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    })

    createdIds.push(explicit.id)
    console.log('✅ Inserted EXPLICIT row.')

    // 3. Insert CONVERSATION_SUMMARY.
    const summary = await prisma.memory.create({
      data: {
        id: `${TEST_OWNER_A}-summary`,
        ownerId: TEST_OWNER_A,
        type: 'CONVERSATION_SUMMARY',
        content: 'Schema verification summary.',
        conversationId: TEST_CONVERSATION,
        sourceMessageCount: 10,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    })

    createdIds.push(summary.id)
    console.log(
      '✅ Inserted CONVERSATION_SUMMARY row with nullable fields populated.',
    )

    // 4. Confirm nullable fields are null for non-summary memories.
    const fetchedProfile = await prisma.memory.findUniqueOrThrow({
      where: { id: profile.id },
    })

    if (
      fetchedProfile.conversationId !== null ||
      fetchedProfile.sourceMessageCount !== null
    ) {
      throw new Error(
        'Expected USER_PROFILE row to have null conversationId/sourceMessageCount.',
      )
    }

    console.log('✅ Nullable fields correctly null for non-summary type.')

    // 5. Confirm summary fields round-trip correctly.
    const fetchedSummary = await prisma.memory.findUniqueOrThrow({
      where: { id: summary.id },
    })

    if (
      fetchedSummary.conversationId !== TEST_CONVERSATION ||
      fetchedSummary.sourceMessageCount !== 10
    ) {
      throw new Error('CONVERSATION_SUMMARY row did not round-trip correctly.')
    }

    console.log('✅ CONVERSATION_SUMMARY fields round-trip correctly.')

    // 6. Confirm the database rejects an invalid enum value.
    let invalidTypeRejected = false

    try {
      await prisma.memory.create({
        data: {
          id: `${TEST_OWNER_A}-invalid`,
          ownerId: TEST_OWNER_A,
          type: 'NOT_A_REAL_TYPE' as never,
          content: 'This should be rejected.',
          createdAt: BigInt(now),
          updatedAt: BigInt(now),
        },
      })
    } catch {
      invalidTypeRejected = true
    }

    if (!invalidTypeRejected) {
      throw new Error(
        'Expected an invalid MemoryType value to be rejected, but it succeeded.',
      )
    }

    console.log(
      '✅ Invalid MemoryType value correctly rejected by the database.',
    )

    // 7. Confirm owner-scoped filtering.
    const otherOwnerRow = await prisma.memory.create({
      data: {
        id: `${TEST_OWNER_B}-profile`,
        ownerId: TEST_OWNER_B,
        type: 'USER_PROFILE',
        content: "Owner B's row, must not appear in Owner A's results.",
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    })

    createdIds.push(otherOwnerRow.id)

    const ownerARows = await prisma.memory.findMany({
      where: { ownerId: TEST_OWNER_A },
    })

    if (ownerARows.some((row) => row.ownerId !== TEST_OWNER_A)) {
      throw new Error(
        'Owner-scoped query returned a row belonging to a different owner.',
      )
    }

    if (ownerARows.length !== 3) {
      throw new Error(
        `Expected 3 rows for owner A, found ${ownerARows.length}.`,
      )
    }

    console.log("✅ Owner-scoped filtering returns only that owner's rows.")

    console.log('🦉 memories table schema verification: all checks passed.')
  } catch (error) {
    failed = true

    console.error('❌ Schema verification failed:')
    console.error(error instanceof Error ? error.message : error)
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }

  if (failed) {
    process.exitCode = 1
  }
}

main()
