export type FilterableTopic = {
  title: string;
  summary: string | null;
  content: string | null;
  categoryId: string;
  categoryName: string;
  tags: string[];
};

// Match tiers for search result ordering: title matches rank above
// category matches, which rank above summary/content/tag matches.
function matchRank(topic: FilterableTopic, query: string): number {
  if (topic.title.toLowerCase().includes(query)) return 0;
  if (topic.categoryName.toLowerCase().includes(query)) return 1;
  return 2;
}

export function filterTopics<T extends FilterableTopic>(
  topics: T[],
  search: string,
  categoryId: string | null,
  tag: string | null,
) {
  const query = search.trim().toLowerCase();
  const filtered = topics.filter((topic) => {
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

  if (!query) return filtered;

  return filtered
    .map((topic) => ({ topic, rank: matchRank(topic, query) }))
    .sort(
      (a, b) => a.rank - b.rank || a.topic.title.localeCompare(b.topic.title),
    )
    .map((entry) => entry.topic);
}
