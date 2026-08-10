export interface AIProvider {
  /**
   * Generates a response from the AI model.
   *
   * @param prompt The fully prepared prompt.
   * @param maxOutputTokens Optional maximum number of output tokens.
   * @returns The generated response.
   */
  generateResponse(prompt: string, maxOutputTokens?: number): Promise<string>
}
