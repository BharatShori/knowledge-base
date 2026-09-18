import { beforeEach, describe, expect, it, vi } from "vitest";

const quizQuestionFindUnique = vi.fn();
const quizAnswerCreate = vi.fn();
const quizSessionFindUnique = vi.fn();
const quizSessionUpdate = vi.fn();
const quizSessionFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    quizQuestion: { findUnique: (...args: unknown[]) => quizQuestionFindUnique(...args) },
    quizAnswer: { create: (...args: unknown[]) => quizAnswerCreate(...args) },
    quizSession: {
      findUnique: (...args: unknown[]) => quizSessionFindUnique(...args),
      update: (...args: unknown[]) => quizSessionUpdate(...args),
      findMany: (...args: unknown[]) => quizSessionFindMany(...args),
    },
  },
}));

const { submitAnswer, completeQuiz, getQuizHistory } = await import("@/actions/quiz");

beforeEach(() => {
  quizQuestionFindUnique.mockReset();
  quizAnswerCreate.mockReset();
  quizSessionFindUnique.mockReset();
  quizSessionUpdate.mockReset();
  quizSessionFindMany.mockReset();
});

describe("submitAnswer", () => {
  it("requires a question id and selected answer", async () => {
    expect(await submitAnswer("", "A")).toEqual({ error: "An answer is required." });
    expect(await submitAnswer("q1", "")).toEqual({ error: "An answer is required." });
  });

  it("returns an error when the question does not exist", async () => {
    quizQuestionFindUnique.mockResolvedValueOnce(null);
    expect(await submitAnswer("missing", "A")).toEqual({ error: "Question not found." });
  });

  it("records a correct answer", async () => {
    quizQuestionFindUnique.mockResolvedValueOnce({
      id: "q1",
      correctAnswer: "A",
      explanation: "Because A.",
      answer: null,
    });
    const result = await submitAnswer("q1", "A");
    expect(quizAnswerCreate).toHaveBeenCalledWith({
      data: { quizQuestionId: "q1", selectedAnswer: "A", isCorrect: true },
    });
    expect(result).toEqual({
      success: true,
      isCorrect: true,
      correctAnswer: "A",
      explanation: "Because A.",
    });
  });

  it("records an incorrect answer", async () => {
    quizQuestionFindUnique.mockResolvedValueOnce({
      id: "q1",
      correctAnswer: "A",
      explanation: "Because A.",
      answer: null,
    });
    const result = await submitAnswer("q1", "B");
    expect(quizAnswerCreate).toHaveBeenCalledWith({
      data: { quizQuestionId: "q1", selectedAnswer: "B", isCorrect: false },
    });
    expect(result).toMatchObject({ success: true, isCorrect: false });
  });

  it("is idempotent when the question was already answered", async () => {
    quizQuestionFindUnique.mockResolvedValueOnce({
      id: "q1",
      correctAnswer: "A",
      explanation: "Because A.",
      answer: { isCorrect: true },
    });
    const result = await submitAnswer("q1", "A");
    expect(quizAnswerCreate).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      isCorrect: true,
      correctAnswer: "A",
      explanation: "Because A.",
    });
  });
});

describe("completeQuiz", () => {
  function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "session-1",
      completedAt: null,
      topic: { title: "Playwright" },
      difficulty: "practitioner",
      questions: [
        { question: "Q1", options: ["A", "B"], correctAnswer: "A", explanation: "e1", answer: { selectedAnswer: "A", isCorrect: true } },
        { question: "Q2", options: ["A", "B"], correctAnswer: "A", explanation: "e2", answer: { selectedAnswer: "B", isCorrect: false } },
        { question: "Q3", options: ["A", "B"], correctAnswer: "A", explanation: "e3", answer: null },
      ],
      ...overrides,
    };
  }

  it("returns an error when the session does not exist", async () => {
    quizSessionFindUnique.mockResolvedValueOnce(null);
    expect(await completeQuiz("missing")).toEqual({ error: "Quiz not found." });
  });

  it("computes the score from answered questions and persists it", async () => {
    quizSessionFindUnique.mockResolvedValueOnce(makeSession());
    const result = await completeQuiz("session-1");
    expect(quizSessionUpdate).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { score: 1, completedAt: expect.any(Date) },
    });
    expect(result).toMatchObject({
      success: true,
      topicTitle: "Playwright",
      difficulty: "practitioner",
      questionCount: 3,
      score: 1,
      percentage: 33,
    });
    if ("review" in result) {
      expect(result.review).toEqual([
        { question: "Q1", options: ["A", "B"], correctAnswer: "A", explanation: "e1", selectedAnswer: "A", isCorrect: true },
        { question: "Q2", options: ["A", "B"], correctAnswer: "A", explanation: "e2", selectedAnswer: "B", isCorrect: false },
        { question: "Q3", options: ["A", "B"], correctAnswer: "A", explanation: "e3", selectedAnswer: null, isCorrect: false },
      ]);
    }
  });

  it("does not overwrite an already-completed session but still returns results", async () => {
    quizSessionFindUnique.mockResolvedValueOnce(
      makeSession({ completedAt: new Date("2026-01-01") }),
    );
    const result = await completeQuiz("session-1");
    expect(quizSessionUpdate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, score: 1, questionCount: 3 });
  });

  it("scores a perfect quiz as 100%", async () => {
    quizSessionFindUnique.mockResolvedValueOnce(
      makeSession({
        questions: [
          { question: "Q1", options: ["A"], correctAnswer: "A", explanation: "e", answer: { selectedAnswer: "A", isCorrect: true } },
          { question: "Q2", options: ["A"], correctAnswer: "A", explanation: "e", answer: { selectedAnswer: "A", isCorrect: true } },
        ],
      }),
    );
    const result = await completeQuiz("session-1");
    expect(result).toMatchObject({ score: 2, questionCount: 2, percentage: 100 });
  });

  it("scores a fully missed quiz as 0%", async () => {
    quizSessionFindUnique.mockResolvedValueOnce(
      makeSession({
        questions: [
          { question: "Q1", options: ["A"], correctAnswer: "A", explanation: "e", answer: { selectedAnswer: "B", isCorrect: false } },
          { question: "Q2", options: ["A"], correctAnswer: "A", explanation: "e", answer: { selectedAnswer: "B", isCorrect: false } },
        ],
      }),
    );
    const result = await completeQuiz("session-1");
    expect(result).toMatchObject({ score: 0, questionCount: 2, percentage: 0 });
  });
});

describe("getQuizHistory", () => {
  it("maps stored sessions and computes percentages", async () => {
    quizSessionFindMany.mockResolvedValueOnce([
      {
        id: "s1",
        difficulty: "practitioner",
        questionCount: 10,
        score: 8,
        completedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    const history = await getQuizHistory("topic-1");
    expect(history).toEqual([
      {
        id: "s1",
        difficulty: "practitioner",
        questionCount: 10,
        score: 8,
        percentage: 80,
        completedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("returns an empty list when there is no history", async () => {
    quizSessionFindMany.mockResolvedValueOnce([]);
    expect(await getQuizHistory("topic-1")).toEqual([]);
  });
});
