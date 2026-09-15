import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required.")
    .max(80, "Category name is too long."),
  description: z
    .string()
    .trim()
    .max(240, "Description is too long.")
    .optional(),
});

export const topicSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Topic title is required.")
    .max(140, "Topic title is too long."),
  categoryId: z.string().trim().min(1, "Category is required."),
  summary: z.string().trim().max(280, "Summary is too long.").optional(),
  content: z.string().trim().max(50000, "Content is too long.").optional(),
  tags: z.string().trim().max(500, "Tags are too long.").optional(),
});

export const sourceSchema = z.object({
  title: z.string().trim().min(1, "Source title is required.").max(160),
  url: z.string().trim().url("Source URL must be a valid URL."),
});

export const sourcesSchema = z
  .array(sourceSchema)
  .max(20, "A topic can have at most 20 sources.");

const importTopicSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(140),
    category: z
      .string()
      .trim()
      .min(1, "Category is required.")
      .max(80)
      .optional(),
    categoryId: z.string().trim().min(1).optional(),
    summary: z.string().trim().max(280).optional(),
    content: z.string().trim().max(50000).optional(),
    tags: z
      .union([z.array(z.string().trim().min(1)).max(50), z.string().max(500)])
      .optional()
      .transform((value) =>
        typeof value === "string" ? value.split(",") : value,
      )
      .default([]),
    relatedTopics: z.array(z.string().trim().min(1)).max(50).default([]),
    sources: sourcesSchema.default([]),
  })
  .superRefine((value, context) => {
    if (!value.category && !value.categoryId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Category is required.",
      });
    }
  });

export const importPayloadSchema = z
  .union([z.array(importTopicSchema).min(1).max(500), importTopicSchema])
  .transform((value) => (Array.isArray(value) ? value : [value]));

export type CategoryInput = z.infer<typeof categorySchema>;
export type TopicInput = z.infer<typeof topicSchema>;
