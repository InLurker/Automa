# Repository Guidelines

## Project Structure & Module Organization
Astro pages live under `src/pages` with layouts and shared UI in `src/layouts` and `src/components`; the automa control stack is under `src/components/automa`. New entries for the gallery are added to `src/config/automa-registry.ts`, which powers `pages/explore.astro` and the slugged viewers. Type definitions sit in `src/types`, while static payloads (HTML, shaders, media) for each automa live in `public/automa/<slug>/`. The build output lands in `dist/`, and helper scripts sit in `scripts/`.

## Build, Test, and Development Commands
- `npm install` — install Astro, React 19, and Tailwind v4 deps.
- `npm run dev` — launch the local server at `http://localhost:4321/explore` with hot reload.
- `npm run build` — produce the static bundle inside `dist/`.
- `npm run preview` — serve the production build to validate routing and iframe isolation.

## Coding Style & Naming Conventions
Use TypeScript with the strict config from `tsconfig.json`; prefer explicit types for registry entries and prop signatures. Components and layout files are PascalCase (`ExampleGrid.astro`, `MainLayout.astro`), while utilities stay camelCase. Keep indentation at two spaces and rely on Tailwind utility ordering from the existing files. Import using the `@/*` alias instead of long relative paths. Inline comments should explain intent, especially around postMessage handling or schema transforms.

## Testing Guidelines
There is no automated test harness, so favor lightweight manual checks. Run `npm run dev`, open each changed automa via `/automa/<slug>`, and confirm the control schema syncs with the iframe via postMessage. Before opening a PR, run `npm run build && npm run preview` to catch static-render regressions, broken asset paths, or Tailwind Purge issues. Capture console output for any runtime warnings.

## Commit & Pull Request Guidelines
Follow the existing concise, imperative commit style (`add export`, `fix ui`). Group related edits and avoid trailing punctuation; squash noisy work-in-progress messages before pushing. Pull requests should explain the intention, list affected automa or pages, and link tracking issues when applicable. Include screenshots or short clips for UI or animation changes, note verification steps (`npm run preview`), and mention any manual regression scope (e.g., "tested Drift + Pulse"). Reference `AUTOMA_SYSTEM.md` if the change adjusts schema or postMessage contracts.
