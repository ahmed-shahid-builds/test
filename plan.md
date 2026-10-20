# Entrepreneur Test — Implementation Plan

## Product scope

Keep the existing Entrepreneur Test quiz: 87 source MCQs; random mixed sets of 20; one current question in fixed order; an automatic 30-second timer; editable answer until submit; immediate keyed answer and PDF-based explanation; percentage result; randomized retake. Keep the password-protected teacher page limited to total starts and completions, with no student identity, answers, or scores persisted.

Prepare the complete project structure as a downloadable ZIP that can be extracted at the Vercel project root. Add a Vercel Node Function using one shared `api/index.ts` Web-standard fetch handler. Map all `/api/*` requests into that handler and rewrite `/teacher` to the built SPA entry. Retain the existing Express/Vite server for Manus Preview. Share quiz-attempt operations, MySQL access, and teacher-session helpers between both runtimes. Build the static client to `dist/client`; keep Vercel-specific build, install, and route configuration in `vercel.json`.

The archive must omit Git history, installed dependencies, generated build output, and credentials. Include Vercel deployment steps and a blank `.env.example`. Vercel cannot receive the Manus-managed `DATABASE_URL` or teacher-password secret through the ZIP, so document that the owner must configure an externally reachable MySQL-compatible `DATABASE_URL` and a strong `TEACHER_PASSWORD` in Vercel project settings.

## Project structure

- `index.html` and `src/` — Entrepreneur Test frontend, 87-question bank, quiz flow, styling, and Vite build.
- `server/db.ts` — managed MySQL pool and additive attempt table.
- `server/quiz-service.ts` — shared start/completion/count operations for both runtime adapters.
- `server/auth.ts` — teacher-password validation and signed secure session cookie helpers.
- `server/app.ts` and `server/index.ts` — Express routes and Manus development/production server.
- `api/index.ts` — one Vercel Function handler for all rewired API paths; no student answers are included.
- `vercel.json` — Vite output settings and Vercel API/SPA rewrites.
- `Dockerfile` — existing Manus server deployment contract.
- `README-VERCEL.md` and `.env.example` — Vercel setup, external database/password requirements, and safe placeholders.
- `VERCEL-DEPLOYMENT.md` — Vercel-specific deployment notes and official references.
- `Entrepreneur-Test-Vercel.zip` — complete source/config bundle, excluding generated or secret files.

## Design direction

- Monochrome exam console: precise ink-and-paper controls with a restrained signal color for timing (0.084).
- Warm editorial study desk: a paper-toned study surface, confident serif headings, and clear contemporary controls (0.086).
- Neo-brutalist classroom handout: bold rules, assertive blocks, and high-contrast answer states (0.088).

Choose **Warm editorial study desk**.

- **Design Movement:** Contemporary editorial learning interface inspired by the calm hierarchy of a well-designed study guide.
- **Core Principles:** Legibility first; one clear action per question; informative feedback without clutter; mobile-first adaptability.
- **Color Philosophy:** Warm ivory and sand create an unhurried study surface; deep ink carries structure; cobalt-blue signals interaction; green/red and amber are reserved for correctness and time pressure.
- **Layout Paradigm:** One centered, readable current-question panel with a progress rail and fixed-order progression; a compact private teacher dashboard uses the same visual system.
- **Signature Elements:** Numbered question markers, a tabular countdown strip, and answer choices with lettered editorial tabs.
- **Interaction Philosophy:** No question navigator or skip control. The selected answer remains editable until Submit; afterward the answer and reason appear and only then does the Next action unlock.
- **Animation:** Short 140–180 ms state transitions, a steadily shrinking timer bar, and respect for `prefers-reduced-motion`.
- **Typography System:** Georgia display headings paired with an Inter/system sans-serif interface stack; tabular numerals for timers and counts.
- **Brand Essence:** A focused practice tool that turns entrepreneurship notes into orderly, answer-by-answer rehearsal; clear, fair, encouraging.
- **Brand Voice:** Direct, supportive, specific. Examples: “Twenty questions. One fresh mix.” and “Your answer stays editable until you submit.”
- **Wordmark & Logo:** The Entrepreneur Test wordmark pairs with the custom four-point spark answer-tab mark already created for the site.
- **Signature Brand Color:** Cobalt blue for selected answers, primary actions, and active progress.

## Constraints

- Preserve the MCQ stems, choices, and keyed correct answers; use the answer key from the MCQ PDF.
- Ground every displayed explanation in the supplied notes and show its source.
- Do not transmit or persist selected answers, scores, or personally identifying student data.
- Backend reporting is starts and completions only; it must not be presented as a unique-student count.
- Each question receives a separate automatic 30-second window; timeout submits the current choice or a blank response.
- The Vercel ZIP must not contain Manus environment secrets; the user supplies the database URL and teacher password in Vercel settings.
- Keep public auto-publication disabled; the user will deploy the archive from their Vercel account.
