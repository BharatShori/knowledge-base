"use server";

import { prisma } from "@/lib/db";
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_QUESTION_COUNT,
  DIFFICULTY_OPTIONS,
  MAX_QUIZ_TOPICS,
  QUESTION_COUNT_OPTIONS,
  SCOPE_OPTIONS,
  generateQuizForTopics,
} from "@/lib/quiz/service";
import { isAnswerCorrect, scorePercentage } from "@/lib/quiz/scoring";
import type {
  CompleteQuizResult,
  GenerateQuizResult,
  QuizDifficulty,
  QuizHistoryEntry,
  QuizScope,
  ResumeQuizResult,
  SubmitAnswerResult,
} from "@/lib/quiz/types";

const HISTORY_LIMIT = 20;

function parseQuestionCount(value: number): number {
  return (QUESTION_COUNT_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_QUESTION_COUNT;
}

function parseDifficulty(value: string): QuizDifficulty {
  return (DIFFICULTY_OPTIONS as readonly string[]).includes(value)
    ? (value as QuizDifficulty)
    : DEFAULT_DIFFICULTY;
}

function parseScope(value: string): QuizScope {
  return (SCOPE_OPTIONS as readonly string[]).includes(value)
    ? (value as QuizScope)
    : "single";
}

function durationSecondsBetween(start: Date, end: Date | null): number | null {
  if (!end) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
}

export async function generateQuiz(
  scope: string,
  topicIds: string[],
  questionCount: number,
  difficulty: string,
): Promise<GenerateQuizResult> {
  const safeScope = parseScope(scope);
  const safeTopicIds = topicIds
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, MAX_QUIZ_TOPICS);
  if (safeScope !== "holistic" && safeTopicIds.length === 0) {
    return { error: "Select at least one topic." };
  }
  const safeQuestionCount = parseQuestionCount(questionCount);
  const safeDifficulty = parseDifficulty(difficulty);

  const result = await generateQuizForTopics({
    scope: safeScope,
    topicIds: safeTopicIds,
    questionCount: safeQuestionCount,
    difficulty: safeDifficulty,
  });
  if (!result.ok) return { error: result.error };

  try {
    const session = await prisma.quizSession.create({
      data: {
        scope: safeScope,
        difficulty: safeDifficulty,
        questionCount: safeQuestionCount,
        aiProvider: result.provider,
        aiModel: result.model,
        topics: {
          create: result.topics.map((topic) => ({ topicId: topic.id })),
        },
        questions: {
          create: result.quiz.questions.map((question, index) => ({
            question: question.question,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            displayOrder: index,
          })),
        },
      },
      include: { questions: { orderBy: { displayOrder: "asc" } } },
    });

    return {
      success: true as const,
      quizSessionId: session.id,
      topicTitles: result.topics.map((topic) => topic.title),
      questions: session.questions.map((question) => ({
        id: question.id,
        question: question.question,
        options: question.options as string[],
        displayOrder: question.displayOrder,
      })),
    };
  } catch (error) {
    console.error("Failed to persist quiz session:", error);
    return { error: "Unable to generate the quiz right now. Please try again." };
  }
}

export async function submitAnswer(
  quizQuestionId: string,
  selectedAnswer: string,
): Promise<SubmitAnswerResult> {
  if (!quizQuestionId || !selectedAnswer) {
    return { error: "An answer is required." };
  }

  const question = await prisma.quizQuestion.findUnique({
    where: { id: quizQuestionId },
    include: { answer: true },
  });
  if (!question) return { error: "Question not found." };

  if (question.answer) {
    return {
      success: true as const,
      isCorrect: question.answer.isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    };
  }

  const correct = isAnswerCorrect(selectedAnswer, question.correctAnswer);
  try {
    await prisma.quizAnswer.create({
      data: { quizQuestionId, selectedAnswer, isCorrect: correct },
    });
  } catch (error) {
    console.error("Failed to persist quiz answer:", error);
    return { error: "Could not save your answer. Please try again." };
  }

  return {
    success: true as const,
    isCorrect: correct,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  };
}

export async function completeQuiz(
  quizSessionId: string,
): Promise<CompleteQuizResult> {
  const session = await prisma.quizSession.findUnique({
    where: { id: quizSessionId },
    include: {
      topics: { include: { topic: { select: { title: true } } } },
      questions: {
        orderBy: { displayOrder: "asc" },
        include: { answer: true },
      },
    },
  });
  if (!session) return { error: "Quiz not found." };

  const total = session.questions.length;
  const correct = session.questions.filter((question) => question.answer?.isCorrect).length;
  let completedAt = session.completedAt;

  if (!completedAt) {
    completedAt = new Date();
    try {
      await prisma.quizSession.update({
        where: { id: quizSessionId },
        data: { score: correct, completedAt },
      });
    } catch (error) {
      console.error("Failed to complete quiz session:", error);
      return { error: "Could not save your quiz results. Please try again." };
    }
  }

  return {
    success: true as const,
    topicTitles: session.topics.map((sessionTopic) => sessionTopic.topic.title),
    scope: session.scope as QuizScope,
    difficulty: session.difficulty as QuizDifficulty,
    questionCount: total,
    score: correct,
    percentage: scorePercentage(correct, total),
    durationSeconds: durationSecondsBetween(session.startedAt, completedAt),
    review: session.questions.map((question) => ({
      question: question.question,
      options: question.options as string[],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      selectedAnswer: question.answer?.selectedAnswer ?? null,
      isCorrect: question.answer?.isCorrect ?? false,
    })),
  };
}

export async function resumeQuizSession(
  quizSessionId: string,
): Promise<ResumeQuizResult> {
  const session = await prisma.quizSession.findUnique({
    where: { id: quizSessionId },
    include: {
      topics: { include: { topic: { select: { title: true } } } },
      questions: {
        orderBy: { displayOrder: "asc" },
        include: { answer: true },
      },
    },
  });
  if (!session) return { error: "Quiz not found." };
  if (session.completedAt) return { error: "This quiz has already been completed." };

  const firstUnanswered = session.questions.findIndex((question) => !question.answer);
  const resumeIndex = firstUnanswered === -1 ? session.questions.length : firstUnanswered;

  return {
    success: true as const,
    quizSessionId: session.id,
    topicTitles: session.topics.map((sessionTopic) => sessionTopic.topic.title),
    difficulty: session.difficulty as QuizDifficulty,
    questions: session.questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options as string[],
      displayOrder: question.displayOrder,
    })),
    resumeIndex,
  };
}

export async function getQuizHistory(
  limit: number = HISTORY_LIMIT,
): Promise<QuizHistoryEntry[]> {
  const include = {
    topics: { include: { topic: { select: { title: true } } } },
    questions: { select: { answer: { select: { id: true } } } },
  } as const;

  const [inProgress, completed] = await Promise.all([
    prisma.quizSession.findMany({
      where: { completedAt: null },
      orderBy: { startedAt: "desc" },
      include,
    }),
    prisma.quizSession.findMany({
      where: { completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: limit,
      include,
    }),
  ]);

  return [...inProgress, ...completed].map((session) => ({
    id: session.id,
    scope: session.scope as QuizScope,
    topicTitles: session.topics.map((sessionTopic) => sessionTopic.topic.title),
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    answeredCount: session.questions.filter((question) => question.answer).length,
    score: session.score,
    percentage:
      session.score !== null
        ? scorePercentage(session.score, session.questionCount)
        : null,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt ? session.completedAt.toISOString() : null,
    durationSeconds: durationSecondsBetween(session.startedAt, session.completedAt),
  }));
}
