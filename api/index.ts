import {
  clearTeacherCookieHeader,
  configuredTeacherPassword,
  createTeacherSession,
  isValidTeacherSession,
  passwordMatches,
  readCookie,
  teacherCookieHeader,
  TEACHER_COOKIE,
} from "../server/auth.js";
import { initializeDatabase } from "../server/db.js";
import {
  completeQuizAttempt,
  getQuizAttemptTotals,
  isValidAttemptId,
  startQuizAttempt,
} from "../server/quiz-service.js";

let databaseReady: Promise<void> | undefined;
let failedTeacherLogins = 0;
let loginBlockedUntil = 0;

function ensureDatabase(): Promise<void> {
  if (!databaseReady) {
    databaseReady = initializeDatabase().catch((error: unknown) => {
      databaseReady = undefined;
      throw error;
    });
  }
  return databaseReady;
}

function json(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers });
}

function requestPath(url: URL): string {
  const capturedPath = url.searchParams.get("path");
  const rawPath = capturedPath ?? url.pathname.replace(/^\/api\/?/, "");
  const cleanPath = rawPath.replace(/^\/+|\/+$/g, "");
  return `/${cleanPath}`;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 12 * 1024) return null;
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = requestPath(url);
  const method = request.method.toUpperCase();

  if (path === "/quiz/start" && method === "POST") {
    try {
      await ensureDatabase();
      const attemptId = await startQuizAttempt();
      return json({ attemptId }, 201);
    } catch {
      return json({ error: "Quiz attempt tracking is temporarily unavailable." }, 503);
    }
  }

  if (path === "/quiz/complete" && method === "POST") {
    const body = await readJson(request);
    const attemptId = body?.attemptId;
    if (!isValidAttemptId(attemptId)) {
      return json({ error: "A valid attempt reference is required." }, 400);
    }
    try {
      await ensureDatabase();
      const found = await completeQuizAttempt(attemptId);
      return found
        ? json({ recorded: true })
        : json({ error: "The quiz attempt was not found." }, 404);
    } catch {
      return json({ error: "Quiz completion tracking is temporarily unavailable." }, 503);
    }
  }

  if (path === "/teacher/login" && method === "POST") {
    const expectedPassword = configuredTeacherPassword();
    if (!expectedPassword) {
      return json({ error: "The teacher password is not configured or is shorter than 16 characters." }, 503);
    }
    const now = Date.now();
    if (now < loginBlockedUntil) {
      return json({ error: "Too many attempts. Wait a few minutes, then try again." }, 429);
    }
    const body = await readJson(request);
    const candidate = body?.password;
    if (typeof candidate !== "string" || candidate.length > 512 || !passwordMatches(candidate, expectedPassword)) {
      failedTeacherLogins += 1;
      if (failedTeacherLogins >= 10) {
        failedTeacherLogins = 0;
        loginBlockedUntil = now + 10 * 60 * 1000;
      }
      return json({ error: "Password not accepted." }, 401);
    }

    failedTeacherLogins = 0;
    loginBlockedUntil = 0;
    return json({ authenticated: true }, 200, {
      "Set-Cookie": teacherCookieHeader(createTeacherSession(expectedPassword)),
    });
  }

  if (path === "/teacher/logout" && method === "POST") {
    return json({ loggedOut: true }, 200, { "Set-Cookie": clearTeacherCookieHeader() });
  }

  if (path === "/teacher/stats" && method === "GET") {
    const password = configuredTeacherPassword();
    const token = readCookie(request.headers.get("cookie") ?? undefined, TEACHER_COOKIE);
    if (!password || !isValidTeacherSession(token, password)) {
      return json({ error: "Teacher access is required." }, 401);
    }
    try {
      await ensureDatabase();
      return json(await getQuizAttemptTotals());
    } catch {
      return json({ error: "Aggregate totals are temporarily unavailable." }, 503);
    }
  }

  const knownPath = ["/quiz/start", "/quiz/complete", "/teacher/login", "/teacher/logout", "/teacher/stats"].includes(path);
  return knownPath
    ? json({ error: "Method not allowed." }, 405, { Allow: path === "/teacher/stats" ? "GET" : "POST" })
    : json({ error: "Not found." }, 404);
}

export default {
  fetch: handleRequest,
};
