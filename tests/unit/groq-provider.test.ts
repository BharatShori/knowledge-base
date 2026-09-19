import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";

const mockCreate = vi.fn();

vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class MockOpenAI {
    chat = { completions: { create: (...args: unknown[]) => mockCreate(...args) } };
  }
  Object.assign(MockOpenAI, actual.default);
  return { ...actual, default: MockOpenAI };
});

const { GroqProvider } = await import("@/lib/ai/groq-provider");

function tokenBudgetError() {
  return OpenAI.APIError.generate(
    400,
    {
      error: {
        code: "json_validate_failed",
        message: "max completion tokens reached before generating a valid document",
      },
    },
    undefined,
    new Headers(),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GroqProvider", () => {
  it("throws a clear error when GROQ_API_KEY is missing", () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect(() => new GroqProvider()).toThrow("GROQ_API_KEY is not configured.");
  });

  it("defaults to openai/gpt-oss-120b when GROQ_MODEL is not set", () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "");
    const provider = new GroqProvider();
    expect(provider.model).toBe("openai/gpt-oss-120b");
    expect(provider.name).toBe("groq");
  });

  it("uses GROQ_MODEL when set", () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    const provider = new GroqProvider();
    expect(provider.model).toBe("openai/gpt-oss-20b");
  });
});

describe("GroqProvider.generateJson", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    vi.stubEnv("GROQ_API_KEY", "test-key");
  });

  it("retries once after a token-budget error and returns the retry's result", async () => {
    mockCreate
      .mockRejectedValueOnce(tokenBudgetError())
      .mockResolvedValueOnce({ choices: [{ message: { content: '{"ok":true}' } }] });

    const provider = new GroqProvider();
    const result = await provider.generateJson([{ role: "user", content: "hi" }]);

    expect(result).toEqual({ ok: true });
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("surfaces a clear error when the retry also hits the token budget", async () => {
    mockCreate.mockRejectedValue(tokenBudgetError());
    const provider = new GroqProvider();

    await expect(
      provider.generateJson([{ role: "user", content: "hi" }]),
    ).rejects.toThrow(/ran out of output tokens/);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry for unrelated errors", async () => {
    mockCreate.mockRejectedValue(
      OpenAI.APIError.generate(
        401,
        { error: { code: "invalid_api_key" } },
        undefined,
        new Headers(),
      ),
    );
    const provider = new GroqProvider();

    await expect(
      provider.generateJson([{ role: "user", content: "hi" }]),
    ).rejects.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("succeeds on the first attempt without retrying", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"topics":[]}' } }],
    });
    const provider = new GroqProvider();

    const result = await provider.generateJson([{ role: "user", content: "hi" }]);

    expect(result).toEqual({ topics: [] });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
