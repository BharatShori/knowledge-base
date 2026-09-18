"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getAIProvider } from "@/lib/ai";
import { generateTopicBatch as generateTopicBatchService } from "@/lib/topic-generator/service";
import { topicPairSchema } from "@/lib/topic-generator/schema";
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
  selectedCandidates: unknown,
): Promise<SaveGeneratedTopicsResult> {
  if (!categoryId) return { error: "Category is required." };

  const parsed = z
    .array(topicPairSchema)
    .min(1, "Select at least one topic to add.")
    .max(BATCH_SIZE)
    .safeParse(selectedCandidates);
  if (!parsed.success) return { error: "Invalid topic data." };

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

        for (const pair of parsed.data) {
          // Defense in depth: never insert a topic whose title exactly matches
          // an existing one, even if a stale/tampered client payload asks for it.
          if (existingSlugs.has(slugify(pair.topic.title))) {
            skippedDuplicateTitles.push(pair.topic.title);
            continue;
          }

          const topicSlug = await uniqueSlug(tx, pair.topic.title);
          const topicTagIds = await resolveTagIds(tx, pair.topic.tags);
          const topic = await tx.topic.create({
            data: {
              title: pair.topic.title,
              slug: topicSlug,
              summary: pair.topic.summary,
              content: pair.topic.content,
              categoryId,
              aiGenerated: true,
              aiProvider,
              aiModel,
              aiBatchId: batchId,
              tags: { create: topicTagIds.map((tagId) => ({ tagId })) },
            },
          });
          topicIdsByTitle.set(pair.topic.title.trim().toLowerCase(), topic.id);
          existingSlugs.add(topicSlug);
          createdIds.push(topic.id);
          pendingRelations.push({
            fromTopicId: topic.id,
            relatedTitles: pair.topic.relatedTopics,
          });

          const referenceCardTitle = `${pair.topic.title} — Reference Card`;
          const referenceCardSlug = await uniqueSlug(tx, referenceCardTitle);
          const referenceCardTagIds = await resolveTagIds(tx, [
            ...pair.referenceCard.tags,
            "Reference Card",
            "Cheat Sheet",
          ]);
          const referenceCard = await tx.topic.create({
            data: {
              title: referenceCardTitle,
              slug: referenceCardSlug,
              summary: pair.referenceCard.summary,
              content: pair.referenceCard.content,
              categoryId,
              aiGenerated: true,
              aiProvider,
              aiModel,
              aiBatchId: batchId,
              tags: { create: referenceCardTagIds.map((tagId) => ({ tagId })) },
            },
          });
          topicIdsByTitle.set(referenceCardTitle.trim().toLowerCase(), referenceCard.id);
          createdIds.push(referenceCard.id);
          pendingRelations.push({
            fromTopicId: referenceCard.id,
            relatedTitles: pair.referenceCard.relatedTopics,
          });
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
