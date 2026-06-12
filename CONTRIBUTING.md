# Contributing

### Pull request titles

PRs are squash-merged, so the PR title becomes the commit message on `main`. Titles must follow [Conventional Commits](https://www.conventionalcommits.org) (enforced by the `pr-title` CI check) because they determine the next release:

| PR title                                       | Release    |
| ---------------------------------------------- | ---------- |
| `fix: ...`                                     | patch      |
| `feat: ...`                                    | minor      |
| `feat!: ...` or `BREAKING CHANGE:` in the body | major      |
| `chore: ...`, `docs: ...`, `refactor: ...`     | no release |

### Releasing

Releases are fully automated — there is no manual version bumping or publishing. On every push to `main`, the [release workflow](.github/workflows/release.yml) runs [semantic-release](https://github.com/semantic-release/semantic-release), which determines the next version from the commit messages since the last release, publishes to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers) (with provenance), pushes a `v*` git tag, and creates a GitHub release with the changelog.

Note: the `version` field in `package.json` is **not** the source of truth — the latest git tag is. semantic-release injects the correct version into the published tarball. Direct commits to `main` must also follow Conventional Commits to trigger a release.

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

**Run all tests**

```
npm test
```

**Run unit tests only**

```
npm run test:unit
```

**Run a single test file**

```
npm test -- src/lib/git.unit.test.ts
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

Tests are organized into three tiers:

- **Unit tests** (`*.unit.test.ts`): Run with `npm run test:unit`. These use mocked HTTP responses and don't require any credentials.
- **Private tests** (`*.private.test.ts`): Run with `npm run test:private`. Require a `GITHUB_TOKEN` environment variable with a GitHub token that has read access to `backport-org/backport-demo`.
- **Mutation tests** (`*.mutation.test.ts`): Run with `npm run test:mutation`. Require a `GITHUB_TOKEN` with **write** access to `backport-org/backport-demo`. Only the repo owner can run these.

To run private or mutation tests:

```
GITHUB_TOKEN=ghp_xxx npm run test:private
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
