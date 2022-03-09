import chalk from 'chalk';
import { isEmpty, difference } from 'lodash';
import { ValidConfigOptions } from '../options/options';
import { HandledError } from '../services/HandledError';
import { spawnPromise } from '../services/child-process-promisified';
import { getRepoPath } from '../services/env';
import {
  cherrypick,
  createBackportBranch,
  deleteBackportBranch,
  pushBackportBranch,
  getUnstagedFiles,
  commitChanges,
  getConflictingFiles,
  getRepoForkOwner,
  fetchBranch,
  ConflictingFiles,
} from '../services/git';
import { getFirstLine, getShortSha } from '../services/github/commitFormatters';
import { addAssigneesToPullRequest } from '../services/github/v3/addAssigneesToPullRequest';
import { addLabelsToPullRequest } from '../services/github/v3/addLabelsToPullRequest';
import { addReviewersToPullRequest } from '../services/github/v3/addReviewersToPullRequest';
import {
  createPullRequest,
  getTitle,
  getPullRequestBody,
  PullRequestPayload,
} from '../services/github/v3/createPullRequest';
import { enablePullRequestAutoMerge } from '../services/github/v4/enablePullRequestAutoMerge';
import { consoleLog, logger } from '../services/logger';
import { confirmPrompt } from '../services/prompts';
import { sequentially } from '../services/sequentially';
import { Commit } from '../services/sourceCommit/parseSourceCommit';
import { getCommitsWithoutBackports } from './getCommitsWithoutBackports';
import { GitConfigAuthor } from './getGitConfigAuthor';
import { ora } from './ora';

export async function cherrypickAndCreateTargetPullRequest({
  options,
  commits,
  targetBranch,
  gitConfigAuthor,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
  gitConfigAuthor?: GitConfigAuthor;
}): Promise<{ url: string; number: number; didUpdate: boolean }> {
  const backportBranch = getBackportBranchName(targetBranch, commits);
  const repoForkOwner = getRepoForkOwner(options);
  consoleLog(`\n${chalk.bold(`Backporting to ${targetBranch}:`)}`);

  await createBackportBranch({ options, targetBranch, backportBranch });

  await sequentially(commits, (commit) =>
    waitForCherrypick(options, commit, targetBranch, gitConfigAuthor)
  );

  if (options.dryRun) {
    ora(options.ci).succeed('Dry run complete');
    return { url: 'https://localhost/dry-run', didUpdate: false, number: 1337 };
  }

  await pushBackportBranch({ options, backportBranch });
  await deleteBackportBranch({ options, backportBranch });

  const prPayload: PullRequestPayload = {
    owner: options.repoOwner,
    repo: options.repoName,
    title: getTitle({ options, commits, targetBranch }),
    body: getPullRequestBody({ options, commits, targetBranch }),
    head: `${repoForkOwner}:${backportBranch}`, // eg. sqren:backport/7.x/pr-75007
    base: targetBranch, // eg. 7.x
  };

  const targetPullRequest = await createPullRequest({ options, prPayload });

  // add assignees to target pull request
  const assignees = options.autoAssign
    ? [options.authenticatedUsername]
    : options.assignees;

  if (options.assignees.length > 0) {
    await addAssigneesToPullRequest(
      options,
      targetPullRequest.number,
      assignees
    );
  }

  // add reviewers to target pull request
  if (options.reviewers.length > 0) {
    await addReviewersToPullRequest(
      options,
      targetPullRequest.number,
      options.reviewers
    );
  }

  // add labels to target pull request
  if (options.targetPRLabels.length > 0) {
    await addLabelsToPullRequest(
      options,
      targetPullRequest.number,
      options.targetPRLabels
    );
  }

  // make PR auto mergable
  if (options.autoMerge) {
    await enablePullRequestAutoMerge(options, targetPullRequest.number);
  }

  // add labels to source pull requests
  if (options.sourcePRLabels.length > 0) {
    const promises = commits.map((commit) => {
      if (commit.sourcePullRequest) {
        return addLabelsToPullRequest(
          options,
          commit.sourcePullRequest.number,
          options.sourcePRLabels
        );
      }
    });

    await Promise.all(promises);
  }

  consoleLog(`View pull request: ${targetPullRequest.url}`);

  return targetPullRequest;
}

/*
 * Returns the name of the backport branch without remote name
 *
 * Examples:
 * For a single PR: `backport/7.x/pr-1234`
 * For a single commit: `backport/7.x/commit-abcdef`
 * For multiple: `backport/7.x/pr-1234_commit-abcdef`
 */
function getBackportBranchName(targetBranch: string, commits: Commit[]) {
  const refValues = commits
    .map((commit) =>
      commit.sourcePullRequest
        ? `pr-${commit.sourcePullRequest.number}`
        : `commit-${getShortSha(commit.sourceCommit.sha)}`
    )
    .join('_')
    .slice(0, 200);
  return `backport/${targetBranch}/${refValues}`;
}

async function waitForCherrypick(
  options: ValidConfigOptions,
  commit: Commit,
  targetBranch: string,
  gitConfigAuthor?: GitConfigAuthor
) {
  const spinnerText = `Cherry-picking: ${chalk.greenBright(
    getFirstLine(commit.sourceCommit.message)
  )}`;

  const mergedTargetPullRequest = commit.expectedTargetPullRequests.find(
    (pr) => pr.state === 'MERGED' && pr.branch === targetBranch
  );

  const cherrypickSpinner = ora(options.ci, spinnerText).start();

  let conflictingFiles: ConflictingFiles;
  let unstagedFiles: string[];
  let needsResolving: boolean;

  const commitAuthor = getCommitAuthor({
    options,
    gitConfigAuthor,
    commit,
  });

  try {
    await fetchBranch(options, commit.sourceBranch);

    ({ conflictingFiles, unstagedFiles, needsResolving } = await cherrypick({
      options,
      sha: commit.sourceCommit.sha,
      mergedTargetPullRequest,
      commitAuthor,
    }));

    // no conflicts encountered
    if (!needsResolving) {
      cherrypickSpinner.succeed();
      return;
    }
    // cherrypick failed due to conflicts
    cherrypickSpinner.fail();
  } catch (e) {
    cherrypickSpinner.fail();
    throw e;
  }

  const repoPath = getRepoPath(options);

  // resolve conflicts automatically
  if (options.autoFixConflicts) {
    const autoResolveSpinner = ora(
      options.ci,
      'Attempting to resolve conflicts automatically'
    ).start();

    const didAutoFix = await options.autoFixConflicts({
      files: conflictingFiles.map((f) => f.absolute),
      directory: repoPath,
      logger,
      targetBranch,
    });

    // conflicts were automatically resolved
    if (didAutoFix) {
      autoResolveSpinner.succeed();
      return;
    }
    autoResolveSpinner.fail();
  }

  const conflictingFilesRelative = conflictingFiles
    .map((f) => f.relative)
    .slice(0, 50);

  const commitsWithoutBackports = await getCommitsWithoutBackports({
    options,
    commit,
    targetBranch,
    conflictingFiles: conflictingFilesRelative,
  });

  if (options.ci) {
    throw new HandledError({
      code: 'merge-conflict-exception',
      commitsWithoutBackports,
      conflictingFiles: conflictingFilesRelative,
    });
  }

  consoleLog(
    chalk.bold('\nThe commit could not be backported due to conflicts\n')
  );
  consoleLog(`Please fix the conflicts in ${repoPath}`);

  if (commitsWithoutBackports.length > 0) {
    consoleLog(
      chalk.italic(
        `Hint: Before fixing the conflicts manually you should consider backporting the following pull requests to "${targetBranch}":`
      )
    );

    consoleLog(
      `${commitsWithoutBackports.map((c) => c.formatted).join('\n')}\n\n`
    );
  }

  /*
   * Commit could not be cleanly cherrypicked: Initiating conflict resolution
   */

  if (options.editor) {
    await spawnPromise(options.editor, [repoPath], options.cwd);
  }

  // list files with conflict markers + unstaged files and require user to resolve them
  await listConflictingAndUnstagedFiles({
    retries: 0,
    options,
    conflictingFiles: conflictingFiles.map((f) => f.absolute),
    unstagedFiles,
  });

  // Conflicts should be resolved and files staged at this point
  const stagingSpinner = ora(options.ci, `Finalizing cherrypick`).start();
  try {
    // Run `git commit`
    await commitChanges(commit, options);
    stagingSpinner.succeed();
  } catch (e) {
    stagingSpinner.fail();
    throw e;
  }
}

async function listConflictingAndUnstagedFiles({
  retries,
  options,
  conflictingFiles,
  unstagedFiles,
}: {
  retries: number;
  options: ValidConfigOptions;
  conflictingFiles: string[];
  unstagedFiles: string[];
}): Promise<void> {
  const hasUnstagedFiles = !isEmpty(
    difference(unstagedFiles, conflictingFiles)
  );
  const hasConflictingFiles = !isEmpty(conflictingFiles);

  if (!hasConflictingFiles && !hasUnstagedFiles) {
    return;
  }

  // add divider between prompts
  if (retries > 0) {
    consoleLog('\n----------------------------------------\n');
  }

  const header = chalk.reset(`Fix the following conflicts manually:`);

  // show conflict section if there are conflicting files
  const conflictSection = hasConflictingFiles
    ? `Conflicting files:\n${chalk.reset(
        conflictingFiles.map((file) => ` - ${file}`).join('\n')
      )}`
    : '';

  const unstagedSection = hasUnstagedFiles
    ? `Unstaged files:\n${chalk.reset(
        unstagedFiles.map((file) => ` - ${file}`).join('\n')
      )}`
    : '';

  const didConfirm = await confirmPrompt(`${header}

${conflictSection}
${unstagedSection}

Press ENTER when the conflicts are resolved and files are staged`);

  if (!didConfirm) {
    throw new HandledError({ code: 'abort-exception' });
  }

  const MAX_RETRIES = 100;
  if (retries++ > MAX_RETRIES) {
    throw new Error(`Maximum number of retries (${MAX_RETRIES}) exceeded`);
  }

  const [_conflictingFiles, _unstagedFiles] = await Promise.all([
    getConflictingFiles(options),
    getUnstagedFiles(options),
  ]);

  await listConflictingAndUnstagedFiles({
    retries,
    options,
    conflictingFiles: _conflictingFiles.map((file) => file.absolute),
    unstagedFiles: _unstagedFiles,
  });
}

function getCommitAuthor({
  options,
  gitConfigAuthor,
  commit,
}: {
  options: ValidConfigOptions;
  gitConfigAuthor?: GitConfigAuthor;
  commit: Commit;
}) {
  if (options.resetAuthor) {
    return {
      name: options.authenticatedUsername,
      email: `<${options.authenticatedUsername}@users.noreply.github.com>`,
    };
  }

  return {
    name: options.gitAuthorName ?? gitConfigAuthor?.name ?? commit.author.name,
    email:
      options.gitAuthorEmail ?? gitConfigAuthor?.email ?? commit.author.email,
  };
}
