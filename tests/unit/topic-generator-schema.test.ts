import { describe, expect, it } from "vitest";
import { topicBatchResponseSchema } from "@/lib/topic-generator/schema";

function validPair(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    topic: {
      title: "Circuit Breaker Pattern",
      summary: "Prevents cascading failures by short-circuiting calls to a failing dependency.",
      content: "## Definition\nA circuit breaker stops calls to a failing dependency.",
      tags: ["Resilience", "Architecture"],
      relatedTopics: ["Microservices"],
      ...(overrides.topic as object),
    },
    referenceCard: {
      summary: "Quick reference for circuit breaker states and configuration.",
      content: "## States\n- Closed\n- Open\n- Half-Open",
      tags: ["Reference Card", "Cheat Sheet"],
      relatedTopics: [],
      ...(overrides.referenceCard as object),
    },
  };
}

describe("topicBatchResponseSchema", () => {
  it("accepts a well-formed batch within the max size", () => {
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [validPair(), validPair({ topic: { title: "Bulkhead Pattern" } })],
    });
    expect(result.success).toBe(true);
  });

  it("accepts fewer topics than the max (comprehensive coverage case)", () => {
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [validPair()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty batch", () => {
    const result = topicBatchResponseSchema(10).safeParse({ topics: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a batch larger than the max size", () => {
    const result = topicBatchResponseSchema(2).safeParse({
      topics: [
        validPair(),
        validPair({ topic: { title: "Bulkhead Pattern" } }),
        validPair({ topic: { title: "Saga Pattern" } }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a topic missing required fields", () => {
    const pair = validPair();
    const withoutContent: Record<string, unknown> = { ...pair.topic };
    delete withoutContent.content;
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [{ ...pair, topic: withoutContent }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing Reference Card", () => {
    const pair = validPair();
    const withoutReferenceCard: Record<string, unknown> = { ...pair };
    delete withoutReferenceCard.referenceCard;
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [withoutReferenceCard],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid Reference Card missing content", () => {
    const pair = validPair();
    const invalidReferenceCard: Record<string, unknown> = { ...pair.referenceCard };
    delete invalidReferenceCard.content;
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [{ ...pair, referenceCard: invalidReferenceCard }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate topic titles within the same batch", () => {
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [validPair(), validPair()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate titles that only differ by case or punctuation", () => {
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [
        validPair(),
        validPair({ topic: { title: "circuit-breaker pattern!" } }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("defaults tags and relatedTopics to empty arrays when omitted", () => {
    const pair = validPair();
    const topicWithoutArrays: Record<string, unknown> = { ...pair.topic };
    delete topicWithoutArrays.tags;
    delete topicWithoutArrays.relatedTopics;
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [{ ...pair, topic: topicWithoutArrays }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topics[0].topic.tags).toEqual([]);
      expect(result.data.topics[0].topic.relatedTopics).toEqual([]);
    }
  });

  it("rejects unexpected extra fields on a topic", () => {
    const pair = validPair();
    const result = topicBatchResponseSchema(10).safeParse({
      topics: [{ ...pair, topic: { ...pair.topic, category: "Architecture" } }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a response that is not an object", () => {
    expect(topicBatchResponseSchema(10).safeParse(null).success).toBe(false);
    expect(topicBatchResponseSchema(10).safeParse("not json").success).toBe(false);
    expect(topicBatchResponseSchema(10).safeParse([]).success).toBe(false);
  });
});
