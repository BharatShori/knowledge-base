import { describe, expect, it } from "vitest";
import { filterTopics, type FilterableTopic } from "@/lib/topic-filter";

const topics: FilterableTopic[] = [
  {
    title: "Zebra Topic",
    summary: null,
    content: "Mentions api somewhere in the details.",
    categoryId: "cat-1",
    categoryName: "General",
    tags: [],
  },
  {
    title: "API Gateway",
    summary: null,
    content: null,
    categoryId: "cat-2",
    categoryName: "General",
    tags: [],
  },
  {
    title: "Contract Testing",
    summary: null,
    content: null,
    categoryId: "cat-3",
    categoryName: "API",
    tags: [],
  },
  {
    title: "Anchor Topic",
    summary: null,
    content: null,
    categoryId: "cat-1",
    categoryName: "General",
    tags: ["api-tag"],
  },
];

describe("filterTopics", () => {
  it("orders title matches before category matches before content/tag matches", () => {
    const results = filterTopics(topics, "api", null, null);

    expect(results.map((topic) => topic.title)).toEqual([
      "API Gateway",
      "Contract Testing",
      "Anchor Topic",
      "Zebra Topic",
    ]);
  });

  it("sorts alphabetically by title within a tier", () => {
    const results = filterTopics(
      [
        { ...topics[0], title: "Zebra" },
        { ...topics[0], title: "Beta" },
        { ...topics[0], title: "Alpha" },
      ],
      "api",
      null,
      null,
    );

    expect(results.map((topic) => topic.title)).toEqual([
      "Alpha",
      "Beta",
      "Zebra",
    ]);
  });

  it("does not reorder results when there is no search query", () => {
    const results = filterTopics(topics, "", null, null);
    expect(results.map((topic) => topic.title)).toEqual(
      topics.map((topic) => topic.title),
    );
  });

  it("still applies category and tag filters", () => {
    const results = filterTopics(topics, "", "cat-1", null);
    expect(results.map((topic) => topic.title)).toEqual([
      "Zebra Topic",
      "Anchor Topic",
    ]);
  });
});
