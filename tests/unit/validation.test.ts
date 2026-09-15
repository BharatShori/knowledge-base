import { describe, expect, it } from "vitest";
import {
  categorySchema,
  importPayloadSchema,
  sourceSchema,
  topicSchema,
} from "@/lib/validation";
import { slugify } from "@/lib/slug";
import { filterTopics } from "@/lib/topic-filter";

describe("topic validation", () => {
  it("requires a title and category", () => {
    expect(topicSchema.safeParse({ title: "", categoryId: "" }).success).toBe(
      false,
    );
    expect(
      topicSchema.safeParse({ title: "Playwright", categoryId: "automation" })
        .success,
    ).toBe(true);
  });
});

describe("category validation", () => {
  it("requires a name", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "Automation" }).success).toBe(true);
  });
});

describe("slugify", () => {
  it("creates URL-safe slugs", () => {
    expect(slugify("API Gateway & OAuth 2.0")).toBe("api-gateway-oauth-20");
  });
});

describe("topic filtering", () => {
  const topics = [
    {
      title: "Playwright",
      summary: "Browser automation",
      content: null,
      categoryId: "automation",
      categoryName: "Automation",
      tags: ["e2e", "typescript"],
    },
    {
      title: "REST API",
      summary: "HTTP services",
      content: null,
      categoryId: "api",
      categoryName: "API",
      tags: ["http"],
    },
  ];

  it("searches tags and combines category and tag filters", () => {
    expect(filterTopics(topics, "typescript", null, null)).toHaveLength(1);
    expect(filterTopics(topics, "", "automation", "e2e")).toHaveLength(1);
    expect(filterTopics(topics, "", "api", "e2e")).toHaveLength(0);
  });
});

describe("source validation", () => {
  it("accepts valid URLs and rejects malformed URLs", () => {
    expect(
      sourceSchema.safeParse({
        title: "Playwright docs",
        url: "https://playwright.dev",
      }).success,
    ).toBe(true);
    expect(
      sourceSchema.safeParse({ title: "Broken", url: "not-a-url" }).success,
    ).toBe(false);
  });
});

describe("JSON import validation", () => {
  it("normalizes one topic and arrays to the same payload", () => {
    const topic = { title: "Playwright", category: "Automation" };
    expect(importPayloadSchema.parse(topic)).toHaveLength(1);
    expect(
      importPayloadSchema.parse([
        topic,
        { title: "REST API", category: "API" },
      ]),
    ).toHaveLength(2);
  });

  it("rejects a topic without a category", () => {
    expect(
      importPayloadSchema.safeParse({ title: "Missing category" }).success,
    ).toBe(false);
  });
});
