# Comprehensive QA Testing Prompt: Backport CLI Tool

## Purpose
Conduct extensive manual testing of the backport CLI tool against a real GitHub environment. This prompt is designed for a very experienced QA engineer to systematically verify all features, config options, and edge cases.

## Testing Environment
- **Test Repository**: https://github.com/backport-org/backport-demo
- **Access Level**: Full write access to create branches, commits, and pull requests
- **Scope**: You may make any necessary changes to the test repository to enable thorough testing

## Before Starting
1. Review the entire backport codebase to understand all features and their implementation
2. Study the documentation: `docs/config-file-options.md`, `docs/cli-options.md`, and `docs/api.md`
3. Install backport locally: `npm install` and `npm run build`
4. Setup your GitHub personal access token with repo and workflow scopes
5. Create a `.backport/config.json` with your token
6. Clone/fork the backport-demo repository to test against

## Test Categories

### Category 1: Core Backporting Flow
Test the fundamental backport workflow: commit selection → branch selection → cherry-pick → PR creation

**Tests to perform:**
- [ ] **TC1.1**: Interactive mode - Select a single commit and backport to a single branch
  - Verify commit is cherry-picked cleanly
  - Verify PR is created on target branch
  - Verify PR title includes original commit message
  - Verify PR body includes "cherry picked from commit..." footer

- [ ] **TC1.2**: Backport using `--sha` flag
  - Backport a specific commit by SHA without interactive selection
  - Verify correct commit is backported

- [ ] **TC1.3**: Backport using `--pull-number` / `--pr` flag
  - Backport an entire PR's commits to target branch
  - Verify all commits from PR are backported in order

- [ ] **TC1.4**: Multi-branch backport
  - Enable `--multiple-branches` (or via config)
  - Select a single commit and backport to multiple branches simultaneously
  - Verify PRs are created on all target branches

- [ ] **TC1.5**: Multi-commit backport
  - Enable `--multiple-commits` (or via config)
  - Select multiple commits and backport to a single branch
  - Verify all commits are cherry-picked in order
  - Verify separate PRs are created for each commit OR combined PR (verify behavior)

---

### Category 2: Configuration Files
Test both global and project configuration options

**Global Config Tests:**
- [ ] **TC2.1**: Global config with accessToken
  - Create `~/.backport/config.json` with valid token
  - Verify backport commands work without `--access-token` flag

- [ ] **TC2.2**: Global config with editor preference
  - Set `editor: "nano"` (or another available editor)
  - Trigger a conflict scenario and verify editor opens correctly

- [ ] **TC2.3**: Global config with custom backportBinary
  - Set `backportBinary` to "npx backport"
  - Verify it's used in GitHub status comments

**Project Config Tests:**
- [ ] **TC2.4**: `.backportrc.json` with required fields
  - Create `.backportrc.json` with `repoOwner`, `repoName`, `targetBranchChoices`
  - Verify config is loaded correctly
  - Verify target branches appear in interactive prompts

- [ ] **TC2.5**: targetBranchChoices with pre-selected branches
  - Configure: `{ "name": "branch-name", "checked": true }`
  - Verify branch appears pre-selected in interactive mode

- [ ] **TC2.6**: Override config with CLI flags
  - Set value in `.backportrc.json`
  - Override with CLI flag
  - Verify CLI flag takes precedence

---

### Category 3: Author and Commit Filtering
Test commit filtering by author

- [ ] **TC3.1**: Default author filtering
  - Run backport interactively
  - Verify only commits from authenticated user are shown

- [ ] **TC3.2**: `--author` flag with specific user
  - Use `--author username`
  - Verify commits from that user are shown

- [ ] **TC3.3**: `--all` flag (show all authors)
  - Use `--all` or set `author: null` in config
  - Verify commits from all users are displayed

- [ ] **TC3.4**: `--max-number` / `--number` flag
  - Use `--max-number 5`
  - Verify max 5 commits are shown
  - Test with different values (1, 10, 20)

---

### Category 4: Merge Strategies and Auto-Merge
Test different merge methods and automatic merging

- [ ] **TC4.1**: `autoMerge: false` (default)
  - Backport a commit
  - Verify PR is created but NOT automatically merged

- [ ] **TC4.2**: `autoMerge: true` with `autoMergeMethod: "merge"`
  - Configure and backport
  - Verify PR is automatically merged with merge commit

- [ ] **TC4.3**: `autoMerge: true` with `autoMergeMethod: "squash"`
  - Configure and backport
  - Verify PR is automatically squashed and merged

- [ ] **TC4.4**: `autoMerge: true` with `autoMergeMethod: "rebase"`
  - Configure and backport
  - Verify PR is automatically rebased and merged

- [ ] **TC4.5**: `--mainline` flag for merge commits
  - Create a merge commit in test repo
  - Use `--mainline 1` and `--mainline 2`
  - Verify correct parent is selected for cherry-pick

---

### Category 5: Assignees and Reviewers
Test assigning users to backport PRs

- [ ] **TC5.1**: `autoAssign: true`
  - Configure and backport
  - Verify current user is automatically assigned

- [ ] **TC5.2**: `--assignee` / `--assign` flag
  - Use `--assignee username1 --assignee username2`
  - Verify all specified users are assigned

- [ ] **TC5.3**: `--reviewer` flag
  - Use `--reviewer username`
  - Verify reviewer is added to PR

- [ ] **TC5.4**: `assignees` in config file
  - Configure `assignees: ["user1", "user2"]`
  - Verify users are assigned

---

### Category 6: Labels
Test label handling and mapping

- [ ] **TC6.1**: `--target-pr-label` / `--label` flag
  - Use `--label bug --label backport`
  - Verify labels are added to target PR

- [ ] **TC6.2**: `targetPRLabels` in config
  - Configure and backport
  - Verify labels are added from config

- [ ] **TC6.3**: `branchLabelMapping` automatic detection
  - Create a source PR with label matching regex (e.g., "backport-to-v1")
  - Configure `branchLabelMapping: { "^backport-to-(.+)$": "$1" }`
  - Backport that PR
  - Verify it automatically backports to branch "v1"

- [ ] **TC6.4**: `copySourcePRLabels: true`
  - Create source PR with multiple labels
  - Set `copySourcePRLabels: true`
  - Backport
  - Verify all source labels are copied to target PR

- [ ] **TC6.5**: `copySourcePRReviewers: true`
  - Create source PR with reviewers
  - Set `copySourcePRReviewers: true`
  - Backport
  - Verify reviewers are copied to target PR

---

### Category 7: Conflict Handling
Test conflict resolution behavior

- [ ] **TC7.1**: Conflicting cherry-pick with interactive resolution
  - Modify same file on target branch
  - Attempt backport that causes conflict
  - Verify conflict prompts interactive mode or editor
  - Manually resolve conflict
  - Verify backport continues successfully

- [ ] **TC7.2**: `--commit-conflicts` flag
  - Use `--commit-conflicts` in non-interactive mode
  - Create a conflicting backport
  - Verify conflict is committed as-is

- [ ] **TC7.3**: Abort on conflict (default)
  - Attempt conflicting backport without `--commit-conflicts`
  - Verify backport aborts on conflict

- [ ] **TC7.4**: `--no-verify` flag
  - Set pre-commit hooks on test repo that would fail
  - Use `--no-verify` to bypass
  - Verify commit succeeds despite hook failure

---

### Category 8: PR Customization
Test pull request title and description customization

- [ ] **TC8.1**: Default PR title and description
  - Backport without custom title/description
  - Verify PR title = commit message
  - Verify description includes cherry-pick footer

- [ ] **TC8.2**: `--pr-title` flag
  - Use `--pr-title "Custom backport title"`
  - Verify PR has custom title

- [ ] **TC8.3**: `--pr-description` / `--description` flag
  - Use `--description "Custom description"`
  - Verify PR has custom description (replaces default)

- [ ] **TC8.4**: `prTitle` in config
  - Configure custom title template
  - Verify title is used from config

- [ ] **TC8.5**: `prDescription` in config
  - Configure custom description
  - Verify description is used from config

---

### Category 9: Dry Run Mode
Test dry-run functionality

- [ ] **TC9.1**: `--dry-run` flag
  - Use `--dry-run`
  - Verify no commits are pushed
  - Verify no PRs are created
  - Verify local cherry-pick is performed

- [ ] **TC9.2**: Dry run with conflicts
  - Create conflicting backport with `--dry-run`
  - Verify behavior matches non-dry-run
  - Verify no PR is created

- [ ] **TC9.3**: Dry run shows what would happen
  - Run with `--dry-run` and `--interactive`
  - Verify output indicates dry-run status

---

### Category 10: Fork vs Direct Push
Test fork vs direct push to main repo

- [ ] **TC10.1**: `--fork: true` (default)
  - Configure fork owner
  - Backport a commit
  - Verify branch is pushed to fork
  - Verify PR is against main repo

- [ ] **TC10.2**: `--fork: false`
  - Set `fork: false` in config
  - Backport a commit
  - Verify branch is pushed to main repo (requires write access)

- [ ] **TC10.3**: `--repo-fork-owner` flag
  - Use `--repo-fork-owner different-user`
  - Verify branch is pushed to that user's fork

---

### Category 11: Source Branch Selection
Test backporting from non-default branches

- [ ] **TC11.1**: `--source-branch` flag
  - Create a release branch
  - Use `--source-branch release-v1.x`
  - Verify commits are fetched from that branch

- [ ] **TC11.2**: `sourceBranch` in config
  - Configure non-default source branch
  - Verify backport uses that branch

---

### Category 12: Path-based Filtering
Test filtering commits by file path

- [ ] **TC12.1**: `--path` flag single file
  - Use `--path "src/index.ts"`
  - Verify only commits touching that path are shown

- [ ] **TC12.2**: `--path` flag multiple files
  - Use `--path "src/**/*.ts"`
  - Verify commits touching matching files are shown

- [ ] **TC12.3**: Path filtering with no matches
  - Use `--path "nonexistent/path/**"`
  - Verify no commits are shown

---

### Category 13: PR Filter
Test filtering commits by GitHub PR search

- [ ] **TC13.1**: `--pr-filter` basic
  - Use `--pr-filter "is:merged label:backport"`
  - Verify only merged PRs with backport label are shown

- [ ] **TC13.2**: `--pr-filter` complex query
  - Use complex GitHub search query
  - Verify filter works correctly

---

### Category 14: Commit Message Customization
Test cherry-pick ref and signoff options

- [ ] **TC14.1**: Default cherry-pick footer
  - Backport a commit
  - Verify commit message includes "(cherry picked from commit SHA)"

- [ ] **TC14.2**: `--no-cherrypick-ref` flag
  - Use `--no-cherrypick-ref`
  - Backport a commit
  - Verify cherry-pick footer is NOT added

- [ ] **TC14.3**: `--signoff` / `-s` flag
  - Use `--signoff`
  - Backport a commit
  - Verify "Signed-off-by:" is added

- [ ] **TC14.4**: `--reset-author` flag
  - Use `--reset-author`
  - Backport a commit from different author
  - Verify commit author is changed to current user

- [ ] **TC14.5**: `cherrypickRef` in config
  - Set `cherrypickRef: false`
  - Backport
  - Verify cherry-pick footer is not added

---

### Category 15: Status Comments
Test GitHub PR status comments

- [ ] **TC15.1**: Default status comment on success
  - Backport successfully (non-auto-merge)
  - Verify backport status comment is posted to source PR

- [ ] **TC15.2**: Status comment on conflict failure
  - Create conflicting backport
  - Verify failure status comment is posted

- [ ] **TC15.3**: `--no-status-comment` flag
  - Use `--no-status-comment`
  - Backport
  - Verify no status comment is posted

- [ ] **TC15.4**: `publishStatusCommentOnSuccess` config
  - Set `publishStatusCommentOnSuccess: false`
  - Backport successfully
  - Verify no success comment is posted

---

### Category 16: Non-Interactive Mode
Test non-interactive / CI mode

- [ ] **TC16.1**: `--interactive false`
  - Use `--interactive false` with `--sha` and `--branch`
  - Verify no prompts appear
  - Verify backport completes successfully

- [ ] **TC16.2**: Missing required options in non-interactive
  - Use `--interactive false` without SHA/PR
  - Verify error is shown

- [ ] **TC16.3**: Conflicts in non-interactive (abort)
  - Create conflicting backport with `--interactive false`
  - Verify backport aborts (no `--commit-conflicts`)

---

### Category 17: Advanced Options
Test less common but important options

- [ ] **TC17.1**: `--git-hostname` flag
  - For custom git hosts (skip if not applicable)

- [ ] **TC17.2**: `--dir` flag custom directory
  - Use `--dir /tmp/custom-backport`
  - Verify repo is cloned to custom location

- [ ] **TC17.3**: `--config-file` flag
  - Use `--config-file ./custom-backport-config.json`
  - Verify custom config is loaded

- [ ] **TC17.4**: `--access-token` flag
  - Override token via CLI flag
  - Verify it takes precedence over config

- [ ] **TC17.5**: `--editor` flag
  - Set custom editor for conflict resolution

---

### Category 18: Source PR Labels
Test source PR label handling

- [ ] **TC18.1**: `--source-pr-label` flag
  - Use `--source-pr-label "backport-done"`
  - Backport successfully
  - Verify label is added to source PR

- [ ] **TC18.2**: `sourcePRLabels` in config
  - Configure labels to add to source PR
  - Backport
  - Verify labels are added

---

### Category 19: Custom Branch Naming
Test custom backport branch naming

- [ ] **TC19.1**: `--backportBranchName` flag
  - Use `--backportBranchName "custom-{{sourceBranch}}-{{targetBranch}}"`
  - Backport
  - Verify branch follows naming convention

- [ ] **TC19.2**: `backportBranchName` in config
  - Configure custom branch name pattern
  - Backport
  - Verify pattern is applied

---

### Category 20: Edge Cases and Error Handling
Test error scenarios and edge cases

- [ ] **TC20.1**: Invalid access token
  - Use invalid token
  - Verify clear error message

- [ ] **TC20.2**: Repository not found
  - Use non-existent repo owner/name
  - Verify clear error message

- [ ] **TC20.3**: Commit already exists on target branch
  - Attempt to backport commit already on target branch
  - Verify appropriate error or skip

- [ ] **TC20.4**: Target branch does not exist
  - Attempt backport to non-existent branch
  - Verify clear error message

- [ ] **TC20.5**: User without write access
  - Attempt backport with restricted token
  - Verify permission error

- [ ] **TC20.6**: Empty commit selection
  - Run interactive and select no commits
  - Verify appropriate handling (cancel/abort)

- [ ] **TC20.7**: Very large commit (many file changes)
  - Backport commit with many changes
  - Verify handles large diffs correctly

- [ ] **TC20.8**: Backport with binary files
  - Create commit with binary files
  - Backport
  - Verify binary files are handled correctly

- [ ] **TC20.9**: Backport with renamed files
  - Create commit that renames files
  - Backport
  - Verify renames are preserved

- [ ] **TC20.10**: Backport with deleted files
  - Create commit that deletes files
  - Backport
  - Verify deletions are applied

---

### Category 21: Help and Version Commands
Test CLI meta commands

- [ ] **TC21.1**: `--help` flag
  - Run `backport --help`
  - Verify all options are listed
  - Verify descriptions are clear

- [ ] **TC21.2**: `--version` / `-v` flag
  - Run `backport --version`
  - Verify version number is displayed correctly

- [ ] **TC21.3**: Help for subcommands
  - Verify help is comprehensive

---

### Category 22: Configuration Precedence
Test configuration loading and precedence

- [ ] **TC22.1**: CLI > Project Config > Global Config
  - Set same option in all three places with different values
  - Verify CLI value is used

- [ ] **TC22.2**: Project config inherits from global config
  - Set option only in global config
  - Verify it's used in project

- [ ] **TC22.3**: Missing project config
  - Run backport without `.backportrc.json`
  - Verify global config is still used

- [ ] **TC22.4**: Invalid JSON in config
  - Create malformed `.backportrc.json`
  - Verify clear error message

---

## Testing Best Practices

1. **Setup**: Before each test session, ensure:
   - Fresh clone of backport-demo (or clean state)
   - Valid GitHub token configured
   - Backport built locally (`npm run build`)

2. **Documentation**: For each test:
   - Record what was tested
   - Document expected vs actual behavior
   - Take screenshots of relevant outputs
   - Note any discrepancies

3. **Cleanup**: After tests:
   - Comment out or delete test branches
   - Close test PRs (or mark as draft)
   - Revert test commits if needed
   - Keep repo in clean state for next session

4. **Regression Testing**:
   - Run critical tests (TC1.1, TC1.3, TC4.2, TC7.1) on each build
   - Test all configuration combinations
   - Test all CLI flag combinations

5. **Report Findings**:
   - Group issues by severity (critical, major, minor)
   - Provide reproduction steps for each issue
   - Include exact command used
   - Include error messages/logs
   - Note any differences from expected behavior

---

## Success Criteria

All tests should:
- ✅ Execute without crashes
- ✅ Produce expected output
- ✅ Create PRs/commits as intended
- ✅ Handle errors gracefully with clear messages
- ✅ Respect all configuration options
- ✅ Follow expected precedence (CLI > Project > Global)
- ✅ Work in both interactive and non-interactive modes
- ✅ Document/commit all meaningful test changes

---

## Notes for QA Engineer

- The backport tool is complex with many configuration options and CLI flags
- Focus on combinations that are most likely to be used in production
- Pay special attention to conflict handling and merge strategies
- Test both happy paths and error scenarios
- Verify GitHub API interactions (labels, reviewers, auto-merge)
- Consider performance with large commits/many files
- Document any edge cases or unexpected behaviors found
