export type QuizDifficulty = "foundation" | "practitioner" | "advanced";

// Plain constants with no server-only dependencies, safe to import from
// client components as well as server code (see lib/quiz/service.ts).
export const QUESTION_COUNT_OPTIONS = [5, 10, 20] as const;
export const DIFFICULTY_OPTIONS: readonly QuizDifficulty[] = [
  "foundation",
  "practitioner",
  "advanced",
];
export const DEFAULT_QUESTION_COUNT = 10;
export const DEFAULT_DIFFICULTY: QuizDifficulty = "practitioner";

export type GeneratedQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export type GeneratedQuiz = {
  questions: GeneratedQuizQuestion[];
};

// Explicit discriminated-union return types for the quiz Server Actions.
// Declaring these (rather than letting TypeScript infer them from mixed
// return statements) keeps `error` a clean discriminant with no incidental
// optional properties leaking onto the success branch.
export type QuizActionError = { error: string };

export type QuizQuestionForClient = {
  id: string;
  question: string;
  options: string[];
  displayOrder: number;
};

export type GenerateQuizResult =
  | QuizActionError
  | {
      success: true;
      quizSessionId: string;
      questions: QuizQuestionForClient[];
    };

export type SubmitAnswerResult =
  | QuizActionError
  | {
      success: true;
      isCorrect: boolean;
      correctAnswer: string;
      explanation: string;
    };

export type QuizReviewItem = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
};

export type CompleteQuizResult =
  | QuizActionError
  | {
      success: true;
      topicTitle: string;
      difficulty: QuizDifficulty;
      questionCount: number;
      score: number;
      percentage: number;
      review: QuizReviewItem[];
    };

export type QuizHistoryEntry = {
  id: string;
  difficulty: string;
  questionCount: number;
  score: number;
  percentage: number;
  completedAt: string;
};
