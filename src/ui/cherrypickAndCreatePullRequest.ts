import chalk from 'chalk';
import ora = require('ora');
import { BackportOptions } from '../options/options';
import { CommitSelected } from '../services/github/Commit';
import { addLabelsToPullRequest } from '../services/github/addLabelsToPullRequest';
import {
  cherrypick,
  createFeatureBranch,
  deleteFeatureBranch,
  pushFeatureBranch,
  getRemoteName,
  setCommitAuthor,
  getUnmergedFiles,
  addUnstagedFiles,
  cherrypickContinue,
  getFilesWithConflicts,
} from '../services/git';
import { createPullRequest } from '../services/github/createPullRequest';
import { getRepoPath } from '../services/env';
import { getShortSha } from '../services/github/commitFormatters';
import { consoleLog } from '../services/logger';
import { exec } from '../services/child-process-promisified';
import { sequentially } from '../services/sequentially';
import { withSpinner } from './withSpinner';
import { confirmPrompt } from '../services/prompts';
import { HandledError } from '../services/HandledError';
import dedent = require('dedent');
import isEmpty = require('lodash.isempty');

export async function cherrypickAndCreatePullRequest({
  options,
  commits,
  baseBranch,
}: {
  options: BackportOptions;
  commits: CommitSelected[];
  baseBranch: string;
}) {
  const featureBranch = getFeatureBranchName(baseBranch, commits);
  const commitMessages = commits
    .map((commit) => ` - ${commit.formattedMessage}`)
    .join('\n');
  consoleLog(
    `\n${chalk.bold(
      `Backporting the following commits to ${baseBranch}:`
    )}\n${commitMessages}\n`
  );

  await withSpinner({ text: 'Pulling latest changes' }, () =>
    createFeatureBranch(options, baseBranch, featureBranch)
  );

  await sequentially(commits, (commit) => waitForCherrypick(options, commit));

  if (options.resetAuthor) {
    await withSpinner(
      { text: `Changing author to "${options.username}"` },
      () => setCommitAuthor(options, options.username)
    );
  }

  const headBranchName = getHeadBranchName(options, featureBranch);

  await withSpinner({ text: `Pushing branch "${headBranchName}"` }, () =>
    pushFeatureBranch(options, featureBranch)
  );

  await deleteFeatureBranch(options, featureBranch);

  return withSpinner({ text: 'Creating pull request' }, async (spinner) => {
    const payload = getPullRequestPayload(options, baseBranch, commits);
    const pullRequest = await createPullRequest(options, payload);

    if (options.labels.length > 0) {
      await addLabelsToPullRequest(options, pullRequest.number, options.labels);
    }

    spinner.text = `Created pull request: ${pullRequest.html_url}`;
    return pullRequest;
  });
}

function getFeatureBranchName(baseBranch: string, commits: CommitSelected[]) {
  const refValues = commits
    .map((commit) =>
      commit.pullNumber
        ? `pr-${commit.pullNumber}`
        : `commit-${getShortSha(commit.sha)}`
    )
    .join('_')
    .slice(0, 200);
  return `backport/${baseBranch}/${refValues}`;
}

async function waitForCherrypick(
  options: BackportOptions,
  commit: CommitSelected
) {
  const cherrypickSpinner = ora(
    `Cherry-picking commit ${getShortSha(commit.sha)}`
  ).start();

  try {
    const didCherrypick = await cherrypick(options, commit);
    if (didCherrypick) {
      cherrypickSpinner.succeed();
      return;
    }

    cherrypickSpinner.fail();
  } catch (e) {
    cherrypickSpinner.fail();
    throw e;
  }

  /*
   * Commit could not be cleanly cherrypicked: Initiating conflict resolution
   */

  if (options.editor) {
    const repoPath = getRepoPath(options);
    await exec(`${options.editor} ${repoPath}`, {});
  }

  // list files with conflict markers and require user to resolve them
  await listConflictingFiles(options);

  // list unmerged files and require user to confirm adding+comitting them
  await listUnstagedFiles(options);

  // Conflicts resolved and unstaged files will now be staged and committed
  const stagingSpinner = ora(`Staging and committing files`).start();
  try {
    // add unstaged files
    await addUnstagedFiles(options);

    // Run `cherrypick --continue` (similar to `git commit`)
    await cherrypickContinue(options);
    stagingSpinner.succeed();
  } catch (e) {
    stagingSpinner.fail();
    throw e;
  }
}

async function listConflictingFiles(options: BackportOptions) {
  const checkForConflicts = async (): Promise<void> => {
    const filesWithConflicts = await getFilesWithConflicts(options);

    if (isEmpty(filesWithConflicts)) {
      return;
    }

    consoleLog(''); // linebreak
    const res = await confirmPrompt(
      dedent(`
        ${chalk.reset(`The following files have conflicts:`)}
        ${chalk.reset(filesWithConflicts.join('\n'))}

        ${chalk.reset.italic(
          'You do not need to `git add` or `git commit` the files - simply fix the conflicts.'
        )}

        Press ENTER to continue
      `)
    );
    if (!res) {
      throw new HandledError('Aborted');
    }

    await checkForConflicts();
  };

  await checkForConflicts();
}

async function listUnstagedFiles(options: BackportOptions) {
  const unmergedFiles = await getUnmergedFiles(options);

  if (isEmpty(unmergedFiles)) {
    return;
  }

  consoleLog(''); // linebreak
  const res = await confirmPrompt(
    dedent(`
      ${chalk.reset(`The following files are unstaged:`)}
      ${chalk.reset(unmergedFiles.join('\n'))}

      Press ENTER to stage them
    `)
  );
  if (!res) {
    throw new HandledError('Aborted');
  }
  consoleLog(''); // linebreak
}

function getPullRequestTitle(
  baseBranch: string,
  commits: CommitSelected[],
  prTitle: string
) {
  const commitMessages = commits
    .map((commit) => commit.formattedMessage)
    .join(' | ');
  return prTitle
    .replace('{baseBranch}', baseBranch)
    .replace('{commitMessages}', commitMessages)
    .slice(0, 240);
}

function getHeadBranchName(options: BackportOptions, featureBranch: string) {
  const remoteName = getRemoteName(options);
  return `${remoteName}:${featureBranch}`;
}

function getPullRequestPayload(
  options: BackportOptions,
  baseBranch: string,
  commits: CommitSelected[]
) {
  const { prDescription, prTitle } = options;
  const featureBranch = getFeatureBranchName(baseBranch, commits);
  const commitMessages = commits
    .map((commit) => ` - ${commit.formattedMessage}`)
    .join('\n');
  const bodySuffix = prDescription ? `\n\n${prDescription}` : '';

  return {
    title: getPullRequestTitle(baseBranch, commits, prTitle),
    body: `Backports the following commits to ${baseBranch}:\n${commitMessages}${bodySuffix}`,
    head: getHeadBranchName(options, featureBranch),
    base: baseBranch,
  };
}
