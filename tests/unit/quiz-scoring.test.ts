import { describe, expect, it } from "vitest";
import { isAnswerCorrect, scorePercentage } from "@/lib/quiz/scoring";

describe("isAnswerCorrect", () => {
  it("matches an exact answer", () => {
    expect(isAnswerCorrect("Playwright", "Playwright")).toBe(true);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isAnswerCorrect("  Playwright  ", "Playwright")).toBe(true);
  });

  it("rejects a different answer", () => {
    expect(isAnswerCorrect("Selenium", "Playwright")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isAnswerCorrect("playwright", "Playwright")).toBe(false);
  });
});

describe("scorePercentage", () => {
  it("scores 0/5 as 0%", () => {
    expect(scorePercentage(0, 5)).toBe(0);
  });

  it("scores 5/5 as 100%", () => {
    expect(scorePercentage(5, 5)).toBe(100);
  });

  it("scores a mixed 3/5 as 60%", () => {
    expect(scorePercentage(3, 5)).toBe(60);
  });

  it("scores 0/10 as 0%", () => {
    expect(scorePercentage(0, 10)).toBe(0);
  });

  it("scores 10/10 as 100%", () => {
    expect(scorePercentage(10, 10)).toBe(100);
  });

  it("scores a mixed 7/10 as 70%", () => {
    expect(scorePercentage(7, 10)).toBe(70);
  });

  it("rounds to the nearest whole percentage", () => {
    expect(scorePercentage(1, 3)).toBe(33);
    expect(scorePercentage(2, 3)).toBe(67);
  });

  it("returns 0 for a zero-question quiz rather than dividing by zero", () => {
    expect(scorePercentage(0, 0)).toBe(0);
  });
});
