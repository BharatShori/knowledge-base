export const BATCH_SIZE = 10;
export const MAX_CONTEXT_TITLES = 150;

export type GeneratedTopicDraft = {
  title: string;
  summary: string;
  content: string;
  tags: string[];
  relatedTopics: string[];
};

export type GeneratedReferenceCardDraft = {
  summary: string;
  content: string;
  tags: string[];
  relatedTopics: string[];
};

export type GeneratedTopicPair = {
  topic: GeneratedTopicDraft;
  referenceCard: GeneratedReferenceCardDraft;
};

export type GeneratedTopicBatch = {
  topics: GeneratedTopicPair[];
};

export type DuplicateStatus = "none" | "exact" | "similar";

export type TopicCandidate = GeneratedTopicPair & {
  duplicateStatus: DuplicateStatus;
  matchedTitle?: string;
};

// Explicit discriminated-union return types for the topic-generator Server
// Actions — see lib/quiz/types.ts for why these are declared rather than
// inferred (TypeScript can otherwise leak stray optional properties across
// branches that break simple `"error" in result` narrowing).
export type ActionError = { error: string };

export type GenerateTopicBatchResult =
  | ActionError
  | {
      success: true;
      candidates: TopicCandidate[];
      requestedCount: number;
    };

export type SaveGeneratedTopicsResult =
  | ActionError
  | {
      success: true;
      createdTopicIds: string[];
      skippedDuplicateTitles: string[];
    };
