import OpenAI from "openai";
import type { AIProvider, ChatMessage } from "./provider";

const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 90_000;
// gpt-oss-120b is a reasoning model: it spends part of its output budget on
// hidden reasoning tokens before the actual JSON answer, and how much it
// spends is non-deterministic — the same prompt can take anywhere from ~2k
// to 30k+ completion tokens between runs (observed directly; larger batches
// and empty-category requests, which get less "stay concise" pressure from
// existing-topic context, are more likely to run long). Without a ceiling
// at or near the model's real max, a verbose run fails outright with a 400
// "max completion tokens reached before generating a valid document" — easy
// to mistake for a timeout or rate limit. Groq bills actual tokens used, not
// this ceiling, so there's no cost to setting it to the model's true max
// (65536 for gpt-oss-120b, per GET /openai/v1/models/openai/gpt-oss-120b).
const MAX_COMPLETION_TOKENS = 65_536;

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
    // How verbose the model gets (reasoning + content) is non-deterministic,
    // so a run that exhausts the token ceiling isn't necessarily a sign the
    // next attempt will too. One retry is cheap insurance against an
    // otherwise-avoidable failure, without masking a genuine, persistent
    // problem (a second failure still surfaces as a real error).
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
        });
        content = completion.choices[0]?.message?.content;
        break;
      } catch (error) {
        if (attempt < maxAttempts && isTokenBudgetError(error)) {
          console.warn(
            "Groq ran out of output tokens; retrying once (attempt %d of %d).",
            attempt + 1,
            maxAttempts,
          );
          continue;
        }
        throw new Error(normalizeGroqError(error));
      }
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

function isTokenBudgetError(error: unknown): boolean {
  return error instanceof OpenAI.APIError && error.code === "json_validate_failed";
}

function normalizeGroqError(error: unknown): string {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return "The request to Groq timed out.";
  }
  // Groq doesn't always use HTTP 429 for rate limiting — e.g. its
  // token-throughput limit comes back as a 413 with this same error code —
  // so check the code first rather than relying only on the status class.
  if (error instanceof OpenAI.APIError && error.code === "rate_limit_exceeded") {
    return "The Groq API rate limit was reached. Please try again shortly.";
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
    if (error.code === "json_validate_failed") {
      return "Groq ran out of output tokens before finishing valid JSON (response too large for the current max_completion_tokens).";
    }
    return `Groq API error (${error.status ?? "unknown"}): ${error.code ?? error.message}`;
  }
  return "Groq API request failed.";
}
