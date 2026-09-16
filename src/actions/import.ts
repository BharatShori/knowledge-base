"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { importPayloadSchema } from "@/lib/validation";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Import failed.";
}

type ImportResult =
  | { success: false; error: string }
  | { success: true; importedCount: number; firstTopicId: string | null };

export async function importTopics(
  formData: FormData,
): Promise<ImportResult> {
  const raw = formData.get("json");
  if (typeof raw !== "string" || !raw.trim()) {
    return { success: false, error: "Paste JSON before importing." };
  }
  if (raw.length > 1_000_000) {
    return { success: false, error: "Import JSON must be smaller than 1 MB." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: "Import JSON is not valid JSON." };
  }

  const payload = importPayloadSchema.safeParse(parsed);
  if (!payload.success) {
    const issue = payload.error.issues[0];
    return {
      success: false,
      error: issue
        ? `${issue.path.join(".") || "Import"}: ${issue.message}`
        : "Import JSON is invalid.",
    };
  }

  try {
    const importResult = await prisma.$transaction(async (tx) => {
      const existingTopics = await tx.topic.findMany({
        select: { id: true, title: true },
      });
      const topicIdsByTitle = new Map(
        existingTopics.map((topic) => [
          topic.title.trim().toLowerCase(),
          topic.id,
        ]),
      );
      const importedIds: Array<{ id: string; relatedTitles: string[] }> = [];

      for (const item of payload.data) {
        const category = item.categoryId
          ? await tx.category.findUnique({ where: { id: item.categoryId } })
          : item.category
            ? await tx.category.upsert({
                where: { name: item.category },
                update: {},
                create: { name: item.category },
              })
            : null;
        if (!category)
          throw new Error(`Category not found for "${item.title}".`);

        const tags = [
          ...new Set(
            item.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
          ),
        ];
        const titleKey = item.title.trim().toLowerCase();
        const existingTopic = await tx.topic.findUnique({
          where: { id: topicIdsByTitle.get(titleKey) ?? "" },
          select: { id: true, content: true },
        });
        let topicId = existingTopic?.id;

        if (!existingTopic) {
          const baseSlug = slugify(item.title) || "topic";
          let slug = baseSlug;
          let suffix = 2;
          while (await tx.topic.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
          }
          const topic = await tx.topic.create({
            data: {
              title: item.title,
              slug,
              summary: item.summary,
              content: item.content,
              categoryId: category.id,
            },
          });
          topicId = topic.id;
          topicIdsByTitle.set(titleKey, topic.id);
        } else if (
          (item.content?.length ?? 0) > (existingTopic.content?.length ?? 0)
        ) {
          await tx.topic.update({
            where: { id: existingTopic.id },
            data: {
              summary: item.summary ?? undefined,
              content: item.content,
              categoryId: category.id,
            },
          });
        }

        if (!topicId)
          throw new Error(`Topic could not be imported: "${item.title}".`);
        for (const name of tags) {
          const tag = await tx.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          });
          await tx.topicTag.upsert({
            where: { topicId_tagId: { topicId, tagId: tag.id } },
            update: {},
            create: { topicId, tagId: tag.id },
          });
        }
        for (const source of item.sources) {
          const existingSource = await tx.source.findFirst({
            where: { topicId, url: source.url },
          });
          if (!existingSource)
            await tx.source.create({ data: { ...source, topicId } });
        }
        importedIds.push({ id: topicId, relatedTitles: item.relatedTopics });
      }

      for (const imported of importedIds) {
        for (const title of imported.relatedTitles) {
          const toTopicId = topicIdsByTitle.get(title.trim().toLowerCase());
          if (!toTopicId || toTopicId === imported.id) continue;
          await tx.topicRelation.upsert({
            where: {
              fromTopicId_toTopicId: { fromTopicId: imported.id, toTopicId },
            },
            update: {},
            create: { fromTopicId: imported.id, toTopicId },
          });
        }
      }

      return {
        count: importedIds.length,
        firstTopicId: importedIds[0]?.id ?? null,
      };
    });

    revalidatePath("/");
    return {
      success: true,
      importedCount: importResult.count,
      firstTopicId: importResult.firstTopicId,
    };
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
}
