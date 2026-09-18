import { describe, expect, it } from "vitest";
import { quizResponseSchema } from "@/lib/quiz/schema";

function validQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    question: "What is a BrowserContext in Playwright?",
    options: [
      "An isolated browser session used for test isolation",
      "A CSS selector engine",
      "A network proxy configuration",
      "A test reporter format",
    ],
    correctAnswer: "An isolated browser session used for test isolation",
    explanation: "BrowserContext provides an isolated session within a browser instance.",
    ...overrides,
  };
}

describe("quizResponseSchema", () => {
  it("accepts a well-formed response with the expected question count", () => {
    const result = quizResponseSchema(2).safeParse({
      questions: [
        validQuestion(),
        validQuestion({ question: "How do you scale Playwright execution?" }),
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a response with the wrong number of questions", () => {
    const result = quizResponseSchema(2).safeParse({
      questions: [validQuestion()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question with fewer than 4 options", () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [validQuestion({ options: ["A", "B", "C"] })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question with more than 4 options", () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [validQuestion({ options: ["A", "B", "C", "D", "E"] })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects when the correct answer is not one of the options", () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [validQuestion({ correctAnswer: "Something else entirely" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate options within a question", () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [
        validQuestion({ options: ["A", "A", "B", "C"], correctAnswer: "A" }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects "all of the above" as an option', () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [
        validQuestion({
          options: ["A", "B", "C", "All of the above"],
        }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects "none of the above" as an option', () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [
        validQuestion({
          options: ["A", "B", "C", "None of the above"],
        }),
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate questions within the same quiz", () => {
    const result = quizResponseSchema(2).safeParse({
      questions: [validQuestion(), validQuestion()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a question missing required fields", () => {
    const withoutExplanation: Record<string, unknown> = validQuestion();
    delete withoutExplanation.explanation;
    const result = quizResponseSchema(1).safeParse({
      questions: [withoutExplanation],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unexpected extra fields on a question", () => {
    const result = quizResponseSchema(1).safeParse({
      questions: [validQuestion({ difficulty: "advanced" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a response that is not an object", () => {
    expect(quizResponseSchema(1).safeParse(null).success).toBe(false);
    expect(quizResponseSchema(1).safeParse("not json").success).toBe(false);
    expect(quizResponseSchema(1).safeParse([]).success).toBe(false);
  });
});
