import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function cleanupTestData() {
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
