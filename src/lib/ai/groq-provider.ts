import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "./provider";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 30_000;

export class GroqProvider implements AIProvider {
  readonly name = "groq";
  readonly model: string;
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }
    this.model = process.env.GROQ_MODEL || DEFAULT_MODEL;
    this.client = new OpenAI({
      apiKey,
      // Overridable so e2e tests can point this at a local mock server
      // instead of the real Groq API (see tests/e2e/quiz.spec.ts).
      baseURL: process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    });
  }

  async generateJson(messages: ChatMessage[]): Promise<unknown> {
    let content: string | null | undefined;
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.4,
      });
      content = completion.choices[0]?.message?.content;
    } catch (error) {
      throw new Error(normalizeGroqError(error));
    }

    if (!content) {
      throw new Error("Groq returned an empty response.");
    }
    try {
      return JSON.parse(content);
    } catch {
      throw new Error("Groq returned a response that was not valid JSON.");
    }
  }
}

function normalizeGroqError(error: unknown): string {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return "The request to Groq timed out.";
  }
  if (error instanceof OpenAI.RateLimitError) {
    return "The Groq API rate limit was reached. Please try again shortly.";
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return "Groq rejected the configured API key.";
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return "Could not reach the Groq API.";
  }
  if (error instanceof OpenAI.APIError) {
    return `Groq API error (${error.status ?? "unknown"}).`;
  }
  return "Groq API request failed.";
}
