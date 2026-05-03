# Configuration Options

## Global & Project Config Formats

### Global config (`~/.backport/config.json`)

Used for your personal authentication token and global settings.

```json
{
  "githubToken": "ghp_very_secret"
}
```

### Project config (`.backportrc.json`)

Added to the root of a project to share configuration with contributors.

```json
{
  "repoOwner": "elastic",
  "repoName": "kibana",
  "targetBranchChoices": ["6.x", "6.3", "6.2", "6.1", "6.0"]
}
```

---

## Options Reference

### `assignees`

**CLI**: `--assignee`, `--assign`  
Add assignees to the target pull request.

### `author`

**CLI**: `--author`, `--all` (to show all)  
Filter commits by Github username. Defaults to the authenticated user. To see commits from all users, use `author: null` in config or `--all` via CLI.

### `autoAssign`

**CLI**: `--auto-assign`  
Automatically add the current user as assignee to the target pull request. (Default: `false`)

### `autoMerge`

**CLI**: `--auto-merge`  
Automatically merge the backport pull request when `true`. (Default: `false`)

### `autoMergeMethod`

**CLI**: `--auto-merge-method`  
Merge method when `autoMerge: true`. Choices: `merge`, `rebase`, `squash`. (Default: `merge`)

### `backportBinary`

CLI command to include in Github status comments (if running a custom wrapped script). (Default: `backport`)

### `backportBranchName`

**CLI**: `--backportBranchName`  
Template to use for the branch name of the backport PR. (Default: `backport/{{targetBranch}}/{{refValues}}`)  
Available variables: `{{targetBranch}}`, `{{sourcePullRequest}}`, `{{refValues}}`.

### `branchLabelMapping`

Automatically detect which branches a pull request should be backported to, based on regex matching of pull request labels. Example:

```json
{
  "branchLabelMapping": {
    "^v7.8.0$": "7.x",
    "^v(\\d+).(\\d+).\\d+$": "$1.$2"
  }
}
```

_Note: backslashes must be escaped in JSON (`\\` → `\`)._

### `cherryPickRef`

**CLI**: `--no-cherry-pick-ref` (to disable)  
Append "(cherry picked from commit...)" to the commit message. (Default: `true`)

### `commitPaths`

**CLI**: `--path`, `-p`  
Only list commits touching files under the specified path.

### `conflictResolution`

**CLI**: `--conflict-resolution`  
Strategy when encountering merge conflicts. Only applies in non-interactive mode (e.g. `--non-interactive`, or when running via the [GitHub Action](https://github.com/sorenlouv/backport-github-action)). Choices: `abort`, `commit`, `theirs`. (Default: `abort`)

### `copySourcePRLabels`

**CLI**: `--copySourcePRLabels`  
Copy labels from the source PR to the target PR. Can be `true` to copy all, or an array of regex strings to copy specific labels. (Default: `false`)

### `copySourcePRReviewers`

**CLI**: `--copySourcePRReviewers`  
Copy reviewers from the source PR to the target PR. (Default: `false`)

### `draft`

**CLI**: `--draft`  
Publish the backport pull request as a draft. (Default: `false`)

### `dryRun`

**CLI**: `--dry-run`  
Run the backport locally without pushing to GitHub or creating a pull request.

### `editor`

**CLI**: `--editor`  
Editor (e.g., `code`) to open and resolve conflicts.

### `fork`

**CLI**: `--fork`, `--no-fork` (to disable)  
Create backport branch in the user's fork (`true`) or in the origin repository (`false`). (Default: `true`)

### `gitAuthorName` / `gitAuthorEmail`

**CLI**: `--git-author-name`, `--git-author-email`  
Override the commit author name and/or email for the backported commits.

### `gitHostname`

**CLI**: `--git-hostname`  
Hostname for Git. (Default: `github.com`)

### `githubApiBaseUrlV3` / `githubApiBaseUrlV4`

Base URLs for Github REST and GraphQL APIs.

### `githubToken` **(Required)**

**CLI**: `--github-token`  
Personal access token for GitHub authentication.

Create a token in [GitHub Developer Settings → Personal Access Tokens (classic)](https://github.com/settings/tokens/new?description=backport%20cli&scopes=repo,workflow) with the following scopes:

- **`repo`** — required for cloning, pushing, and creating pull requests
- **`workflow`** — required if any target branch has GitHub Actions workflows

**For public and private repos (recommended):**

<img width="971" alt="PAT scopes for public and private repos" src="https://user-images.githubusercontent.com/7416358/226398066-54cd918e-7d5a-420b-9f84-bb34f9f43dd6.png">

**For public repos only:**

<img width="971" alt="PAT scopes for public repos only" src="https://user-images.githubusercontent.com/7416358/226398088-715a5bab-7ac8-4733-b48c-d94da593ca04.png">

### `interactive`

**CLI**: `--interactive`, `--non-interactive` (or `--json` to disable)  
Enable interactive prompts. (Default: `true`)

### `ls`

**CLI**: `--ls`  
List commits instead of backporting them.

### `mainline`

**CLI**: `--mainline`  
Parent id of a merge commit to backport. Defaults to `1` when specified without a value.

### `maxCount`

**CLI**: `--max-count`, `--number`, `-n`  
Number of commits to choose from in the interactive prompt. (Default: `10`)

### `multipleBranches`

**CLI**: `--multiple-branches`, `--multiple` (for both)  
Allow selecting multiple branches to backport to. (Default: `true`)

### `multipleCommits`

**CLI**: `--multiple-commits`, `--multiple` (for both)  
Allow selecting multiple commits to backport. (Default: `false`)

### `noVerify`

**CLI**: `--no-verify`, `--verify` (to enforce)  
Bypass the pre-commit and commit-msg hooks. (Default: `true`)

### `onlyMissing`

**CLI**: `--only-missing`  
Only list commits with missing or unmerged backports.

### `prDescription`

**CLI**: `--pr-description`, `--description`  
Description template for the target pull request. Supports Handlebars templating (`{{sourceBranch}}`, `{{targetBranch}}`, `{{commitMessages}}`, `{{commits}}`, `{{defaultPrDescription}}`).

### `prQuery`

**CLI**: `--pr-query`  
Filter source pull requests using Github's search syntax.

### `prTitle`

**CLI**: `--pr-title`, `--title`  
Title template for the target pull request. Supports Handlebars templating (`{{targetBranch}}`, `{{commitMessages}}`, etc.).

### `projectConfigFile` / `globalConfigFile`

**CLI**: `--config-file`, `--global-config-file`  
Custom paths to configuration files.

### `publishStatusCommentOnAbort` / `publishStatusCommentOnFailure` / `publishStatusCommentOnSuccess`

**CLI**: `--no-status-comment` (to disable all)  
Publish status comments to the source PR based on the backport outcome. (Defaults: Success: `true`, Failure/Abort: `false`)

### `pullNumber`

**CLI**: `--pr`  
Backport a pull request by specifying its number.

### `repoForkOwner`

**CLI**: `--repo-fork-owner`  
The owner of the fork where the backport branch is pushed. Defaults to the currently authenticated user.

### `repoName` **(Required)**

**CLI**: `--repo-name`  
Name of the repository.

### `repoOwner` **(Required)**

**CLI**: `--repo-owner`  
Owner of the repository (organization or username).  
_Note: The CLI supports `--repo owner/name` as a shorthand for both._

### `resetAuthor`

**CLI**: `--reset-author`  
Set yourself as the commit author of the backported commit. (Default: `false`)

### `reviewers`

**CLI**: `--reviewer`  
Add reviewers to the target pull request.

### `sha`

**CLI**: `--sha`  
Backport a commit by specifying its commit sha.

### `signoff`

**CLI**: `--signoff`, `-s`  
Pass the `--signoff` option to the `git cherry-pick` command. (Default: `false`)

### `since` / `until`

**CLI**: `--since`, `--until`  
Only display commits newer/older than the specified ISO-8601 date.

### `skipRemoteConfig`

**CLI**: `--skip-remote-config`  
Use the local `.backportrc.json` config instead of loading from the repository's default branch on GitHub.

### `sourceBranch`

**CLI**: `--source-branch`  
Specify a non-default branch (e.g. instead of `master`/`main`) to backport commits from.

### `sourcePRLabels`

**CLI**: `--source-pr-label`  
Labels that will be added to the source (original) pull request after backporting.

### `targetBranchChoices`

List of target branches the user can select interactively. Can be a simple array of strings, or objects with `name` and `checked` (pre-selected) fields:

```json
{
  "targetBranchChoices": [
    { "name": "6.1", "checked": true },
    { "name": "6.0", "checked": false }
  ]
}
```

### `targetBranches`

**CLI**: `--target-branch`, `-b`  
Overrides `targetBranchChoices` and bypasses the branch selection prompt, backporting directly to these branches.

### `targetPRLabels`

**CLI**: `--target-pr-label`, `--label`, `-l`  
Labels that will be added to the target (backport) pull request.

### `verbose`

**CLI**: `--verbose`  
Show additional details about each commit in the interactive prompt. (Default: `false`)

### `workdir`

**CLI**: `--workdir`  
Directory where `backport` clones the repository and performs git operations. (Default: `~/.backport/repositories/`)
