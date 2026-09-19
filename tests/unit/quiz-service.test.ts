import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIProvider, ChatMessage } from "@/lib/ai/provider";

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    topic: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

const { generateQuizForTopics, MAX_QUIZ_TOPICS } = await import("@/lib/quiz/service");

type MockArgs = { where: { id?: string; slug?: string } };

function topic(id: string, title: string, content = "x".repeat(300)) {
  return { id, title, slug: id, content };
}

/** Routes findUnique by id or slug against an in-memory table, so
 * concurrent multi-topic lookups (Promise.all) resolve correctly
 * regardless of call interleaving order. */
function mockTopicTable(topics: ReturnType<typeof topic>[]) {
  const byId = new Map(topics.map((t) => [t.id, t]));
  const bySlug = new Map(topics.map((t) => [t.slug, t]));
  findUniqueMock.mockImplementation(async ({ where }: MockArgs) => {
    if (where.id) return byId.get(where.id) ?? null;
    if (where.slug) return bySlug.get(where.slug) ?? null;
    return null;
  });
}

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
  findManyMock.mockReset();
});

describe("generateQuizForTopics", () => {
  it("returns an error when a selected topic does not exist", async () => {
    mockTopicTable([]);
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["missing"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(vi.fn()),
    );
    expect(result).toEqual({
      ok: false,
      error: "One or more selected topics were not found.",
    });
  });

  it("returns an error when no topics are selected for a non-holistic scope", async () => {
    const result = await generateQuizForTopics(
      { scope: "multi", topicIds: [], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(vi.fn()),
    );
    expect(result).toEqual({ ok: false, error: "Select at least one topic." });
  });

  it("returns an error when the selected topics have insufficient combined content", async () => {
    mockTopicTable([topic("t1", "Playwright", "too short")]);
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(vi.fn()),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/enough content/i);
  });

  it("returns a validated quiz for a single topic", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(5));
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quiz.questions).toHaveLength(5);
      expect(result.topics).toEqual([{ id: "t1", title: "Playwright" }]);
      expect(result.provider).toBe("fake");
      expect(result.model).toBe("fake-model");
    }
  });

  it("returns a validated quiz spanning multiple selected topics", async () => {
    mockTopicTable([
      topic("t1", "Playwright"),
      topic("t2", "Selenium"),
      topic("t3", "Cypress"),
    ]);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(9));
    const result = await generateQuizForTopics(
      {
        scope: "multi",
        topicIds: ["t1", "t2", "t3"],
        questionCount: 9,
        difficulty: "practitioner",
      },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.topics.map((t) => t.title)).toEqual([
        "Playwright",
        "Selenium",
        "Cypress",
      ]);
    }
    const messages = generateJson.mock.calls[0][0] as ChatMessage[];
    const userMessage = messages.find((message) => message.role === "user");
    expect(userMessage?.content).toContain("Playwright");
    expect(userMessage?.content).toContain("Selenium");
    expect(userMessage?.content).toContain("Cypress");
  });

  it("truncates a topic selection larger than the max to the cap", async () => {
    const topics = Array.from({ length: MAX_QUIZ_TOPICS + 3 }, (_, i) =>
      topic(`t${i}`, `Topic ${i}`),
    );
    mockTopicTable(topics);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(5));
    const result = await generateQuizForTopics(
      {
        scope: "multi",
        topicIds: topics.map((t) => t.id),
        questionCount: 5,
        difficulty: "practitioner",
      },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.topics).toHaveLength(MAX_QUIZ_TOPICS);
  });

  it("samples up to the max topic count at random for a holistic quiz", async () => {
    const topics = Array.from({ length: 20 }, (_, i) => topic(`t${i}`, `Topic ${i}`));
    mockTopicTable(topics);
    findManyMock.mockImplementation(async (args?: { select?: unknown }) => {
      if (args?.select) return topics.map((t) => ({ id: t.id }));
      return topics;
    });
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(5));
    const result = await generateQuizForTopics(
      { scope: "holistic", topicIds: [], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.topics).toHaveLength(MAX_QUIZ_TOPICS);
  });

  it("returns an error for a holistic quiz when there are no topics at all", async () => {
    findManyMock.mockResolvedValue([]);
    const result = await generateQuizForTopics(
      { scope: "holistic", topicIds: [], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(vi.fn()),
    );
    expect(result).toEqual({
      ok: false,
      error: "There are no topics in the knowledge base yet.",
    });
  });

  it("includes reference card content in the prompt when available", async () => {
    mockTopicTable([
      topic("t1", "Playwright"),
      { id: "rc-1", title: "rc", slug: "playwright-reference-card", content: "Reference card notes" },
    ]);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(5));
    await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    const messages = generateJson.mock.calls[0][0] as ChatMessage[];
    const userMessage = messages.find((message) => message.role === "user");
    expect(userMessage?.content).toContain("Reference card notes");
  });

  it("returns a generic error when the provider returns malformed JSON structure", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    const generateJson = vi.fn().mockResolvedValue({ not: "a quiz" });
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result).toEqual({
      ok: false,
      error: "Unable to generate the quiz right now. Please try again.",
    });
  });

  it("returns a generic error when the provider returns the wrong question count", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    const generateJson = vi.fn().mockResolvedValue(validQuizJson(3));
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the correct answer is missing from the options", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    const quiz = validQuizJson(5);
    quiz.questions[0].correctAnswer = "Not an option";
    const generateJson = vi.fn().mockResolvedValue(quiz);
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the response contains duplicate questions", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    const quiz = validQuizJson(5);
    quiz.questions[1] = { ...quiz.questions[0] };
    const generateJson = vi.fn().mockResolvedValue(quiz);
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result.ok).toBe(false);
  });

  it("returns a generic error when the provider call fails (timeout/rate-limit/outage)", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    const generateJson = vi.fn().mockRejectedValue(new Error("The request to Groq timed out."));
    const result = await generateQuizForTopics(
      { scope: "single", topicIds: ["t1"], questionCount: 5, difficulty: "practitioner" },
      fakeProvider(generateJson),
    );
    expect(result).toEqual({
      ok: false,
      error: "Unable to generate the quiz right now. Please try again.",
    });
  });

  it("returns a 'not configured' error when no provider override is given and none is configured", async () => {
    mockTopicTable([topic("t1", "Playwright")]);
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await generateQuizForTopics({
      scope: "single",
      topicIds: ["t1"],
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
