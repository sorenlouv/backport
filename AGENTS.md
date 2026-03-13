# Agents

## Manual validation

Use the `backport-org/backport-demo` repo for end-to-end CLI validation. You can commit and push to it, create PRs (via `gh` CLI), then run:

```
node bin/backport --repo backport-org/backport-demo --no-fork --accessToken $(gh auth token)
```

Test scenarios to cover:

- **Clean backport**: `--pr <number> --targetBranch production --non-interactive`
- **Dry run**: add `--dry-run` to verify no side effects
- **Conflict with auto-resolve**: `--autoResolveConflictsWithTheirs --non-interactive`
- **Conflict with commit**: `--commitConflicts --non-interactive`
- **List mode**: `--ls` to verify commit listing
- **Multiple branches**: `--targetBranch production --targetBranch staging`

## Tests

- `*.test.ts` — unit tests, run via `npm test`
- `*.private.test.ts` — require `ACCESS_TOKEN` env var (GitHub PAT), run via `npm run test-private`
- `*.mutation.test.ts` — sequential execution (mutate shared state), run via `npm run test-mutation`
