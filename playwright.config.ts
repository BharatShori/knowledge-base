import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3001", trace: "on-first-retry" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3001",
    reuseExistingServer: true,
    env: {
      // Redirects quiz generation to a local mock server (see
      // tests/e2e/quiz.spec.ts) so e2e tests never call the real Groq API,
      // even if a real GROQ_API_KEY is set in .env for manual use.
      GROQ_API_KEY: "test-key-for-e2e",
      GROQ_BASE_URL: "http://localhost:4010/openai/v1",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
