import { Octokit } from '@octokit/rest';
import { ora } from '../../../lib/ora.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import { logger } from '../../logger.js';
import { GithubV4Exception } from '../v4/client/graphql-client.js';

export async function addReviewersToPullRequest(
  {
    githubApiBaseUrlV3,
    repoName,
    repoOwner,
    accessToken,
    interactive,
    dryRun,
  }: ValidConfigOptions,
  pullNumber: number,
  reviewers: string[],
) {
  const text = `Adding reviewers: ${reviewers}`;
  logger.info(text);
  const spinner = ora(interactive, text).start();

  if (dryRun) {
    spinner.succeed();
    return;
  }

  try {
    const octokit = new Octokit({
      auth: accessToken,
      baseUrl: githubApiBaseUrlV3,
      log: logger,
    });

    await octokit.pulls.requestReviewers({
      owner: repoOwner,
      repo: repoName,
      pull_number: pullNumber,
      reviewers,
    });

    spinner.succeed();
  } catch (e) {
    const message =
      e instanceof GithubV4Exception
        ? e.result?.data?.message
        : e instanceof Error
          ? e.message
          : '';

    spinner.fail(`Adding reviewers. ${message}`);
    logger.error(`Could not add reviewers to PR ${pullNumber}`, e);
  }
}
