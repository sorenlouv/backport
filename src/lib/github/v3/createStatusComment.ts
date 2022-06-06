import { Octokit } from '@octokit/rest';
import { BackportResponse } from '../../../backportRun';
import { ValidConfigOptions } from '../../../options/options';
import { PACKAGE_VERSION } from '../../../utils/packageVersion';
import { BackportError } from '../../BackportError';
import { logger, redactAccessToken } from '../../logger';
import { getFirstLine } from '../commitFormatters';

export async function createStatusComment({
  options,
  backportResponse,
}: {
  options: ValidConfigOptions;
  backportResponse: BackportResponse;
}): Promise<void> {
  const { githubApiBaseUrlV3, repoName, repoOwner, accessToken } = options;

  try {
    const octokit = new Octokit({
      auth: accessToken,
      baseUrl: githubApiBaseUrlV3,
      log: logger,
    });

    await Promise.all(
      backportResponse.commits.map((commit) => {
        if (!commit.sourcePullRequest) {
          return;
        }

        const body = getCommentBody({
          options,
          pullNumber: commit.sourcePullRequest.number,
          backportResponse,
        });

        // only post comment if there is a body
        if (!body) {
          return;
        }

        return octokit.issues.createComment({
          baseUrl: githubApiBaseUrlV3,
          owner: repoOwner,
          repo: repoName,
          issue_number: commit.sourcePullRequest.number,
          body: redactAccessToken(body),
        });
      })
    );
  } catch (e) {
    logger.error(`Could not create status comment `, e);
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
    publishStatusCommentOnAbort,
    publishStatusCommentOnFailure,
    publishStatusCommentOnSuccess,
  } = options;

  // eg. in addition to `--noStatusComment` add `--noFailureStatusComment` and `--noSuccessStatusComment` where the former will overwrite the two latter

  const didAllBackportsSucceed =
    backportResponse.status === 'success' &&
    backportResponse.results.every((r) => r.status === 'success');

  const didAllBackportsFail =
    backportResponse.status === 'failure' ||
    (backportResponse.status === 'success' &&
      backportResponse.results.every((r) => r.status !== 'success'));

  if (
    // don't publish on dry-run
    options.dryRun ||
    //
    // don't publish comment under any circumstances
    (!publishStatusCommentOnFailure &&
      !publishStatusCommentOnSuccess &&
      !publishStatusCommentOnAbort) ||
    //
    // dont publish comment if all backports suceeded
    (didAllBackportsSucceed && !publishStatusCommentOnSuccess) ||
    //
    // dont publish comment if operation failed or all backports failed
    (didAllBackportsFail && !publishStatusCommentOnFailure) ||
    //
    // dont publish comment if backport was aborted
    (backportResponse.status === 'aborted' && !publishStatusCommentOnAbort)
  ) {
    return;
  }

  const packageVersionSection = `\n<!--- Backport version: ${PACKAGE_VERSION} -->`;
  const manualBackportCommand = `\n### Manual backport\nTo create the backport manually run:\n\`\`\`\n${options.backportBinary} --pr ${pullNumber}\n\`\`\`\n`;
  const questionsAndLinkToBackport =
    '\n### Questions ?\nPlease refer to the [Backport tool documentation](https://github.com/sqren/backport)\n';

  if (
    backportResponse.status === 'aborted' &&
    backportResponse.error.errorContext.code === 'no-branches-exception'
  ) {
    return `## ⚪ Backport skipped
The pull request was not backported as there were no branches to backport to. If this is a mistake, please apply the desired version labels or run the backport tool manually.
${manualBackportCommand}${questionsAndLinkToBackport}${packageVersionSection}`;
  }

  if (backportResponse.status !== 'success') {
    return `## 💔 Backport failed
The pull request could not be backported due to the following error:
\`${backportResponse.error.message}\`
${manualBackportCommand}${questionsAndLinkToBackport}${packageVersionSection}`;
  }

  const tableBody = backportResponse.results
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
        result.error instanceof BackportError &&
        result.error.errorContext.code === 'merge-conflict-exception'
      ) {
        const unmergedBackports =
          result.error.errorContext.commitsWithoutBackports.map((c) => {
            return ` - [${getFirstLine(c.commit.sourceCommit.message)}](${
              c.commit.sourcePullRequest?.url
            })`;
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
          unmergedBackportsSection
            ? `**${backportFailedLabel}**${unmergedBackportsSection}`
            : backportFailedLabel,
        ];
      }

      const message =
        result.status === 'handled-error'
          ? result.error.message
          : 'An unhandled error occurred. Please see the logs for details';
      return ['❌', result.targetBranch, message];
    })
    .map((line) => line.join('|'))
    .join('|\n|');

  const table = backportResponse.results.length
    ? `\n\n| Status | Branch | Result |\n|:------:|:------:|:------|\n|${tableBody}|\n`
    : '';

  const didAnyBackportsSucceed = backportResponse.results.some(
    (r) => r.status === 'success'
  );

  let header = '';
  if (didAllBackportsSucceed) {
    header = '## 💚 All backports created successfully';
  } else if (didAnyBackportsSucceed) {
    header = '## 💔 Some backports could not be created';
  } else {
    header = '## 💔 All backports failed';
  }

  const autoMergeMessage =
    autoMerge && didAnyBackportsSucceed
      ? '\nNote: Successful backport PRs will be merged automatically after passing CI.\n'
      : '';

  const backportPRCommandMessage = !didAllBackportsSucceed
    ? `${manualBackportCommand}`
    : '';

  return `${header}${table}${autoMergeMessage}${backportPRCommandMessage}${questionsAndLinkToBackport}${packageVersionSection}`;
}
