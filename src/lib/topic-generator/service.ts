import { prisma } from "@/lib/db";
import { getAIProvider } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai/provider";
import { buildTopicGenerationMessages } from "./prompt";
import { topicBatchResponseSchema } from "./schema";
import { classifyDuplicate, isReferenceCardTitle } from "./similarity";
import { BATCH_SIZE, type TopicCandidate } from "./types";

const GENERIC_ERROR = "Unable to generate topics right now. Please try again.";

export type GenerateTopicBatchServiceResult =
  | { ok: true; candidates: TopicCandidate[]; provider: string; model: string }
  | { ok: false; error: string };

export async function generateTopicBatch(
  params: { categoryId: string; excludeTitles?: string[] },
  providerOverride?: AIProvider,
): Promise<GenerateTopicBatchServiceResult> {
  const category = await prisma.category.findUnique({
    where: { id: params.categoryId },
  });
  if (!category) return { ok: false, error: "Category not found." };

  const [categoryTopics, allTopics] = await Promise.all([
    prisma.topic.findMany({
      where: { categoryId: params.categoryId },
      select: { title: true },
    }),
    prisma.topic.findMany({ select: { title: true } }),
  ]);

  const existingCategoryTitles = categoryTopics
    .map((topic) => topic.title)
    .filter((title) => !isReferenceCardTitle(title));
  const allExistingTitles = allTopics
    .map((topic) => topic.title)
    .filter((title) => !isReferenceCardTitle(title));

  let provider: AIProvider;
  try {
    provider = providerOverride ?? getAIProvider();
  } catch (error) {
    console.error(
      "Topic generation provider is not configured:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: "Topic generation is not configured." };
  }

  const messages = buildTopicGenerationMessages({
    categoryName: category.name,
    existingTitles: existingCategoryTitles,
    batchSize: BATCH_SIZE,
    excludeTitles: params.excludeTitles,
  });

  let raw: unknown;
  try {
    raw = await provider.generateJson(messages);
  } catch (error) {
    console.error(
      "Topic generation request failed:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = topicBatchResponseSchema(BATCH_SIZE).safeParse(raw);
  if (!parsed.success) {
    console.error(
      "Topic generation returned an invalid response:",
      parsed.error.issues,
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  const candidates: TopicCandidate[] = parsed.data.topics.map((pair) => {
    const match = classifyDuplicate(pair.topic.title, allExistingTitles);
    return {
      ...pair,
      duplicateStatus: match.status,
      matchedTitle: match.matchedTitle,
    };
  });

  return {
    ok: true,
    candidates,
    provider: provider.name,
    model: provider.model,
  };
}
