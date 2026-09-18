import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProvider, ChatMessage } from "@/lib/ai/provider";

const findUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    topic: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
}));

const { generateQuizForTopic } = await import("@/lib/quiz/service");

const TOPIC = {
  id: "topic-1",
  title: "Playwright",
  slug: "playwright",
  content: "x".repeat(300),
};

function fakeProvider(generateJson: AIProvider["generateJson"]): AIProvider {
  return { name: "fake", model: "fake-model", generateJson };
}

function validQuizJson(questionCount: number) {
  return {
    questions: Array.from({ length: questionCount }, (_, index) => ({
      question: `Question ${index + 1}?`,
      options: ["A", "B", "C", "D"],
      correctAnswer: "A",
      explanation: "Because A is correct.",
    })),
  };
}

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("generateQuizForTopic", () => {
  it("returns an error when the topic does not exist", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const result = await generateQuizForTopic(
      { topicId: "missing", questionCount: 5, difficulty: "practitioner" },
      fakeProvider(vi.fn()),
    );
    expect(result).toEqual({ ok: false, error: "Topic not found." });
  });

  it("returns an error when the topic has insufficient content", async () => {
    findUniqueMock
      .mockResolvedValueOnce({ ...TOPIC, content: "too short" })
      .mockResolvedValueOnce(null);
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(vi.fn()),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/enough content/i);
    }
  });

  it("returns a validated quiz on a well-formed provider response", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(5));
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quiz.questions).toHaveLength(5);
      expect(result.provider).toBe("fake");
      expect(result.model).toBe("fake-model");
    }
  });

  it("includes reference card content in the prompt when available", async () => {
    findUniqueMock
      .mockResolvedValueOnce(TOPIC)
      .mockResolvedValueOnce({ ...TOPIC, id: "rc-1", content: "Reference card notes" });
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(5));
    await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    const messages = generateJson.mock.calls[0][0] as ChatMessage[];
    const userMessage = messages.find((message) => message.role === "user");
    expect(userMessage?.content).toContain("Reference card notes");
  });

  it("returns a generic error when the provider returns malformed JSON structure", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    const generateJson = vi.fn().mockResolvedValue({ not: "a quiz" });
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result).toEqual({
      ok: false,
      error: "Unable to generate the quiz right now. Please try again.",
    });
  });

  it("returns a generic error when the provider returns the wrong question count", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(3));
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the correct answer is missing from the options", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    const quiz = validQuizJson(5);
    quiz.questions[0].correctAnswer = "Not an option";
    const generateJson = vi.fn().mockResolvedValue(quiz);
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the response contains duplicate questions", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    const quiz = validQuizJson(5);
    quiz.questions[1] = { ...quiz.questions[0] };
    const generateJson = vi.fn().mockResolvedValue(quiz);
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the provider call fails (timeout/rate-limit/outage)", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    const generateJson = vi.fn().mockRejectedValue(new Error("The request to Groq timed out."));
    const result = await generateQuizForTopic(
      { topicId: TOPIC.id, questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result).toEqual({
      ok: false,
      error: "Unable to generate the quiz right now. Please try again.",
    });
  });

  it("returns a 'not configured' error when no provider override is given and none is configured", async () => {
    findUniqueMock.mockResolvedValueOnce(TOPIC).mockResolvedValueOnce(null);
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await generateQuizForTopic({
      topicId: TOPIC.id,
      questionCount: 5,
      difficulty: "practitioner",
    });
    expect(result).toEqual({
      ok: false,
      error: "Quiz generation is not configured.",
    });
    vi.unstubAllEnvs();
  });
});
