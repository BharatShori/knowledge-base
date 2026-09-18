import { describe, expect, it } from "vitest";
import {
  classifyDuplicate,
  isReferenceCardTitle,
  tokenSimilarity,
} from "@/lib/topic-generator/similarity";

describe("classifyDuplicate", () => {
  const existing = [
    "Layered Architecture",
    "Hexagonal Architecture",
    "Clean Architecture",
    "Microservices",
    "Event-Driven Architecture",
  ];

  it("flags an exact duplicate", () => {
    expect(classifyDuplicate("Microservices", existing)).toEqual({
      status: "exact",
      matchedTitle: "Microservices",
    });
  });

  it("flags a duplicate that only differs by case", () => {
    expect(classifyDuplicate("microservices", existing)).toEqual({
      status: "exact",
      matchedTitle: "Microservices",
    });
  });

  it("flags a duplicate that only differs by punctuation", () => {
    expect(classifyDuplicate("Event Driven Architecture!", existing)).toEqual({
      status: "exact",
      matchedTitle: "Event-Driven Architecture",
    });
  });

  it("flags a duplicate that only differs by whitespace", () => {
    expect(classifyDuplicate("  Microservices   ", existing)).toEqual({
      status: "exact",
      matchedTitle: "Microservices",
    });
  });

  it("flags an obvious near-duplicate with reworded phrasing", () => {
    const result = classifyDuplicate("Architecture: Clean", [
      "Clean Architecture Principles",
    ]);
    expect(result.status).toBe("similar");
    expect(result.matchedTitle).toBe("Clean Architecture Principles");
  });

  it("flags the spec's own example overlap despite singular/plural wording", () => {
    const result = classifyDuplicate("API Contract Testing", [
      "Contract Testing for APIs",
    ]);
    expect(result.status).toBe("similar");
    expect(result.matchedTitle).toBe("Contract Testing for APIs");
  });

  it("does not flag an unrelated title", () => {
    expect(classifyDuplicate("Circuit Breaker Pattern", existing)).toEqual({
      status: "none",
    });
  });

  it("does not flag a title with only incidental word overlap", () => {
    const result = classifyDuplicate("Testing Strategy", [
      "Contract Testing for APIs",
    ]);
    expect(result.status).toBe("none");
  });
});

describe("tokenSimilarity", () => {
  it("is 1 for identical titles", () => {
    expect(tokenSimilarity("Contract Testing", "Contract Testing")).toBe(1);
  });

  it("is 0 for completely unrelated titles", () => {
    expect(tokenSimilarity("Contract Testing", "Circuit Breaker")).toBe(0);
  });

  it("scores partial overlap between 0 and 1", () => {
    const similarity = tokenSimilarity(
      "API Contract Testing",
      "Contract Testing for APIs",
    );
    expect(similarity).toBeGreaterThan(0);
    expect(similarity).toBeLessThan(1);
  });
});

describe("isReferenceCardTitle", () => {
  it("identifies a reference card title", () => {
    expect(isReferenceCardTitle("Playwright — Reference Card")).toBe(true);
  });

  it("does not flag a regular topic title", () => {
    expect(isReferenceCardTitle("Playwright")).toBe(false);
  });
});
