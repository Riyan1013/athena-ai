import { GoogleGenAI } from '@google/genai'

import { env } from '../../config/env.js'
import type { AIProvider } from './AIProvider.js'

const MODEL_NAME = 'gemini-2.5-flash'

/**
 * Google Gemini implementation of the AIProvider contract.
 */
export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured.')
    }

    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  }

  async generateResponse(
    prompt: string,
    maxOutputTokens?: number,
  ): Promise<string> {
    const startedAt = Date.now()

    // Short-response requests (a maxOutputTokens cap is set) don't need
    // Gemini's extended reasoning, so thinking is disabled for them.
    // Unbounded requests keep the model's default thinking behavior.
    const thinkingBudget = maxOutputTokens === undefined ? undefined : 0

    const result = await this.client.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      config: {
        maxOutputTokens,
        thinkingConfig:
          thinkingBudget === undefined ? undefined : { thinkingBudget },
      },
    })

    const latency = Date.now() - startedAt
    const usage = result.usageMetadata

    if (usage) {
      console.log(`
🦉 Athena Usage
────────────────────────────────
Model            : ${MODEL_NAME}
Prompt Tokens    : ${usage.promptTokenCount}
Response Tokens  : ${usage.candidatesTokenCount}
Total Tokens     : ${usage.totalTokenCount}
Latency          : ${latency} ms
────────────────────────────────
`)
    }

    return result.text ?? ''
  }
}
