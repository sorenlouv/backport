import { Octokit } from '@octokit/rest';
import apm from 'elastic-apm-node';
import { ora } from '../../../lib/ora';
import type { ValidConfigOptions } from '../../../options/options';
import { logger } from '../../logger';
import { GithubV4Exception } from '../v4/client/graphqlClient';

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

  const span = apm.startSpan('REST: Request reviewers');

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
  } finally {
    span?.end();
  }
}
