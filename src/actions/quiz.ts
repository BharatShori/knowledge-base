"use server";

import { prisma } from "@/lib/db";
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_QUESTION_COUNT,
  DIFFICULTY_OPTIONS,
  QUESTION_COUNT_OPTIONS,
  generateQuizForTopic,
} from "@/lib/quiz/service";
import { isAnswerCorrect, scorePercentage } from "@/lib/quiz/scoring";
import type {
  CompleteQuizResult,
  GenerateQuizResult,
  QuizDifficulty,
  QuizHistoryEntry,
  SubmitAnswerResult,
} from "@/lib/quiz/types";

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

export async function generateQuiz(
  topicId: string,
  questionCount: number,
  difficulty: string,
): Promise<GenerateQuizResult> {
  if (!topicId) return { error: "Topic is required." };
  const safeQuestionCount = parseQuestionCount(questionCount);
  const safeDifficulty = parseDifficulty(difficulty);

  const result = await generateQuizForTopic({
    topicId,
    questionCount: safeQuestionCount,
    difficulty: safeDifficulty,
  });
  if (!result.ok) return { error: result.error };

  try {
    const session = await prisma.quizSession.create({
      data: {
        topicId,
        difficulty: safeDifficulty,
        questionCount: safeQuestionCount,
        aiProvider: result.provider,
        aiModel: result.model,
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
      topic: { select: { title: true } },
      questions: {
        orderBy: { displayOrder: "asc" },
        include: { answer: true },
      },
    },
  });
  if (!session) return { error: "Quiz not found." };

  const total = session.questions.length;
  const correct = session.questions.filter((question) => question.answer?.isCorrect).length;

  if (!session.completedAt) {
    try {
      await prisma.quizSession.update({
        where: { id: quizSessionId },
        data: { score: correct, completedAt: new Date() },
      });
    } catch (error) {
      console.error("Failed to complete quiz session:", error);
      return { error: "Could not save your quiz results. Please try again." };
    }
  }

  return {
    success: true as const,
    topicTitle: session.topic.title,
    difficulty: session.difficulty as QuizDifficulty,
    questionCount: total,
    score: correct,
    percentage: scorePercentage(correct, total),
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

export async function getQuizHistory(
  topicId: string,
): Promise<QuizHistoryEntry[]> {
  const sessions = await prisma.quizSession.findMany({
    where: { topicId, completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 5,
    select: {
      id: true,
      difficulty: true,
      questionCount: true,
      score: true,
      completedAt: true,
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    score: session.score ?? 0,
    percentage: scorePercentage(session.score ?? 0, session.questionCount),
    completedAt: session.completedAt!.toISOString(),
  }));
}
