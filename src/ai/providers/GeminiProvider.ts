import { GoogleGenerativeAI } from '@google/generative-ai'

import { env } from '../../config/env.js'
import type { AIProvider } from './AIProvider.js'

/**
 * Google Gemini implementation of the AIProvider contract.
 */
export class GeminiProvider implements AIProvider {
  private readonly model

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured.')
    }

    const client = new GoogleGenerativeAI(env.GEMINI_API_KEY)

    this.model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
    })
  }

  async generateResponse(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt)

    return result.response.text()
  }
}
