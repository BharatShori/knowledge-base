export type FilterableTopic = {
  title: string;
  summary: string | null;
  content: string | null;
  categoryId: string;
  categoryName: string;
  tags: string[];
};

export function filterTopics<T extends FilterableTopic>(
  topics: T[],
  search: string,
  categoryId: string | null,
  tag: string | null,
) {
  const query = search.trim().toLowerCase();
  return topics.filter((topic) => {
    const searchable = [
      topic.title,
      topic.summary ?? "",
      topic.content ?? "",
      topic.categoryName,
      ...topic.tags,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (!categoryId || topic.categoryId === categoryId) &&
      (!tag || topic.tags.includes(tag))
    );
  });
}
