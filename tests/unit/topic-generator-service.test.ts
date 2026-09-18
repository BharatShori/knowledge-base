import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProvider, ChatMessage } from "@/lib/ai/provider";

const categoryFindUnique = vi.fn();
const topicFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    category: { findUnique: (...args: unknown[]) => categoryFindUnique(...args) },
    topic: { findMany: (...args: unknown[]) => topicFindMany(...args) },
  },
}));

const { generateTopicBatch } = await import("@/lib/topic-generator/service");

const CATEGORY = { id: "cat-1", name: "Software Architecture" };

function fakeProvider(generateJson: AIProvider["generateJson"]): AIProvider {
  return { name: "fake", model: "fake-model", generateJson };
}

function validTopicPair(title: string) {
  return {
    topic: {
      title,
      summary: "A concise summary of the topic.",
      content: "## Overview\nSubstantial markdown content about the topic.",
      tags: ["Architecture"],
      relatedTopics: [],
    },
    referenceCard: {
      summary: "Quick reference summary.",
      content: "## Key Points\n- One\n- Two",
      tags: ["Reference Card", "Cheat Sheet"],
      relatedTopics: [],
    },
  };
}

function validBatchJson(count: number) {
  return {
    topics: Array.from({ length: count }, (_, index) =>
      validTopicPair(`Generated Topic ${index + 1}`),
    ),
  };
}

beforeEach(() => {
  categoryFindUnique.mockReset();
  topicFindMany.mockReset();
});

describe("generateTopicBatch", () => {
  it("returns an error when the category does not exist", async () => {
    categoryFindUnique.mockResolvedValueOnce(null);
    const result = await generateTopicBatch(
      { categoryId: "missing" },
      fakeProvider(vi.fn()),
    );
    expect(result).toEqual({ ok: false, error: "Category not found." });
  });

  it("returns validated candidates for a well-formed response", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany
      .mockResolvedValueOnce([{ title: "Layered Architecture" }])
      .mockResolvedValueOnce([{ title: "Layered Architecture" }]);
    const generateJson = vi.fn().mockResolvedValue(validBatchJson(10));

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidates).toHaveLength(10);
      expect(result.candidates.every((c) => c.duplicateStatus === "none")).toBe(true);
      expect(result.provider).toBe("fake");
      expect(result.model).toBe("fake-model");
    }
  });

  it("allows fewer than the max batch size (comprehensive coverage case)", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const generateJson = vi.fn().mockResolvedValue(validBatchJson(3));

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.candidates).toHaveLength(3);
  });

  it("flags a candidate that exactly matches an existing topic title", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany
      .mockResolvedValueOnce([{ title: "Generated Topic 1" }])
      .mockResolvedValueOnce([{ title: "Generated Topic 1" }]);
    const generateJson = vi.fn().mockResolvedValue(validBatchJson(2));

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidates[0].duplicateStatus).toBe("exact");
      expect(result.candidates[0].matchedTitle).toBe("Generated Topic 1");
      expect(result.candidates[1].duplicateStatus).toBe("none");
    }
  });

  it("flags a candidate that is a near-duplicate of an existing topic title", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany
      .mockResolvedValueOnce([{ title: "Contract Testing for APIs" }])
      .mockResolvedValueOnce([{ title: "Contract Testing for APIs" }]);
    const generateJson = vi
      .fn()
      .mockResolvedValue({ topics: [validTopicPair("API Contract Testing")] });

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.candidates[0].duplicateStatus).toBe("similar");
  });

  it("excludes existing Reference Card titles from duplicate context", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany
      .mockResolvedValueOnce([{ title: "Circuit Breaker Pattern — Reference Card" }])
      .mockResolvedValueOnce([{ title: "Circuit Breaker Pattern — Reference Card" }]);
    const generateJson = vi
      .fn()
      .mockResolvedValue({ topics: [validTopicPair("Circuit Breaker Pattern")] });

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.candidates[0].duplicateStatus).toBe("none");
  });

  it("returns a generic error for a malformed (empty) response", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const generateJson = vi.fn().mockResolvedValue({ topics: [] });

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );
    expect(result).toEqual({
      ok: false,
      error: "Unable to generate topics right now. Please try again.",
    });
  });

  it("returns a generic error when a topic is missing required fields", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const badPair = validTopicPair("Broken Topic");
    // @ts-expect-error intentionally malformed for the test
    delete badPair.topic.content;
    const generateJson = vi.fn().mockResolvedValue({ topics: [badPair] });

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the Reference Card is missing", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const badPair: Record<string, unknown> = validTopicPair("Broken Topic");
    delete badPair.referenceCard;
    const generateJson = vi.fn().mockResolvedValue({ topics: [badPair] });

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the batch contains duplicate generated titles", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const generateJson = vi.fn().mockResolvedValue({
      topics: [validTopicPair("Same Title"), validTopicPair("Same Title")],
    });

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the provider call fails", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const generateJson = vi.fn().mockRejectedValue(new Error("Groq API error (500)."));

    const result = await generateTopicBatch(
      { categoryId: CATEGORY.id },
      fakeProvider(generateJson),
    );
    expect(result).toEqual({
      ok: false,
      error: "Unable to generate topics right now. Please try again.",
    });
  });

  it("returns a 'not configured' error when no provider is available", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.stubEnv("GROQ_API_KEY", "");

    const result = await generateTopicBatch({ categoryId: CATEGORY.id });
    expect(result).toEqual({
      ok: false,
      error: "Topic generation is not configured.",
    });
    vi.unstubAllEnvs();
  });

  it("passes excludeTitles through to the prompt so regeneration avoids repeats", async () => {
    categoryFindUnique.mockResolvedValueOnce(CATEGORY);
    topicFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const generateJson = vi.fn().mockResolvedValue(validBatchJson(1));

    await generateTopicBatch(
      { categoryId: CATEGORY.id, excludeTitles: ["Rejected Topic Title"] },
      fakeProvider(generateJson),
    );

    const messages = generateJson.mock.calls[0][0] as ChatMessage[];
    const userMessage = messages.find((message) => message.role === "user");
    expect(userMessage?.content).toContain("Rejected Topic Title");
  });
});
