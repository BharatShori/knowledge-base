import { z } from "zod";

const BANNED_OPTIONS = new Set(["all of the above", "none of the above"]);

const optionsSchema = z
  .array(z.string().trim().min(1))
  .length(4, "Each question must have exactly 4 options.")
  .superRefine((options, ctx) => {
    const normalized = options.map((option) => option.trim().toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A question's options must not contain duplicates.",
      });
    }
    if (normalized.some((option) => BANNED_OPTIONS.has(option))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Options must not include "all of the above" or "none of the above".',
      });
    }
  });

const quizQuestionSchema = z
  .object({
    question: z.string().trim().min(1),
    options: optionsSchema,
    correctAnswer: z.string().trim().min(1),
    explanation: z.string().trim().min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const normalizedOptions = value.options.map((option) => option.trim());
    if (!normalizedOptions.includes(value.correctAnswer.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctAnswer"],
        message: "The correct answer must exactly match one of the options.",
      });
    }
  });

export function quizResponseSchema(expectedQuestionCount: number) {
  return z
    .object({ questions: z.array(quizQuestionSchema) })
    .strict()
    .superRefine((value, ctx) => {
      if (value.questions.length !== expectedQuestionCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: `Expected ${expectedQuestionCount} questions but received ${value.questions.length}.`,
        });
      }
      const normalizedQuestions = value.questions.map((question) =>
        question.question.trim().toLowerCase(),
      );
      if (new Set(normalizedQuestions).size !== normalizedQuestions.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions"],
          message: "The quiz contains duplicate questions.",
        });
      }
    });
}
