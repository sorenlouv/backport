import chalk from 'chalk';
import { isEmpty, difference, flatten } from 'lodash';
import { ValidConfigOptions } from '../options/options';
import { BackportError } from './BackportError';
import { CommitAuthor, getCommitAuthor } from './author';
import { spawnPromise } from './child-process-promisified';
import { getRepoPath } from './env';
import { getCommitsWithoutBackports } from './getCommitsWithoutBackports';
import {
  cherrypick,
  createBackportBranch,
  deleteBackportBranch,
  pushBackportBranch,
  getUnstagedFiles,
  commitChanges,
  getConflictingFiles,
  getRepoForkOwner,
  ConflictingFiles,
  getIsMergeCommit,
  getShasInMergeCommit,
} from './git';
import { getFirstLine, getShortSha } from './github/commitFormatters';
import { addAssigneesToPullRequest } from './github/v3/addAssigneesToPullRequest';
import { addLabelsToPullRequest } from './github/v3/addLabelsToPullRequest';
import { addReviewersToPullRequest } from './github/v3/addReviewersToPullRequest';
import {
  createPullRequest,
  getTitle,
  getPullRequestBody,
  PullRequestPayload,
} from './github/v3/createPullRequest';
import { enablePullRequestAutoMerge } from './github/v4/enablePullRequestAutoMerge';
import { fetchCommitBySha } from './github/v4/fetchCommits/fetchCommitBySha';
import { validateTargetBranch } from './github/v4/validateTargetBranch';
import { consoleLog, logger } from './logger';
import { ora, Ora } from './ora';
import { confirmPrompt } from './prompts';
import { sequentially } from './sequentially';
import { Commit } from './sourceCommit/parseSourceCommit';

function getSourceBranchFromCommits(commits: Commit[]) {
  // sourceBranch should be the same for all commits, so picking `sourceBranch` from the first commit should be fine 🤞
  // this is specifically needed when backporting a PR like `backport --pr 123` and the source PR was merged to a non-default (aka non-master) branch.
  const { sourceBranch } = commits[0];
  return sourceBranch;
}

export async function cherrypickAndCreateTargetPullRequest({
  options,
  commits,
  targetBranch,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranch: string;
}): Promise<{ url: string; number: number; didUpdate: boolean }> {
  const backportBranch = getBackportBranchName(targetBranch, commits);
  const repoForkOwner = getRepoForkOwner(options);
  consoleLog(`\n${chalk.bold(`Backporting to ${targetBranch}:`)}`);

  await validateTargetBranch({ ...options, branchName: targetBranch });
  await createBackportBranch({
    options,
    sourceBranch: getSourceBranchFromCommits(commits),
    targetBranch,
    backportBranch,
  });

  const commitsFlattened = flatten(
    await Promise.all(commits.map((c) => getMergeCommits(options, c)))
  );

  await sequentially(commitsFlattened, (commit) =>
    waitForCherrypick(options, commit, targetBranch)
  );

  if (options.dryRun) {
    ora(options.interactive).succeed('Dry run complete');
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

async function getMergeCommits(
  options: ValidConfigOptions,
  commit: Commit
): Promise<Commit[]> {
  const { sha } = commit.sourceCommit;
  if (!options.mainline) {
    const isMergeCommit = await getIsMergeCommit(options, sha);
    if (isMergeCommit) {
      const shas = await getShasInMergeCommit(options, sha);
      return Promise.all(
        shas.reverse().map((sha) => fetchCommitBySha({ ...options, sha }))
      );
    }
  }

  return [commit];
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
  targetBranch: string
) {
  const spinnerText = `Cherry-picking: ${chalk.greenBright(
    getFirstLine(commit.sourceCommit.message)
  )}`;
  const cherrypickSpinner = ora(options.interactive, spinnerText).start();
  const commitAuthor = getCommitAuthor({ options, commit });

  await cherrypickAndHandleConflicts({
    options,
    commit,
    commitAuthor,
    targetBranch,
    cherrypickSpinner,
  });

  // Conflicts should be resolved and files staged at this point

  try {
    // Run `git commit` in case conflicts were not manually committed
    await commitChanges({ options, commit, commitAuthor });
    cherrypickSpinner.succeed();
  } catch (e) {
    cherrypickSpinner.fail();
    throw e;
  }
}

async function cherrypickAndHandleConflicts({
  options,
  commit,
  commitAuthor,
  targetBranch,
  cherrypickSpinner,
}: {
  options: ValidConfigOptions;
  commit: Commit;
  commitAuthor: CommitAuthor;
  targetBranch: string;
  cherrypickSpinner: Ora;
}) {
  const mergedTargetPullRequest = commit.pullRequestStates.find(
    (pr) => pr.state === 'MERGED' && pr.branch === targetBranch
  );

  let conflictingFiles: ConflictingFiles;
  let unstagedFiles: string[];
  let needsResolving: boolean;

  try {
    ({ conflictingFiles, unstagedFiles, needsResolving } = await cherrypick({
      options,
      sha: commit.sourceCommit.sha,
      mergedTargetPullRequest,
      commitAuthor,
    }));

    // no conflicts encountered
    if (!needsResolving) {
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
      options.interactive,
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

  if (!options.interactive) {
    throw new BackportError({
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

  const didConfirm = await confirmPrompt(
    `${header}\n\n${conflictSection}\n${unstagedSection}\n\nPress ENTER when the conflicts are resolved and files are staged`
  );

  if (!didConfirm) {
    throw new BackportError({ code: 'abort-conflict-resolution-exception' });
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
