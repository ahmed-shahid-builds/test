import { questionBank } from "./questions";
import { calculateScore, chooseQuestions } from "./quiz-logic";
import type { AnswerLetter, QuestionResponse, QuizQuestion } from "./types";
import "./styles.css";

const ROUND_SIZE = 20;
const QUESTION_SECONDS = 30;
const appElement = document.querySelector<HTMLDivElement>("#app");
if (!appElement) {
  throw new Error("The application mount point is missing.");
}
const app: HTMLDivElement = appElement;

let round: QuizQuestion[] = [];
let currentIndex = -1;
let responses = new Map<number, QuestionResponse>();
let attemptId: string | null = null;
let completionState: "not-started" | "pending" | "recorded" | "failed" = "not-started";
let completionRequest: Promise<void> | null = null;
let timerHandle: number | undefined;
let isStarting = false;

const logoMark = `<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3.5 24.6 15.4 36.5 20l-11.9 4.6L20 36.5l-4.6-11.9L3.5 20l11.9-4.6L20 3.5Z" fill="currentColor"/><circle cx="20" cy="20" r="3.4" fill="#f7f4ed"/></svg>`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function shell(content: string, pageClass = "", headerAction = "<a class=\"header-note\" href=\"/teacher\">Teacher dashboard <span aria-hidden=\"true\">↗</span></a>"): string {
  return `
    <div class="page-shell ${pageClass}">
      <header class="site-header">
        <div class="brand" aria-label="Entrepreneur Test">
          ${logoMark}
          <span>Entrepreneur<span class="brand__light"> Test</span></span>
        </div>
        ${headerAction}
      </header>
      <main id="main-content">${content}</main>
      <footer class="site-footer">
        <span>Built from your entrepreneurship MCQs and notes.</span>
        <span>Only aggregate quiz starts and completions are counted.</span>
      </footer>
    </div>`;
}

function setTitle(title: string): void {
  document.title = `${title} · Entrepreneur Test`;
}

function renderHome(errorMessage = ""): void {
  stopTimer();
  setTitle("Entrepreneurship practice");
  app.innerHTML = shell(`
    <section class="home-hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-line"></span> Entrepreneurship practice</p>
        <h1 id="home-title">Build your<br /><em>enterprise thinking.</em></h1>
        <p class="hero-lede">A fresh mix of entrepreneurship questions, one at a time—with the reason behind every answer.</p>
        <button class="button button--primary start-round" type="button" data-action="start-round">
          <span>Start a 20-question round</span><span class="button-arrow" aria-hidden="true">↗</span>
        </button>
        <p id="start-error" class="inline-error" role="alert" ${errorMessage ? "" : "hidden"}>${escapeHtml(errorMessage)}</p>
        <p class="fine-print">No student accounts or IDs. The backend records attempt starts and completions only.</p>
      </div>
      <aside class="hero-aside" aria-label="Quiz format">
        <div class="aside-index">01 <span> / 03</span></div>
        <p class="aside-kicker">The format</p>
        <div class="format-list">
          <div class="format-item"><span class="format-number">20</span><span><strong>mixed questions</strong><small>selected from 87 MCQs</small></span></div>
          <div class="format-item"><span class="format-number">30<span class="format-unit">s</span></span><span><strong>for each question</strong><small>clock starts on display</small></span></div>
          <div class="format-item"><span class="format-number">→</span><span><strong>fixed random order</strong><small>submit to unlock the next</small></span></div>
        </div>
        <div class="aside-note"><span class="note-star" aria-hidden="true">✳</span><span>Change your answer as often as you like before submitting the current question.</span></div>
      </aside>
    </section>
    <section class="source-strip" aria-label="Question sources">
      <span class="source-strip__label">Question set</span>
      <span>Entrepreneurship MCQs</span><span class="source-separator">·</span>
      <span>Economic development notes</span><span class="source-separator">·</span>
      <span>Theories of Entrepreneurship</span>
    </section>
  `, "page-shell--home");
}

async function startRound(button?: HTMLButtonElement): Promise<void> {
  if (isStarting) return;
  isStarting = true;
  stopTimer();
  const originalMarkup = button?.innerHTML;
  if (button) {
    button.disabled = true;
    button.innerHTML = "Starting your round <span aria-hidden=\"true\">…</span>";
  }

  try {
    const response = await fetch("/api/quiz/start", { method: "POST" });
    const payload = await response.json().catch(() => ({})) as { attemptId?: unknown; error?: unknown };
    if (!response.ok || typeof payload.attemptId !== "string") {
      throw new Error(typeof payload.error === "string" ? payload.error : "The attempt could not be recorded.");
    }

    attemptId = payload.attemptId;
    round = chooseQuestions(questionBank, ROUND_SIZE);
    currentIndex = 0;
    responses = new Map(round.map((question) => [question.id, {
      selected: null,
      startedAt: null,
      submitted: false,
      correct: null,
      timedOut: false,
    }]));
    completionState = "not-started";
    completionRequest = null;
    isStarting = false;
    renderCurrentQuestion();
  } catch {
    isStarting = false;
    if (button) {
      button.disabled = false;
      button.innerHTML = originalMarkup ?? "Start a 20-question round";
    }
    const message = "We couldn't record this quiz start. Check your connection and try again.";
    const inlineError = app.querySelector<HTMLElement>("#start-error");
    if (inlineError) {
      inlineError.textContent = message;
      inlineError.hidden = false;
    } else {
      const actions = app.querySelector<HTMLElement>(".results-actions");
      if (actions) actions.insertAdjacentHTML("beforeend", `<p class="inline-error" role="alert">${escapeHtml(message)}</p>`);
    }
  }
}

function renderCurrentQuestion(): void {
  stopTimer();
  const question = round[currentIndex];
  if (!question) return;
  setTitle(`Question ${currentIndex + 1} of ${ROUND_SIZE}`);

  app.innerHTML = shell(`
    <section class="quiz-intro" aria-labelledby="quiz-title">
      <p class="eyebrow"><span class="eyebrow-line"></span> Mixed practice <span class="eyebrow-divider">/</span> fixed order</p>
      <h1 id="quiz-title">Question ${String(currentIndex + 1).padStart(2, "0")}<br /><em>of ${ROUND_SIZE}.</em></h1>
      <p class="quiz-instructions">Answer this question to reveal the correct choice and its reason. Then the next question unlocks. You cannot skip or choose the order.</p>
      <div class="round-progress" aria-live="polite">
        <div class="round-progress__labels"><span id="progress-label">Question ${currentIndex + 1} of ${ROUND_SIZE}</span><span id="progress-status">${resolvedCount()} submitted</span></div>
        <div class="progress-track" role="progressbar" aria-label="Questions submitted" aria-valuemin="0" aria-valuemax="${ROUND_SIZE}" aria-valuenow="${resolvedCount()}"><span id="progress-fill" style="width:${(resolvedCount() / ROUND_SIZE) * 100}%"></span></div>
      </div>
    </section>
    <section class="question-list" aria-label="Current entrepreneurship question">
      ${renderQuestionCard(question, currentIndex)}
    </section>
  `, "page-shell--quiz", `<div class="header-note"><span class="status-dot"></span> One question at a time</div>`);

  const response = responses.get(question.id)!;
  response.startedAt = Date.now();
  app.querySelector<HTMLElement>(".question-card__prompt")?.focus({ preventScroll: true });
  updateTimer();
  startTimerLoop();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestionCard(question: QuizQuestion, index: number): string {
  const optionMarkup = question.options.map((option) => `
    <label class="choice" data-choice="${option.label}">
      <input type="radio" name="current-answer" value="${option.label}" />
      <span class="choice__letter">${option.label}</span>
      <span class="choice__text">${escapeHtml(option.text)}</span>
      <span class="choice__check" aria-hidden="true">✓</span>
    </label>`).join("");

  return `
    <article class="question-card is-active" id="current-question" data-question-id="${question.id}">
      <div class="question-card__top">
        <div class="question-card__number"><span class="question-card__index">${String(index + 1).padStart(2, "0")}</span><span class="question-card__total">/ ${ROUND_SIZE}</span></div>
        <span class="category-chip">${escapeHtml(question.category)}</span>
        <span class="card-status" data-status>In progress</span>
      </div>
      <h2 class="question-card__prompt" tabindex="-1">${escapeHtml(question.text)}</h2>
      <div class="timer-block" data-timer-block>
        <div class="timer-block__top"><span class="timer-label">Time left for this question</span><span class="timer-value" data-time aria-live="polite">0:${QUESTION_SECONDS}</span></div>
        <div class="timer-track" aria-hidden="true"><span data-timer-fill></span></div>
      </div>
      <fieldset class="answer-group">
        <legend class="sr-only">Choose one answer for question ${index + 1}</legend>
        ${optionMarkup}
      </fieldset>
      <div class="question-card__actions">
        <p class="answer-hint" data-hint>Change your answer freely until you submit.</p>
        <button class="button button--submit" type="button" data-action="submit-question" disabled>Submit answer</button>
      </div>
      <div class="feedback" data-feedback hidden aria-live="polite"></div>
      <div class="advance-area" data-advance hidden></div>
    </article>`;
}

function resolvedCount(): number {
  return [...responses.values()].filter((response) => response.submitted).length;
}

function renderResults(): void {
  stopTimer();
  setTitle("Your results");
  const score = calculateScore(round, responses);
  const review = round.map((question, index) => {
    const response = responses.get(question.id)!;
    const correctOption = question.options.find((option) => option.label === question.correctAnswer)!;
    const selectedOption = question.options.find((option) => option.label === response.selected);
    const outcome = response.correct ? "Correct" : "Review";
    return `
      <details class="review-item">
        <summary><span class="review-item__number">${String(index + 1).padStart(2, "0")}</span><span class="review-item__title">${escapeHtml(question.text)}</span><span class="review-item__result ${response.correct ? "is-correct" : "is-incorrect"}">${outcome}</span></summary>
        <div class="review-item__body">
          <p class="review-answer">Correct answer: <strong>${correctOption.label}. ${escapeHtml(correctOption.text)}</strong></p>
          <p>${escapeHtml(question.explanation)}</p>
          <p class="source-credit">Source: ${escapeHtml(question.source)}</p>
          ${selectedOption && !response.correct ? `<p class="review-selected">Your answer: ${selectedOption.label}. ${escapeHtml(selectedOption.text)}</p>` : response.timedOut && !selectedOption ? `<p class="review-selected">No answer was selected before time ran out.</p>` : ""}
        </div>
      </details>`;
  }).join("");

  app.innerHTML = shell(`
    <section class="results-hero" aria-labelledby="results-title">
      <div class="results-copy"><p class="eyebrow"><span class="eyebrow-line"></span> Round complete</p><h1 id="results-title">Your result,<br /><em>made clear.</em></h1><p class="quiz-instructions">Review the score and explanations, then start another shuffled round whenever you're ready.</p></div>
      <div class="score-card"><p class="score-card__label">Your score</p><div class="score-number">${score.percentage}<span>%</span></div><p class="score-card__detail"><strong>${score.correctCount} of ${score.total}</strong> correct</p><div class="score-card__rule"></div><p class="score-card__message">${score.percentage === 100 ? "A perfect round. Nicely done." : score.percentage >= 70 ? "A strong round. Keep building on it." : "Every answer is another chance to learn."}</p></div>
    </section>
    <section class="results-actions">
      <button class="button button--primary" type="button" data-action="retake">Retake with a new mix <span class="button-arrow" aria-hidden="true">↻</span></button>
      <p>Another 20 questions, reshuffled from the full set.</p>
      <span id="completion-status" class="completion-status" aria-live="polite">${completionText()}</span>
      <button class="button button--secondary" type="button" data-action="retry-completion" ${completionState === "failed" ? "" : "hidden"}>Retry count</button>
      <p id="start-error" class="inline-error" role="alert" hidden></p>
    </section>
    <section class="review-section"><div class="review-section__heading"><p class="eyebrow">Answer review</p><h2>Keep what you learned.</h2><p>Open any question to revisit its answer and source-based explanation.</p></div><div class="review-list">${review}</div></section>
  `, "page-shell--results");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function submitCurrentQuestion(timedOut: boolean): void {
  const question = round[currentIndex];
  const response = question ? responses.get(question.id) : undefined;
  const card = app.querySelector<HTMLElement>("#current-question");
  if (!question || !response || !card || response.submitted) return;
  if (!timedOut && (response.startedAt === null || response.selected === null)) return;

  response.submitted = true;
  response.timedOut = timedOut;
  response.correct = response.selected === question.correctAnswer;
  stopTimer();
  card.classList.remove("is-active");
  card.classList.add("is-submitted", response.correct ? "is-correct" : "is-incorrect");

  const fieldset = card.querySelector<HTMLFieldSetElement>(".answer-group");
  const submitButton = card.querySelector<HTMLButtonElement>('[data-action="submit-question"]');
  const status = card.querySelector<HTMLElement>("[data-status]");
  const hint = card.querySelector<HTMLElement>("[data-hint]");
  const feedback = card.querySelector<HTMLElement>("[data-feedback]");
  const advanceArea = card.querySelector<HTMLElement>("[data-advance]");
  if (fieldset) fieldset.disabled = true;
  if (submitButton) submitButton.hidden = true;
  if (status) status.textContent = timedOut ? "Time expired" : "Submitted";
  if (hint) hint.textContent = "This question is locked. Read the explanation, then continue.";

  const correctOption = question.options.find((option) => option.label === question.correctAnswer)!;
  const selectedOption = question.options.find((option) => option.label === response.selected);
  if (feedback) {
    feedback.className = `feedback ${response.correct ? "feedback--correct" : "feedback--incorrect"}`;
    feedback.innerHTML = `
      <div class="feedback__mark" aria-hidden="true">${response.correct ? "✓" : timedOut ? "⌛" : "↗"}</div>
      <div class="feedback__body">
        <p class="feedback__heading">${timedOut ? "Time’s up" : response.correct ? "That’s right" : "Not quite"}${timedOut && response.correct ? " — your answer is correct" : ""}</p>
        ${selectedOption && !response.correct ? `<p class="feedback__selected">Your answer: ${selectedOption.label}. ${escapeHtml(selectedOption.text)}</p>` : timedOut && !selectedOption ? "<p class=\"feedback__selected\">No answer was selected before time ran out.</p>" : ""}
        <p class="feedback__answer">Correct answer: <strong>${correctOption.label}. ${escapeHtml(correctOption.text)}</strong></p>
        <p class="feedback__explanation">${escapeHtml(question.explanation)}</p>
        <p class="source-credit">Source: ${escapeHtml(question.source)}</p>
      </div>`;
    feedback.hidden = false;
  }

  const isFinal = currentIndex === ROUND_SIZE - 1;
  if (isFinal) void recordCompletion();
  if (advanceArea) {
    advanceArea.innerHTML = `
      ${isFinal ? `<div class="completion-row"><span id="completion-status" class="completion-status" aria-live="polite">${completionText()}</span><button class="button button--secondary" type="button" data-action="retry-completion" ${completionState === "failed" ? "" : "hidden"}>Retry count</button></div>` : ""}
      <button class="button button--primary" type="button" data-action="${isFinal ? "show-results" : "next-question"}">${isFinal ? "See your results" : "Next question"}<span class="button-arrow" aria-hidden="true">${isFinal ? "↗" : "→"}</span></button>`;
    advanceArea.hidden = false;
  }
  updateProgress();
}

function updateProgress(): void {
  const submitted = resolvedCount();
  const label = app.querySelector<HTMLElement>("#progress-label");
  const status = app.querySelector<HTMLElement>("#progress-status");
  const fill = app.querySelector<HTMLElement>("#progress-fill");
  const progress = app.querySelector<HTMLElement>('[role="progressbar"]');
  if (label) label.textContent = `Question ${currentIndex + 1} of ${ROUND_SIZE}`;
  if (status) status.textContent = `${submitted} submitted`;
  if (fill) fill.style.width = `${(submitted / ROUND_SIZE) * 100}%`;
  progress?.setAttribute("aria-valuenow", String(submitted));
}

function advanceQuestion(): void {
  const question = round[currentIndex];
  if (!question || !responses.get(question.id)?.submitted || currentIndex >= ROUND_SIZE - 1) return;
  currentIndex += 1;
  renderCurrentQuestion();
}

function startTimerLoop(): void {
  stopTimer();
  timerHandle = window.setInterval(updateTimer, 200);
}

function stopTimer(): void {
  if (timerHandle !== undefined) {
    window.clearInterval(timerHandle);
    timerHandle = undefined;
  }
}

function updateTimer(): void {
  const question = round[currentIndex];
  const response = question ? responses.get(question.id) : undefined;
  if (!response || response.startedAt === null || response.submitted) {
    stopTimer();
    return;
  }
  const totalMs = QUESTION_SECONDS * 1000;
  const remainingMs = Math.max(0, totalMs - (Date.now() - response.startedAt));
  const seconds = Math.ceil(remainingMs / 1000);
  const timerValue = app.querySelector<HTMLElement>("[data-time]");
  const timerFill = app.querySelector<HTMLElement>("[data-timer-fill]");
  const timerBlock = app.querySelector<HTMLElement>("[data-timer-block]");
  if (timerValue) timerValue.textContent = `0:${String(seconds).padStart(2, "0")}`;
  if (timerFill) timerFill.style.width = `${(remainingMs / totalMs) * 100}%`;
  timerBlock?.classList.toggle("is-urgent", seconds <= 5);
  if (remainingMs <= 0) submitCurrentQuestion(true);
}

function completionText(): string {
  if (completionState === "pending") return "Recording this completion…";
  if (completionState === "recorded") return "Completion counted.";
  if (completionState === "failed") return "Completion could not be counted yet.";
  return "Completion count pending.";
}

function updateCompletionUI(): void {
  const status = app.querySelector<HTMLElement>("#completion-status");
  const retry = app.querySelector<HTMLButtonElement>('[data-action="retry-completion"]');
  if (status) status.textContent = completionText();
  if (retry) retry.hidden = completionState !== "failed";
}

async function recordCompletion(): Promise<void> {
  if (!attemptId || completionState === "recorded") return;
  if (completionRequest) return completionRequest;
  completionState = "pending";
  updateCompletionUI();
  completionRequest = (async () => {
    try {
      const response = await fetch("/api/quiz/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      if (!response.ok) throw new Error("Completion was not recorded.");
      completionState = "recorded";
    } catch {
      completionState = "failed";
    } finally {
      completionRequest = null;
      updateCompletionUI();
    }
  })();
  return completionRequest;
}

function renderTeacher(): void {
  stopTimer();
  setTitle("Teacher dashboard");
  app.innerHTML = shell(`
    <section class="teacher-page" aria-labelledby="teacher-title">
      <p class="eyebrow"><span class="eyebrow-line"></span> Private teacher page</p>
      <h1 id="teacher-title">Quiz participation,<br /><em>at a glance.</em></h1>
      <p class="quiz-instructions">This dashboard counts quiz attempts—not unique students. It stores no names, student IDs, answers, or scores.</p>
      <div id="teacher-access" class="teacher-access" aria-live="polite"><p class="teacher-loading">Checking teacher access…</p></div>
    </section>
  `, "page-shell--teacher", `<a class="header-note" href="/">Back to the quiz <span aria-hidden="true">↗</span></a>`);
  void loadTeacherStats();
}

function renderTeacherLogin(message = ""): void {
  const access = app.querySelector<HTMLElement>("#teacher-access");
  if (!access) return;
  access.innerHTML = `
    <form class="teacher-login" id="teacher-login-form">
      <label for="teacher-password">Teacher password</label>
      <input id="teacher-password" name="password" type="password" autocomplete="current-password" minlength="16" required />
      <p class="teacher-hint">Use the password configured privately for this project (at least 16 characters).</p>
      ${message ? `<p class="inline-error" role="alert">${escapeHtml(message)}</p>` : ""}
      <button class="button button--primary" type="submit">Open teacher totals <span class="button-arrow" aria-hidden="true">↗</span></button>
    </form>`;
}

async function loadTeacherStats(): Promise<void> {
  const access = app.querySelector<HTMLElement>("#teacher-access");
  if (!access) return;
  try {
    const response = await fetch("/api/teacher/stats", { cache: "no-store", credentials: "same-origin" });
    if (response.status === 401) {
      renderTeacherLogin();
      return;
    }
    if (!response.ok) throw new Error("The totals are temporarily unavailable.");
    const stats = await response.json() as { totalStarted?: unknown; totalCompleted?: unknown };
    if (!app.contains(access)) return;
    renderTeacherTotals(access, stats);
  } catch {
    if (app.contains(access)) renderTeacherLogin("The teacher page could not connect. Please try again.");
  }
}

function renderTeacherTotals(access: HTMLElement, stats: { totalStarted?: unknown; totalCompleted?: unknown }): void {
  const started = Number(stats.totalStarted);
  const completed = Number(stats.totalCompleted);
  if (!Number.isSafeInteger(started) || !Number.isSafeInteger(completed) || started < 0 || completed < 0) {
    renderTeacherLogin("The dashboard returned invalid totals. Please refresh and try again.");
    return;
  }
  access.innerHTML = `
    <div class="teacher-stats">
      <article class="teacher-stat"><span class="teacher-stat__label">Quiz starts</span><strong>${started.toLocaleString()}</strong><small>Total attempts begun</small></article>
      <article class="teacher-stat"><span class="teacher-stat__label">Completions</span><strong>${completed.toLocaleString()}</strong><small>Attempts with all 20 resolved</small></article>
    </div>
    <div class="teacher-dashboard-foot"><p>Counts are aggregate attempt totals, not unique-student totals. No student identity or answer data is stored.</p><button class="button button--secondary" type="button" data-action="teacher-logout">Lock teacher page</button></div>`;
}

async function submitTeacherLogin(form: HTMLFormElement): Promise<void> {
  const passwordInput = form.elements.namedItem("password");
  if (!(passwordInput instanceof HTMLInputElement)) return;
  const password = passwordInput.value;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  try {
    const response = await fetch("/api/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: unknown };
    passwordInput.value = "";
    if (!response.ok) {
      renderTeacherLogin(typeof payload.error === "string" ? payload.error : "Password not accepted.");
      return;
    }
    await loadTeacherStats();
  } catch {
    passwordInput.value = "";
    renderTeacherLogin("The teacher page could not connect. Please try again.");
  }
}

async function lockTeacherPage(): Promise<void> {
  try {
    await fetch("/api/teacher/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    renderTeacherLogin("Teacher page locked.");
  }
}

app.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button || button.disabled) return;

  switch (button.dataset.action) {
    case "start-round":
    case "retake":
      void startRound(button);
      break;
    case "submit-question":
      submitCurrentQuestion(false);
      break;
    case "next-question":
      advanceQuestion();
      break;
    case "show-results":
      renderResults();
      break;
    case "retry-completion":
      void recordCompletion();
      break;
    case "teacher-logout":
      void lockTeacherPage();
      break;
    default:
      break;
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.name !== "current-answer") return;
  const question = round[currentIndex];
  const response = question ? responses.get(question.id) : undefined;
  if (!question || !response || response.submitted) return;
  const option = question.options.find((item) => item.label === target.value);
  if (!option) return;
  response.selected = option.label as AnswerLetter;
  const submitButton = app.querySelector<HTMLButtonElement>('[data-action="submit-question"]');
  if (submitButton) submitButton.disabled = false;
  const hint = app.querySelector<HTMLElement>("[data-hint]");
  if (hint) hint.textContent = `Answer ${option.label} selected. You can change it until you submit.`;
});

app.addEventListener("submit", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement) || target.id !== "teacher-login-form") return;
  event.preventDefault();
  void submitTeacherLogin(target);
});

if (window.location.pathname.replace(/\/+$/, "") === "/teacher") {
  renderTeacher();
} else {
  renderHome();
}
