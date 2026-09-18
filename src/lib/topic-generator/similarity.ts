import { slugify } from "@/lib/slug";

export const REFERENCE_CARD_SUFFIX = " — Reference Card";

export function isReferenceCardTitle(title: string): boolean {
  return title.trim().endsWith("— Reference Card");
}

const NEAR_DUPLICATE_THRESHOLD = 0.6;

export type DuplicateStatus = "none" | "exact" | "similar";

export type DuplicateMatch = {
  status: DuplicateStatus;
  matchedTitle?: string;
  similarity?: number;
};

function tokenize(title: string): Set<string> {
  return new Set(slugify(title).split("-").filter(Boolean).map(stem));
}

/** Strips a trailing plural "s" so e.g. "api" and "apis" are treated as the same token. */
function stem(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Jaccard similarity over normalized word tokens, 0 (no overlap) to 1 (identical token sets). */
export function tokenSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersectionSize++;
  }
  const unionSize = tokensA.size + tokensB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Classifies a candidate topic title against existing topic titles.
 * "exact" means the normalized slug matches an existing title exactly.
 * "similar" means the titles share enough word tokens to likely cover the
 * same subject, even if worded differently (e.g. "API Contract Testing"
 * vs. "Contract Testing for APIs").
 */
export function classifyDuplicate(
  candidateTitle: string,
  existingTitles: string[],
): DuplicateMatch {
  const candidateSlug = slugify(candidateTitle);

  for (const existingTitle of existingTitles) {
    if (slugify(existingTitle) === candidateSlug) {
      return { status: "exact", matchedTitle: existingTitle };
    }
  }

  let best: { title: string; similarity: number } | null = null;
  for (const existingTitle of existingTitles) {
    const similarity = tokenSimilarity(candidateTitle, existingTitle);
    if (!best || similarity > best.similarity) {
      best = { title: existingTitle, similarity };
    }
  }

  if (best && best.similarity >= NEAR_DUPLICATE_THRESHOLD) {
    return { status: "similar", matchedTitle: best.title, similarity: best.similarity };
  }

  return { status: "none" };
}
