# CLAUDE.md

The working agreement for this repository lives in [`AGENTS.md`](AGENTS.md).
Read it before changing anything.

It is kept in one file rather than two so the rules cannot drift apart. The
points that get broken most often, in short:

- Commit with [Conventional Commits](https://www.conventionalcommits.org/), and
  never push straight to `main`.
- `npm run check` and `npm run build` both pass before you push.
- No em dashes and no semicolons in any copy a user can read.
- Every user-visible string exists in both `i18n/id.ts` and `i18n/en.ts`.
- Figures in copy are read from the data, never typed in by hand.
