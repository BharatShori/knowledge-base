import { describe, expect, it } from "vitest";
import {
  buildTopicClipboardHtml,
  buildTopicClipboardText,
  type ClipboardTopic,
} from "@/lib/topic-clipboard";

// Markdown content is rendered via a detached DOM node (see
// renderMarkdownToHtml in topic-clipboard.ts), which requires a browser
// environment. That path is covered by the e2e "copies a topic as rich
// text for sharing" test instead; these unit tests use content: null.
const topic: ClipboardTopic = {
  title: "Playwright",
  categoryName: "Automation",
  summary: "Browser automation framework.",
  content: null,
  tags: ["e2e", "typescript"],
  relatedTopics: [{ title: "Browser Context" }],
  sources: [{ title: "Docs", url: "https://playwright.dev" }],
};

describe("buildTopicClipboardHtml", () => {
  it("renders title, category, summary, tags, related topics and sources", () => {
    const html = buildTopicClipboardHtml(topic);
    expect(html).toContain("<h1>Playwright</h1>");
    expect(html).toContain("<strong>Automation</strong>");
    expect(html).toContain("Browser automation framework.");
    expect(html).toContain("e2e, typescript");
    expect(html).toContain("<li>Browser Context</li>");
    expect(html).toContain('href="https://playwright.dev"');
    expect(html).toContain(">Docs</a>");
  });

  it("escapes unsafe characters in plain-text fields", () => {
    const html = buildTopicClipboardHtml({
      ...topic,
      title: "<script>alert(1)</script>",
      summary: null,
      content: null,
      tags: [],
      relatedTopics: [],
      sources: [],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("omits empty sections", () => {
    const html = buildTopicClipboardHtml({
      ...topic,
      summary: null,
      content: null,
      tags: [],
      relatedTopics: [],
      sources: [],
    });
    expect(html).not.toContain("<h2>");
  });
});

describe("buildTopicClipboardText", () => {
  it("produces a readable plain-text fallback", () => {
    const text = buildTopicClipboardText({
      ...topic,
      content: "## Key Concepts\n- Browser\n- Page",
    });
    expect(text).toContain("Playwright");
    expect(text).toContain("Automation");
    expect(text).toContain("Browser automation framework.");
    expect(text).toContain("Detailed notes");
    expect(text).toContain("## Key Concepts\n- Browser\n- Page");
    expect(text).toContain("Tags");
    expect(text).toContain("e2e, typescript");
    expect(text).toContain("- Browser Context");
    expect(text).toContain("- Docs: https://playwright.dev");
  });
});
