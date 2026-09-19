"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getAIProvider } from "@/lib/ai";
import { generateTopicBatch as generateTopicBatchService } from "@/lib/topic-generator/service";
import {
  categoryReferenceCardDraftSchema,
  topicDraftSchema,
} from "@/lib/topic-generator/schema";
import { BATCH_SIZE } from "@/lib/topic-generator/types";
import type {
  GenerateTopicBatchResult,
  SaveGeneratedTopicsResult,
} from "@/lib/topic-generator/types";

export async function generateTopicBatch(
  categoryId: string,
  excludeTitles: string[] = [],
): Promise<GenerateTopicBatchResult> {
  if (!categoryId) return { error: "Category is required." };

  const safeExcludeTitles = excludeTitles
    .filter((title): title is string => typeof title === "string")
    .slice(0, 50);

  const result = await generateTopicBatchService({
    categoryId,
    excludeTitles: safeExcludeTitles,
  });
  if (!result.ok) return { error: result.error };

  return {
    success: true,
    candidates: result.candidates,
    requestedCount: BATCH_SIZE,
    categoryReferenceCard: result.categoryReferenceCard,
    categoryReferenceCardTitle: result.categoryReferenceCardTitle,
  };
}

async function resolveTagIds(
  tx: Prisma.TransactionClient,
  names: string[],
): Promise<string[]> {
  const normalized = [
    ...new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean)),
  ];
  return Promise.all(
    normalized.map(async (name) => {
      const tag = await tx.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      return tag.id;
    }),
  );
}

async function uniqueSlug(
  tx: Prisma.TransactionClient,
  title: string,
): Promise<string> {
  const base = slugify(title) || "topic";
  let slug = base;
  let suffix = 2;
  while (await tx.topic.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function saveGeneratedTopics(
  categoryId: string,
  selectedTopics: unknown,
  categoryReferenceCard: unknown,
): Promise<SaveGeneratedTopicsResult> {
  if (!categoryId) return { error: "Category is required." };

  const parsedTopics = z
    .array(topicDraftSchema)
    .max(BATCH_SIZE)
    .safeParse(selectedTopics);
  if (!parsedTopics.success) return { error: "Invalid topic data." };

  const parsedReferenceCard = categoryReferenceCard
    ? categoryReferenceCardDraftSchema.safeParse(categoryReferenceCard)
    : null;
  if (parsedReferenceCard && !parsedReferenceCard.success) {
    return { error: "Invalid reference card data." };
  }
  const referenceCardData = parsedReferenceCard?.data ?? null;

  if (parsedTopics.data.length === 0 && !referenceCardData) {
    return { error: "Select at least one topic to add." };
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) return { error: "Category not found." };

  let aiProvider = "groq";
  let aiModel = "unknown";
  try {
    const provider = getAIProvider();
    aiProvider = provider.name;
    aiModel = provider.model;
  } catch {
    // Metadata only — don't block saving already-generated content over this.
  }

  const batchId = randomUUID();

  try {
    const { createdIds: createdTopicIds, skippedDuplicateTitles } = await prisma.$transaction(
      async (tx) => {
        const existingTopics = await tx.topic.findMany({
          select: { id: true, title: true },
        });
        const topicIdsByTitle = new Map(
          existingTopics.map((topic) => [topic.title.trim().toLowerCase(), topic.id]),
        );
        const existingSlugs = new Set(
          existingTopics.map((topic) => slugify(topic.title)),
        );

        const createdIds: string[] = [];
        const skippedDuplicateTitles: string[] = [];
        const pendingRelations: { fromTopicId: string; relatedTitles: string[] }[] = [];

        for (const topic of parsedTopics.data) {
          // Defense in depth: never insert a topic whose title exactly matches
          // an existing one, even if a stale/tampered client payload asks for it.
          if (existingSlugs.has(slugify(topic.title))) {
            skippedDuplicateTitles.push(topic.title);
            continue;
          }

          const topicSlug = await uniqueSlug(tx, topic.title);
          const topicTagIds = await resolveTagIds(tx, topic.tags);
          const created = await tx.topic.create({
            data: {
              title: topic.title,
              slug: topicSlug,
              summary: topic.summary,
              content: topic.content,
              categoryId,
              aiGenerated: true,
              aiProvider,
              aiModel,
              aiBatchId: batchId,
              tags: { create: topicTagIds.map((tagId) => ({ tagId })) },
            },
          });
          topicIdsByTitle.set(topic.title.trim().toLowerCase(), created.id);
          existingSlugs.add(topicSlug);
          createdIds.push(created.id);
          pendingRelations.push({
            fromTopicId: created.id,
            relatedTitles: topic.relatedTopics,
          });
        }

        if (referenceCardData) {
          const referenceCardTitle = `${category.name} — Reference Card`;
          if (existingSlugs.has(slugify(referenceCardTitle))) {
            skippedDuplicateTitles.push(referenceCardTitle);
          } else {
            const referenceCardSlug = await uniqueSlug(tx, referenceCardTitle);
            const referenceCardTagIds = await resolveTagIds(tx, [
              ...referenceCardData.tags,
              "Reference Card",
              "Cheat Sheet",
            ]);
            const referenceCard = await tx.topic.create({
              data: {
                title: referenceCardTitle,
                slug: referenceCardSlug,
                summary: referenceCardData.summary,
                content: referenceCardData.content,
                categoryId,
                aiGenerated: true,
                aiProvider,
                aiModel,
                aiBatchId: batchId,
                tags: { create: referenceCardTagIds.map((tagId) => ({ tagId })) },
              },
            });
            createdIds.push(referenceCard.id);
          }
        }

        for (const { fromTopicId, relatedTitles } of pendingRelations) {
          for (const title of relatedTitles) {
            const toTopicId = topicIdsByTitle.get(title.trim().toLowerCase());
            if (!toTopicId || toTopicId === fromTopicId) continue;
            await tx.topicRelation.upsert({
              where: { fromTopicId_toTopicId: { fromTopicId, toTopicId } },
              update: {},
              create: { fromTopicId, toTopicId },
            });
          }
        }

        return { createdIds, skippedDuplicateTitles };
      },
    );

    revalidatePath("/");
    return { success: true, createdTopicIds, skippedDuplicateTitles };
  } catch (error) {
    console.error("Failed to save generated topics:", error);
    return { error: "Unable to save the generated topics. Please try again." };
  }
}
