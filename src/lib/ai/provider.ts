export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

/**
 * Generic chat/JSON-completion abstraction. Provider-specific request
 * shaping (auth, base URL, model, JSON-mode plumbing) lives in each
 * implementation; callers only deal with messages in, parsed JSON out.
 * Keeps feature code (e.g. quiz generation) portable across providers.
 */
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateJson(messages: ChatMessage[]): Promise<unknown>;
}
