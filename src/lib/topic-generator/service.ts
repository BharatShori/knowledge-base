import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getAIProvider } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai/provider";
import { buildTopicGenerationMessages } from "./prompt";
import { topicBatchResponseSchema } from "./schema";
import {
  REFERENCE_CARD_SUFFIX,
  classifyDuplicate,
  isReferenceCardTitle,
} from "./similarity";
import {
  BATCH_SIZE,
  type GeneratedCategoryReferenceCard,
  type TopicCandidate,
} from "./types";

const GENERIC_ERROR = "Unable to generate topics right now. Please try again.";

export type GenerateTopicBatchServiceResult =
  | {
      ok: true;
      candidates: TopicCandidate[];
      categoryReferenceCard: GeneratedCategoryReferenceCard | null;
      categoryReferenceCardTitle: string;
      provider: string;
      model: string;
    }
  | { ok: false; error: string };

export async function generateTopicBatch(
  params: { categoryId: string; excludeTitles?: string[] },
  providerOverride?: AIProvider,
): Promise<GenerateTopicBatchServiceResult> {
  const category = await prisma.category.findUnique({
    where: { id: params.categoryId },
  });
  if (!category) return { ok: false, error: "Category not found." };

  const categoryReferenceCardTitle = `${category.name}${REFERENCE_CARD_SUFFIX}`;
  const categoryReferenceCardSlug = slugify(categoryReferenceCardTitle);

  const [categoryTopics, allTopics, existingCategoryReferenceCard] = await Promise.all([
    prisma.topic.findMany({
      where: { categoryId: params.categoryId },
      select: { title: true },
    }),
    prisma.topic.findMany({ select: { title: true } }),
    prisma.topic.findUnique({ where: { slug: categoryReferenceCardSlug } }),
  ]);

  const existingCategoryTitles = categoryTopics
    .map((topic) => topic.title)
    .filter((title) => !isReferenceCardTitle(title));
  const allExistingTitles = allTopics
    .map((topic) => topic.title)
    .filter((title) => !isReferenceCardTitle(title));
  const needsCategoryReferenceCard = !existingCategoryReferenceCard;

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
    includeCategoryReferenceCard: needsCategoryReferenceCard,
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

  const parsed = topicBatchResponseSchema(BATCH_SIZE, needsCategoryReferenceCard).safeParse(
    raw,
  );
  if (!parsed.success) {
    console.error(
      "Topic generation returned an invalid response:",
      parsed.error.issues,
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  const candidates: TopicCandidate[] = parsed.data.topics.map((topic) => {
    const match = classifyDuplicate(topic.title, allExistingTitles);
    return {
      ...topic,
      duplicateStatus: match.status,
      matchedTitle: match.matchedTitle,
    };
  });

  return {
    ok: true,
    candidates,
    categoryReferenceCard: parsed.data.categoryReferenceCard ?? null,
    categoryReferenceCardTitle,
    provider: provider.name,
    model: provider.model,
  };
}
