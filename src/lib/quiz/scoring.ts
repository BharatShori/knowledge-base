export function isAnswerCorrect(selectedAnswer: string, correctAnswer: string): boolean {
  return selectedAnswer.trim() === correctAnswer.trim();
}

export function scorePercentage(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}
