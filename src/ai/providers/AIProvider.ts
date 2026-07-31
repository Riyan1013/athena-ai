/**
 * Contract that every AI provider must implement.
 *
 * Athena communicates only through this interface,
 * allowing different AI models to be swapped without
 * changing the rest of the application.
 */
export interface AIProvider {
  /**
   * Generates a response from the AI model.
   *
   * @param prompt The fully prepared prompt.
   * @returns The generated response.
   */
  generateResponse(prompt: string): Promise<string>
}
