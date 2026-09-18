import type { ChatMessage } from "@/lib/ai/provider";
import type { QuizDifficulty } from "./types";

const DIFFICULTY_GUIDANCE: Record<QuizDifficulty, string> = {
  foundation:
    "Bias toward core concepts and straightforward, correct application of the material. Avoid advanced architecture or trade-off questions.",
  practitioner:
    "Include realistic day-to-day QE situations, implementation decisions, and applied judgement calls a working practitioner would face.",
  advanced:
    "Emphasize trade-offs, architecture, failure modes, test strategy, risk, distributed systems, and CI/CD implications where relevant to the material.",
};

function questionMix(questionCount: number) {
  const recall = Math.max(1, Math.round(questionCount * 0.3));
  const scenario = Math.max(1, Math.round(questionCount * 0.3));
  const application = Math.max(1, questionCount - recall - scenario);
  return { recall, application, scenario };
}

export function buildQuizMessages(params: {
  topicTitle: string;
  articleContent: string | null;
  referenceCardContent: string | null;
  questionCount: number;
  difficulty: QuizDifficulty;
}): ChatMessage[] {
  const { topicTitle, articleContent, referenceCardContent, questionCount, difficulty } =
    params;
  const mix = questionMix(questionCount);

  const sourceSections = [
    referenceCardContent
      ? `### Reference Card (use primarily for recall/concept questions)\n${referenceCardContent}`
      : null,
    articleContent
      ? `### Full Article (use for application, scenario, and trade-off questions)\n${articleContent}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = `You are a senior Quality Engineering instructor writing a multiple-choice quiz to test practical QE understanding, not trivia.

Rules you must follow exactly:
- Base every question strictly on the supplied knowledge-base content below. Do not invent facts, tools, or details that are not supported by that content.
- Test understanding, practical application, testing strategy, engineering trade-offs, risk, and real-world QE scenarios. Avoid excessive trivial definition questions.
- Every question must have exactly 4 options.
- Exactly 1 option must be unambiguously correct.
- The other 3 options must be plausible, realistic distractors, not obviously wrong.
- Never use "All of the above" or "None of the above" as an option.
- Never write ambiguous questions or options.
- Do not produce duplicate questions within the same quiz.
- Provide a concise explanation of why the correct answer is correct.
- Respond with strict JSON only, matching this shape exactly, with no extra fields:
{"questions":[{"question":"string","options":["string","string","string","string"],"correctAnswer":"string (must exactly match one of the options)","explanation":"string"}]}`;

  const user = `Topic: ${topicTitle}
Difficulty: ${difficulty}
${DIFFICULTY_GUIDANCE[difficulty]}

Generate exactly ${questionCount} questions with approximately this mix:
- ${mix.recall} recall/concept questions
- ${mix.application} practical application questions
- ${mix.scenario} scenario/engineering-judgement questions

Knowledge-base content:

${sourceSections}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
