import { Octokit } from '@octokit/rest';
import { BackportResponse } from '../../../backportRun';
import { ValidConfigOptions } from '../../../options/options';
import { PACKAGE_VERSION } from '../../../utils/packageVersion';
import { redact } from '../../../utils/redact';
import { HandledError } from '../../HandledError';
import { logger } from '../../logger';
import { getFirstLine } from '../commitFormatters';

export async function createStatusComment({
  options,
  backportResponse,
}: {
  options: ValidConfigOptions;
  backportResponse: BackportResponse;
}): Promise<void> {
  const {
    githubApiBaseUrlV3,
    repoName,
    repoOwner,
    accessToken,
    publishStatusComment,
  } = options;

  if (!publishStatusComment || options.dryRun) {
    return;
  }

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
          baseUrl: options.githubApiBaseUrlV3,
          owner: repoOwner,
          repo: repoName,
          issue_number: commit.sourcePullRequest.number,
          body: redact(options.accessToken, body),
        });
      })
    );
  } catch (e) {
    logger.info(`Could not create status comment `, e.stack);
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
  const { repoName, repoOwner, autoMerge } = options;

  // custom handling when running backport locally (as opposed to on CI)
  if (!options.ci) {
    // don't post comment when the overall process failed
    if (backportResponse.status === 'failure') {
      return;
    }

    // only post a comment if all backports succeeded
    const didAllBackportsSucceed = backportResponse.results.every(
      (r) => r.status === 'success'
    );

    if (!didAllBackportsSucceed) {
      return;
    }
  }

  const packageVersionSection = `\n<!--- Backport version: ${PACKAGE_VERSION} -->`;
  const manualBackportCommand = `\n### Manual backport\nTo create the backport manually run:\n\`\`\`\n${options.backportBinary} --pr ${pullNumber}\n\`\`\``;
  const questionsAndLinkToBackport =
    '\n\n### Questions ?\nPlease refer to the [Backport tool documentation](https://github.com/sqren/backport)';

  if (backportResponse.status === 'failure') {
    if (
      backportResponse.error instanceof HandledError &&
      backportResponse.error.errorContext.code === 'no-branches-exception'
    ) {
      return `## ⚪ Backport skipped
The pull request was not backported as there were no branches to backport to. If this is a mistake, please apply the desired version labels or run the backport tool manually.
${manualBackportCommand}${questionsAndLinkToBackport}${packageVersionSection}`;
    }

    return `## 💔 Backport failed
The pull request could not be backported due to the following error:
\`${backportResponse.error.message}\`
${manualBackportCommand}${questionsAndLinkToBackport}${packageVersionSection}`;
  }

  const tableBody = backportResponse.results
    .filter((result) => {
      // only post status updates for successful backports when running manually (non-ci)
      return options.ci || result.status === 'success';
    })
    .map((result) => {
      if (result.status === 'success') {
        return [
          '✅',
          result.targetBranch,
          `[<img src="https://img.shields.io/github/pulls/detail/state/${repoOwner}/${repoName}/${result.pullRequestNumber}">](${result.pullRequestUrl})`,
        ];
      }

      if (
        result.error instanceof HandledError &&
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
            : '';

        return [
          '❌',
          result.targetBranch,
          `**Backport failed because of merge conflicts**${unmergedBackportsSection}`,
        ];
      }

      return ['❌', result.targetBranch, result.error.message];
    })
    .map((line) => line.join('|'))
    .join('|\n|');

  const table = backportResponse.results.length
    ? `| Status | Branch | Result |\n|:------:|:------:|:------|\n|${tableBody}|`
    : '';

  const didAllBackportsSucceed = backportResponse.results.every(
    (r) => r.status === 'success'
  );

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
      ? '\nNote: Successful backport PRs will be merged automatically after passing CI.'
      : '';

  const backportPRCommandMessage = !didAllBackportsSucceed
    ? `${manualBackportCommand}`
    : '';

  return `${header}\n\n${table}
${backportPRCommandMessage}${autoMergeMessage}${questionsAndLinkToBackport}${packageVersionSection}`;
}
