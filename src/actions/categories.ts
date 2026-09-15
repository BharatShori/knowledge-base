"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { categorySchema } from "@/lib/validation";

function readCategory(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
}

export async function createCategory(formData: FormData) {
  const result = readCategory(formData);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Invalid category." };
  try {
    await prisma.category.create({ data: result.data });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "A category with that name already exists." };
  }
}

export async function updateCategory(id: string, formData: FormData) {
  const result = readCategory(formData);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Invalid category." };
  try {
    await prisma.category.update({ where: { id }, data: result.data });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "A category with that name already exists." };
  }
}

export async function deleteCategory(id: string) {
  const topicCount = await prisma.topic.count({ where: { categoryId: id } });
  if (topicCount > 0)
    return { error: "Category cannot be deleted because it contains topics." };
  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { error: "Category could not be deleted." };
  }
}
