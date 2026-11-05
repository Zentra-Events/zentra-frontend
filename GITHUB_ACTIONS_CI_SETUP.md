# GitHub Actions CI Setup

This document describes the GitHub Actions CI pipeline for the Zentra Frontend (Next.js) application.

## Workflow Architecture

The CI pipeline is defined in `.github/workflows/ci.yml` and runs on GitHub-hosted Ubuntu runners (`ubuntu-latest`). It consists of three independent jobs that execute in parallel:

1. **Unit Tests** — Runs existing Vitest unit and integration tests, generates coverage, and uploads the coverage report as an artifact.
2. **Code Quality** — Runs TypeScript type checking (`tsc --noEmit`) and ESLint validation.
3. **Production Build** — Verifies the Next.js production build succeeds (`next build --turbopack`).

All jobs run in parallel. Each job independently checks out the repository, sets up Node.js, and installs dependencies via `npm ci`.

## PR Trigger Conditions

The workflow is triggered on:

- **Pull Requests** opened or updated targeting `main` or `master`.
- **Pushes** directly to `main` or `master`.

This ensures every PR targeting the production branch automatically triggers CI, and every new commit to an existing PR re-runs the pipeline.

Concurrency control is enabled: when a new commit is pushed to the same PR or branch, any in-progress CI run for that ref is automatically cancelled (`cancel-in-progress: true`). This prevents stale runs from consuming resources.

## Node.js and npm Versions

| Tool | Version | Source |
|------|---------|--------|
| Node.js | 26.13.0 | `package.json` `engines.node` |
| npm | 11.20.0 | `package.json` `engines.npm` |

The `actions/setup-node@v4` action installs Node.js 26.13.0 from the official Node.js distribution. After setup, `npm install -g npm@11.20.0` ensures the exact npm version matches `package.json`. No downgrade or engine requirement change is performed.

Dependency installation uses `npm ci` for deterministic, reproducible installs based on `package-lock.json`. The npm cache is populated through `actions/setup-node` with `cache: 'npm'`.

## CI Jobs and Responsibilities

### Job 1: Unit Tests

Status-check name: `Unit Tests`

Steps:
1. Checkout repository (`actions/checkout@v4`)
2. Set up Node.js 26.13.0 with npm caching (`actions/setup-node@v4`)
3. Install npm 11.20.0
4. Install dependencies (`npm ci`)
5. Run Vitest unit and integration tests (`npm run test` → `vitest run`)
6. Generate coverage (`npm run test:coverage` → `vitest run --coverage`)
7. Upload coverage report as a workflow artifact (`actions/upload-artifact@v4`, 7-day retention)

Test configuration: `vitest.config.ts` (jsdom environment, MSW API mocking, fake-indexeddb, Next.js navigation/image mocks). No external services, database, or backend are required.

### Job 2: Code Quality

Status-check name: `Code Quality`

Steps:
1. Checkout repository
2. Set up Node.js 26.13.0 with npm caching
3. Install npm 11.20.0
4. Install dependencies (`npm ci`)
5. TypeScript type check (`npx tsc --noEmit`)
6. ESLint validation (`npm run lint` → `eslint`)

### Job 3: Production Build

Status-check name: `Production Build`

Steps:
1. Checkout repository
2. Set up Node.js 26.13.0 with npm caching
3. Install npm 11.20.0
4. Install dependencies (`npm ci`)
5. Next.js production build (`npm run build` → `next build --turbopack`)

Safe placeholder environment variables are provided for the build only. No production credentials or secrets are used.

## Commands Executed by Each Job

| Job | Command | Purpose |
|-----|---------|---------|
| Unit Tests | `npm run test` | Run Vitest unit/integration tests |
| Unit Tests | `npm run test:coverage` | Run tests with coverage report |
| Code Quality | `npx tsc --noEmit` | TypeScript static type checking |
| Code Quality | `npm run lint` | ESLint static analysis |
| Production Build | `npm run build` | Next.js production build verification |

## Required Environment Variables

### Public configuration values (CI placeholders)

These values are safe to use in CI and are provided as placeholders in the `Production Build` job:

| Variable | CI Value | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Default fallback in `src/config/site.ts` |
| `NEXT_PUBLIC_ENCRYPTION_KEY` | `ci-placeholder-key-do-not-use-in-production` | Default fallback in `src/lib/secure-storage.ts` |
| `BACKEND_URL` | `http://localhost:8080` | Default fallback in API route handlers |

All environment variables referenced by the application have sensible default values, so no secrets are required for unit tests or the production build.

### Secrets

No GitHub Actions secrets are required for the CI pipeline. Vitest uses MSW (Mock Service Worker) to mock all API calls, and fake-indexeddb for IndexedDB, so no external services, databases, or credentials are needed.

### Variables not required for unit tests

`NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_ENCRYPTION_KEY`, and `BACKEND_URL` are not required for Vitest tests because MSW intercepts all HTTP requests at the handler level.

## How to Inspect Failed Test Runs

1. Go to the **Actions** tab in the GitHub repository.
2. Select the failed workflow run.
3. Click on the failed job (e.g., `Unit Tests`, `Code Quality`, or `Production Build`).
4. Expand the relevant step in the job log to view error messages and failed test names.
5. For test failures, the Vitest output lists each failed test name, the error message, and the stack trace directly in the step logs.

## How to Download Coverage and Playwright Artifacts

### Coverage report

1. In the workflow run page, locate the **Artifacts** section.
2. Click `coverage-report` to download the ZIP archive.
3. Extract and open `coverage/index.html` for the HTML coverage report.

The coverage artifact is retained for 7 days.

### Playwright reports (optional E2E workflow)

Playwright E2E tests are NOT part of the mandatory CI pipeline. If you add a separate Playwright workflow, upload `playwright-report/`, `test-results/`, and traces as artifacts with an appropriate retention period. Generated reports are gitignored (see `.gitignore`) and must not be committed.

## How to Configure GitHub Branch Protection

GitHub Actions running tests is separate from GitHub Branch Protection enforcing those tests. Creating the workflow alone does **not** prevent merging. You must configure branch protection separately:

1. Open your repository on GitHub.
2. Go to **Settings** → **Rules** → **Rulesets**.
3. Click **Add ruleset** (or edit an existing one).
4. Name the ruleset (e.g., "Main branch protection").
5. Under **Target branches**, select **Specific branches** and choose `main` (or `master` if applicable).
6. Under **Require a pull request before merging**, enable **Require approvals** if desired.
7. Under **Status checks required before merging**, enable **Require status checks to pass before merging**.
8. Select all mandatory CI status checks:
   - `Unit Tests`
   - `Code Quality`
   - `Production Build`
9. Optionally enable **Require conversation resolution before merging**.
10. Click **Create** or **Save** to activate the ruleset.

Once active, pull requests cannot be merged until all selected status checks report success.

## How to Rerun Failed Workflows

1. Go to the **Actions** tab in the GitHub repository.
2. Select the failed workflow run from the list.
3. Click the **Re-run jobs** button in the upper-right corner.
4. Choose **Re-run failed jobs** or **Re-run all jobs**.
5. The workflow will re-execute with the same commit and inputs.

## How to Add Future Tests

- Add new Vitest test files matching `src/**/*.{test,spec}.{ts,tsx}`. They are automatically picked up by `vitest run`.
- Do not modify `vitest.config.ts` unless a new testing requirement necessitates it.
- For Playwright E2E tests, add files under `tests/e2e/` and consider adding a separate optional workflow until E2E CI dependencies (browser installation, dev server, backend) are fully supported.
- Always run `npm run test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` locally before pushing.

## Known CI Limitations and External Dependencies

| Limitation / Dependency | Details |
|-------------------------|---------|
| ESLint pre-existing errors | The codebase has pre-existing ESLint errors in source files (e.g., `no-explicit-any`, `no-unused-expressions`). The `Code Quality` job runs ESLint but these errors are not caused by CI and must be addressed separately in the source code. |
| Playwright E2E tests | Excluded from mandatory CI. E2E tests spin up `npm run dev` via `webServer` in `playwright.config.ts` and require Chromium. Add as a separate optional workflow when ready. |
| No production secrets | CI does not access production databases, APIs, or credentials. MSW mocks all API calls. |
| GitHub-hosted runners | No self-hosted runner or separate testing server is required. Chromium is installed via `npx playwright install --with-deps chromium` if E2E is added later. |
| Build environment variables | The Next.js build uses safe CI placeholders. No production credentials are injected. |

## Verification

Locally verified before CI integration:

- `npm run test` — 13 test files, 144 tests passed
- `npx tsc --noEmit` — passed
- `npm run build` — Next.js production build succeeded
- Node.js `v26.13.0`, npm `11.20.0` match `package.json` engines
- `.gitignore` already excludes `coverage/`, `playwright-report/`, `test-results/`, `.env*`
