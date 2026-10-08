# CNA Practice

Live site: <https://leo0331.github.io/cna-practice/>

CNA Practice is an independent study app for University of Adelaide Computer Networks and Applications historical exam questions and revision notes. The collection contains every recoverable question and sub-question from the 2013, 2014, and 2015 Semester 1 primary exam papers supplied with this project. Run `npm run stats` for current counts.

The app keeps past exam wording separate from original study guidance. It is intended for study and revision; historical questions and notes may not reflect the current University of Adelaide CNA syllabus, assessment format, or official answers.

## Technology

- Next.js App Router, React, strict TypeScript, Tailwind CSS
- Local typed question data; no account or database
- Browser `localStorage` for reviewed, bookmarked, and last viewed progress
- A production service worker caches the exported question collection for offline use

## Offline use

Open the site online and wait for “Available offline” in the footer before going offline. The production build caches all exported pages, question content, navigation payloads, and app assets, so repeat visits and practice work without a connection. Practice sets, filters, and the current question are saved on this device.

The first visit downloads the collection in the background after the page loads. This uses device storage and mobile data; the build reports its uncompressed size. Caching is unavailable in browsers that block service workers or cache storage, and browsers may evict it. Online use continues if installation fails. Offline caching is disabled in development.

Each build gets a separate cache. An update downloads while online and takes over after all existing site tabs are closed and the site is reopened, avoiding a forced reload during practice. Old caches are then removed. Run `npm run build` to generate `out/sw.js`; deploying an export without this postbuild step does not enable offline use.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Verification commands:

```bash
npm run lint
npm run typecheck
npm test
npm run stats   # dataset counts + validation (also runs before build)
npm run build
```

## Deployment

The site is a static export (`out/`) published to GitHub Pages. Every push to `main` runs `.github/workflows/deploy.yml`. The workflow runs lint, typecheck and tests, then builds with `PAGES_BASE_PATH=/<repo name>` and deploys `out/` with GitHub's Pages actions. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. Pull requests are checked by `.github/workflows/ci.yml` (lint, typecheck, tests, build), and Dependabot (`.github/dependabot.yml`) opens weekly npm and monthly GitHub Actions update PRs. The build also writes `sitemap.xml` from the data. Submit it in Google Search Console, since a project site cannot serve a root `robots.txt`. Live site: <https://leo0331.github.io/cna-practice/>.

## Pages

- `/` — collection overview, category links, and local study progress (continue where you left off, reviewed count, reset)
- `/questions` — searchable library with shareable year, category, topic, type, answer-status, and my-progress (bookmarked / reviewed / not reviewed) filters
- `/questions/[id]` — question and separate Key Concepts, Answer Approach, and Full Answer reveals, previous/next navigation, and links to the other parts of the same exam question
- `/practice` — configurable one-question-at-a-time practice with local progress and a reset button
- `/topics` and `/topics/[slug]` — data-derived topic counts and listings
- `/categories/[slug]` — data-derived category listings
- `/about` — source labeling and disclaimer

On question and practice pages, keyboard shortcuts toggle guidance (K concepts, A approach, F answer), mark progress (R reviewed, B bookmark), and move between questions (← / → or P / N). Printing a question page (Ctrl/Cmd + P) hides navigation and includes all guidance sections.

## Data structure

`src/types/question.ts` defines the `Question`, `QuestionType`, `AnswerStatus`, and `QuestionSource` contracts. Question records live in one file per exam year:

```
src/data/questions/
  2013.ts   2014.ts   2015.ts   # questions2013 / questions2014 / questions2015
  source.ts                     # examSource(year, page) and exam file names
  index.ts                      # exports the combined `questions` array
```

`src/lib/validation.ts` holds the pure `validateQuestions()` checks used by the tests and by `scripts/dataset-report.mjs`. `src/lib/filters.ts` contains reusable pure search and filter functions; `src/lib/questions.ts` provides data-derived queries and counts. `src/lib/progress.ts` handles local progress state. UI components live in `src/components`.

## Dataset

Each exam sub-question is its own record with a deterministic ID (`2015-q2-d-i` = 2015, Question 2(d)(i)), plus `parentQuestion` and `part` linking it to its parent. Sub-question records repeat the shared stem so each page stands alone.

- **Question text** is transcribed from the PDF. Only line-wrap hyphenation and layout are fixed; historical typos (e.g. “Subnect”, “occured”) are kept. Handwritten student annotations on the scans are excluded.
- **category** is one of `application-layer`, `transport-layer`, `network-layer`, `link-layer`, `security-management`. Each topic (e.g. “Congestion Control”, “TCP Connection”) belongs to exactly one category.
- **type** is one of `concept`, `why`, `comparison`, `calculation`, `true-false`, `scenario`, `protocol-flow`, `algorithm`.
- **keyConcepts** (3–8 cues), **answerApproach** (3–6 guiding steps), **answer**, and optional **formulas** are revision notes written for this app, not official marking schemes.
- **answerStatus**: `verified` — directly supported by the supplied 2017 student study notes; `draft` — written from networking principles and the textbook (Kurose & Ross) with no historical answer available, stating any assumption made where the question is ambiguous; `needs-review` — the wording, figure, or interpretation is uncertain. Items needing attention are listed in [`docs/dataset-review.md`](docs/dataset-review.md).
- **requiresFigure** / **figureDescription** mark questions that depend on a figure in the paper and give a text transcription of it.

Example record:

```ts
{
  id: '2015-q2-d-iii', year: 2015, exam: 'Primary Examination, Semester 1',
  questionNumber: 'Q2(d)(iii)', parentQuestion: '2015 Q2(d)', part: 'iii',
  category: 'transport-layer', topic: 'Reliable Transport',
  subtopics: ['Alternating Bit', 'Go-Back-N', 'Selective Repeat', 'Sequence numbers'],
  type: 'concept', marks: 3,
  question: 'We looked at three protocols for providing reliable transport: Alternating Bit, Go-Back-N and Selective-Repeat.

Given a window size, W , what is the minimum sequence space required for each of these protocols?',
  keyConcepts: ['Sequence number wrap-around', 'W + 1 for GBN', '2W for SR', '1 bit for Alternating Bit'],
  answerApproach: ['Alternating Bit has a window of 1: how many numbers distinguish new from duplicate?', 'For GBN, consider a full window sent and all ACKs lost.', 'For SR, the sender and receiver windows must not overlap.'],
  answer: 'Alternating Bit: 2 sequence numbers (0 and 1). Go-Back-N: W + 1. Selective Repeat: 2W (the window can be at most half the sequence space).',
  formulas: ['AB: 2', 'GBN: ≥ W + 1', 'SR: ≥ 2W'],
  source: {
    type: 'past-exam', institution: 'University of Adelaide',
    course: 'Computer Networks and Applications', courseCode: 'COMPSCI 3001 / 7039',
    year: 2015, file: 'CNA-2015-s1-MAIN.pdf', page: 4,
  },
  answerStatus: 'draft',
}
```

In the year files, `source` is written as `examSource(2015, 4)`.

## Add a question or year

1. Open the source PDF and verify exact wording, marks, year, question reference, and page.
2. Add one record per sub-question to the year file (`src/data/questions/<year>.ts`, created from an existing one and added to `index.ts`). Use `examSource(year, page)`, and add the file name to `examFiles` in `source.ts`.
3. Write separate `keyConcepts`, `answerApproach`, and `answer` fields. Set `answerStatus` honestly, and add a `docs/dataset-review.md` entry for anything uncertain.
4. Run `npm run stats`, lint, typecheck, tests, and build. Years, topics, category counts, routes, and filters update from data automatically. (To add years outside 2013–2015, update `examYears` in `src/lib/validation.ts`.)

## Future roadmap

The typed data boundary allows a later JSON, CMS, or database import without changing page components. Possible later work includes more years, accounts and cloud sync, answer submission, AI explanation, random quizzes, spaced repetition, difficulty and statistics, import tools, a content editor, Markdown answers, and mathematical notation. These are outside this v1.
