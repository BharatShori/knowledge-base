import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ClipboardTopic = {
  title: string;
  categoryName: string;
  summary: string | null;
  content: string | null;
  tags: string[];
  relatedTopics: { title: string }[];
  sources: { title: string; url: string }[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Renders Markdown to an HTML string via a detached DOM node, since
 * react-dom/server isn't safe to import into client-bundled code. */
function renderMarkdownToHtml(markdown: string) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown),
    );
  });
  const html = container.innerHTML;
  root.unmount();
  return html;
}

export function buildTopicClipboardHtml(topic: ClipboardTopic): string {
  const parts: string[] = [
    `<h1>${escapeHtml(topic.title)}</h1>`,
    `<p><strong>${escapeHtml(topic.categoryName)}</strong></p>`,
  ];

  if (topic.summary) parts.push(`<p>${escapeHtml(topic.summary)}</p>`);

  if (topic.content) {
    parts.push("<h2>Detailed notes</h2>", renderMarkdownToHtml(topic.content));
  }

  if (topic.tags.length > 0) {
    parts.push(
      "<h2>Tags</h2>",
      `<p>${topic.tags.map(escapeHtml).join(", ")}</p>`,
    );
  }

  if (topic.relatedTopics.length > 0) {
    parts.push(
      "<h2>Related topics</h2>",
      `<ul>${topic.relatedTopics
        .map((related) => `<li>${escapeHtml(related.title)}</li>`)
        .join("")}</ul>`,
    );
  }

  if (topic.sources.length > 0) {
    parts.push(
      "<h2>Sources</h2>",
      `<ul>${topic.sources
        .map(
          (source) =>
            `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a></li>`,
        )
        .join("")}</ul>`,
    );
  }

  return parts.join("\n");
}

export function buildTopicClipboardText(topic: ClipboardTopic): string {
  const lines: string[] = [topic.title, topic.categoryName];

  if (topic.summary) lines.push("", topic.summary);
  if (topic.content) lines.push("", "Detailed notes", "", topic.content);
  if (topic.tags.length > 0) lines.push("", "Tags", topic.tags.join(", "));
  if (topic.relatedTopics.length > 0)
    lines.push(
      "",
      "Related topics",
      ...topic.relatedTopics.map((related) => `- ${related.title}`),
    );
  if (topic.sources.length > 0)
    lines.push(
      "",
      "Sources",
      ...topic.sources.map((source) => `- ${source.title}: ${source.url}`),
    );

  return lines.join("\n");
}
