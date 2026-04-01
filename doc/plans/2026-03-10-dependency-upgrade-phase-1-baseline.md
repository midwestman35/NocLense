# Dependency Upgrade Phase 1 Baseline

Date: 2026-03-10
Branch: `feature/ui-overhaul`
Commit: `161a59c`

## Purpose

This document captures the pre-upgrade state for the latest-first dependency migration plan. It is the rollback and comparison point before any package updates are applied.

## Working tree state

The repository was already dirty before Phase 1 began. Existing changes were left untouched.

Modified files:
- `src/components/__tests__/ExportModal.test.tsx`
- `src/components/case/CasePanel.tsx`
- `src/components/export/ExportModal.tsx`
- `src/services/__tests__/exportPackBuilder.test.ts`
- `src/services/exportPackBuilder.ts`
- `src/store/caseContext.tsx`
- `src/types/case.ts`

Untracked paths:
- `.codex-beta-push/`
- `.npm-cache/`
- `docs/design/`
- `public/app-icons/noclense-icon-monogram-signal.svg`
- `public/app-icons/preview.html`

## Current installed highlights

- `react` `19.2.1`
- `react-dom` `19.2.1`
- `vite` `7.2.7`
- `vitest` `4.0.18`
- `electron` `39.2.7`
- `electron-builder` `26.0.12`
- `eslint` `9.39.1`
- `@eslint/js` `9.39.1`
- `typescript` `5.9.3`

## Latest upgrade targets

Non-Electron, non-ESLint upgrades currently available:
- `@tailwindcss/postcss` `4.1.17 -> 4.2.1`
- `@tanstack/react-virtual` `3.13.13 -> 3.13.21`
- `@types/node` `24.10.2 -> 25.4.0`
- `@types/react` `19.2.7 -> 19.2.14`
- `@vercel/analytics` `1.6.1 -> 2.0.0`
- `@vitejs/plugin-react` `5.1.2 -> 5.1.4`
- `autoprefixer` `10.4.22 -> 10.4.27`
- `electron-builder` `26.0.12 -> 26.8.1`
- `eslint-plugin-react-refresh` `0.4.24 -> 0.5.2`
- `globals` `16.5.0 -> 17.4.0`
- `jsdom` `28.0.0 -> 28.1.0`
- `lucide-react` `0.556.0 -> 0.577.0`
- `motion` `12.34.5 -> 12.35.2`
- `postcss` `8.5.6 -> 8.5.8`
- `react` `19.2.1 -> 19.2.4`
- `react-dom` `19.2.1 -> 19.2.4`
- `tailwind-merge` `3.4.0 -> 3.5.0`
- `tailwindcss` `4.1.17 -> 4.2.1`
- `typescript-eslint` `8.49.0 -> 8.57.0`
- `vite` `7.2.7 -> 7.3.1`
- `wait-on` `9.0.3 -> 9.0.4`

Separated rollback phases:
- `eslint` `9.39.1 -> 10.0.3`
- `@eslint/js` `9.39.1 -> 10.0.1`
- `electron` `39.2.7 -> 40.8.0`

## Baseline validation

`npm run build`
- Passed.
- Vite produced a large chunk warning for `dist/assets/index-*.js` at about `660 kB` minified.

`npm run test:run`
- Completed after running outside the sandbox.
- Result: `46` passing test files and `2` failing test files.
- The only unique failure is `src/services/__tests__/llmService.test.ts` for `should skip cache creation for cache-incompatible models`.
- Failure reason: `ReferenceError: sharedCacheManagerMock is not defined`.
- The second failing file is the duplicate copy under `.codex-beta-push/`.

`npm run lint`
- Failed before any dependency changes.
- ESLint is scanning both the main workspace and `.codex-beta-push`, which duplicates findings.
- The current lint baseline includes a large number of pre-existing issues such as:
- `react-hooks/set-state-in-effect`
- `react-hooks/immutability`
- `@typescript-eslint/no-explicit-any`
- `react-refresh/only-export-components`
- `@typescript-eslint/no-unused-vars`
- `no-useless-escape`

## Phase 1 conclusion

The project has a usable baseline for upgrade work:
- Production build is healthy.
- Tests are mostly healthy, with one real failing test scenario to track during upgrades.
- Lint is already red and should not be treated as an upgrade regression signal until the existing baseline is addressed or scoped.
