# Contributing

## Getting started

```
git clone https://github.com/sorenlouv/backport.git
cd backport
npm install
npm run build
```

- **Node.js >= 22 is required** (see `engines` in `package.json`).
- **`npm run build` is not optional**: it runs the GraphQL codegen which generates TypeScript types into `src/graphql/generated/`. That directory is gitignored, so nothing compiles (tsc, eslint, vitest) until the build has run at least once. `npm install` triggers it automatically via the `prepare` script, but if compilation suddenly fails after a fresh clone or a clean, run `npm run build`.
- **Optional:** create a `.env` file in the repo root with a `GITHUB_TOKEN=ghp_xxx` entry if you want to run the live test tiers (see [Test tiers](#test-tiers) below). It is gitignored and only needed for the private/mutation tests — unit tests run without any credentials.

## What CI runs on your PR

- **Every PR**: lint, unit tests, and integration tests. These are fully offline/mocked and require no credentials — they must pass for your PR to be merged.
- **Credentialed live suites** (`test:private` and `test:mutation`): these talk to real GitHub repos and require repository secrets, so they only run for branches pushed to the main repository and on a nightly schedule. If you open a PR from a fork, that job will show as **skipped** — this is expected and fine; a maintainer's nightly run covers it.

## Release labels

Every PR **must** carry exactly one release label. It determines how the version is bumped when the PR is merged — the merge automatically publishes a new version to npm and creates a matching GitHub Release (see `.github/workflows/release.yml`).

| Label           | Version bump                  |
| --------------- | ----------------------------- |
| `release:patch` | bug fixes (`1.2.3` → `1.2.4`) |
| `release:minor` | new features (`1.2.3` → `1.3.0`) |
| `release:major` | breaking changes (`1.2.3` → `2.0.0`) |

The `require-release-label` status check blocks merging until exactly one of these labels is present, so there is no "merge without releasing" path. If a change genuinely should not ship (rare for this repo, since `main` is always released), hold the PR rather than merging it.

## Pull request titles

PRs are squash-merged, so the PR title becomes the commit message on `main`. Titles must follow [Conventional Commits](https://www.conventionalcommits.org) (enforced by the `pr-title` CI check) for a clean, readable history and changelog. Unlike the release labels above, the title no longer determines the version bump.

### Run

```
npm start -- --branch 6.1 --repo backport-org/backport-demo --all
```

**Run `backport` CLI globally**
This will build backport continuously and link it, so it can be accessed with the `backport` command globally

```
npm run build && chmod +x bin/backport && npm link && npx tsc --watch
```

**Remove linked backport**

```
npm uninstall -g backport; npm unlink;
```

You can now use `backport` command anywhere, and it'll point to the development version.

### Testing

**Run unit tests** (this is what contributors should use — no credentials required)

```
npm test
```

**Run the full test suite** (all tiers; requires a `GITHUB_TOKEN`, see below)

```
npm run test:all
```

**Run a single test file**

```
npm test -- src/lib/git/git.unit.test.ts
```

**Run tests continuously**

```
npm run test:unit -- --watch
```

**Compile TypeScript continuously**

```
npx tsc --watch
```

#### Test tiers

Tests are organized into four tiers:

- **Unit tests** (`*.unit.test.ts`): Run with `npm test` (alias: `npm run test:unit`). These use mocked HTTP responses and don't require any credentials.
- **Private tests** (`*.private.test.ts`): Run with `npm run test:private`. Make live **read-only** GitHub API calls against fixture repos under the `backport-org` organization. Require a `GITHUB_TOKEN` environment variable — any classic personal access token with public-repo read access works. Create a `.env` file in the repo root containing `GITHUB_TOKEN="ghp_..."`.
- **Mutation tests** (`*.mutation.test.ts`): Run with `npm run test:mutation`. Make live GitHub API calls that **write** to fixture repos under `backport-org`. Require a `GITHUB_TOKEN` with write access — maintainer-only.
- **Integration tests** (`*.integration.test.ts`): Run with `npm run test:integration`. Pack the npm tarball and install it to verify the published artifact. No credentials required.

To run a single file in a non-unit tier, use that tier's script:

```
npm run test:private -- src/lib/github/v4/fetch-author-id.private.test.ts
```

### Architecture overview

#### Config merging pipeline

Options are resolved in this priority order (highest wins):

1. **Default options** (`option-schema.ts`)
2. **Local config files** (`.backportrc.json` or global `~/.backport/config.json`)
3. **Remote config** (fetched from the repo's `.backportrc.json` via GitHub API)
4. **CLI arguments** (always highest precedence)

#### GraphQL codegen

GraphQL queries are type-checked at build time. After modifying any `graphql(...)` tagged template:

```
npm run codegen
```

This regenerates `src/graphql/generated/`. Queries can be validated against the GitHub schema with:

```
npm run graphql:validate
```
