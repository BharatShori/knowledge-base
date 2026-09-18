import { GroqProvider } from "./groq-provider";
import type { AIProvider } from "./provider";

export type { AIProvider, ChatMessage } from "./provider";

/** Single place to swap the active AI provider later (Ollama, OpenAI, etc). */
export function getAIProvider(): AIProvider {
  return new GroqProvider();
}
