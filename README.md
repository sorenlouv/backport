<div align="center">
	<img src="https://user-images.githubusercontent.com/209966/148229483-9f867a20-da7d-4cff-8c52-fcb27d482b89.png" height="200">
	<p>
    <b>A CLI tool that automates the process of backporting commits.</b>
	</p>
	<br>
</div>

## 🎉 New! The Backport Tool as a Github Action 🎉

A [Github Action](https://github.com/sqren/backport-github-action) around The Backport Tool now exists. It makes it a breeze to get automatic backports when pull requests are merged.

# Backport CLI tool

The remaining documentation focuses on the Backport CLI tool (not the Github Action) although all configuration options apply to the Github Action too. The only difference is that the CLI tool is interactive and run manually locally, where the Github Action runs automatically.

## How it works

1. Select a commit to backport
2. Select a branch to backport to
3. The commit will be cherrypicked, pushed and a pull request created.

![backport-demo](https://user-images.githubusercontent.com/209966/80993576-95766380-8e3b-11ea-9efd-b35eb2e6a9ec.gif)

## Requirements

- Node 16 or higher
- git

## Install

```sh
npm install -g backport
```

After installation you should add an access token to the [global config](https://github.com/sqren/backport/blob/main/docs/configuration.md#global-config-backportconfigjson) in `~/.backport/config.json`. See the [documentation](https://github.com/sqren/backport/blob/main/docs/configuration.md#accesstoken-required) for how the access token is generated.

## Quick start

```
npm install backport
```

Add a [project config](https://github.com/sqren/backport/blob/main/docs/configuration.md#project-config-backportrcjson) to the root of your repository:

```js
// .backportrc.json
{
  "repoOwner": "elastic",
  "repoName": "kibana",

  // the branches available to backport to
  "targetBranchChoices": ["main", "6.3", "6.2", "6.1", "6.0"],

  // Optional: Automatically detect which branches a pull request should be backported to based on the pull request labels.
  // In this case, adding the label "backport-to-production" will backport the PR to the "production" branch
  "branchLabelMapping": {
    "^backport-to-(.+)$": "$1"
  }
}
```

Add personal access token to [global config](https://github.com/sqren/backport/blob/main/docs/configuration.md#global-config-backportconfigjson):

```js
// ~/.backport/config.json
{
  "accessToken": "ghp_very_secret"
}
```

Run:

```
npx backport
```

_This will start an interactive prompt. You can use your keyboards arrow keys to choose options, `<space>` to select checkboxes and `<enter>` to proceed._

### Config options

See [configuration.md](https://github.com/sqren/backport/blob/main/docs/configuration.md)

### CLI options

| Option              | Shorthand notation | Description                                                                | Default                   |
| ------------------- | ------------------ | -------------------------------------------------------------------------- | ------------------------- |
| --access-token      |                    | Github access token                                                        |                           |
| --all               | -a                 | Show commits from any author. Opposite of `--author`                       | false                     |
| --assignee          | --assign           | Assign users to the target PR                                              |                           |
| --author            |                    | Filter commits by Github username. Opposite of `--all`                     | _Current user_            |
| --auto-assign       |                    | Assign current user to the target PR                                       | false                     |
| --branch            | -b                 | Target branch to backport to                                               |                           |
| --config-file       |                    | Custom path to project config file (.backportrc.json)                      |                           |
| --dir               |                    | Clone repository into custom directory                                     | ~/.backport/repositories/ |
| --dry-run           |                    | Perform backport without pushing to Github                                 | false                     |
| --editor            |                    | Editor (eg. `code`) to open and resolve conflicts                          | nano                      |
| --fork              |                    | Create backports in fork repo                                              | true                      |
| --git-hostname      |                    | Hostname for Git                                                           | github.com                |
| --interactive       |                    | Enable interactive prompts                                                 | true                      |
| --mainline          |                    | Parent id of merge commit                                                  | 1                         |
| --max-number        | --number, -n       | Number of commits to choose from                                           | 10                        |
| --multiple          |                    | Multi-select for commits and branches                                      | false                     |
| --multiple-branches |                    | Multi-select for branches                                                  | true                      |
| --multiple-commits  |                    | Multi-select for commits                                                   | false                     |
| --no-cherrypick-ref |                    | Do not append "(cherry picked from commit...)". [Git Docs][1]              | false                     |
| --no-status-comment |                    | Do not publish a status comment to Github with the results of the backport | false                     |
| --no-verify         |                    | Bypass the pre-commit and commit-msg hooks                                 | false                     |
| --path              | -p                 | Filter commits by path                                                     |                           |
| --pr-description    | --description      | Description for pull request                                               |                           |
| --pr-filter         |                    | Find PRs using [Github's search syntax][2]                                 |                           |
| --pr-title          | --title            | Title of pull request                                                      |                           |
| --pull-number       | --pr               | Backport pull request by number                                            |                           |
| --repo-fork-owner   |                    | The owner of the fork where the backport branch is pushed.                 | _Current user_            |
| --repo-name         |                    | Name of repository                                                         |                           |
| --repo-owner        |                    | Owner of repository                                                        |                           |
| --reset-author      |                    | Set yourself as commit author                                              |                           |
| --reviewer          |                    | Add reviewer to the target PR                                              |                           |
| --sha               |                    | Sha of commit to backport                                                  |                           |
| --source-branch     |                    | Specify a non-default branch to backport from                              |                           |
| --source-pr-label   |                    | Labels added to the source PR                                              |                           |
| --target-branch     | -b                 | Target branch(es) to backport to                                           |                           |
| --target-pr-label   | --label, -l        | Labels added to the target PR                                              |                           |
| --help              |                    | Show help                                                                  |                           |
| -v, --version       |                    | Show version number                                                        |                           |

The CLI options will override the [configuration options](https://github.com/sqren/backport/blob/main/docs/configuration.md).

## Backport Module API

`backport` can be imported as a Node module and interacted with programatically. This can be useful when creating automation around the Backport tool. See for example the [Backport Github Action](https://github.com/sqren/backport-github-action)

### `backportRun`

Backport a commit programatically. Commits can be selected via `pullNumber` or `sha`.

#### Arguments:

All of the options listed on [configuration.md](https://github.com/sqren/backport/blob/main/docs/configuration.md) are valid. The most common options are:

`accessToken` _string_ **(Required)**<br/>
Github access token to authenticate the request

`repoName` _string_ **(Required)**<br/>
Name of repository

`repoOwner` _string_ **(Required)**<br/>
Owner of repository (organisation or username)

`pullNumber` _number_<br/>
Filter commits by pull request number

`sha` _string_<br/>
Filter commits by commit sha

`interactive` _boolean_<br/>
Enable interactive prompts

#### Example

```ts
import { backportRun } from 'backport';

const result = await backportRun({
  options: {
    accessToken: 'very secret',
    repoName: 'kibana',
    repoOwner: 'elastic',
    pullNumber: 121633,
    interactive: false,
  },
});

console.log(result);
```

### `getCommits`

Retrieve information about commits and whether they are backported

#### Arguments:

`accessToken` _string_ **(Required)**<br/>
Github access token to authenticate the request

`repoName` _string_ **(Required)**<br/>
Name of repository

`repoOwner` _string_ **(Required)**<br/>
Owner of repository (organisation or username)

`author` _string_<br/>
Filter commits by Github user

`pullNumber` _number_<br/>
Filter commits by pull request number

`sha` _string_<br/>
Filter commits by commit sha

`sourceBranch` _string_<br/>
The branch to display commits from. Defaults to the default branch (normally "main" or "master")

#### Example

```ts
import { getCommits } from 'backport';

const commits = await getCommits({
  accessToken: 'abc',
  repoName: 'kibana',
  repoOwner: 'elastic',
  pullNumber: 121633,
});

console.log(commits);

/*
[{
  soureCommit: {
    committedDate: '2021-12-20T14:20:16Z',
    sha: 'd421ddcf6157150596581c7885afa3690cec6339',
    message: '[APM] Add note about synthtrace to APM docs (#121633)',
  },
  sourcePullRequest: {
    number: 121633,
    url: 'https://github.com/elastic/kibana/pull/121633'
    mergeCommit: {
      sha: 'd421ddcf6157150596581c7885afa3690cec6339',
      message: '[APM] Add note about synthtrace to APM docs (#121633)',
    }
  },
  sourceBranch: 'main',
  expectedTargetPullRequests: [
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

## What is backporting?

> Backporting is the action of taking parts from a newer version of a software system [..] and porting them to an older version of the same software. It forms part of the maintenance step in a software development process, and it is commonly used for fixing security issues in older versions of the software and also for providing new features to older versions.

Source: [https://en.wikipedia.org/wiki/Backporting](https://en.wikipedia.org/wiki/Backporting)

## Who is this tool for?

This tools is for anybody who is working on a codebase where they have to maintain multiple versions. If you manually cherry-pick commits from master and apply them to one or more branches, this tool might save you a lot of time.

`backport` is a CLI tool that will let you backport commit(s) interactively and then cherry-pick and create pull requests automatically. `backport` will perform all git operations in a temporary folder (`~/.backport/repositories/`) separate from your working directory, thereby never interfering with any unstages changes your might have.

**Features:**

- interactively backport one or more commits to one or more branches with an intuitive UI
- ability to see which commits have been backported and to which branches
- ability to customize the title, description and labels of the created backport PRs
- all git operations are handled in a separate directory to not interfere with unstaged files
- Conflicts are handled gracefully, and hints are provided to help the user understand the source of the conflict
- backport a commit by specifying a PR: `backport --pr 1337`
- list and backport commits by a particular user: `backport --author john`
- list and backport commits by a particular path: `backport --path src/plugins/chatbot`
- list PRs filtered by a query: `backport --pr-filter label:backport-v2` (will list commits from PRs with the label "backport-v2")
- forward port commits: `backport --source-branch 7.x --branch master` (will forwardport from 7.x to master)
- backport merge commits: `backport --mainline`

## Contributing

See [CONTRIBUTING.md](https://github.com/sqren/backport/blob/master/CONTRIBUTING.md)

[1]: https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt--x
[2]: https://docs.github.com/en/search-github/getting-started-with-searching-on-github/understanding-the-search-syntax

[![NPM version](https://img.shields.io/npm/v/backport.svg)](https://www.npmjs.com/package/backport)
[![Coverage Status](https://coveralls.io/repos/github/sqren/backport/badge.svg?branch=master)](https://coveralls.io/github/sqren/backport?branch=master)
