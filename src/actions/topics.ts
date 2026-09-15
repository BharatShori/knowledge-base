"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { sourcesSchema, topicSchema } from "@/lib/validation";

function readTopic(formData: FormData) {
  return topicSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
    summary: formData.get("summary") || undefined,
    content: formData.get("content") || undefined,
    tags: formData.get("tags") || undefined,
  });
}

function readRelationships(formData: FormData) {
  const relatedTopicIds = formData.getAll("relatedTopicIds").map(String);
  const sourceValue = formData.get("sources");
  let sources: unknown = [];
  if (typeof sourceValue === "string" && sourceValue) {
    try {
      sources = JSON.parse(sourceValue);
    } catch {
      sources = null;
    }
  }
  const sourceResult = sourcesSchema.safeParse(sources);
  return sourceResult.success
    ? {
        ok: true as const,
        relatedTopicIds: [...new Set(relatedTopicIds)],
        sources: sourceResult.data,
      }
    : {
        ok: false as const,
        error: sourceResult.error.issues[0]?.message ?? "Invalid source.",
      };
}

async function uniqueSlug(title: string, currentId?: string) {
  const base = slugify(title) || "topic";
  let slug = base;
  let suffix = 2;
  while (
    await prisma.topic.findFirst({
      where: { slug, ...(currentId ? { NOT: { id: currentId } } : {}) },
    })
  ) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

async function categoryExists(categoryId: string) {
  return Boolean(
    await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    }),
  );
}

async function tagIds(value?: string) {
  const names = [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  return Promise.all(
    names.map(async (name) => {
      const tag = await prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      return tag.id;
    }),
  );
}

function topicData(
  data: {
    title: string;
    categoryId: string;
    summary?: string;
    content?: string;
  },
  slug: string,
) {
  return {
    title: data.title,
    categoryId: data.categoryId,
    summary: data.summary,
    content: data.content,
    slug,
  };
}

export async function createTopic(formData: FormData) {
  const result = readTopic(formData);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Invalid topic." };
  if (!(await categoryExists(result.data.categoryId)))
    return { error: "Category is required." };
  const relationships = readRelationships(formData);
  if (!relationships.ok) return { error: relationships.error };
  try {
    const topic = await prisma.topic.create({
      data: {
        ...topicData(result.data, await uniqueSlug(result.data.title)),
        tags: {
          create: (await tagIds(result.data.tags)).map((tagId) => ({ tagId })),
        },
      },
      include: { category: true },
    });
    const relatedTopicIds = relationships.relatedTopicIds.filter(
      (id) => id !== topic.id,
    );
    await prisma.$transaction([
      prisma.topicRelation.createMany({
        data: relatedTopicIds.map((toTopicId) => ({
          fromTopicId: topic.id,
          toTopicId,
        })),
      }),
      prisma.source.createMany({
        data: relationships.sources.map((source) => ({
          ...source,
          topicId: topic.id,
        })),
      }),
    ]);
    revalidatePath("/");
    return { success: true, topicId: topic.id };
  } catch {
    return { error: "Topic could not be saved." };
  }
}

export async function updateTopic(id: string, formData: FormData) {
  const result = readTopic(formData);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Invalid topic." };
  if (!(await categoryExists(result.data.categoryId)))
    return { error: "Category is required." };
  const relationships = readRelationships(formData);
  if (!relationships.ok) return { error: relationships.error };
  try {
    await prisma.topicTag.deleteMany({ where: { topicId: id } });
    await prisma.topicRelation.deleteMany({ where: { fromTopicId: id } });
    await prisma.source.deleteMany({ where: { topicId: id } });
    await prisma.topic.update({
      where: { id },
      data: {
        ...topicData(result.data, await uniqueSlug(result.data.title, id)),
        tags: {
          create: (await tagIds(result.data.tags)).map((tagId) => ({ tagId })),
        },
      },
    });
    const relatedTopicIds = relationships.relatedTopicIds.filter(
      (relatedId) => relatedId !== id,
    );
    await prisma.$transaction([
      prisma.topicRelation.createMany({
        data: relatedTopicIds.map((toTopicId) => ({
          fromTopicId: id,
          toTopicId,
        })),
      }),
      prisma.source.createMany({
        data: relationships.sources.map((source) => ({
          ...source,
          topicId: id,
        })),
      }),
    ]);
    revalidatePath("/");
    return { success: true, topicId: id };
  } catch {
    return { error: "Topic could not be saved." };
  }
}

export async function deleteTopic(id: string) {
  try {
    await prisma.topic.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Topic could not be deleted." };
  }
}
