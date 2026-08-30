---
name: frontend
description: Frontend development conventions for Astro, React, Tailwind CSS, and shadcn/ui with Base UI.
---

# Frontend Development

Use the project's existing frontend stack and conventions:

- Astro
- React
- Tailwind CSS v4
- shadcn/ui
- Base UI
- Lucide
- TypeScript

## Core Architecture

- Astro is the primary application and page framework.
- Prefer `.astro` components for layouts, pages, static UI, and server-rendered content.
- Use React/TSX only for interactive UI that requires client-side state or behavior.
- Do not convert an Astro page or component to React unless there is a clear technical reason.
- Keep client-side JavaScript minimal.
- Avoid unnecessary hydration.

## shadcn/ui

- Use shadcn/ui components as the default source for UI primitives.
- The project uses Base UI as the underlying component library.
- Reuse existing components from `src/components/ui` before creating new primitives.
- If a required primitive is not available, use the shadcn CLI to add it when appropriate.
- Do not introduce another UI component library.
- Do not recreate existing shadcn components manually.
- Customize shadcn components through composition, variants, and Tailwind classes.
- Preserve accessibility and keyboard interaction provided by the underlying component.

## React Components

- React components belong in `.tsx` files.
- Use React only when interactivity requires it.
- Keep React components focused and reusable.
- Avoid unnecessary client-side state.
- In Astro, hydrate React components only when they actually require browser-side interaction.
- Prefer `client:load`, `client:idle`, or `client:visible` based on the actual interaction requirement rather than defaulting to `client:load`.

## Tailwind CSS

- Use Tailwind CSS v4.
- Use utility classes for component styling.
- Follow the existing design tokens in `src/styles/global.css`.
- Prefer semantic theme tokens such as `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `border-border`, and `ring-ring`.
- Do not introduce a separate CSS framework.
- Avoid unnecessary custom CSS.
- Avoid arbitrary values unless they are genuinely required.
- Use responsive, mobile-first layouts.

## Design System

- Reuse existing design tokens, spacing, typography, radius, and component patterns.
- Do not replace or rewrite `src/styles/global.css` without a clear requirement.
- Do not change the shadcn theme or CSS variables merely to satisfy an individual component.
- Maintain visual consistency across pages and components.
- Prefer composition over duplicated markup.

## Icons

- Use Lucide icons through the project's existing Lucide setup.
- Do not introduce another icon library.
- Prefer icons with accessible labels when they communicate meaning without accompanying text.

## Imports

Use the configured aliases:

- `@/components` → `src/components`
- `@/components/ui` → `src/components/ui`
- `@/lib` → `src/lib`
- `@/lib/utils` → `src/lib/utils`
- `@/hooks` → `src/hooks`

Prefer aliases over long relative import paths.

## Before Creating Components

Before creating a new component:

1. Inspect existing components.
2. Check `src/components/ui` for an existing shadcn component.
3. Check whether the requirement can be solved through composition.
4. Reuse existing design tokens and utilities.
5. Only create a new component when an existing component is insufficient.

## Code Quality

- Use TypeScript for application logic and React components.
- Keep components small and focused.
- Avoid unnecessary dependencies.
- Do not modify unrelated files.
- Preserve existing application behavior.
- Run the appropriate type/check/build command after significant frontend changes.

## Implementation Priority

When implementing UI, follow this priority:

1. Existing project components
2. Existing shadcn/ui components
3. Composition of existing primitives
4. New shadcn/ui component
5. Custom component
6. Custom CSS only when necessary

Do not introduce a new library when the existing stack can solve the requirement.
