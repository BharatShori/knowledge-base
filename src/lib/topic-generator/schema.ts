import { z } from "zod";
import { slugify } from "@/lib/slug";

const stringArray = z
  .array(z.string().trim().min(1))
  .max(20)
  .optional()
  .transform((value) => value ?? []);

export const topicDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    summary: z.string().trim().min(1).max(280),
    content: z.string().trim().min(1).max(20000),
    tags: stringArray,
    relatedTopics: stringArray,
  })
  .strict();

export const categoryReferenceCardDraftSchema = z
  .object({
    summary: z.string().trim().min(1).max(280),
    content: z.string().trim().min(1).max(20000),
    tags: stringArray,
  })
  .strict();

export function topicBatchResponseSchema(
  maxBatchSize: number,
  requireCategoryReferenceCard: boolean,
) {
  return z
    .object({
      topics: z.array(topicDraftSchema).min(1).max(maxBatchSize),
      categoryReferenceCard: requireCategoryReferenceCard
        ? categoryReferenceCardDraftSchema
        : categoryReferenceCardDraftSchema.optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      const normalizedTitles = value.topics.map((topic) => slugify(topic.title));
      if (new Set(normalizedTitles).size !== normalizedTitles.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["topics"],
          message: "The generated batch contains duplicate topic titles.",
        });
      }
    });
}
