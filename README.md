# backport

[![Build Status](https://travis-ci.com/sqren/backport.svg?branch=master)](https://app.travis-ci.com/github/sqren/backport)
[![NPM version](https://img.shields.io/npm/v/backport.svg)](https://www.npmjs.com/package/backport)
[![Coverage Status](https://coveralls.io/repos/github/sqren/backport/badge.svg?branch=master)](https://coveralls.io/github/sqren/backport?branch=master)

A simple CLI tool that automates the process of backporting commits on a GitHub repo.

![backport-demo](https://user-images.githubusercontent.com/209966/80993576-95766380-8e3b-11ea-9efd-b35eb2e6a9ec.gif)

## Requirements

- Node 16 or higher
- git

## Install

```sh
npm install -g backport
```

After installation you should update the [global config](https://github.com/sqren/backport/blob/master/docs/configuration.md#global-config-backportconfigjson) in `~/.backport/config.json` with a Github access token. See the [documentation](https://github.com/sqren/backport/blob/master/docs/configuration.md#accesstoken-required) for how the access token is generated.

## Quick start

Add a [project config](https://github.com/sqren/backport/blob/master/docs/configuration.md#project-config-backportrcjson) to the root of your repository:

```js
// .backportrc.json
{
  "repoOwner": "elastic",
  "repoName": "kibana",
  "targetBranchChoices": ["main", "6.3", "6.2", "6.1", "6.0"],
  "branchLabelMapping": {
    "^v6.4.0$": "main",
    "^v(\\d+).(\\d+).\\d+$": "$1.$2"
  }
}
```

Install locally:

```
npm install backport
```

Run:

```
npx backport
```

_This will start an interactive prompt. You can use your keyboards arrow keys to choose options, `<space>` to select checkboxes and `<enter>` to proceed._

### Config options

See [configuration.md](https://github.com/sqren/backport/blob/master/docs/configuration.md)

### CLI options

Please note that dashes between the words are optional, for instance you can type `--targetBranch` or `--target-branch` both are valid options.

| Option              | Shorthand notation | Description                                                   | Default        | Type      |
| ------------------- | ------------------ | ------------------------------------------------------------- | -------------- | --------- |
| --access-token      |                    | Github access token                                           |                | `string`  |
| --all               | -a                 | Show commits from any author                                  | false          | `boolean` |
| --assignee          | --assign           | Assign users to the target PR                                 |                | `string`  |
| --author            |                    | Filter commits by Github username. Opposite of `--all`        | _Current user_ | `string`  |
| --auto-assign       |                    | Assign current user to the target PR                          | false          | `boolean` |
| --branch            | -b                 | Target branch to backport to                                  |                | `string`  |
| --ci                |                    | Disable interactive prompts                                   | false          | `boolean` |
| --dry-run           |                    | Perform backport without pushing to Github                    | false          | `string`  |
| --editor            |                    | Editor (eg. `code`) to open and resolve conflicts             | nano           | `string`  |
| --fork              |                    | Create backports in fork repo                                 | true           | `boolean` |
| --git-hostname      |                    | Hostname for Git                                              | github.com     | `string`  |
| --mainline          |                    | Parent id of merge commit                                     | 1              | `number`  |
| --max-number        | --number, -n       | Number of commits to choose from                              | 10             | `number`  |
| --multiple          |                    | Multi-select for commits and branches                         | false          | `boolean` |
| --multiple-branches |                    | Multi-select for branches                                     | true           | `boolean` |
| --multiple-commits  |                    | Multi-select for commits                                      | false          | `boolean` |
| --no-cherrypick-ref |                    | Do not append "(cherry picked from commit...)". [Git Docs][1] | false          | `boolean` |
| --no-verify         |                    | Bypass the pre-commit and commit-msg hooks                    | false          | `boolean` |
| --path              | -p                 | Filter commits by path                                        |                | `string`  |
| --pr-description    | --description      | Pull request description suffix                               |                | `string`  |
| --pr-filter         |                    | Find PRs using [Github's search syntax][2]                    |                | `string`  |
| --pr-title          | --title            | Title of pull request                                         |                | `string`  |
| --pull-number       | --pr               | Backport pull request by number                               |                | `number`  |
| --repo-name         |                    | Name of repository                                            |                | `string`  |
| --repo-owner        |                    | Owner of repository                                           |                | `string`  |
| --reset-author      |                    | Set yourself as commit author                                 |                | `boolean` |
| --reviewer          |                    | Add reviewer to the target PR                                 |                | `boolean` |
| --sha               |                    | Sha of commit to backport                                     |                | `string`  |
| --source-branch     |                    | Specify a non-default branch to backport from                 |                | `string`  |
| --source-pr-label   |                    | Labels added to the source PR                                 |                | `string`  |
| --target-branch     | -b                 | Target branch(es) to backport to                              |                | `string`  |
| --target-pr-label   | --label, -l        | Labels added to the target PR                                 |                | `string`  |
| --help              |                    | Show help                                                     |                |           |
| -v, --version       |                    | Show version number                                           |                |           |

The CLI options will override the [configuration options](https://github.com/sqren/backport/blob/master/docs/configuration.md).

### Using `backport` as a Node module

Backport a commit programatically. Commits can be selected via `pullNumber` or `sha`.

#### `backportRun`

##### Arguments:

All of the options listed on [configuration.md](https://github.com/sqren/backport/blob/main/docs/configuration.md) are valid. The most

`accessToken` _string_ **(Required)**
Github access token to authenticate the request

`repoName` _string_ **(Required)**
Name of repository

`repoOwner` _string_ **(Required)**
Owner of repository (organisation or username)

`pullNumber` _number_
Filter commits by pull request number

`sha` _string_
Filter commits by commit sha

`ci` _boolean_
Enabling this will disable the interactive prompts

##### Example

```ts
import { backportRun } from 'backport';
await backportRun({
  accessToken: 'abc',
  repoName: 'kibana',
  repoOwner: 'elastic',
  pullNumber: 121633,
  ci: true,
  targetPRLabels: ['backport'],
  autoMerge: true,
  autoMergeMethod: 'squash',
});
```

#### `getCommits`

Retrieve information about

##### Arguments:

`accessToken` _string_ **(Required)**
Github access token to authenticate the request

`repoName` _string_ **(Required)**
Name of repository

`repoOwner` _string_ **(Required)**
Owner of repository (organisation or username)

`author` _string_
Filter commits by Github user

`pullNumber` _number_
Filter commits by pull request number

`sha` _string_
Filter commits by commit sha

`sourceBranch` _string_
The branch to display commits from. Defaults to the default branch (normally "main" or "master")

##### Example

```ts
import { getCommits } from 'backport';

const commits = await getCommits({
  accessToken: 'abc',
  repoName: 'kibana',
  repoOwner: 'elastic',
  pullNumber: 121633,
});

return commits;

/*
Return value:
{
  committedDate: '2021-12-20T14:20:16Z',
  sourceBranch: 'main',
  sha: 'd421ddcf6157150596581c7885afa3690cec6339',
  originalMessage: '[APM] Add note about synthtrace to APM docs (#121633)',
  pullNumber: 121633,
  pullUrl: 'https://github.com/elastic/kibana/pull/121633',
  expectedTargetPullRequests: [
    {
      url: 'https://github.com/elastic/kibana/pull/121643',
      number: 121643,
      branch: '8.0',
      state: 'MERGED'
    }
  ]
}
*/
```

## What is backporting?

> Backporting is the action of taking parts from a newer version of a software system [..] and porting them to an older version of the same software. It forms part of the maintenance step in a software development process, and it is commonly used for fixing security issues in older versions of the software and also for providing new features to older versions.

Source: [https://en.wikipedia.org/wiki/Backporting](https://en.wikipedia.org/wiki/Backporting)

## Who is this tool for?

This tools is for anybody who is working on a codebase where they have to maintain multiple versions. If you manually cherry-pick commits from master and apply them to one or more branches, this tool might save you a lot of time.

`backport` is a CLI tool that will let you backport commit(s) interactively and then cherry-pick and create pull requests automatically. `backport` will always perform the git operation in a temporary folder (`~/.backport/repositories/`) separate from your working directory, thereby never interfering with any unstages changes your might have.

**Features:**

- interactively backport one or more commits to one or more branches with an intuitive UI
- will never run `git reset --hard` or other git commands in your working directory - all git operations are handled in a separate directory
- backport a commit by specifying a PR: `backport --pr 1337`
- list and backport commits by a particular user: `backport --author john`
- list and backport commits by a particular path: `backport --path src/plugins/chatbot`
- list PRs filtered by a query: `backport --pr-filter label:backport-v2` (will list commits from PRs with the label "backport-v2")
- forward port commits: `backport --sourceBranch 7.x --branch master` (will forwardport from 7.x to master)
- backport merge commits: `backport --mainline`
- ability to see which commits have been backported and to which branches
- customize the title, description and labels of the created backport PRs

## Contributing

See [CONTRIBUTING.md](https://github.com/sqren/backport/blob/master/CONTRIBUTING.md)

[1]: https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt--x
[2]: https://docs.github.com/en/search-github/getting-started-with-searching-on-github/understanding-the-search-syntax
