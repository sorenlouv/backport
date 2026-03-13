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

- `npm run test-all` — runs **all** test suites (unit + private + mutation). Always use this for final verification.
- `npm run test-all -- somefile.test.ts` — run a single test file (much faster than running all tests).
- `*.test.ts` — unit tests, run via `npm test`
- `*.private.test.ts` — require `ACCESS_TOKEN` env var (GitHub PAT), run via `npm run test-private`
- `*.mutation.test.ts` — sequential execution (mutate shared state), run via `npm run test-mutation`

## GraphQL

This section describes how to work with the GraphQL queries in the backport CLI project.

### Architecture Overview

The project uses GitHub's GraphQL API v4 via:

- **Client**: `@urql/core` with a custom exchange for response metadata (`src/lib/github/v4/client/graphql-client.ts`)
- **Schema**: `schema.graphql` (GitHub's full GraphQL schema, ~34k lines)
- **Code generation**: `@graphql-codegen/cli` with `client-preset` (config in `codegen.ts`)
- **Query pattern**: Inline tagged template literals using `graphql()` from the generated code

All queries live in `src/lib/github/v4/` as inline `graphql(\`...\`)` calls within TypeScript files. Fragments are defined in `src/lib/sourceCommit/parse-source-commit.ts` and `src/lib/remote-config.ts`.

### Setup

1. Install dependencies: `npm install`
2. Create a `.env` file in the project root:
   ```
   ACCESS_TOKEN=ghp_your_github_personal_access_token
   ```
   The token needs `repo` scope for most queries.

### Validating Queries

Validate all GraphQL queries against the schema without a full build:

```bash
npm run graphql:validate
```

This parses every `graphql()` tagged template in `src/`, resolves fragment dependencies, and validates each operation against `schema.graphql`. It reports pass/fail with file locations.

Use this after editing any query to catch schema mismatches early.

### Executing Queries

Run any project query against the real GitHub API:

```bash
# List all available operations
npm run graphql:execute -- --list

# Execute a named operation
npm run graphql:execute -- --operation AuthorId --variables '{"author":"sorenlouv"}'

# Execute an ad-hoc query
npm run graphql:execute -- --query 'query { viewer { login } }'
```

Requires `ACCESS_TOKEN` in `.env`.

### All GraphQL Operations

| Operation | Kind | File |
|-----------|------|------|
| `AuthorId` | query | `src/lib/github/v4/fetch-author-id.ts` |
| `CommitsBySha` | query | `src/lib/github/v4/fetchCommits/fetch-commit-by-sha.ts` |
| `CommitsByAuthor` | query | `src/lib/github/v4/fetchCommits/fetch-commits-by-author.ts` |
| `CommitByPullNumber` | query | `src/lib/github/v4/fetchCommits/fetch-commit-by-pull-number.ts` |
| `CommitsForRebaseAndMergeStrategy` | query | `src/lib/github/v4/fetchCommits/fetch-commits-for-rebase-and-merge-strategy.ts` |
| `PullRequestBySearchQuery` | query | `src/lib/github/v4/fetchCommits/fetch-pull-requests-by-search-query.ts` |
| `ExistingPullRequest` | query | `src/lib/github/v4/fetch-existing-pull-request.ts` |
| `PullRequestId` | query | `src/lib/github/v4/fetch-pull-request-id2.ts` |
| `PullRequestAutoMergeMethod` | query | `src/lib/github/v4/fetch-pull-request-auto-merge-method.ts` |
| `GithubConfigOptions` | query | `src/lib/github/v4/getOptionsFromGithub/get-options-from-github.ts` |
| `GetBranchId` | query | `src/lib/github/v4/validate-target-branch.ts` |
| `RepoOwnerAndName` | query | `src/lib/github/v4/get-repo-owner-and-name-from-git-remotes.ts` |
| `EnablePullRequestAutoMerge` | mutation | `src/lib/github/v4/enable-pull-request-auto-merge.ts` |
| `DisablePullRequestAutoMerge` | mutation | `src/lib/github/v4/disable-pull-request-auto-merge.ts` |
| `SourceCommitWithTargetPullRequestFragment` | fragment | `src/lib/sourceCommit/parse-source-commit.ts` |
| `RemoteConfigHistoryFragment` | fragment | `src/lib/remote-config.ts` |

### Adding a New Query

1. Create or edit a file in `src/lib/github/v4/`
2. Import and use the `graphql()` tag:
   ```typescript
   import { graphql } from '../../../graphql/generated/index.js';

   const query = graphql(`
     query MyNewQuery($owner: String!, $name: String!) {
       repository(owner: $owner, name: $name) {
         id
       }
     }
   `);
   ```
3. Run `npm run graphql:validate` to check the query against the schema
4. Run `npm run codegen` to regenerate typed helpers
5. Use the query via the urql client from `getGraphQLClient()`

### Updating the Schema

1. Download the latest GitHub GraphQL schema to `schema.graphql`
2. Run `npm run graphql:validate` to check all queries still work
3. Run `npm run codegen` to regenerate types

### Testing GraphQL Queries

Tests use `nock` to mock HTTP requests. The helper `mockUrqlRequest()` from `src/test/nock-helpers.ts` intercepts GraphQL requests by operation name:

```typescript
import { mockUrqlRequest } from '../../../test/nock-helpers';

mockUrqlRequest({
  operationName: 'AuthorId',
  body: { data: { user: { id: 'user-id-123' } } },
});
```

Tests run against `http://localhost/graphql` (the default test URL).
