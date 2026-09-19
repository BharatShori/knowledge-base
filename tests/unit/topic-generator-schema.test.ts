import { describe, expect, it } from "vitest";
import { topicBatchResponseSchema } from "@/lib/topic-generator/schema";

function validTopic(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: "Circuit Breaker Pattern",
    summary: "Prevents cascading failures by short-circuiting calls to a failing dependency.",
    content: "## Definition\nA circuit breaker stops calls to a failing dependency.",
    tags: ["Resilience", "Architecture"],
    relatedTopics: ["Microservices"],
    ...overrides,
  };
}

function validCategoryReferenceCard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    summary: "Quick reference for resilience patterns.",
    content: "## Key Points\n- Circuit breaker\n- Bulkhead",
    tags: ["Reference Card", "Cheat Sheet"],
    ...overrides,
  };
}

describe("topicBatchResponseSchema", () => {
  it("accepts a well-formed batch when no reference card is required", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [validTopic(), validTopic({ title: "Bulkhead Pattern" })],
    });
    expect(result.success).toBe(true);
  });

  it("accepts fewer topics than the max (comprehensive coverage case)", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [validTopic()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty batch", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({ topics: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a batch larger than the max size", () => {
    const result = topicBatchResponseSchema(2, false).safeParse({
      topics: [
        validTopic(),
        validTopic({ title: "Bulkhead Pattern" }),
        validTopic({ title: "Saga Pattern" }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a topic missing required fields", () => {
    const withoutContent: Record<string, unknown> = validTopic();
    delete withoutContent.content;
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [withoutContent],
    });
    expect(result.success).toBe(false);
  });

  it("requires categoryReferenceCard when the category doesn't already have one", () => {
    const result = topicBatchResponseSchema(10, true).safeParse({
      topics: [validTopic()],
    });
    expect(result.success).toBe(false);
  });

  it("accepts categoryReferenceCard when required and present", () => {
    const result = topicBatchResponseSchema(10, true).safeParse({
      topics: [validTopic()],
      categoryReferenceCard: validCategoryReferenceCard(),
    });
    expect(result.success).toBe(true);
  });

  it("does not require categoryReferenceCard when the category already has one", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [validTopic()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid categoryReferenceCard missing content", () => {
    const invalidCard: Record<string, unknown> = validCategoryReferenceCard();
    delete invalidCard.content;
    const result = topicBatchResponseSchema(10, true).safeParse({
      topics: [validTopic()],
      categoryReferenceCard: invalidCard,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate topic titles within the same batch", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [validTopic(), validTopic()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate titles that only differ by case or punctuation", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [validTopic(), validTopic({ title: "circuit-breaker pattern!" })],
    });
    expect(result.success).toBe(false);
  });

  it("defaults tags and relatedTopics to empty arrays when omitted", () => {
    const topicWithoutArrays: Record<string, unknown> = validTopic();
    delete topicWithoutArrays.tags;
    delete topicWithoutArrays.relatedTopics;
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [topicWithoutArrays],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topics[0].tags).toEqual([]);
      expect(result.data.topics[0].relatedTopics).toEqual([]);
    }
  });

  it("rejects unexpected extra fields on a topic", () => {
    const result = topicBatchResponseSchema(10, false).safeParse({
      topics: [{ ...validTopic(), category: "Architecture" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a response that is not an object", () => {
    expect(topicBatchResponseSchema(10, false).safeParse(null).success).toBe(false);
    expect(topicBatchResponseSchema(10, false).safeParse("not json").success).toBe(
      false,
    );
    expect(topicBatchResponseSchema(10, false).safeParse([]).success).toBe(false);
  });
});
