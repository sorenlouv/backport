import { checkbox, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { repeat, isEmpty } from 'lodash-es';
import terminalLink from 'terminal-link';
import type { TargetBranchChoice } from '../options/config-options.js';
import {
  stripPullNumber,
  getFirstLine,
  getShortSha,
} from './github/commit-formatters.js';
import type { TargetPullRequest } from './sourceCommit/get-pull-request-states.js';
import type { Commit } from './sourceCommit/parse-source-commit.js';

function getPrStateIcon(state: TargetPullRequest['state']) {
  if (state === 'MERGED') {
    return '🟢';
  }

  if (state === 'NOT_CREATED') {
    return '🔴';
  }

  if (state === 'OPEN') {
    return '🔵';
  }

  // unknown state
  return '🔴';
}

function getPrStateText(state: TargetPullRequest['state']) {
  if (state === 'MERGED') {
    return chalk.gray('Merged');
  }

  if (state === 'NOT_CREATED') {
    return chalk.gray('Backport not created');
  }

  if (state === 'OPEN') {
    return chalk.gray('Open, not merged');
  }

  return chalk.gray('Unknown state');
}

function getPrLink(number?: number, url?: string) {
  return url ? `(${terminalLink(`#${number}`, url)})` : '';
}

function getDetailedPullStatus(c: Commit) {
  const items = c.targetPullRequestStates
    .filter(({ isSourceBranch }) => !isSourceBranch)
    .map((pr) => {
      const prLink = getPrLink(pr.number, pr.url);
      return `     └ ${getPrStateIcon(pr.state)} ${
        pr.branch
      } ${prLink} ${getPrStateText(pr.state)}`;
    });

  const list =
    items.length > 0
      ? `\n${chalk.reset(items.join('\n'))}`
      : `\n     └ ${chalk.gray('No backports expected')}`;

  return `${list}\n`;
}

function getSimplePullStatus(c: Commit) {
  return c.targetPullRequestStates
    .filter(({ isSourceBranch }) => !isSourceBranch)
    .map(({ state, branch }) => {
      if (state === 'MERGED') {
        return chalk.green(branch);
      }

      if (state === 'NOT_CREATED') {
        return chalk.red(branch);
      }

      if (state === 'OPEN') {
        return chalk.gray(branch);
      }

      return chalk.gray('Unknown state');
    })
    .join(', ');
}

export function getChoicesForCommitPrompt(
  commits: Commit[],
  showDetails: boolean,
) {
  return commits.map((c, i) => {
    const leadingWhitespace = repeat(' ', 2 - (i + 1).toString().length);
    const position = chalk.gray(`${i + 1}.${leadingWhitespace}`);

    let name;
    if (showDetails) {
      const message = stripPullNumber(c.sourceCommit.message);
      const prLink = c.sourcePullRequest
        ? ` ` + getPrLink(c.sourcePullRequest.number, c.sourcePullRequest.url)
        : '';
      const pullStatus = getDetailedPullStatus(c);
      name = `${position}${message}${prLink}${pullStatus}`;
    } else {
      const message = getFirstLine(c.sourceCommit.message);
      const pullStatus = getSimplePullStatus(c);
      name = `${position}${message} ${pullStatus}`;
    }

    const short = c.sourcePullRequest?.mergeCommit
      ? `#${c.sourcePullRequest.number} (${getShortSha(
          c.sourcePullRequest.mergeCommit.sha,
        )})`
      : getShortSha(c.sourceCommit.sha);

    return { name, short, value: c };
  });
}

export async function promptForCommits({
  commitChoices,
  isMultipleChoice,
  showDetails,
}: {
  commitChoices: Commit[];
  isMultipleChoice: boolean;
  showDetails: boolean;
}): Promise<Commit[]> {
  const choices = getChoicesForCommitPrompt(commitChoices, showDetails);

  const res = isMultipleChoice
    ? await checkbox<Commit>({
        loop: false,
        pageSize: 30,
        choices,
        message: 'Select commit',
      })
    : await select<Commit>({
        loop: false,
        pageSize: 30,
        choices,
        message: 'Select commit',
      });

  const selectedCommits = Array.isArray(res) ? res.reverse() : [res];
  return isEmpty(selectedCommits)
    ? promptForCommits({ commitChoices, isMultipleChoice, showDetails })
    : selectedCommits;
}

export async function promptForTargetBranches({
  targetBranchChoices,
  isMultipleChoice,
}: {
  targetBranchChoices: TargetBranchChoice[];
  isMultipleChoice: boolean;
}): Promise<string[]> {
  const res = isMultipleChoice
    ? await checkbox<string>({
        loop: false,
        pageSize: 15,
        choices: targetBranchChoices,
        message: 'Select branch',
      })
    : await select<string>({
        loop: false,
        pageSize: 15,
        choices: targetBranchChoices,
        message: 'Select branch',
      });

  const selectedBranches = Array.isArray(res) ? res : [res];

  return isEmpty(selectedBranches)
    ? promptForTargetBranches({
        targetBranchChoices,
        isMultipleChoice,
      })
    : selectedBranches;
}

export function confirmPrompt(message: string) {
  return confirm({ message });
}
