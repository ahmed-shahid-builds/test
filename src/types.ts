export type AnswerLetter = "A" | "B" | "C" | "D";

export interface QuizOption {
  readonly label: AnswerLetter;
  readonly text: string;
}

export interface QuizQuestion {
  readonly id: number;
  readonly category: string;
  readonly text: string;
  readonly options: readonly QuizOption[];
  readonly correctAnswer: AnswerLetter;
  readonly explanation: string;
  readonly source: string;
}

export interface QuestionResponse {
  selected: AnswerLetter | null;
  startedAt: number | null;
  submitted: boolean;
  correct: boolean | null;
  timedOut: boolean;
}
