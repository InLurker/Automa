## Automa Tech Stack

This document captures the technologies and conventions used across the Automa project so new contributors can ramp up quickly.

### Core Framework
- **Astro 5** (`astro`, `@astrojs/react`, `@astrojs/mdx`) powers the site with island hydration for interactive regions while keeping most pages static.
- **React 19** renders interactive “automa” controls and renderers via Astro islands (`src/components/automa/**`).
- **TypeScript everywhere**: Astro, React, and config files all use TS for type safety (`tsconfig.json`).

### Styling & UI
- **Tailwind CSS 4** (`tailwindcss`, `@tailwindcss/vite`, PostCSS pipeline) provides utility-first styling with project-wide config in `tailwind.config.ts`.
- **Radix UI primitives** (e.g., `@radix-ui/react-switch`, dialog, tabs) supply accessible building blocks that we wrap with custom components (`src/components/ui/**`).
- **Lucide icons** via `lucide-react` or `@iconify-json/*` for lightweight iconography.

### Automa Runtime
- **Config-driven registry** (`src/config/automa-registry.ts`) describes every automa’s schema, defaults, and renderer metadata.
- **Renderer components** live in `src/components/automa/renderers/**`, each consuming `AutomaComponentProps` (`src/types/automa.ts`).
- **Control surface** components (`control-slider`, `control-gradient`, `controls-panel`) translate schema definitions into UI, using shared primitives like the custom Switch.

### Content & Media
- **MDX support** (`@astrojs/mdx`) for rich editorial content.
- **Static assets** served from `public/` and typography experiments inside `Typography/`.

### Build & Tooling
- **Vite-based dev server** via `astro dev`.
- **Sharp** for image optimization within Astro.
- **PostCSS + Autoprefixer** for CSS transforms.
- **Framer Motion** & `tw-animate-css` for advanced animation needs.

### Testing & Quality
- No dedicated test runner yet; linting is handled implicitly by TypeScript and the Astro/Tailwind toolchain. (Add ESLint/Playwright if automated coverage becomes necessary.)

### Deployment
- Project builds with `astro build`, generating static assets plus any server-side endpoints configured via Astro adapters (none presently). Output can deploy to any static host or Astro-supported platform.

> Need a deeper dive into a specific subsystem (e.g., renderer protocol, theming, data flow)? Add an addendum here or in a dedicated doc under the repo root.
