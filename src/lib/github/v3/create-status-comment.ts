import type { BackportResponse } from '../../../backport-run.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import { getPackageVersion } from '../../../utils/package-version.js';
import { logger, redactGithubToken } from '../../logger.js';
import { getFirstLine } from '../commit-formatters.js';
import { createOctokitClient, retryOctokitRequest } from './octokit-client.js';

export async function createStatusComment({
  options,
  backportResponse,
}: {
  options: ValidConfigOptions;
  backportResponse: BackportResponse;
}): Promise<void> {
  const { githubApiBaseUrlV3, repoName, repoOwner, githubToken } = options;

  try {
    const octokit = createOctokitClient({ githubToken, githubApiBaseUrlV3 });

    await Promise.all(
      backportResponse.commits
        .filter((commit) => commit.sourcePullRequest)
        .map((commit) => {
          const body = getCommentBody({
            options,
            pullNumber: commit.sourcePullRequest!.number,
            backportResponse,
          });

          // only post comment if there is a body
          if (!body) {
            return Promise.resolve();
          }

          return retryOctokitRequest(() =>
            octokit.issues.createComment({
              baseUrl: githubApiBaseUrlV3,
              owner: repoOwner,
              repo: repoName,
              issue_number: commit.sourcePullRequest!.number,
              body: redactGithubToken(body),
            }),
          );
        }),
    );
  } catch (error) {
    logger.error(`Could not create status comment `, error);
  }
}

export function getCommentBody({
  options,
  pullNumber,
  backportResponse,
}: {
  options: ValidConfigOptions;
  pullNumber: number;
  backportResponse: BackportResponse;
}): string | undefined {
  const {
    repoName,
    repoOwner,
    autoMerge,
    isRepoPrivate,
    noUnmergedBackportsHelp,
    publishStatusCommentOnAbort,
    publishStatusCommentOnFailure,
    publishStatusCommentOnSuccess,
  } = options;

  const { results } = backportResponse;

  const isAborted = results.some(
    (r) => r.status === 'error' && r.errorCode === 'no-branches-exception',
  );
  const didAllBackportsSucceed =
    results.length > 0 && results.every((r) => r.status === 'success');
  const didAllBackportsFail =
    !isAborted &&
    results.length > 0 &&
    results.every((r) => r.status !== 'success');
  const isPreLoopError =
    !isAborted &&
    results.length === 1 &&
    results[0].status === 'error' &&
    !results[0].targetBranch;

  if (
    options.dryRun ||
    (!publishStatusCommentOnFailure &&
      !publishStatusCommentOnSuccess &&
      !publishStatusCommentOnAbort) ||
    (didAllBackportsSucceed && !publishStatusCommentOnSuccess) ||
    ((didAllBackportsFail || isPreLoopError) &&
      !publishStatusCommentOnFailure) ||
    (isAborted && !publishStatusCommentOnAbort)
  ) {
    return;
  }

  const packageVersionSection = `\n<!--- Backport version: ${getPackageVersion()} -->`;
  const manualBackportCommand = `\n### Manual backport\nTo create the backport manually run:\n\`\`\`\n${options.backportBinary} --pr ${pullNumber}\n\`\`\`\n`;

  const linkToGithubActionLogs = options.githubActionRunId
    ? ` and see the [Github Action logs](https://github.com/${repoOwner}/${repoName}/actions/runs/${options.githubActionRunId}) for details`
    : '';
  const questionsAndLinkToBackport = `\n### Questions ?\nPlease refer to the [Backport tool documentation](https://github.com/sorenlouv/backport)${linkToGithubActionLogs}\n`;

  if (isAborted) {
    return `## ⚪ Backport skipped
The pull request was not backported as there were no branches to backport to. If this is a mistake, please apply the desired version labels or run the backport tool manually.
${manualBackportCommand}${questionsAndLinkToBackport}${packageVersionSection}`;
  }

  if (isPreLoopError && results[0].status === 'error') {
    const errorMessage = results[0].errorMessage;
    return `## 💔 Backport failed
The pull request could not be backported due to the following error:
\`${errorMessage}\`
${manualBackportCommand}${questionsAndLinkToBackport}${packageVersionSection}`;
  }

  const tableBody = results
    .map((result) => {
      if (result.status === 'success') {
        const prShield = `[<img src="https://img.shields.io/github/pulls/detail/state/${repoOwner}/${repoName}/${result.pullRequestNumber}">](${result.pullRequestUrl})`;

        return [
          '✅',
          result.targetBranch,
          isRepoPrivate ? result.pullRequestUrl : prShield,
        ];
      }

      if (
        result.errorCode === 'merge-conflict-exception' &&
        result.errorContext?.code === 'merge-conflict-exception'
      ) {
        const unmergedBackports =
          result.errorContext.commitsWithoutBackports.map((c) => {
            const msg = getFirstLine(c.commit.sourceCommit.message);
            const msgEscaped = msg.replaceAll('|', String.raw`\|`);
            return ` - [${msgEscaped}](${c.commit.sourcePullRequest?.url})`;
          });

        const unmergedBackportsSection =
          unmergedBackports.length > 0
            ? `<br><br>You might need to backport the following PRs to ${
                result.targetBranch
              }:<br>${unmergedBackports.join('<br>')}`
            : undefined;

        const backportFailedLabel =
          'Backport failed because of merge conflicts';

        return [
          '❌',
          result.targetBranch,
          unmergedBackportsSection && !noUnmergedBackportsHelp
            ? `**${backportFailedLabel}**${unmergedBackportsSection}`
            : backportFailedLabel,
        ];
      }

      const message =
        result.errorCode === 'unhandled-exception'
          ? 'An unhandled error occurred. Please see the logs for details'
          : result.errorMessage;
      return ['❌', result.targetBranch, message];
    })
    .map((line) => line.join('|'))
    .join('|\n|');

  const table =
    results.length > 0
      ? `\n\n| Status | Branch | Result |\n|:------:|:------:|:------|\n|${tableBody}|\n`
      : '';

  const didAnyBackportsSucceed = results.some((r) => r.status === 'success');

  const header = didAllBackportsSucceed
    ? '## 💚 All backports created successfully'
    : didAnyBackportsSucceed
      ? '## 💔 Some backports could not be created'
      : '## 💔 All backports failed';

  const autoMergeMessage =
    autoMerge && didAnyBackportsSucceed
      ? '\nNote: Successful backport PRs will be merged automatically after passing CI.\n'
      : '';

  const backportPRCommandMessage = didAllBackportsSucceed
    ? ''
    : `${manualBackportCommand}`;

  return `${header}${table}${autoMergeMessage}${backportPRCommandMessage}${questionsAndLinkToBackport}${packageVersionSection}`;
}
