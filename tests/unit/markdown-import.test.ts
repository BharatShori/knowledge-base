import { describe, expect, it } from "vitest";
import { parseMarkdownImport } from "@/lib/markdown-import";

describe("parseMarkdownImport", () => {
  it("parses a single topic with metadata and content", () => {
    const [topic] = parseMarkdownImport(`# Playwright

Category: Automation
Tags: e2e, typescript
Related: Browser Context, Page Object Model
Sources: [Docs](https://playwright.dev), [GitHub](https://github.com/microsoft/playwright)
Summary: Browser automation framework.

Playwright is a browser automation framework.

## Key Concepts
- Browser
- Page`);

    expect(topic).toEqual({
      title: "Playwright",
      category: "Automation",
      tags: ["e2e", "typescript"],
      relatedTopics: ["Browser Context", "Page Object Model"],
      sources: [
        { title: "Docs", url: "https://playwright.dev" },
        { title: "GitHub", url: "https://github.com/microsoft/playwright" },
      ],
      summary: "Browser automation framework.",
      content: "Playwright is a browser automation framework.\n\n## Key Concepts\n- Browser\n- Page",
    });
  });

  it("parses multiple topics separated by level-1 headings", () => {
    const topics = parseMarkdownImport(`# Playwright
Category: Automation

Notes on Playwright.

# Appium
Category: Mobile Testing

Notes on Appium.`);

    expect(topics).toHaveLength(2);
    expect(topics[0].title).toBe("Playwright");
    expect(topics[0].content).toBe("Notes on Playwright.");
    expect(topics[1].title).toBe("Appium");
    expect(topics[1].category).toBe("Mobile Testing");
  });

  it("returns a topic with no metadata or content when only a heading is given", () => {
    const topics = parseMarkdownImport("# Just a title");
    expect(topics).toEqual([{ title: "Just a title" }]);
  });

  it("returns no topics when there is no level-1 heading", () => {
    expect(parseMarkdownImport("Some text with no heading.")).toEqual([]);
  });

  it("ignores metadata-shaped lines once content has started", () => {
    const [topic] = parseMarkdownImport(`# Topic
Category: General

Some content.
Tags: this-looks-like-metadata-but-isnt`);

    expect(topic.tags).toBeUndefined();
    expect(topic.content).toBe(
      "Some content.\nTags: this-looks-like-metadata-but-isnt",
    );
  });
});
