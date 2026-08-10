import { GeminiProvider } from '../ai/providers/GeminiProvider.js'
import { ConversationManager } from '../conversation/ConversationManager.js'
import { Athena } from '../core/Athena.js'

async function main() {
  const provider = new GeminiProvider()
  const conversationManager = new ConversationManager()

  const athena = new Athena(provider, conversationManager)

  const conversationId = 'test-conversation'

  console.log('\n--- Turn 1 ---')

  const reply1 = await athena.ask(conversationId, 'My name is Riyan.')

  console.log('Athena:', reply1)

  console.log('\n--- Turn 2 ---')

  const reply2 = await athena.ask(conversationId, 'What is my name?')

  console.log('Athena:', reply2)

  console.log('\n--- Turn 3 ---')

  const reply3 = await athena.ask(
    conversationId,
    'What did I tell you about myself?',
  )

  console.log('Athena:', reply3)
}

main().catch(console.error)
