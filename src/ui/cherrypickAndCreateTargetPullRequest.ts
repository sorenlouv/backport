import { Octokit } from '@octokit/rest';
import chalk from 'chalk';
import { backportPullRequest } from 'github-backport';
import difference from 'lodash.difference';
import isEmpty from 'lodash.isempty';
import ora = require('ora');
import { BackportOptions } from '../options/options';
import { HandledError } from '../services/HandledError';
import { exec } from '../services/child-process-promisified';
import { getRepoPath } from '../services/env';
import {
  cherrypick,
  createBackportBranch,
  deleteBackportBranch,
  pushBackportBranch,
  setCommitAuthor,
  getUnstagedFiles,
  finalizeCherrypick,
  getConflictingFiles,
  getRepoForkOwner,
} from '../services/git';
import { getShortSha } from '../services/github/commitFormatters';
import { addAssigneesToPullRequest } from '../services/github/v3/addAssigneesToPullRequest';
import { addLabelsToPullRequest } from '../services/github/v3/addLabelsToPullRequest';
import {
  createPullRequest,
  getTitle,
  getBody,
  PullRequestPayload,
} from '../services/github/v3/createPullRequest';
import {
  splitHead,
  fetchExistingPullRequest,
} from '../services/github/v4/fetchExistingPullRequest';
import { consoleLog, logger } from '../services/logger';
import { confirmPrompt } from '../services/prompts';
import { sequentially } from '../services/sequentially';
import { CommitSelected } from '../types/Commit';

export async function cherrypickAndCreateTargetPullRequest({
  options,
  commits,
  targetBranch,
}: {
  options: BackportOptions;
  commits: CommitSelected[];
  targetBranch: string;
}) {
  const backportBranch = getBackportBranchName(targetBranch, commits);
  const repoForkOwner = getRepoForkOwner(options);
  consoleLog(`\n${chalk.bold(`Backporting to ${targetBranch}:`)}`);

  const prPayload: PullRequestPayload = {
    owner: options.repoOwner,
    repo: options.repoName,
    title: getTitle({ options, commits, targetBranch }),
    body: getBody({ options, commits, targetBranch }),
    head: `${repoForkOwner}:${backportBranch}`, // eg. sqren:backport/7.x/pr-75007
    base: targetBranch, // eg. 7.x
  };

  const sourcePullNumber =
    commits.length === 1 ? commits[0].pullNumber : undefined;

  // backport using Github API
  const targetPullRequest =
    // fork mode not supported via API
    (options.username === options.repoName || !options.fork) &&
    // only enable for ci mode until fork-mode is supported
    options.ci &&
    // has exactly 1 PR to backport
    sourcePullNumber != undefined &&
    // `autoFixConflicts` is not supported via API
    !options.autoFixConflicts &&
    // `mainline` (merge commits) is not supported via API
    !options.mainline &&
    // `resetAuthor` is not supported via API
    !options.resetAuthor
      ? await backportViaGithubApi({
          options,
          prPayload,
          pullNumber: sourcePullNumber,
        })
      : await backportViaFilesystem({
          options,
          prPayload,
          targetBranch,
          backportBranch,
          commits,
        });

  // add assignees to target pull request
  if (options.assignees.length > 0) {
    await addAssigneesToPullRequest(
      options,
      targetPullRequest.number,
      options.assignees
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

  // add labels to source pull requests
  if (options.sourcePRLabels.length > 0) {
    const promises = commits.map((commit) => {
      if (commit.pullNumber) {
        return addLabelsToPullRequest(
          options,
          commit.pullNumber,
          options.sourcePRLabels
        );
      }
    });
    await Promise.all(promises);
  }

  consoleLog(`View pull request: ${targetPullRequest.url}`);

  return targetPullRequest;
}

async function backportViaGithubApi({
  options,
  prPayload,
  pullNumber,
}: {
  options: BackportOptions;
  prPayload: PullRequestPayload;
  pullNumber: number;
}) {
  logger.info('Backporting via api');

  const spinner = ora(`Performing backport via Github API...`).start();

  const octokit = new Octokit({
    auth: options.accessToken,
    baseUrl: options.githubApiBaseUrlV3,
    log: logger,
  });

  let number;
  try {
    const { head } = splitHead(prPayload);
    number = await backportPullRequest({
      octokit,
      pullRequestNumber: pullNumber,
      ...prPayload,
      head,
    });
    spinner.succeed();
  } catch (e) {
    spinner.fail();

    // PR already exists
    if (
      e.name === 'HttpError' &&
      e.message.includes('Reference already exists')
    ) {
      const res = await fetchExistingPullRequest({ options, prPayload });
      throw new HandledError(`Pull request already exists: ${res?.url}`);
    }

    // merge conflict
    if (e.message.includes('could not be cherry-picked on top of')) {
      throw new HandledError(
        'Commit could not be cherrypicked due to conflicts'
      );
    }

    throw e;
  }

  const url = `https://github.com/${options.repoOwner}/${options.repoName}/pull/${number}`;
  return { number, url };
}

async function backportViaFilesystem({
  options,
  prPayload,
  commits,
  targetBranch,
  backportBranch,
}: {
  options: BackportOptions;
  prPayload: PullRequestPayload;
  commits: CommitSelected[];
  targetBranch: string;
  backportBranch: string;
}) {
  logger.info('Backporting via filesystem');

  await createBackportBranch({ options, targetBranch, backportBranch });

  await sequentially(commits, (commit) =>
    waitForCherrypick(options, commit, targetBranch)
  );

  if (options.resetAuthor) {
    await setCommitAuthor(options, options.username);
  }

  await pushBackportBranch({ options, backportBranch });
  await deleteBackportBranch({ options, backportBranch });
  return createPullRequest({ options, prPayload });
}

/*
 * Returns the name of the backport branch without remote name
 *
 * Examples:
 * For a single PR: `backport/7.x/pr-1234`
 * For a single commit: `backport/7.x/commit-abcdef`
 * For multiple: `backport/7.x/pr-1234_commit-abcdef`
 */
export function getBackportBranchName(
  targetBranch: string,
  commits: CommitSelected[]
) {
  const refValues = commits
    .map((commit) =>
      commit.pullNumber
        ? `pr-${commit.pullNumber}`
        : `commit-${getShortSha(commit.sha)}`
    )
    .join('_')
    .slice(0, 200);
  return `backport/${targetBranch}/${refValues}`;
}

async function waitForCherrypick(
  options: BackportOptions,
  commit: CommitSelected,
  targetBranch: string
) {
  const spinnerText = `Cherry-picking: ${chalk.greenBright(
    commit.formattedMessage
  )}`;
  const cherrypickSpinner = ora(spinnerText).start();

  if (options.dryRun) {
    cherrypickSpinner.succeed(`Dry run: ${spinnerText}`);
    return;
  }

  try {
    const { needsResolving } = await cherrypick(options, commit);

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

  // resolve conflicts automatically
  if (options.autoFixConflicts) {
    const autoResolveSpinner = ora(
      'Attempting to resolve conflicts automatically'
    ).start();

    const filesWithConflicts = await getConflictingFiles(options);
    const repoPath = getRepoPath(options);
    const didAutoFix = await options.autoFixConflicts({
      files: filesWithConflicts,
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

  if (options.ci) {
    throw new HandledError('Commit could not be cherrypicked due to conflicts');
  }

  /*
   * Commit could not be cleanly cherrypicked: Initiating conflict resolution
   */

  if (options.editor) {
    const repoPath = getRepoPath(options);
    await exec(`${options.editor} ${repoPath}`, {});
  }

  // list files with conflict markers + unstaged files and require user to resolve them
  await listConflictingAndUnstagedFiles(options);

  // Conflicts should be resolved and files staged at this point
  const stagingSpinner = ora(`Finalizing cherrypick`).start();
  try {
    // Run `git commit`
    await finalizeCherrypick(options);
    stagingSpinner.succeed();
  } catch (e) {
    stagingSpinner.fail();
    throw e;
  }
}

async function listConflictingAndUnstagedFiles(options: BackportOptions) {
  const checkForProblems = async (retries = 0): Promise<void> => {
    const [conflictingFiles, _unstagedFiles] = await Promise.all([
      getConflictingFiles(options),
      getUnstagedFiles(options),
    ]);

    const unstagedFiles = difference(_unstagedFiles, conflictingFiles);
    const hasConflictingFiles = !isEmpty(conflictingFiles);
    const hasUnstagedFiles = !isEmpty(unstagedFiles);

    if (!hasConflictingFiles && !hasUnstagedFiles) {
      return;
    }

    // add divider between prompts
    if (retries > 0) {
      consoleLog('\n----------------------------------------\n');
    }

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

    const res = await confirmPrompt(`${chalk.reset(
      `Please fix the issues in: ${getRepoPath(options)}`
    )}

${conflictSection}
${unstagedSection}

Press ENTER when the conflicts are resolved and files are staged`);

    if (!res) {
      throw new HandledError('Aborted');
    }

    const MAX_RETRIES = 100;
    if (retries++ > MAX_RETRIES) {
      throw new Error(`Maximum number of retries (${MAX_RETRIES}) exceeded`);
    }
    await checkForProblems(retries);
  };

  await checkForProblems();
}
