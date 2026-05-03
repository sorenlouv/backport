# Agents

## Manual validation

Use the `backport-org/backport-demo` repo for end-to-end CLI validation. You can commit and push to it, create PRs (via `gh` CLI), then run:

```
node bin/backport --repo backport-org/backport-demo --no-fork --github-token $(gh auth token)
```

Test scenarios to cover:

- **Clean backport**: `--pr <number> --target-branch production --non-interactive`
- **Dry run**: add `--dry-run` to verify no side effects
- **Conflict with auto-resolve**: `--conflict-resolution theirs --non-interactive`
- **Conflict with commit**: `--conflict-resolution commit --non-interactive`
- **List mode**: `--ls` to verify commit listing
- **Multiple branches**: `--target-branch production --target-branch staging`

## Tests

- `npm test` — runs **all** test suites (unit + private + mutation). Always use this for final verification.
- `npm test -- somefile.test.ts` — run a single test file (much faster than running all tests).
- `*.unit.test.ts` — unit tests, run via `npm run test:unit`
- `*.private.test.ts` — require `GITHUB_TOKEN` env var (GitHub PAT), run via `npm run test:private`
- `*.mutation.test.ts` — sequential execution (mutate shared state), run via `npm run test:mutation`

## GraphQL

GraphQL codegen config is in `scripts/codegen-config.ts`. Queries live inline as `graphql()` tagged templates in `src/lib/github/v4/`.

Useful commands:

- `npm run graphql:validate` — validate all queries against `schema.graphql`
- `npm run graphql:execute -- --list` — list all operations
- `npm run graphql:execute -- --operation AuthorId --variables '{"author":"sorenlouv"}'` — execute a query (requires `GITHUB_TOKEN` in `.env`)

If you see **"Cannot find module graphql/generated"**, run `npm run build` to regenerate types.
