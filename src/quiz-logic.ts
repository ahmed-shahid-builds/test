import type { QuestionResponse, QuizQuestion } from "./types";

export interface QuizScore {
  readonly correctCount: number;
  readonly total: number;
  readonly percentage: number;
}

export function chooseQuestions(
  bank: readonly QuizQuestion[],
  count = 20,
  random: () => number = Math.random,
): QuizQuestion[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError("Question count must be a positive integer.");
  }
  if (count > bank.length) {
    throw new RangeError("The question bank is smaller than the requested quiz.");
  }

  const shuffled = [...bank];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export function calculateScore(
  questions: readonly QuizQuestion[],
  responses: ReadonlyMap<number, QuestionResponse>,
): QuizScore {
  const correctCount = questions.reduce((total, question) => {
    const response = responses.get(question.id);
    return total + (response?.submitted && response.correct ? 1 : 0);
  }, 0);
  const total = questions.length;
  return {
    correctCount,
    total,
    percentage: total === 0 ? 0 : Math.round((correctCount / total) * 100),
  };
}
