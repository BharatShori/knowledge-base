import type { ChatMessage } from "@/lib/ai/provider";
import { MAX_CONTEXT_TITLES } from "./types";

export function buildTopicGenerationMessages(params: {
  categoryName: string;
  existingTitles: string[];
  batchSize: number;
  excludeTitles?: string[];
}): ChatMessage[] {
  const { categoryName, existingTitles, batchSize, excludeTitles = [] } = params;

  const cappedTitles = existingTitles.slice(0, MAX_CONTEXT_TITLES);
  const truncatedNote =
    existingTitles.length > cappedTitles.length
      ? `\n(${existingTitles.length - cappedTitles.length} additional existing titles omitted for brevity.)`
      : "";

  const system = `You are a principal software engineer curating a professional Software Engineering knowledge base. Quality Engineering is a major area of expertise, but the knowledge base now spans all of software engineering — the category you are given determines the subject matter (it could be an engineering discipline, a language, a business domain like accounting, or anything else already in the knowledge base).

Generated content must be:
- professionally relevant, accurate, and practical
- useful for experienced engineers, including for technical interviews and day-to-day work
- sufficiently specific, not generic filler
- focused on principles before tools
- connected to architecture, implementation, testing, reliability, or operations where relevant
- concise but substantial

Avoid:
- trivial beginner topics
- generic filler or "tool of the month" topics
- duplicate or near-duplicate topics (reworded versions of existing coverage)
- excessively broad topics
- marketing language or unsupported claims

Build coverage progressively across requests: foundation and core concepts first, then practical application, then advanced concepts, architecture and trade-offs, real-world scenarios, and operational considerations. Do not simply return the most famous topics every time — prioritize filling real gaps in what is already covered.

For every topic you generate, also produce a companion Reference Card. The Reference Card is NOT a repeat of the article — it is a dense, scan-friendly quick-recall aid for interviews, discussions, and revision. Where applicable include: definition, key principles, terminology, important rules, workflow, common patterns, common mistakes, testing considerations, tools, commands/code patterns, interview points, a practical example, and points to remember.

Topic content and Reference Card content must both be Markdown, using headings, lists, tables, and code examples where useful. Do not write unnecessarily long articles.

Respond with strict JSON only, matching this shape exactly, with no extra fields:
{"topics":[{"topic":{"title":"string","summary":"string","content":"string (markdown)","tags":["string"],"relatedTopics":["string"]},"referenceCard":{"summary":"string","content":"string (markdown)","tags":["string"],"relatedTopics":["string"]}}]}

Suggest relatedTopics using titles that plausibly already exist in this knowledge base when possible; otherwise omit rather than invent unrelated titles.`;

  const excludeSection =
    excludeTitles.length > 0
      ? `\n\nDo not repeat any of these previously suggested titles that were rejected in an earlier batch:\n${excludeTitles.map((title) => `- ${title}`).join("\n")}`
      : "";

  const user = `Category: ${categoryName}

Existing topics already covered in this category (do not duplicate or closely rework these):
${cappedTitles.length > 0 ? cappedTitles.map((title) => `- ${title}`).join("\n") : "(none yet — this category is empty)"}${truncatedNote}${excludeSection}

Generate up to ${batchSize} new topic + Reference Card pairs that meaningfully expand coverage of this category without duplicating or substantially overlapping the existing topics above. If the category is already comprehensively covered and fewer than ${batchSize} genuinely new, valuable topics remain, return fewer — do not invent low-value filler just to reach ${batchSize}.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
