import { Octokit } from '@octokit/rest';
import { BackportResponse } from '../../../main';
import { ValidConfigOptions } from '../../../options/options';
import { logger } from '../../logger';

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

    // don't post update if there are no new pull requests created
    if (backportResponse.status === 'success') {
      const hasOnlyUpdates = backportResponse.results.every(
        (result) => result.status === 'success' && result.didUpdate
      );

      if (hasOnlyUpdates) {
        return;
      }
    }

    await Promise.all(
      backportResponse.commits.map((commit) => {
        if (!commit.pullNumber) {
          return;
        }

        const body = getCommentFromResponse({
          options,
          pullNumber: commit.pullNumber,
          backportResponse,
        });

        return octokit.issues.createComment({
          owner: repoOwner,
          repo: repoName,
          issue_number: commit.pullNumber,
          body,
        });
      })
    );
  } catch (e) {
    logger.info(`Could not create status comment `, e.stack);
  }
}

export function getCommentFromResponse({
  options,
  pullNumber,
  backportResponse,
}: {
  options: ValidConfigOptions;
  pullNumber: number;
  backportResponse: BackportResponse;
}): string {
  const { repoName, repoOwner, autoMerge } = options;
  const backportPRCommand = `To backport manually run: \`node scripts/backport --pr ${pullNumber}\`.\n\nFor more info read the [Backport documentation](https://github.com/sqren/backport#backport)`;

  if (backportResponse.status === 'failure') {
    return `## 💔 Backport failed
The pull request could not be backported due to the following error:
\`${backportResponse.errorMessage}\`

${backportPRCommand}
`;
  }

  const tableHeader = `| Status | Branch | Result |\n|:------:|:------:|:------:|\n`;
  const tableBody = backportResponse.results
    .map((result) => {
      if (result.status === 'success') {
        return `| ✅ |  [${result.targetBranch}](${result.pullRequestUrl})  | [<img src="https://img.shields.io/github/pulls/detail/state/${repoOwner}/${repoName}/${result.pullRequestNumber}">](${result.pullRequestUrl}) |`;
      }

      return `| ❌ |  ${result.targetBranch}  | ${result.errorMessage} |`;
    })
    .join('\n');

  const table = backportResponse.results.length ? tableHeader + tableBody : '';

  const didAllBackportsSucceed = backportResponse.results.every(
    (r) => r.status === 'success'
  );

  const header = didAllBackportsSucceed
    ? '## 💚 All backports created successfully'
    : '## 💔 Some backports could not be created';

  const autoMergeMessage = autoMerge
    ? 'Successful backport PRs will be merged automatically after passing CI.'
    : '';

  const backportPRCommandMessage = !didAllBackportsSucceed
    ? backportPRCommand
    : '';

  return `${header}\n${table}\n${autoMergeMessage}${backportPRCommandMessage}`;
}
