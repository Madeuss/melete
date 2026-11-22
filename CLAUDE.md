# Melete

The spec lives in [docs/SPEC.md](docs/SPEC.md) and is the source of truth: read it before changing anything.
What is listed there as decided is a decision; what is under "Em aberto" is not — ask before assuming.

Decisions taken during implementation that still need the owner's review are logged in
[docs/DECISOES.md](docs/DECISOES.md). Add to it whenever you make a call the spec doesn't cover.

## Commands

- `yarn dev` — dev server (the `/styleguide` page only exists in dev)
- `yarn test` — Vitest (unit + engine tests, no network)
- `yarn typecheck` / `yarn lint` / `yarn build`
- `yarn evals` — runs `evals/run.ts` against real providers (needs env vars, see evals/README)

## Rules (short version of the spec)

- Components never call providers or the database directly: go through the engine and the repositories.
- Everything coming from the LLM or IndexedDB goes through `schema.parse`.
- The API key never goes to logs, error messages, exports or URLs.
- No hardcoded UI text: every string lives in `src/i18n/{pt-BR,en,es}.json`.
- No hex colors or default Tailwind palette classes in components: use the tokens from `src/styles/tokens.css`.
- Commits: English, Conventional Commits, no co-author trailers.

## Gotchas

- Windows: run Vitest from a path with an uppercase drive letter (`cd C:/Users/...`). With `c:/...` Vitest
  loads itself twice and every test file fails with "Vitest failed to find the current suite".
