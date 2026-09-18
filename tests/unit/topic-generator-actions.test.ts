import { beforeEach, describe, expect, it, vi } from "vitest";

const categoryFindUnique = vi.fn();
const topicFindMany = vi.fn();
const topicFindUnique = vi.fn();
const topicCreate = vi.fn();
const tagUpsert = vi.fn();
const topicRelationUpsert = vi.fn();

const mockTx = {
  topic: {
    findMany: (...args: unknown[]) => topicFindMany(...args),
    findUnique: (...args: unknown[]) => topicFindUnique(...args),
    create: (...args: unknown[]) => topicCreate(...args),
  },
  tag: { upsert: (...args: unknown[]) => tagUpsert(...args) },
  topicRelation: { upsert: (...args: unknown[]) => topicRelationUpsert(...args) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    category: { findUnique: (...args: unknown[]) => categoryFindUnique(...args) },
    $transaction: (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/ai", () => ({
  getAIProvider: () => ({
    name: "groq",
    model: "test-model",
    generateJson: vi.fn(),
  }),
}));

const { saveGeneratedTopics } = await import("@/actions/topic-generator");

const CATEGORY = { id: "cat-1", name: "Software Architecture" };

function validPair(title: string, relatedTopics: string[] = []) {
  return {
    topic: {
      title,
      summary: "A concise summary of the topic.",
      content: "## Overview\nSubstantial markdown content about the topic.",
      tags: ["Architecture"],
      relatedTopics,
    },
    referenceCard: {
      summary: "Quick reference summary.",
      content: "## Key Points\n- One\n- Two",
      tags: ["Custom Tag"],
      relatedTopics: [],
    },
  };
}

beforeEach(() => {
  categoryFindUnique.mockReset();
  topicFindMany.mockReset();
  topicFindUnique.mockReset();
  topicCreate.mockReset();
  tagUpsert.mockReset();
  topicRelationUpsert.mockReset();

  categoryFindUnique.mockResolvedValue(CATEGORY);
  topicFindUnique.mockResolvedValue(null); // no slug collisions by default
  tagUpsert.mockImplementation(async ({ where }: { where: { name: string } }) => ({
    id: `tag-${where.name}`,
    name: where.name,
  }));
  topicCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `id-${data.slug}`,
    ...data,
  }));
});

describe("saveGeneratedTopics", () => {
  it("returns an error when the category is required but missing", async () => {
    expect(await saveGeneratedTopics("", [validPair("A")])).toEqual({
      error: "Category is required.",
    });
  });

  it("returns an error for invalid/tampered candidate data", async () => {
    const result = await saveGeneratedTopics(CATEGORY.id, [{ not: "valid" }]);
    expect(result).toEqual({ error: "Invalid topic data." });
  });

  it("returns an error when the category no longer exists", async () => {
    categoryFindUnique.mockResolvedValueOnce(null);
    const result = await saveGeneratedTopics(CATEGORY.id, [validPair("A")]);
    expect(result).toEqual({ error: "Category not found." });
  });

  it("inserts each selected topic and its Reference Card", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    const result = await saveGeneratedTopics(CATEGORY.id, [
      validPair("Circuit Breaker Pattern"),
      validPair("Saga Pattern"),
    ]);

    expect(result.success).toBe(true);
    expect(topicCreate).toHaveBeenCalledTimes(4); // 2 topics + 2 reference cards
    if (result.success) {
      expect(result.createdTopicIds).toHaveLength(4);
      expect(result.skippedDuplicateTitles).toEqual([]);
    }
  });

  it("only persists the candidates it was given, nothing extra", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    await saveGeneratedTopics(CATEGORY.id, [validPair("Only This One")]);
    expect(topicCreate).toHaveBeenCalledTimes(2); // topic + reference card
  });

  it("associates the topic and its Reference Card with the same category and a derived title", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    await saveGeneratedTopics(CATEGORY.id, [validPair("Bulkhead Pattern")]);

    const [topicCall, referenceCardCall] = topicCreate.mock.calls;
    expect(topicCall[0].data.title).toBe("Bulkhead Pattern");
    expect(topicCall[0].data.categoryId).toBe(CATEGORY.id);
    expect(referenceCardCall[0].data.title).toBe("Bulkhead Pattern — Reference Card");
    expect(referenceCardCall[0].data.categoryId).toBe(CATEGORY.id);
  });

  it("always tags the Reference Card with 'Reference Card' and 'Cheat Sheet'", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    await saveGeneratedTopics(CATEGORY.id, [validPair("Bulkhead Pattern")]);

    const tagNames = tagUpsert.mock.calls.map((call) => call[0].where.name);
    expect(tagNames).toContain("reference card");
    expect(tagNames).toContain("cheat sheet");
  });

  it("does not insert a candidate that exactly duplicates an existing topic title", async () => {
    topicFindMany.mockResolvedValueOnce([
      { id: "existing-1", title: "Circuit Breaker Pattern" },
    ]);
    const result = await saveGeneratedTopics(CATEGORY.id, [
      validPair("Circuit Breaker Pattern"),
      validPair("Saga Pattern"),
    ]);

    expect(topicCreate).toHaveBeenCalledTimes(2); // only Saga Pattern + its card
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.skippedDuplicateTitles).toEqual(["Circuit Breaker Pattern"]);
      expect(result.createdTopicIds).toHaveLength(2);
    }
  });

  it("persists AI generation metadata on every created record", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    await saveGeneratedTopics(CATEGORY.id, [validPair("Bulkhead Pattern")]);

    for (const call of topicCreate.mock.calls) {
      expect(call[0].data.aiGenerated).toBe(true);
      expect(call[0].data.aiProvider).toBe("groq");
      expect(call[0].data.aiModel).toBe("test-model");
      expect(typeof call[0].data.aiBatchId).toBe("string");
    }
    const batchIds = new Set(topicCreate.mock.calls.map((call) => call[0].data.aiBatchId));
    expect(batchIds.size).toBe(1); // same batch id across the whole save
  });

  it("links relatedTopics between candidates created in the same batch", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    await saveGeneratedTopics(CATEGORY.id, [
      validPair("Circuit Breaker Pattern"),
      validPair("Saga Pattern", ["Circuit Breaker Pattern"]),
    ]);

    expect(topicRelationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          fromTopicId: "id-saga-pattern",
          toTopicId: "id-circuit-breaker-pattern",
        },
      }),
    );
  });

  it("silently drops a relatedTopics entry that cannot be resolved", async () => {
    topicFindMany.mockResolvedValueOnce([]);
    await saveGeneratedTopics(CATEGORY.id, [
      validPair("Saga Pattern", ["Some Topic That Does Not Exist"]),
    ]);
    expect(topicRelationUpsert).not.toHaveBeenCalled();
  });
});
