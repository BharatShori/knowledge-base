import { z } from "zod";
import { slugify } from "@/lib/slug";

const stringArray = z
  .array(z.string().trim().min(1))
  .max(20)
  .optional()
  .transform((value) => value ?? []);

const topicDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    summary: z.string().trim().min(1).max(280),
    content: z.string().trim().min(1).max(20000),
    tags: stringArray,
    relatedTopics: stringArray,
  })
  .strict();

const referenceCardDraftSchema = z
  .object({
    summary: z.string().trim().min(1).max(280),
    content: z.string().trim().min(1).max(20000),
    tags: stringArray,
    relatedTopics: stringArray,
  })
  .strict();

export const topicPairSchema = z
  .object({
    topic: topicDraftSchema,
    referenceCard: referenceCardDraftSchema,
  })
  .strict();

export function topicBatchResponseSchema(maxBatchSize: number) {
  return z
    .object({ topics: z.array(topicPairSchema).min(1).max(maxBatchSize) })
    .strict()
    .superRefine((value, ctx) => {
      const normalizedTitles = value.topics.map((pair) => slugify(pair.topic.title));
      if (new Set(normalizedTitles).size !== normalizedTitles.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["topics"],
          message: "The generated batch contains duplicate topic titles.",
        });
      }
    });
}
