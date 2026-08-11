import { GeminiProvider } from '../ai/providers/GeminiProvider.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'

async function main() {
  const provider = new GeminiProvider()
  const conversationManager = new ConversationManager()

  const athena = new Athena(provider, conversationManager)
  const athenaUserId = 'test-athena-user'

  // ─────────────────────────────────────────
  // Conversation A
  // ─────────────────────────────────────────

  const conversationA = 'test-conversation-A'

  console.log('\n========== CONVERSATION A ==========')

  console.log('\n--- A1 ---')

  const replyA1 = await athena.ask(
    conversationA,
    athenaUserId,
    'My favorite color is blue.',
  )

  console.log('Athena:', replyA1)

  console.log('\n--- A2 ---')

  const replyA2 = await athena.ask(
    conversationA,
    athenaUserId,
    'What is my favorite color?',
  )

  console.log('Athena:', replyA2)

  // ─────────────────────────────────────────
  // Conversation B
  // ─────────────────────────────────────────

  const conversationB = 'test-conversation-B'

  console.log('\n========== CONVERSATION B ==========')

  console.log('\n--- B1 ---')

  const replyB1 = await athena.ask(
    conversationB,
    athenaUserId,
    'What is my favorite color?',
  )

  console.log('Athena:', replyB1)

  // ─────────────────────────────────────────
  // Return to Conversation A
  // ─────────────────────────────────────────

  console.log('\n========== BACK TO CONVERSATION A ==========')

  console.log('\n--- A3 ---')

  const replyA3 = await athena.ask(
    conversationA,
    athenaUserId,
    'Do you remember what my favorite color is?',
  )

  console.log('Athena:', replyA3)
}

main().catch(console.error)
