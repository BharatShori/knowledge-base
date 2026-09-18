import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getAIProvider } from "@/lib/ai";
import type { AIProvider } from "@/lib/ai/provider";
import { buildQuizMessages } from "./prompt";
import { quizResponseSchema } from "./schema";
import type { GeneratedQuiz, QuizDifficulty } from "./types";

export {
  QUESTION_COUNT_OPTIONS,
  DIFFICULTY_OPTIONS,
  DEFAULT_QUESTION_COUNT,
  DEFAULT_DIFFICULTY,
} from "./types";

const MIN_CONTENT_LENGTH = 200;
const GENERIC_ERROR = "Unable to generate the quiz right now. Please try again.";

export type QuizGenerationResult =
  | { ok: true; quiz: GeneratedQuiz; provider: string; model: string }
  | { ok: false; error: string };

export async function generateQuizForTopic(
  params: {
    topicId: string;
    questionCount: number;
    difficulty: QuizDifficulty;
  },
  providerOverride?: AIProvider,
): Promise<QuizGenerationResult> {
  const topic = await prisma.topic.findUnique({ where: { id: params.topicId } });
  if (!topic) return { ok: false, error: "Topic not found." };

  const referenceCard = await prisma.topic.findUnique({
    where: { slug: `${slugify(topic.title)}-reference-card` },
  });

  const articleContent = topic.content?.trim() || null;
  const referenceCardContent = referenceCard?.content?.trim() || null;
  const combinedLength =
    (articleContent?.length ?? 0) + (referenceCardContent?.length ?? 0);
  if (combinedLength < MIN_CONTENT_LENGTH) {
    return {
      ok: false,
      error: "This topic does not have enough content to generate a quiz.",
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
    topicTitle: topic.title,
    articleContent,
    referenceCardContent,
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
    provider: provider.name,
    model: provider.model,
  };
}
