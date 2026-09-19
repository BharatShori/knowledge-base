"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Clock,
  Copy,
  Edit3,
  FolderKanban,
  GraduationCap,
  Hash,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/actions/categories";
import { createTopic, deleteTopic, updateTopic } from "@/actions/topics";
import { importTopics } from "@/actions/import";
import {
  completeQuiz,
  generateQuiz,
  getQuizHistory,
  resumeQuizSession,
  submitAnswer,
} from "@/actions/quiz";
import {
  generateTopicBatch,
  saveGeneratedTopics,
} from "@/actions/topic-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardData } from "@/lib/data";
import { filterTopics } from "@/lib/topic-filter";
import {
  buildTopicClipboardHtml,
  buildTopicClipboardText,
} from "@/lib/topic-clipboard";
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_QUESTION_COUNT,
  DIFFICULTY_OPTIONS,
  MAX_QUIZ_TOPICS,
  QUESTION_COUNT_OPTIONS,
  SCOPE_OPTIONS,
  type CompleteQuizResult,
  type GenerateQuizResult,
  type QuizDifficulty,
  type QuizHistoryEntry,
  type QuizScope,
  type ResumeQuizResult,
  type SubmitAnswerResult,
} from "@/lib/quiz/types";
import {
  BATCH_SIZE,
  type GeneratedCategoryReferenceCard,
  type TopicCandidate,
} from "@/lib/topic-generator/types";

type Topic = DashboardData["topics"][number];
type Category = DashboardData["categories"][number];
type Dialog =
  | "topic"
  | "category"
  | "manage"
  | "import"
  | "delete-topic"
  | "appearance"
  | "generate-topics"
  | null;
type MainView = "browse" | "quiz";

const BG_THEMES = [
  { value: "cream", label: "Cream", swatch: "#f4ecd8" },
  { value: "white", label: "Pure White", swatch: "#ffffff" },
  { value: "gray", label: "Soft Gray", swatch: "#e5e8eb" },
  { value: "sepia", label: "Sepia", swatch: "#ead9b4" },
  { value: "mint", label: "Mint", swatch: "#d7ece3" },
] as const;

const FONT_CHOICES = [
  { value: "sans", label: "Sans", family: "var(--font-dm-sans)" },
  { value: "inter", label: "Inter", family: "var(--font-inter)" },
  { value: "serif", label: "Serif", family: "var(--font-source-serif)" },
  { value: "legible", label: "Legible", family: "var(--font-atkinson)" },
  { value: "mono", label: "Mono", family: "var(--font-jetbrains-mono)" },
] as const;

const FONT_SIZES = [
  { value: "sm", label: "Small", px: 14 },
  { value: "md", label: "Default", px: 16 },
  { value: "lg", label: "Medium", px: 18 },
  { value: "xl", label: "Large", px: 20 },
  { value: "xxl", label: "Extra Large", px: 22 },
] as const;

const BG_THEME_DEFAULT = "cream";
const FONT_DEFAULT = "sans";
const FONT_SIZE_DEFAULT = "md";

function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-4"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-surface shadow-2xl outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="dialog-title"
            className="font-[var(--font-display)] text-2xl font-semibold"
          >
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="p-6">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required = false,
  multiline = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  multiline?: boolean;
}) {
  const classes =
    "mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15";
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      {required && <span className="ml-1 text-accent">*</span>}
      {multiline ? (
        <textarea
          className={`${classes} min-h-36 resize-y`}
          name={name}
          defaultValue={defaultValue ?? ""}
          required={required}
        />
      ) : (
        <input
          className={classes}
          name={name}
          defaultValue={defaultValue ?? ""}
          required={required}
        />
      )}
    </label>
  );
}

function TopicForm({
  categories,
  topics,
  topic,
  onClose,
  onSaved,
}: {
  categories: Category[];
  topics: Topic[];
  topic?: Topic;
  onClose: () => void;
  onSaved: (topicId?: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [sources, setSources] = useState(topic?.sources ?? []);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set(
      "sources",
      JSON.stringify(
        sources.filter((source) => source.title.trim() || source.url.trim()),
      ),
    );
    startTransition(async () => {
      const result = topic
        ? await updateTopic(topic.id, formData)
        : await createTopic(formData);
      if (result.error) setError(result.error);
      else onSaved(result.topicId);
    });
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Title" name="title" defaultValue={topic?.title} required />
      <label className="block text-sm font-semibold">
        Category<span className="ml-1 text-accent">*</span>
        <select
          aria-label="Category"
          name="categoryId"
          defaultValue={topic?.categoryId ?? ""}
          required
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        >
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Summary" name="summary" defaultValue={topic?.summary} />
      <Field
        label="Content"
        name="content"
        defaultValue={topic?.content}
        multiline
      />
      <Field label="Tags" name="tags" defaultValue={topic?.tags.join(", ")} />
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Related topics</legend>
        <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-border p-3">
          {topics
            .filter((candidate) => candidate.id !== topic?.id)
            .map((candidate) => (
              <label
                key={candidate.id}
                className="flex items-center gap-2 text-sm font-normal"
              >
                <input
                  type="checkbox"
                  name="relatedTopicIds"
                  value={candidate.id}
                  defaultChecked={topic?.relatedTopics.some(
                    (related) => related.id === candidate.id,
                  )}
                  className="h-4 w-4 accent-[hsl(var(--accent))]"
                />
                {candidate.title}
              </label>
            ))}
          {topics.filter((candidate) => candidate.id !== topic?.id).length ===
            0 && (
            <p className="text-xs text-muted-foreground">
              Create another topic to link it here.
            </p>
          )}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Sources</legend>
        {sources.map((source, index) => (
          <div
            key={`${source.id}-${index}`}
            className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto]"
          >
            <input
              aria-label={`Source title ${index + 1}`}
              value={source.title}
              onChange={(event) =>
                setSources((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, title: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="Source title"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              aria-label={`Source URL ${index + 1}`}
              value={source.url}
              onChange={(event) =>
                setSources((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, url: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="https://..."
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove source ${index + 1}`}
              onClick={() =>
                setSources((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <X size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setSources((current) => [
              ...current,
              { id: `new-${current.length}`, title: "", url: "" },
            ])
          }
        >
          <Plus size={15} /> Add source
        </Button>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending ? (
            "Saving..."
          ) : (
            <>
              <Check size={16} /> Save topic
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function CategoryForm({
  category,
  onClose,
  onSaved,
}: {
  category?: Category;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = category
        ? await updateCategory(category.id, formData)
        : await createCategory(formData);
      if (result.error) setError(result.error);
      else onSaved();
    });
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        label="Category name"
        name="name"
        defaultValue={category?.name}
        required
      />
      <Field
        label="Description"
        name="description"
        defaultValue={category?.description}
        multiline
      />
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending ? (
            "Saving..."
          ) : (
            <>
              <Check size={16} /> Save category
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function ImportForm({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (firstTopicId: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [format, setFormat] = useState<"json" | "markdown">("json");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult("");
    const formData = new FormData();
    formData.set("format", format);
    formData.set("payload", text);
    startTransition(async () => {
      const response = await importTopics(formData);
      if (!response.success) {
        setError(response.error);
      } else {
        setResult(
          `${response.importedCount} topic${response.importedCount === 1 ? "" : "s"} imported.`,
        );
        onImported(response.firstTopicId);
      }
    });
  }

  const jsonExample = `{
  "title": "Playwright",
  "category": "Automation",
  "summary": "Browser automation",
  "content": "Detailed notes",
  "tags": ["e2e", "typescript"],
  "relatedTopics": [],
  "sources": [{ "title": "Docs", "url": "https://playwright.dev" }]
}`;
  const markdownExample = `# Playwright

Category: Automation
Tags: e2e, typescript
Related: Browser Context
Sources: [Docs](https://playwright.dev)
Summary: Browser automation

Detailed notes go here as Markdown content.`;

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="flex items-center gap-1 rounded-md border border-border p-1">
        <legend className="sr-only">Import format</legend>
        {(["json", "markdown"] as const).map((option) => (
          <label
            key={option}
            className={`flex-1 cursor-pointer rounded-sm px-3 py-1.5 text-center text-sm font-medium capitalize transition-colors ${
              format === option
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <input
              type="radio"
              name="import-format"
              value={option}
              checked={format === option}
              onChange={() => setFormat(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </fieldset>
      <details className="group rounded-md border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-sm font-medium">
          <ChevronRight
            size={16}
            className="shrink-0 transition-transform group-open:rotate-90"
          />
          Usage info
        </summary>
        <div className="border-t border-border px-3 py-3">
          {format === "json" ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Paste one topic object or an array of topic objects. Each
                topic needs a title and category name.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-[#f7f4ec] p-3 text-xs leading-5 text-muted-foreground">
                {jsonExample}
              </pre>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Start each topic with a level-1 heading (# Title). Optional
                metadata lines directly below it set Category, Tags, Related
                and Sources; everything after that becomes the topic&apos;s
                content. Sources use Markdown links.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-md bg-[#f7f4ec] p-3 text-xs leading-5 text-muted-foreground">
                {markdownExample}
              </pre>
            </>
          )}
        </div>
      </details>
      <label className="block text-sm font-semibold" htmlFor="import-payload">
        {format === "json" ? "JSON input" : "Markdown input"}
        <textarea
          id="import-payload"
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
          className="mt-2 min-h-64 w-full resize-y rounded-md border border-border bg-background px-3 py-2.5 font-mono text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          placeholder={
            format === "json" ? "Paste JSON here..." : "Paste Markdown here..."
          }
        />
      </label>
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {result && (
        <p
          role="status"
          className="rounded-md bg-accent/10 px-3 py-2 text-sm text-accent"
        >
          {result}
        </p>
      )}
      <div className="flex justify-end gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending ? (
            "Importing..."
          ) : (
            <>
              <Upload size={16} /> Import topics
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

type QuizPaneStep = "landing" | "question" | "answered" | "results";
type GenerateQuizSuccess = Extract<GenerateQuizResult, { success: true }>;
type SubmitAnswerSuccess = Extract<SubmitAnswerResult, { success: true }>;
type CompleteQuizSuccess = Extract<CompleteQuizResult, { success: true }>;
type ResumeQuizSuccess = Extract<ResumeQuizResult, { success: true }>;

const SCOPE_LABELS: Record<QuizScope, string> = {
  single: "Single Topic",
  multi: "Multiple Topics",
  holistic: "Holistic",
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

// A session's topics can become an empty list if every topic it referenced
// was later deleted (the join row cascades away, the session doesn't).
function formatTopicTitles(titles: string[]): string {
  return titles.length > 0 ? titles.join(", ") : "Deleted topic(s)";
}

function QuizPane({
  topics,
  prefillTopicId,
  onExit,
  onProgressChange,
}: {
  topics: Topic[];
  prefillTopicId: string | null;
  onExit: () => void;
  onProgressChange: (inProgress: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<QuizPaneStep>("landing");
  const [scope, setScope] = useState<QuizScope>("single");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    prefillTopicId ? [prefillTopicId] : [],
  );
  const [topicSearch, setTopicSearch] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(
    DEFAULT_QUESTION_COUNT,
  );
  const [difficulty, setDifficulty] = useState<QuizDifficulty>(
    DEFAULT_DIFFICULTY,
  );
  const [error, setError] = useState("");
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [topicTitles, setTopicTitles] = useState<string[]>([]);
  const [questions, setQuestions] = useState<
    GenerateQuizSuccess["questions"]
  >([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<SubmitAnswerSuccess | null>(
    null,
  );
  const [results, setResults] = useState<CompleteQuizSuccess | null>(null);
  const [showReview, setShowReview] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerStartRef = useRef<number | null>(null);

  function loadHistory() {
    getQuizHistory()
      .then(setHistory)
      .catch(() => {});
  }

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (step !== "question" && step !== "answered") return;
    const interval = setInterval(() => {
      if (timerStartRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const isQuizInProgress = step === "question" || step === "answered";

  // Lets the parent guard its own navigation (sidebar links) with the same
  // leave-confirmation this pane uses for its own Exit Quiz button.
  useEffect(() => {
    onProgressChange(isQuizInProgress);
  }, [isQuizInProgress, onProgressChange]);

  const inProgressHistory = history.filter((entry) => entry.completedAt === null);
  const completedHistory = history.filter((entry) => entry.completedAt !== null);
  const filteredTopics = filterTopics(topics, topicSearch, null, null).slice(0, 50);

  function requestExit() {
    if (isQuizInProgress) {
      setShowLeaveConfirm(true);
      return;
    }
    onExit();
  }

  function beginTimer() {
    timerStartRef.current = Date.now();
    setElapsedSeconds(0);
  }

  function toggleTopicSelection(topicId: string) {
    setSelectedTopicIds((previous) => {
      if (scope === "single") return [topicId];
      if (previous.includes(topicId)) {
        return previous.filter((id) => id !== topicId);
      }
      if (previous.length >= MAX_QUIZ_TOPICS) return previous;
      return [...previous, topicId];
    });
  }

  function startQuiz() {
    setError("");
    startTransition(async () => {
      const result = await generateQuiz(
        scope,
        scope === "holistic" ? [] : selectedTopicIds,
        questionCount,
        difficulty,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setQuizSessionId(result.quizSessionId);
      setTopicTitles(result.topicTitles);
      setQuestions(result.questions);
      setCurrentIndex(0);
      setSelectedOption(null);
      setAnswerResult(null);
      beginTimer();
      setStep("question");
    });
  }

  function finishQuiz(sessionId: string) {
    setError("");
    startTransition(async () => {
      const result = await completeQuiz(sessionId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setResults(result);
      setStep("results");
      loadHistory();
    });
  }

  function resumeQuiz(sessionId: string) {
    setError("");
    startTransition(async () => {
      const result = await resumeQuizSession(sessionId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      applyResumedSession(result);
    });
  }

  function applyResumedSession(result: ResumeQuizSuccess) {
    setQuizSessionId(result.quizSessionId);
    setTopicTitles(result.topicTitles);
    setQuestions(result.questions);
    setDifficulty(result.difficulty);
    setSelectedOption(null);
    setAnswerResult(null);
    beginTimer();
    if (result.resumeIndex >= result.questions.length) {
      finishQuiz(result.quizSessionId);
      return;
    }
    setCurrentIndex(result.resumeIndex);
    setStep("question");
  }

  function submitCurrentAnswer() {
    if (!selectedOption || !currentQuestion) return;
    setError("");
    startTransition(async () => {
      const result = await submitAnswer(currentQuestion.id, selectedOption);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setAnswerResult(result);
      setStep("answered");
    });
  }

  function goToNextQuestion() {
    if (isLastQuestion) {
      if (!quizSessionId) return;
      finishQuiz(quizSessionId);
      return;
    }
    setCurrentIndex((index) => index + 1);
    setSelectedOption(null);
    setAnswerResult(null);
    setStep("question");
  }

  function startNewQuiz() {
    setStep("landing");
    setQuizSessionId(null);
    setTopicTitles([]);
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswerResult(null);
    setResults(null);
    setShowReview(false);
    setError("");
    setSelectedTopicIds([]);
    setTopicSearch("");
    loadHistory();
  }

  const timerLabel = `${Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`;

  const paneHeader = (
    <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex items-center gap-2">
        <GraduationCap size={18} className="text-accent" />
        <h2 className="font-[var(--font-display)] text-xl font-semibold">
          Quiz
        </h2>
      </div>
      <div className="flex items-center gap-3">
        {isQuizInProgress && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Clock size={15} /> {timerLabel}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={requestExit}>
          Exit Quiz
        </Button>
      </div>
    </div>
  );

  const leaveConfirm = showLeaveConfirm && (
    <DialogShell title="Leave quiz?" onClose={() => setShowLeaveConfirm(false)}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Your progress is saved. You can resume this quiz later from the quiz
          history list.
        </p>
        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowLeaveConfirm(false)}
          >
            Stay
          </Button>
          <Button type="button" onClick={onExit}>
            Leave Quiz
          </Button>
        </div>
      </div>
    </DialogShell>
  );

  if (step === "landing") {
    return (
      <Card>
        <CardContent>
          {paneHeader}
          <div className="space-y-6">
            {inProgressHistory.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Continue a quiz in progress
                </p>
                <ul className="mt-3 space-y-2">
                  {inProgressHistory.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/60 px-3 py-2 text-sm"
                    >
                      <span>
                        {formatTopicTitles(entry.topicTitles)} ·{" "}
                        {entry.answeredCount}/{entry.questionCount} answered ·{" "}
                        <span className="capitalize">{entry.difficulty}</span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() => resumeQuiz(entry.id)}
                      >
                        Resume
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <fieldset>
              <legend className="text-sm font-semibold">Scope</legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {SCOPE_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-2 text-sm font-medium ${
                      scope === option ? "text-accent" : "text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz-scope"
                      value={option}
                      checked={scope === option}
                      onChange={() => {
                        setScope(option);
                        setSelectedTopicIds([]);
                      }}
                      className="h-4 w-4 accent-accent"
                    />
                    {SCOPE_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>

            {scope === "holistic" ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                We&apos;ll randomly sample up to {MAX_QUIZ_TOPICS} topics from
                across your whole knowledge base.
              </p>
            ) : (
              <div>
                <label
                  className="block text-sm font-semibold"
                  htmlFor="quiz-topic-search"
                >
                  {scope === "single"
                    ? "Choose a topic"
                    : `Choose up to ${MAX_QUIZ_TOPICS} topics`}
                </label>
                <input
                  id="quiz-topic-search"
                  value={topicSearch}
                  onChange={(event) => setTopicSearch(event.target.value)}
                  placeholder="Search topics..."
                  className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
                <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
                  {filteredTopics.map((topic) => {
                    const isSelected = selectedTopicIds.includes(topic.id);
                    const disabled =
                      scope === "multi" &&
                      !isSelected &&
                      selectedTopicIds.length >= MAX_QUIZ_TOPICS;
                    return (
                      <li key={topic.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleTopicSelection(topic.id)}
                          className={`flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 disabled:cursor-not-allowed disabled:opacity-40 ${
                            isSelected
                              ? "bg-accent/10 text-accent"
                              : "hover:bg-muted"
                          }`}
                        >
                          {isSelected ? (
                            <Check size={14} className="shrink-0" />
                          ) : (
                            <span className="w-[14px] shrink-0" />
                          )}
                          <span className="truncate">{topic.title}</span>
                        </button>
                      </li>
                    );
                  })}
                  {filteredTopics.length === 0 && (
                    <li className="px-3 py-2 text-sm text-muted-foreground">
                      No topics found.
                    </li>
                  )}
                </ul>
                {selectedTopicIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedTopicIds.length} of {MAX_QUIZ_TOPICS} selected
                  </p>
                )}
              </div>
            )}

            <fieldset>
              <legend className="text-sm font-semibold">
                Number of Questions
              </legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {QUESTION_COUNT_OPTIONS.map((count) => (
                  <label
                    key={count}
                    className={`flex cursor-pointer items-center gap-2 text-sm font-medium ${
                      questionCount === count
                        ? "text-accent"
                        : "text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz-question-count"
                      value={count}
                      checked={questionCount === count}
                      onChange={() => setQuestionCount(count)}
                      className="h-4 w-4 accent-accent"
                    />
                    {count}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold">Difficulty</legend>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {DIFFICULTY_OPTIONS.map((level) => (
                  <label
                    key={level}
                    className={`flex cursor-pointer items-center gap-2 text-sm font-medium capitalize ${
                      difficulty === level
                        ? "text-accent"
                        : "text-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz-difficulty"
                      value={level}
                      checked={difficulty === level}
                      onChange={() => setDifficulty(level)}
                      className="h-4 w-4 accent-accent"
                    />
                    {level}
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="flex justify-end border-t border-border pt-5">
              <Button
                type="button"
                onClick={startQuiz}
                disabled={
                  isPending ||
                  (scope !== "holistic" && selectedTopicIds.length === 0)
                }
                aria-busy={isPending}
              >
                {isPending ? "Generating..." : "Start Quiz"}
              </Button>
            </div>

            {completedHistory.length > 0 && (
              <div className="border-t border-border pt-5">
                <button
                  type="button"
                  onClick={() => setShowHistory((value) => !value)}
                  className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  {showHistory ? "Hide" : "View"} quiz history (
                  {completedHistory.length})
                </button>
                {showHistory && (
                  <ul className="mt-3 space-y-2">
                    {completedHistory.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {formatTopicTitles(entry.topicTitles)}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {entry.percentage}%
                          </span>
                          <span className="capitalize">{entry.difficulty}</span>
                          <span>{formatDuration(entry.durationSeconds)}</span>
                          <span>
                            {entry.completedAt &&
                              new Date(entry.completedAt).toLocaleDateString()}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "question" && currentQuestion) {
    return (
      <Card>
        <CardContent>
          {paneHeader}
          {leaveConfirm}
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {formatTopicTitles(topicTitles)} · Question {currentIndex + 1} of{" "}
              {questions.length}
            </p>
            <p className="text-lg font-semibold leading-7">
              {currentQuestion.question}
            </p>
            <div className="space-y-2">
              {currentQuestion.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selectedOption === option}
                  onClick={() => setSelectedOption(option)}
                  className={`block w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                    selectedOption === option
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end border-t border-border pt-5">
              <Button
                type="button"
                onClick={submitCurrentAnswer}
                disabled={!selectedOption || isPending}
                aria-busy={isPending}
              >
                {isPending ? "Submitting..." : "Submit Answer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "answered" && currentQuestion && answerResult) {
    return (
      <Card>
        <CardContent>
          {paneHeader}
          {leaveConfirm}
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {formatTopicTitles(topicTitles)} · Question {currentIndex + 1} of{" "}
              {questions.length}
            </p>
            <p className="text-lg font-semibold leading-7">
              {currentQuestion.question}
            </p>
            <div className="space-y-2">
              {currentQuestion.options.map((option) => {
                const isCorrectOption = option === answerResult.correctAnswer;
                const isSelected = option === selectedOption;
                return (
                  <div
                    key={option}
                    className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
                      isCorrectOption
                        ? "border-green-600 bg-green-50 text-green-800"
                        : isSelected
                          ? "border-red-600 bg-red-50 text-red-800"
                          : "border-border"
                    }`}
                  >
                    <span>{option}</span>
                    {isCorrectOption && <Check size={16} />}
                    {!isCorrectOption && isSelected && <X size={16} />}
                  </div>
                );
              })}
            </div>
            <p
              role="status"
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                answerResult.isCorrect
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {answerResult.isCorrect ? "Correct!" : "Not quite."}
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              {answerResult.explanation}
            </p>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end border-t border-border pt-5">
              <Button
                type="button"
                onClick={goToNextQuestion}
                disabled={isPending}
                aria-busy={isPending}
              >
                {isPending
                  ? "Loading..."
                  : isLastQuestion
                    ? "See Results"
                    : "Next Question"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === "results" && results) {
    const incorrectReview = results.review.filter((item) => !item.isCorrect);
    return (
      <Card>
        <CardContent>
          {paneHeader}
          <div className="space-y-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Quiz Complete · {formatTopicTitles(results.topicTitles)}
            </p>
            <p className="font-[var(--font-display)] text-3xl font-semibold">
              Score: {results.score} / {results.questionCount}
            </p>
            <p className="mt-1 text-lg text-muted-foreground">
              {results.percentage}%
            </p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>{results.score} correct</span>
              <span>{results.questionCount - results.score} incorrect</span>
              <span className="capitalize">{results.difficulty}</span>
              <span>Time: {formatDuration(results.durationSeconds)}</span>
            </div>
            {incorrectReview.length > 0 && (
              <div className="text-left">
                <button
                  type="button"
                  onClick={() => setShowReview((value) => !value)}
                  className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                >
                  {showReview ? "Hide" : "Review"} incorrect answers
                </button>
                {showReview && (
                  <ul className="mt-3 space-y-4">
                    {incorrectReview.map((item, index) => (
                      <li
                        key={index}
                        className="rounded-md border border-border p-3 text-sm"
                      >
                        <p className="font-semibold">{item.question}</p>
                        <p className="mt-1 text-red-700">
                          Your answer: {item.selectedAnswer ?? "No answer"}
                        </p>
                        <p className="text-green-700">
                          Correct answer: {item.correctAnswer}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {item.explanation}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex justify-center gap-3 border-t border-border pt-5">
              <Button type="button" variant="outline" onClick={onExit}>
                Exit Quiz
              </Button>
              <Button type="button" onClick={startNewQuiz}>
                New Quiz
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

type GeneratorStep = "config" | "preview" | "done";

function TopicGeneratorFlow({
  categories,
  initialCategoryId,
  onClose,
  onSaved,
}: {
  categories: Category[];
  initialCategoryId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<GeneratorStep>("config");
  const [categoryId, setCategoryId] = useState(
    initialCategoryId ?? categories[0]?.id ?? "",
  );
  const [candidates, setCandidates] = useState<TopicCandidate[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [categoryReferenceCard, setCategoryReferenceCard] =
    useState<GeneratedCategoryReferenceCard | null>(null);
  const [categoryReferenceCardTitle, setCategoryReferenceCardTitle] = useState("");
  const [referenceCardSelected, setReferenceCardSelected] = useState(false);
  const [seenTitles, setSeenTitles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [savedSummary, setSavedSummary] = useState<{
    addedTopicCount: number;
    referenceCardAdded: boolean;
    skippedDuplicateTitles: string[];
  } | null>(null);

  const selectedCategory = categories.find((category) => category.id === categoryId);

  function runGenerate(excludeTitles: string[]) {
    if (!categoryId) return;
    setError("");
    startTransition(async () => {
      const result = await generateTopicBatch(categoryId, excludeTitles);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCandidates(result.candidates);
      setSelectedIndices(
        new Set(
          result.candidates
            .map((candidate, index) => [candidate, index] as const)
            .filter(([candidate]) => candidate.duplicateStatus === "none")
            .map(([, index]) => index),
        ),
      );
      setCategoryReferenceCard(result.categoryReferenceCard);
      setCategoryReferenceCardTitle(result.categoryReferenceCardTitle);
      setReferenceCardSelected(result.categoryReferenceCard !== null);
      setSeenTitles((previous) => [
        ...previous,
        ...result.candidates.map((candidate) => candidate.title),
      ]);
      setStep("preview");
    });
  }

  function toggleSelected(index: number) {
    setSelectedIndices((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function saveSelected() {
    const selected = candidates.filter((_, index) => selectedIndices.has(index));
    const includeReferenceCard = referenceCardSelected && categoryReferenceCard !== null;
    if (selected.length === 0 && !includeReferenceCard) return;
    setError("");
    startTransition(async () => {
      const result = await saveGeneratedTopics(
        categoryId,
        selected.map(({ title, summary, content, tags, relatedTopics }) => ({
          title,
          summary,
          content,
          tags,
          relatedTopics,
        })),
        includeReferenceCard ? categoryReferenceCard : null,
      );
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSavedSummary({
        addedTopicCount: selected.length - result.skippedDuplicateTitles.length,
        referenceCardAdded:
          includeReferenceCard &&
          !result.skippedDuplicateTitles.includes(categoryReferenceCardTitle),
        skippedDuplicateTitles: result.skippedDuplicateTitles,
      });
      setStep("done");
      onSaved();
    });
  }

  function generateAnotherBatch() {
    setCandidates([]);
    setSelectedIndices(new Set());
    setCategoryReferenceCard(null);
    setCategoryReferenceCardTitle("");
    setReferenceCardSelected(false);
    setSavedSummary(null);
    setStep("config");
  }

  if (step === "config") {
    return (
      <div className="space-y-5">
        <label className="block text-sm font-semibold">
          Category
          <select
            aria-label="Category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {selectedCategory && (
          <p className="text-sm text-muted-foreground">
            Existing topics: {selectedCategory.topicCount}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => runGenerate([])}
            disabled={!categoryId || isPending}
            aria-busy={isPending}
          >
            {isPending ? "Generating..." : "Generate Next 10"}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {candidates.length < BATCH_SIZE
            ? `Coverage for this category is becoming comprehensive — only ${candidates.length} new topic${candidates.length === 1 ? "" : "s"} suggested.`
            : `${candidates.length} new topics suggested.`}
        </p>
        <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
          {candidates.map((candidate, index) => (
            <li
              key={candidate.title}
              className="rounded-md border border-border p-3"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`candidate-${index}`}
                  checked={selectedIndices.has(index)}
                  onChange={() => toggleSelected(index)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <label htmlFor={`candidate-${index}`} className="flex-1 cursor-pointer">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{candidate.title}</span>
                    {candidate.duplicateStatus === "exact" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Exact duplicate
                      </span>
                    )}
                    {candidate.duplicateStatus === "similar" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Potential duplicate
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {candidate.summary}
                  </p>
                  {candidate.matchedTitle && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Similar to existing: &quot;{candidate.matchedTitle}&quot;
                    </p>
                  )}
                </label>
              </div>
            </li>
          ))}
          {categoryReferenceCard && (
            <li className="rounded-md border border-accent/40 bg-accent/5 p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="category-reference-card"
                  checked={referenceCardSelected}
                  onChange={() => setReferenceCardSelected((value) => !value)}
                  className="mt-1 h-4 w-4 accent-accent"
                />
                <label
                  htmlFor="category-reference-card"
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{categoryReferenceCardTitle}</span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                      Category Reference Card
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryReferenceCard.summary}
                  </p>
                </label>
              </div>
            </li>
          )}
        </ul>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => runGenerate(seenTitles)}
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? "Regenerating..." : "Regenerate"}
          </Button>
          <Button
            type="button"
            onClick={saveSelected}
            disabled={
              (selectedIndices.size === 0 &&
                !(referenceCardSelected && categoryReferenceCard)) ||
              isPending
            }
            aria-busy={isPending}
          >
            {isPending
              ? "Adding..."
              : `Add Selected (${
                  selectedIndices.size +
                  (referenceCardSelected && categoryReferenceCard ? 1 : 0)
                })`}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done" && savedSummary) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Topics Added
        </p>
        <p className="font-[var(--font-display)] text-3xl font-semibold">
          {savedSummary.addedTopicCount} topic
          {savedSummary.addedTopicCount === 1 ? "" : "s"} added
        </p>
        {savedSummary.referenceCardAdded && (
          <p className="text-sm text-muted-foreground">
            Plus the category Reference Card.
          </p>
        )}
        {savedSummary.skippedDuplicateTitles.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Skipped {savedSummary.skippedDuplicateTitles.length} already in the
            database: {savedSummary.skippedDuplicateTitles.join(", ")}
          </p>
        )}
        <div className="flex justify-center gap-3 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={generateAnotherBatch}>
            Generate Next 10
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export function KnowledgeBaseApp({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [mainView, setMainView] = useState<MainView>("browse");
  const [quizPrefillTopicId, setQuizPrefillTopicId] = useState<string | null>(
    null,
  );
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    data.topics[0]?.id ?? null,
  );
  const [editingTopic, setEditingTopic] = useState<Topic | undefined>();
  const [editingCategory, setEditingCategory] = useState<
    Category | undefined
  >();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [topicError, setTopicError] = useState("");
  const [topicCopied, setTopicCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [bgTheme, setBgTheme] = useState(BG_THEME_DEFAULT);
  const [fontChoice, setFontChoice] = useState(FONT_DEFAULT);
  const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);
  const [overviewCollapsed, setOverviewCollapsed] = useState(
    data.topics.length > 0,
  );
  const [isPending, startTransition] = useTransition();
  const selectedTopic = data.topics.find(
    (topic) => topic.id === selectedTopicId,
  );
  const visibleTopics = filterTopics(
    data.topics,
    search,
    categoryFilter,
    tagFilter,
  );

  useEffect(() => {
    setSidebarCollapsed(
      window.localStorage.getItem("qe-sidebar-collapsed") === "true",
    );
    setBgTheme(
      window.localStorage.getItem("qe-bg-theme") ?? BG_THEME_DEFAULT,
    );
    setFontChoice(window.localStorage.getItem("qe-font") ?? FONT_DEFAULT);
    setFontSize(
      window.localStorage.getItem("qe-font-size") ?? FONT_SIZE_DEFAULT,
    );
  }, []);

  function applyBgTheme(value: string) {
    setBgTheme(value);
    window.localStorage.setItem("qe-bg-theme", value);
    document.documentElement.setAttribute("data-bg-theme", value);
  }
  function applyFontChoice(value: string) {
    setFontChoice(value);
    window.localStorage.setItem("qe-font", value);
    document.documentElement.setAttribute("data-font", value);
  }
  function applyFontSize(value: string) {
    setFontSize(value);
    window.localStorage.setItem("qe-font-size", value);
    document.documentElement.setAttribute("data-font-size", value);
  }

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (dialog) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;
      if (isTyping) return;
      if (event.key === "/") {
        event.preventDefault();
        setSidebarCollapsed(false);
        setTimeout(
          () => document.getElementById("topic-search")?.focus(),
          0,
        );
      } else if (event.key === "n") {
        event.preventDefault();
        setEditingTopic(undefined);
        setDialog("topic");
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [dialog]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobileSidebarOpen]);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("qe-sidebar-collapsed", String(next));
      return next;
    });
  }

  function refresh(topicId?: string) {
    setDialog(null);
    if (topicId) setSelectedTopicId(topicId);
    window.location.reload();
  }

  function openNewTopic() {
    setEditingTopic(undefined);
    setDialog("topic");
  }

  // Leaving the quiz pane for the browse view (via the sidebar) should
  // confirm first if a quiz is in progress, same as the pane's own Exit
  // Quiz button. Navigation actions that don't touch mainView (e.g.
  // clicks that only happen inside the browse view itself) skip the guard
  // because mainView is already "browse" by the time they run.
  function guardedNavigate(action: () => void) {
    if (mainView === "quiz" && quizInProgress) {
      setPendingNavigation(() => action);
      return;
    }
    action();
  }

  function selectTopic(topicId: string) {
    guardedNavigate(() => {
      setMainView("browse");
      setSelectedTopicId(topicId);
      setOverviewCollapsed(true);
    });
  }

  function selectCategory(categoryId: string) {
    guardedNavigate(() => {
      const firstTopic = data.topics.find(
        (topic) => topic.categoryId === categoryId,
      );
      setMainView("browse");
      setCategoryFilter(categoryId);
      setTagFilter(null);
      setSearch("");
      setSelectedTopicId(firstTopic?.id ?? null);
      setOverviewCollapsed(true);
    });
  }

  const selectedTopicIndex = selectedTopic
    ? visibleTopics.findIndex((topic) => topic.id === selectedTopic.id)
    : -1;
  const previousTopic =
    selectedTopicIndex > 0 ? visibleTopics[selectedTopicIndex - 1] : undefined;
  const nextTopic =
    selectedTopicIndex >= 0 && selectedTopicIndex < visibleTopics.length - 1
      ? visibleTopics[selectedTopicIndex + 1]
      : undefined;

  function openEditTopic() {
    if (selectedTopic) {
      setEditingTopic(selectedTopic);
      setDialog("topic");
    }
  }
  function openQuizForTopic(topicId: string) {
    setQuizPrefillTopicId(topicId);
    setMainView("quiz");
  }
  async function copyTopic() {
    if (!selectedTopic) return;
    setCopyError("");
    const html = buildTopicClipboardHtml(selectedTopic);
    const text = buildTopicClipboardText(selectedTopic);
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setTopicCopied(true);
      setTimeout(() => setTopicCopied(false), 1500);
    } catch {
      setCopyError("Could not copy topic to clipboard.");
    }
  }
  function removeTopic() {
    if (!selectedTopic) return;
    startTransition(async () => {
      const result = await deleteTopic(selectedTopic.id);
      if (result.error) {
        setTopicError(result.error);
      } else {
        setTopicError("");
        setSelectedTopicId(null);
        setDialog(null);
        window.location.reload();
      }
    });
  }
  function removeCategory(category: Category) {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.error) {
        setCategoryError(result.error);
      } else {
        setCategoryError("");
        window.location.reload();
      }
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {mobileSidebarOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex min-h-screen shrink-0 flex-col border-r border-border bg-[#f7f4ec] py-5 transition-[width,padding] duration-200 lg:sticky lg:top-0 lg:h-screen ${mobileSidebarOpen ? "flex" : "hidden lg:flex"} ${sidebarCollapsed ? "w-[92px] px-2" : "w-[280px] px-5"}`}
      >
        <div
          className={`mb-6 flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : "px-2"}`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <BookOpen size={18} />
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="font-[var(--font-display)] text-lg font-semibold leading-none">
                QE / KB
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Knowledge system
              </p>
            </div>
          )}
        </div>
        <div className={`${sidebarCollapsed ? "space-y-2" : "space-y-2"} mb-6`}>
          {sidebarCollapsed ? (
            <button
              className="flex h-10 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
              onClick={() => {
                setSidebarCollapsed(false);
                setTimeout(
                  () => document.getElementById("topic-search")?.focus(),
                  0,
                );
              }}
              aria-label="Search topics"
              title="Search topics"
            >
              <Search size={17} />
            </button>
          ) : (
            <label className="relative block">
              <span className="sr-only">Search topics</span>
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <input
                id="topic-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/15"
                placeholder="Search topics..."
              />
            </label>
          )}
          <div
            className={`grid gap-2 ${sidebarCollapsed ? "grid-cols-1" : "grid-cols-2"}`}
          >
            <Button
              className={sidebarCollapsed ? "px-0" : ""}
              onClick={openNewTopic}
              aria-label="Add topic"
              title="Add topic"
            >
              <Plus size={16} />
              {!sidebarCollapsed && <span>Add</span>}
            </Button>
            <Button
              variant="outline"
              className={sidebarCollapsed ? "px-0" : ""}
              onClick={() => setDialog("import")}
              aria-label="Import"
              title="Import"
            >
              <Upload size={16} />
              {!sidebarCollapsed && <span>Import</span>}
            </Button>
            <Button
              variant="outline"
              className={sidebarCollapsed ? "px-0" : ""}
              onClick={() => setDialog("manage")}
              aria-label="Manage categories"
              title="Manage categories"
            >
              <FolderKanban size={16} />
              {!sidebarCollapsed && <span>Manage</span>}
            </Button>
            <Button
              variant="outline"
              className={sidebarCollapsed ? "px-0" : ""}
              onClick={() => setDialog("generate-topics")}
              aria-label="AI Generate Topics"
              title="AI Generate Topics"
            >
              <Wand2 size={16} />
              {!sidebarCollapsed && <span>AI Generate</span>}
            </Button>
          </div>
        </div>
        <nav
          aria-label="Knowledge base navigation"
          className="min-h-0 flex-1 space-y-7 overflow-y-auto"
        >
          <div>
            {!sidebarCollapsed && (
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Workspace
              </p>
            )}
            <button
              onClick={() =>
                guardedNavigate(() => {
                  setMainView("browse");
                  setCategoryFilter(null);
                  setTagFilter(null);
                  setSearch("");
                  setOverviewCollapsed(false);
                })
              }
              className={`flex w-full items-center gap-3 rounded-md py-2.5 text-left text-sm font-semibold ${sidebarCollapsed ? "justify-center px-1" : "px-3"} ${mainView === "browse" && !categoryFilter && !tagFilter && !search ? "bg-surface text-accent shadow-sm" : "text-muted-foreground hover:bg-surface"}`}
              title="Dashboard"
            >
              <Sparkles size={16} />
              {!sidebarCollapsed && "Dashboard"}
            </button>
            <button
              onClick={() => {
                setQuizPrefillTopicId(null);
                setMainView("quiz");
              }}
              className={`mt-0.5 flex w-full items-center gap-3 rounded-md py-2.5 text-left text-sm font-semibold ${sidebarCollapsed ? "justify-center px-1" : "px-3"} ${mainView === "quiz" ? "bg-surface text-accent shadow-sm" : "text-muted-foreground hover:bg-surface"}`}
              title="Quiz"
            >
              <GraduationCap size={16} />
              {!sidebarCollapsed && "Quiz"}
            </button>
          </div>
          <div>
            {!sidebarCollapsed && (
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Categories
              </p>
            )}
            <div className="space-y-0.5">
              {data.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => selectCategory(category.id)}
                  className={`flex w-full items-center justify-between rounded-md py-2 text-left text-sm ${sidebarCollapsed ? "justify-center px-1" : "px-3"} ${categoryFilter === category.id ? "bg-surface font-semibold text-accent" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}
                  title={category.name}
                >
                  <span className="flex items-center gap-3">
                    {sidebarCollapsed ? (
                      <span className="text-center text-[11px] font-bold uppercase leading-tight">
                        {category.name.slice(0, 5).trim()}
                      </span>
                    ) : (
                      <>
                        <FolderKanban size={15} />
                        {category.name}
                      </>
                    )}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="text-xs opacity-60">
                      {category.topicCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            {!sidebarCollapsed && (
              <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                All topics
              </p>
            )}
            <div className="space-y-0.5">
              {data.topics.slice(0, 8).map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => selectTopic(topic.id)}
                  className={`flex w-full items-center gap-3 rounded-md py-2 text-left text-sm text-muted-foreground hover:bg-surface hover:text-foreground ${sidebarCollapsed ? "justify-center px-1" : "px-3"}`}
                  title={topic.title}
                >
                  <Hash size={15} />
                  {!sidebarCollapsed && topic.title}
                </button>
              ))}
            </div>
          </div>
        </nav>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="flex min-h-[58px] items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {selectedTopic ? selectedTopic.title : "Knowledge base"}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                A quiet place for your engineering notes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {tagFilter && (
              <span className="hidden rounded-full bg-accent/10 px-2.5 py-1 font-semibold text-accent sm:inline">
                Tag: {tagFilter}
              </span>
            )}
            {categoryFilter && (
              <span className="hidden rounded-full bg-muted px-2.5 py-1 font-semibold sm:inline">
                Filtered view
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDialog("appearance")}
              aria-label="Appearance settings"
              title="Appearance settings"
            >
              <Settings size={17} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={toggleSidebar}
              aria-label={
                sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
              }
              title={
                sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
              }
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen size={17} />
              ) : (
                <PanelLeftClose size={17} />
              )}
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          <section aria-label="Knowledge base overview" className="mb-6">
            <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  Your engineering reference
                </p>
                <p className="mt-1 truncate font-[var(--font-display)] text-xl font-semibold">
                  Make the complex <span className="text-accent">click.</span>
                </p>
              </div>
              <button
                className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setOverviewCollapsed((current) => !current)}
                aria-expanded={!overviewCollapsed}
                aria-controls="overview-panel"
              >
                <span className="hidden sm:inline">
                  {overviewCollapsed ? "Show overview" : "Hide overview"}
                </span>
                {overviewCollapsed ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronUp size={16} />
                )}
              </button>
            </div>
            {!overviewCollapsed && (
              <div id="overview-panel" className="mt-3 space-y-3">
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Capture the ideas, tools, and patterns that make quality
                  software possible.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat
                    label="Total topics"
                    value={data.topicCount}
                    icon={<BookOpen size={18} />}
                    detail={
                      data.topicCount
                        ? "Growing your reference"
                        : "Start building your library"
                    }
                  />
                  <Stat
                    label="Categories"
                    value={data.categoryCount}
                    icon={<FolderKanban size={18} />}
                    detail="Ready for your notes"
                  />
                  <Stat
                    label="Tags"
                    value={data.tagCount}
                    icon={<Hash size={18} />}
                    detail={
                      data.tagCount
                        ? "Reusable topic labels"
                        : "Organise as you grow"
                    }
                  />
                </div>
              </div>
            )}
          </section>
          {mainView === "quiz" && (
            <div className="mt-6">
              <QuizPane
                topics={data.topics}
                prefillTopicId={quizPrefillTopicId}
                onExit={() => setMainView("browse")}
                onProgressChange={setQuizInProgress}
              />
            </div>
          )}
          {mainView === "browse" && (
          <>
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(250px,0.72fr)_minmax(0,1.6fr)]">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Topics
                    </p>
                    <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">
                      {tagFilter
                        ? `Tag: ${tagFilter}`
                        : categoryFilter
                          ? data.categories.find(
                              (category) => category.id === categoryFilter,
                            )?.name
                          : search
                            ? "Search results"
                            : "Your library"}
                    </h2>
                  </div>
                  {(categoryFilter || tagFilter || search) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCategoryFilter(null);
                        setTagFilter(null);
                        setSearch("");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="mt-5 space-y-2">
                  {visibleTopics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => selectTopic(topic.id)}
                      aria-current={
                        topic.id === selectedTopicId ? "true" : undefined
                      }
                      className={`w-full rounded-md border px-4 py-3 text-left transition ${topic.id === selectedTopicId ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold">{topic.title}</span>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-muted-foreground"
                        />
                      </div>
                      <p className="mt-1 text-xs text-accent">
                        {topic.categoryName}
                      </p>
                      {topic.summary && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                          {topic.summary}
                        </p>
                      )}
                    </button>
                  ))}
                  {visibleTopics.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-5 py-10 text-center">
                      <p className="font-semibold">
                        {search
                          ? `No topics found for "${search}".`
                          : tagFilter
                            ? `No topics tagged "${tagFilter}".`
                            : categoryFilter
                              ? "No topics in this category."
                              : "No topics yet."}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {search
                          ? "Try another search term."
                          : tagFilter || categoryFilter
                            ? "Try a different filter, or clear it."
                            : "Add your first knowledge topic."}
                      </p>
                      {!search && !tagFilter && !categoryFilter && (
                        <Button className="mt-5" onClick={openNewTopic}>
                          <Plus size={16} /> Add topic
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                {selectedTopic ? (
                  <article>
                    <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          previousTopic && selectTopic(previousTopic.id)
                        }
                        disabled={!previousTopic}
                        aria-label="Previous topic"
                      >
                        <ArrowLeft size={15} />
                        <span className="hidden sm:inline">Back</span>
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {selectedTopicIndex + 1} of {visibleTopics.length}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => nextTopic && selectTopic(nextTopic.id)}
                        disabled={!nextTopic}
                        aria-label="Next topic"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
                          {selectedTopic.categoryName}
                        </p>
                        <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">
                          {selectedTopic.title}
                        </h2>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openQuizForTopic(selectedTopic.id)}
                        >
                          <GraduationCap size={15} /> Quiz Me
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={
                            topicCopied
                              ? "Copied topic to clipboard"
                              : "Copy topic for sharing"
                          }
                          title="Copy for sharing"
                          onClick={copyTopic}
                        >
                          {topicCopied ? (
                            <Check size={16} />
                          ) : (
                            <Copy size={16} />
                          )}
                        </Button>
                        <span role="status" aria-live="polite" className="sr-only">
                          {topicCopied ? "Copied topic to clipboard." : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit topic"
                          onClick={openEditTopic}
                        >
                          <Edit3 size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete topic"
                          onClick={() => setDialog("delete-topic")}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    {copyError && (
                      <p
                        role="alert"
                        className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        {copyError}
                      </p>
                    )}
                    {selectedTopic.summary && (
                      <p className="mt-5 text-lg leading-8 text-muted-foreground">
                        {selectedTopic.summary}
                      </p>
                    )}
                    {selectedTopic.tags.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {selectedTopic.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setTagFilter(tag)}
                            className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="my-7 border-t border-border" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Detailed notes
                    </h3>
                    {selectedTopic.content ? (
                      <div className="markdown-content mt-4 max-w-none text-base leading-8 text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {selectedTopic.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No detailed notes yet. Edit this topic to add them.
                      </p>
                    )}
                    <div className="my-7 border-t border-border" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Related topics
                    </h3>
                    {selectedTopic.relatedTopics.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedTopic.relatedTopics.map((related) => (
                          <button
                            key={related.id}
                            onClick={() => selectTopic(related.id)}
                            className="rounded-md border border-border px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
                          >
                            {related.title}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No related topics.
                      </p>
                    )}
                    <div className="my-7 border-t border-border" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Sources
                    </h3>
                    {selectedTopic.sources.length > 0 ? (
                      <ul className="mt-4 space-y-2">
                        {selectedTopic.sources.map((source) => (
                          <li key={source.id}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
                            >
                              {source.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        No sources.
                      </p>
                    )}
                  </article>
                ) : (
                  <div className="flex min-h-[330px] flex-col items-center justify-center text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
                      <BookOpen size={21} />
                    </div>
                    <h2 className="mt-4 font-[var(--font-display)] text-2xl font-semibold">
                      Choose a topic
                    </h2>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                      Select a topic from your library or create your first one.
                    </p>
                    <Button className="mt-5" onClick={openNewTopic}>
                      <Plus size={16} /> Add topic
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="mt-6">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Category management
                    </p>
                    <h2 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">
                      Keep your library findable.
                    </h2>
                  </div>
                  <Button variant="outline" onClick={() => setDialog("manage")}>
                    <Pencil size={16} /> Manage categories
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          </>
          )}
        </div>
      </main>
      {dialog === "topic" && (
        <DialogShell
          title={editingTopic ? "Edit topic" : "Add topic"}
          onClose={() => setDialog(null)}
        >
          <TopicForm
            categories={data.categories}
            topics={data.topics}
            topic={editingTopic}
            onClose={() => setDialog(null)}
            onSaved={refresh}
          />
        </DialogShell>
      )}
      {dialog === "generate-topics" && (
        <DialogShell
          title="AI Topic Generator"
          onClose={() => setDialog(null)}
        >
          <TopicGeneratorFlow
            categories={data.categories}
            initialCategoryId={categoryFilter}
            onClose={() => setDialog(null)}
            onSaved={() => router.refresh()}
          />
        </DialogShell>
      )}
      {dialog === "import" && (
        <DialogShell
          title="Import topics"
          onClose={() => setDialog(null)}
        >
          <ImportForm
            onClose={() => setDialog(null)}
            onImported={(firstTopicId) => {
              if (firstTopicId) setSelectedTopicId(firstTopicId);
              router.refresh();
            }}
          />
        </DialogShell>
      )}
      {dialog === "category" && (
        <DialogShell
          title={editingCategory ? "Edit category" : "Add category"}
          onClose={() => setDialog("manage")}
        >
          <CategoryForm
            category={editingCategory}
            onClose={() => setDialog("manage")}
            onSaved={() => {
              setDialog("manage");
              window.location.reload();
            }}
          />
        </DialogShell>
      )}
      {dialog === "manage" && (
        <DialogShell
          title="Manage categories"
          onClose={() => {
            setCategoryError("");
            setDialog(null);
          }}
        >
          <div className="space-y-3">
            {categoryError && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {categoryError}
              </p>
            )}
            <Button
              onClick={() => {
                setEditingCategory(undefined);
                setDialog("category");
              }}
            >
              <Plus size={16} /> Add category
            </Button>
            {data.categories.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-5 py-10 text-center">
                <p className="font-semibold">No categories yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a category to start organising your topics.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.topicCount}{" "}
                        {category.topicCount === 1 ? "topic" : "topics"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${category.name}`}
                        onClick={() => {
                          setEditingCategory(category);
                          setDialog("category");
                        }}
                      >
                        <Edit3 size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => removeCategory(category)}
                        disabled={isPending}
                        aria-busy={isPending}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogShell>
      )}
      {dialog === "delete-topic" && selectedTopic && (
        <DialogShell
          title="Delete topic?"
          onClose={() => {
            setTopicError("");
            setDialog(null);
          }}
        >
          <div className="space-y-3">
            {topicError && (
              <p
                role="alert"
                className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {topicError}
              </p>
            )}
            <p className="text-sm leading-6 text-muted-foreground">
              This will permanently remove{" "}
              <strong className="text-foreground">
                {selectedTopic.title}
              </strong>{" "}
              from your knowledge base.
            </p>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setTopicError("");
                setDialog(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={removeTopic}
              disabled={isPending}
              aria-busy={isPending}
            >
              {isPending ? "Deleting..." : "Confirm delete"}
            </Button>
          </div>
        </DialogShell>
      )}
      {dialog === "appearance" && (
        <DialogShell title="Appearance" onClose={() => setDialog(null)}>
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Background
              </legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {BG_THEMES.map((theme) => (
                  <label
                    key={theme.value}
                    className="flex cursor-pointer flex-col items-center gap-1.5"
                  >
                    <input
                      type="radio"
                      name="bg-theme"
                      value={theme.value}
                      checked={bgTheme === theme.value}
                      onChange={() => applyBgTheme(theme.value)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${bgTheme === theme.value ? "border-accent" : "border-border"}`}
                      style={{ background: theme.swatch }}
                    >
                      {bgTheme === theme.value && (
                        <Check size={16} className="text-accent" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {theme.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Font
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FONT_CHOICES.map((font) => (
                  <label
                    key={font.value}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${fontChoice === font.value ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"}`}
                  >
                    <input
                      type="radio"
                      name="font-choice"
                      value={font.value}
                      checked={fontChoice === font.value}
                      onChange={() => applyFontChoice(font.value)}
                      className="sr-only"
                    />
                    <span style={{ fontFamily: font.family }}>
                      {font.label}
                    </span>
                    {fontChoice === font.value && (
                      <Check size={14} className="shrink-0 text-accent" />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Font size
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {FONT_SIZES.map((size) => (
                  <label
                    key={size.value}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${fontSize === size.value ? "border-accent bg-accent/5 text-accent" : "border-border text-muted-foreground hover:border-accent/50"}`}
                  >
                    <input
                      type="radio"
                      name="font-size"
                      value={size.value}
                      checked={fontSize === size.value}
                      onChange={() => applyFontSize(size.value)}
                      className="sr-only"
                    />
                    <span style={{ fontSize: size.px }}>Aa</span>
                    <span>{size.label}</span>
                    {fontSize === size.value && (
                      <Check size={14} className="text-accent" />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </DialogShell>
      )}
      {pendingNavigation && (
        <DialogShell
          title="Leave quiz?"
          onClose={() => setPendingNavigation(null)}
        >
          <div className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Your progress is saved. You can resume this quiz later from the
              quiz history list.
            </p>
            <div className="flex justify-end gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingNavigation(null)}
              >
                Stay
              </Button>
              <Button
                type="button"
                onClick={() => {
                  pendingNavigation();
                  setPendingNavigation(null);
                }}
              >
                Leave Quiz
              </Button>
            </div>
          </div>
        </DialogShell>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  detail,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="text-accent">{icon}</span>
        </div>
        <p className="mt-5 font-[var(--font-display)] text-4xl font-semibold">
          {value}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
