# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 16 TypeScript app using the App Router. Routes and pages live in `app/`, with API endpoints under `app/api/*/route.ts`. Shared UI is in `components/`, including primitives in `components/ui/`. Reusable logic lives in `lib/`, grouped by `api`, `auth`, `config`, `db`, `feature-flags`, `observability`, and `readiness`. Database schema and migrations are in `lib/db/schema.ts` and `drizzle/`. Tests are in `tests/`, Storybook stories in `stories/`, and manual QA notes in `docs/manual-testing/`.

## Build, Test, and Development Commands

Use Node `>=25 <26`.

- `npm run dev`: start the Next.js development server.
- `npm run build` / `npm run start`: build and serve production.
- `npm run lint`: run ESLint with zero warnings allowed.
- `npm run typecheck`: generate Next types and run `tsc --noEmit`.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode.
- `npm run storybook` / `npm run build-storybook`: run or build Storybook.
- `npm run db:generate` / `npm run db:migrate`: generate and apply Drizzle migrations.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, and React JSX. Prefer `@/` imports for repo-root modules. Follow existing formatting: two-space indentation, double quotes, and semicolons. Name React components in PascalCase, hooks with `use*`, tests as `*.test.ts` or `*.test.tsx`, and API route files as `route.ts`. Keep helpers grouped under the relevant `lib/<domain>/` directory.

## Semantic Style Guide

Use names that describe domain behavior, not implementation mechanics. Prefer `getReadinessStatus`, `featureFlagDefaults`, or `createApiError` over vague names like `handleData` or `utils`. Keep API responses shaped through `lib/api/*` helpers so success, error, and validation semantics stay consistent. Model configuration and environment values as explicit types, and keep provider-specific details behind domain modules such as `lib/feature-flags/posthog.ts`. In UI code, choose component and prop names that describe user-visible intent, for example `FoundationStatus` and `variant`, instead of styling-only names.

## Testing Guidelines

Vitest runs in `jsdom` with globals enabled and includes `tests/**/*.test.ts` and `tests/**/*.test.tsx`. Add tests by behavior or domain, for example `tests/feature-flags.test.ts`. For API routes, cover success and error response shapes. For UI states, add or update stories in `stories/` and run Storybook or Chromatic checks when relevant.

## Commit & Pull Request Guidelines

The current history uses short imperative or descriptive subjects, for example `Initial Boilerplate (Epic 1)` and `starting`. Keep commits concise and scoped to one logical change. Pull requests should include a summary, verification steps such as `npm test` and `npm run lint`, linked tickets, and screenshots or Storybook/Chromatic links for UI changes. Note required environment variables, migrations, or manual testing.

## Security & Configuration Tips

Do not commit secrets or local `.env` files. Configuration is centralized in `lib/config/env.ts`; add new variables there with validation. Redact sensitive observability data through `lib/observability/redaction.ts`. Commit generated Drizzle migrations with schema updates.
