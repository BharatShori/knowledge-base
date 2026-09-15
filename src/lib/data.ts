import { prisma } from "@/lib/db";

export const DEFAULT_CATEGORIES = [
  "AI & GenAI",
  "API",
  "Automation",
  "CI/CD",
  "Cloud",
  "Databases",
  "DevOps",
  "Mobile Testing",
  "Performance Testing",
  "Security",
  "Software Architecture",
  "Software Testing",
  "Agile / Delivery",
  "General",
];

export async function ensureDefaultCategories() {
  const categoryCount = await prisma.category.count();
  if (categoryCount > 0) return;

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ name })),
  });
}

export async function getDashboardData() {
  await ensureDefaultCategories();
  const [categories, topics, topicCount, tagCount] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { topics: true } } },
    }),
    prisma.topic.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        category: true,
        tags: { include: { tag: true } },
        sources: { orderBy: { createdAt: "asc" } },
        relatedFrom: {
          include: { toTopic: { select: { id: true, title: true } } },
        },
      },
    }),
    prisma.topic.count(),
    prisma.tag.count(),
  ]);

  return {
    categories: categories.map(({ _count, ...category }) => ({
      ...category,
      topicCount: _count.topics,
    })),
    topics: topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      slug: topic.slug,
      summary: topic.summary,
      content: topic.content,
      tags: topic.tags.map(({ tag }) => tag.name),
      sources: topic.sources.map(({ id, title, url }) => ({ id, title, url })),
      relatedTopics: topic.relatedFrom.map(({ toTopic }) => toTopic),
      categoryId: topic.categoryId,
      categoryName: topic.category.name,
      createdAt: topic.createdAt.toISOString(),
      updatedAt: topic.updatedAt.toISOString(),
    })),
    topicCount,
    categoryCount: categories.length,
    tagCount,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
