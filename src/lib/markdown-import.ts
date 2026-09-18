const METADATA_KEY_PATTERN = /^(Category|Tags|Related|Sources|Summary):\s*(.*)$/i;
const SOURCE_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export type MarkdownImportTopic = {
  title: string;
  category?: string;
  tags?: string[];
  relatedTopics?: string[];
  sources?: { title: string; url: string }[];
  summary?: string;
  content?: string;
};

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSources(value: string) {
  const sources: { title: string; url: string }[] = [];
  for (const match of value.matchAll(SOURCE_LINK_PATTERN)) {
    sources.push({ title: match[1].trim(), url: match[2].trim() });
  }
  return sources;
}

/**
 * Parses a document made of one or more `# Title` sections into import
 * topics. Metadata lines (Category/Tags/Related/Sources/Summary) directly
 * under the heading are consumed; the first non-metadata line starts the
 * topic's Markdown content, which runs until the next `# Title`.
 */
export function parseMarkdownImport(raw: string): MarkdownImportTopic[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const topics: MarkdownImportTopic[] = [];
  let current: MarkdownImportTopic | null = null;
  let contentLines: string[] = [];
  let inMetadata = true;

  function flush() {
    if (current) {
      const content = contentLines.join("\n").trim();
      if (content) current.content = content;
      topics.push(current);
    }
    current = null;
    contentLines = [];
    inMetadata = true;
  }

  for (const line of lines) {
    const heading = /^#\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      current = { title: heading[1].trim() };
      continue;
    }
    if (!current) continue;

    if (inMetadata) {
      const metaMatch = METADATA_KEY_PATTERN.exec(line);
      if (metaMatch) {
        const key = metaMatch[1].toLowerCase();
        const value = metaMatch[2].trim();
        if (key === "category") current.category = value;
        else if (key === "tags") current.tags = splitList(value);
        else if (key === "related") current.relatedTopics = splitList(value);
        else if (key === "sources") current.sources = parseSources(value);
        else if (key === "summary") current.summary = value;
        continue;
      }
      if (line.trim() === "") continue;
      inMetadata = false;
    }
    contentLines.push(line);
  }
  flush();

  return topics;
}
