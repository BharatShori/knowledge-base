import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getAIProvider } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai/provider";
import { buildQuizMessages, type QuizTopicContent } from "./prompt";
import { quizResponseSchema } from "./schema";
import { MAX_QUIZ_TOPICS } from "./types";
import type { GeneratedQuiz, QuizDifficulty, QuizScope } from "./types";

export {
  QUESTION_COUNT_OPTIONS,
  DIFFICULTY_OPTIONS,
  SCOPE_OPTIONS,
  DEFAULT_QUESTION_COUNT,
  DEFAULT_DIFFICULTY,
  MAX_QUIZ_TOPICS,
} from "./types";

const MIN_CONTENT_LENGTH = 200;
const GENERIC_ERROR = "Unable to generate the quiz right now. Please try again.";

export type QuizGenerationResult =
  | {
      ok: true;
      quiz: GeneratedQuiz;
      topics: { id: string; title: string }[];
      provider: string;
      model: string;
    }
  | { ok: false; error: string };

type LoadedTopic = {
  id: string;
  title: string;
  content: QuizTopicContent;
};

async function loadTopicContent(topicId: string): Promise<LoadedTopic | null> {
  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return null;

  const referenceCard = await prisma.topic.findUnique({
    where: { slug: `${slugify(topic.title)}-reference-card` },
  });

  return {
    id: topic.id,
    title: topic.title,
    content: {
      title: topic.title,
      articleContent: topic.content?.trim() || null,
      referenceCardContent: referenceCard?.content?.trim() || null,
    },
  };
}

/** Random cross-category sample for "holistic" quizzes — there's no way to
 * fit every topic's content into one prompt, so this stands in for "broad
 * coverage" rather than literal completeness. */
async function sampleHolisticTopicIds(limit: number): Promise<string[]> {
  const allTopics = await prisma.topic.findMany({ select: { id: true } });
  const shuffled = [...allTopics].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map((topic) => topic.id);
}

export async function generateQuizForTopics(
  params: {
    scope: QuizScope;
    topicIds: string[];
    questionCount: number;
    difficulty: QuizDifficulty;
  },
  providerOverride?: AIProvider,
): Promise<QuizGenerationResult> {
  let topicIds = params.topicIds;

  if (params.scope === "holistic") {
    topicIds = await sampleHolisticTopicIds(MAX_QUIZ_TOPICS);
    if (topicIds.length === 0) {
      return { ok: false, error: "There are no topics in the knowledge base yet." };
    }
  }

  if (topicIds.length === 0) {
    return { ok: false, error: "Select at least one topic." };
  }
  if (topicIds.length > MAX_QUIZ_TOPICS) {
    topicIds = topicIds.slice(0, MAX_QUIZ_TOPICS);
  }

  const loaded = await Promise.all(topicIds.map(loadTopicContent));
  if (loaded.some((topic) => topic === null)) {
    return { ok: false, error: "One or more selected topics were not found." };
  }
  const topics = loaded as LoadedTopic[];

  const combinedLength = topics.reduce(
    (total, topic) =>
      total +
      (topic.content.articleContent?.length ?? 0) +
      (topic.content.referenceCardContent?.length ?? 0),
    0,
  );
  if (combinedLength < MIN_CONTENT_LENGTH) {
    return {
      ok: false,
      error: "The selected topics do not have enough content to generate a quiz.",
    };
  }

  let provider: AIProvider;
  try {
    provider = providerOverride ?? getAIProvider();
  } catch (error) {
    console.error(
      "Quiz generation provider is not configured:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: "Quiz generation is not configured." };
  }

  const messages = buildQuizMessages({
    topics: topics.map((topic) => topic.content),
    questionCount: params.questionCount,
    difficulty: params.difficulty,
  });

  let raw: unknown;
  try {
    raw = await provider.generateJson(messages);
  } catch (error) {
    console.error(
      "Quiz generation request failed:",
      error instanceof Error ? error.message : error,
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = quizResponseSchema(params.questionCount).safeParse(raw);
  if (!parsed.success) {
    console.error(
      "Quiz generation returned an invalid response:",
      parsed.error.issues,
    );
    return { ok: false, error: GENERIC_ERROR };
  }

  return {
    ok: true,
    quiz: parsed.data,
    topics: topics.map((topic) => ({ id: topic.id, title: topic.title })),
    provider: provider.name,
    model: provider.model,
  };
}
