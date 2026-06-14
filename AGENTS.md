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

- `npm test` — runs **unit tests only**. No credentials needed. Use this for routine verification.
- `npm run test:all` — runs **all** test tiers (unit + private + mutation + integration). Requires a `GITHUB_TOKEN` env var (GitHub PAT) and makes live GitHub API calls.
- `npm test -- somefile.unit.test.ts` — run a single unit test file. For other tiers, use the tier script, e.g. `npm run test:private -- somefile.private.test.ts`.

Test tiers:

- `*.unit.test.ts` — offline unit tests (mocked HTTP), run via `npm run test:unit` (same as `npm test`)
- `*.private.test.ts` — live read-only GitHub API calls, require `GITHUB_TOKEN`, run via `npm run test:private`
- `*.mutation.test.ts` — live GitHub API calls with **write** access, sequential execution (mutate shared state), run via `npm run test:mutation`
- `*.integration.test.ts` — pack and install the npm tarball to verify the published artifact, no credentials needed, run via `npm run test:integration`

## GraphQL

GraphQL codegen config is in `scripts/codegen-config.ts`. Queries live inline as `graphql()` tagged templates in `src/lib/github/v4/`.

Useful commands:

- `npm run graphql:validate` — validate all queries against `schema.graphql`
- `npm run graphql:execute -- --list` — list all operations
- `npm run graphql:execute -- --operation AuthorId --variables '{"author":"sorenlouv"}'` — execute a query (requires `GITHUB_TOKEN` in `.env`)

If you see **"Cannot find module graphql/generated"**, run `npm run build` to regenerate types.
