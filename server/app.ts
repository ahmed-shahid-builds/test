import express from "express";
import {
  clearTeacherCookieHeader,
  configuredTeacherPassword,
  createTeacherSession,
  isValidTeacherSession,
  passwordMatches,
  readCookie,
  teacherCookieHeader,
  TEACHER_COOKIE,
} from "./auth.js";
import {
  completeQuizAttempt,
  getQuizAttemptTotals,
  isValidAttemptId,
  startQuizAttempt,
} from "./quiz-service.js";

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "12kb" }));
app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/_app/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.post("/api/quiz/start", async (_request, response) => {
  try {
    const attemptId = await startQuizAttempt();
    response.status(201).json({ attemptId });
  } catch {
    response.status(503).json({ error: "Quiz attempt tracking is temporarily unavailable." });
  }
});

app.post("/api/quiz/complete", async (request, response) => {
  const attemptId = request.body?.attemptId;
  if (!isValidAttemptId(attemptId)) {
    response.status(400).json({ error: "A valid attempt reference is required." });
    return;
  }
  try {
    const found = await completeQuizAttempt(attemptId);
    if (!found) {
      response.status(404).json({ error: "The quiz attempt was not found." });
      return;
    }
    response.status(200).json({ recorded: true });
  } catch {
    response.status(503).json({ error: "Quiz completion tracking is temporarily unavailable." });
  }
});

let failedTeacherLogins = 0;
let loginBlockedUntil = 0;
app.post("/api/teacher/login", (request, response) => {
  const expectedPassword = configuredTeacherPassword();
  if (!expectedPassword) {
    response.status(503).json({ error: "The teacher password is not configured or is shorter than 16 characters." });
    return;
  }
  const now = Date.now();
  if (now < loginBlockedUntil) {
    response.status(429).json({ error: "Too many attempts. Wait a few minutes, then try again." });
    return;
  }
  const candidate = request.body?.password;
  if (typeof candidate !== "string" || candidate.length > 512 || !passwordMatches(candidate, expectedPassword)) {
    failedTeacherLogins += 1;
    if (failedTeacherLogins >= 10) {
      failedTeacherLogins = 0;
      loginBlockedUntil = now + 10 * 60 * 1000;
    }
    response.status(401).json({ error: "Password not accepted." });
    return;
  }

  failedTeacherLogins = 0;
  loginBlockedUntil = 0;
  response.setHeader("Set-Cookie", teacherCookieHeader(createTeacherSession(expectedPassword)));
  response.status(200).json({ authenticated: true });
});

app.post("/api/teacher/logout", (_request, response) => {
  response.setHeader("Set-Cookie", clearTeacherCookieHeader());
  response.status(200).json({ loggedOut: true });
});

app.get("/api/teacher/stats", async (request, response) => {
  const password = configuredTeacherPassword();
  const token = readCookie(request.headers.cookie, TEACHER_COOKIE);
  if (!password || !isValidTeacherSession(token, password)) {
    response.status(401).json({ error: "Teacher access is required." });
    return;
  }
  try {
    const totals = await getQuizAttemptTotals();
    response.status(200).json(totals);
  } catch {
    response.status(503).json({ error: "Aggregate totals are temporarily unavailable." });
  }
});
