import { createServer, type Server } from "node:http";

let server: Server | null = null;
let nextResponseBody: unknown = { questions: [] };

/**
 * A minimal stand-in for Groq's OpenAI-compatible chat completions
 * endpoint. Server Actions run in the Next.js dev server process, so
 * Playwright's `page.route()` (which only intercepts browser-originated
 * requests) can't mock them — this real local HTTP server, referenced via
 * GROQ_BASE_URL in playwright.config.ts, is the simplest way to keep e2e
 * tests off the real Groq API.
 */
export function startGroqMockServer(port: number): Promise<void> {
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      if (req.method === "POST" && req.url === "/__set-response") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          nextResponseBody = JSON.parse(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/openai/v1/chat/completions") {
        const content = JSON.stringify(nextResponseBody);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "chatcmpl-mock",
            object: "chat.completion",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content },
                finish_reason: "stop",
              },
            ],
          }),
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });
    server.listen(port, resolve);
  });
}

export function stopGroqMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
    server = null;
  });
}

export async function setNextGroqResponse(
  port: number,
  questions: unknown[],
): Promise<void> {
  await fetch(`http://localhost:${port}/__set-response`, {
    method: "POST",
    body: JSON.stringify({ questions }),
  });
}
