# Programmatic API

The `backport` package can be imported as a Node module for use in automation scripts. See the [Backport GitHub Action](https://github.com/sorenlouv/backport-github-action) for a real-world example.

### `backportRun(options, processArgs, exitCodeOnFailure)`

Backport one or more commits programmatically. Commits can be selected via `pullNumber` or `sha`.

**Arguments:**

- `options` _object_ — accepts all [configuration options](configuration.md#options-reference)
- `processArgs` _string[]_ — forward CLI arguments from the calling process (e.g. `process.argv.slice(2)`)
- `exitCodeOnFailure` _boolean_ — if `true`, sets a non-zero exit code on failure. Default: `true`

**Example:**

```ts
import { backportRun } from 'backport';

const result = await backportRun({
  options: {
    githubToken: 'ghp_very_secret',
    repoName: 'kibana',
    repoOwner: 'elastic',
    pullNumber: 121633,
    interactive: false,
  },
});
```

### `getCommits(options)`

Retrieve information about commits and whether they have been backported. Useful for building dashboards or CI status checks.

**Arguments:**

- `githubToken` _string_ **(Required)** — GitHub access token
- `repoName` _string_ **(Required)** — Name of repository
- `repoOwner` _string_ **(Required)** — Owner of repository (organisation or username)
- `author` _string_ — Filter commits by GitHub username
- `pullNumber` _number_ — Filter commits by pull request number
- `sha` _string_ — Filter commits by commit sha
- `sourceBranch` _string_ — Branch to list commits from. Defaults to the repository's default branch

**Example:**

```ts
import { getCommits } from 'backport';

const commits = await getCommits({
  githubToken: 'ghp_very_secret',
  repoName: 'kibana',
  repoOwner: 'elastic',
  pullNumber: 121633,
});

/*
[{
  sourceCommit: {
    committedDate: '2021-12-20T14:20:16Z',
    sha: 'd421ddcf6157150596581c7885afa3690cec6339',
    message: '[APM] Add note about synthtrace to APM docs (#121633)',
  },
  sourcePullRequest: {
    number: 121633,
    url: 'https://github.com/elastic/kibana/pull/121633',
    mergeCommit: {
      sha: 'd421ddcf6157150596581c7885afa3690cec6339',
      message: '[APM] Add note about synthtrace to APM docs (#121633)',
    }
  },
  sourceBranch: 'main',
  targetPullRequestStates: [
    {
      url: 'https://github.com/elastic/kibana/pull/121643',
      number: 121643,
      branch: '8.0',
      state: 'MERGED'
    }
  ]
}]
*/
```
