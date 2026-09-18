import { afterEach, describe, expect, it, vi } from "vitest";
import { GroqProvider } from "@/lib/ai/groq-provider";

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
