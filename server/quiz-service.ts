import { randomUUID } from "node:crypto";
import {
  getAttemptTotals as readAttemptTotals,
  insertQuizAttempt,
  markQuizAttemptComplete,
} from "./db.js";

const ATTEMPT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAttemptId(value: unknown): value is string {
  return typeof value === "string" && ATTEMPT_ID_PATTERN.test(value);
}

export async function startQuizAttempt(): Promise<string> {
  const attemptId = randomUUID();
  await insertQuizAttempt(attemptId);
  return attemptId;
}

export async function completeQuizAttempt(attemptId: string): Promise<boolean> {
  return markQuizAttemptComplete(attemptId);
}

export async function getQuizAttemptTotals(): Promise<{ totalStarted: number; totalCompleted: number }> {
  return readAttemptTotals();
}
