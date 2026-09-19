import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function cleanupTestData() {
  // Quiz sessions must be removed before their topics: once a topic is
  // deleted, the QuizSessionTopic join row cascades away but the session
  // itself survives (orphaned, with an empty topic list).
  const linkedSessions = await prisma.quizSessionTopic.findMany({
    where: { topic: { title: { startsWith: "E2E " } } },
    select: { quizSessionId: true },
  });
  if (linkedSessions.length > 0) {
    await prisma.quizSession.deleteMany({
      where: { id: { in: linkedSessions.map((s) => s.quizSessionId) } },
    });
  }
  await prisma.topic.deleteMany({ where: { title: { startsWith: "E2E " } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: "E2E " } } });
  await prisma.tag.deleteMany({
    where: {
      topics: { none: {} },
      OR: [
        { name: { startsWith: "e2e-" } },
        { name: { startsWith: "typescript-" } },
      ],
    },
  });
}
