import { GeminiProvider } from '../ai/providers/GeminiProvider.js'
import { Athena } from '../core/Athena.js'

async function main() {
  const provider = new GeminiProvider()
  const athena = new Athena(provider)

  const reply = await athena.ask(
    'Hello Athena! Introduce yourself in 3 sentences.',
  )

  console.log(reply)
}

main().catch(console.error)
