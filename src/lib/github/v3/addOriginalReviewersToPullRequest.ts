import { Octokit } from '@octokit/rest';
import { flatten } from 'lodash';
import { ora } from '../../../lib/ora';
import { ValidConfigOptions } from '../../../options/options';
import { filterNil } from '../../../utils/filterEmpty';
import { logger } from '../../logger';
import { Commit } from '../../sourceCommit/parseSourceCommit';
import { addReviewersToPullRequest } from './addReviewersToPullRequest';

export async function addOriginalReviewersToPullRequest(
  options: ValidConfigOptions,
  commits: Commit[],
  pullNumber: number,
) {
  const { githubApiBaseUrlV3, repoName, repoOwner, accessToken, interactive } =
    options;
  const text = `Retrieving original reviewers`;
  const spinner = ora(interactive, text).start();

  try {
    const octokit = new Octokit({
      auth: accessToken,
      baseUrl: githubApiBaseUrlV3,
      log: logger,
    });

    const promises = commits
      .map((commit) => commit.sourcePullRequest?.number)
      .filter(filterNil)
      .map(async (pullNumber) => {
        const reviews = await octokit.pulls.listReviews({
          owner: repoOwner,
          repo: repoName,
          pull_number: pullNumber,
        });

        return reviews.data
          .map((review) => review.user?.login)
          .filter((username) => username !== options.authenticatedUsername)
          .filter(filterNil);
      });

    const reviewers = flatten(await Promise.all(promises));
    await addReviewersToPullRequest(options, pullNumber, reviewers);

    spinner.succeed();
  } catch (e) {
    spinner.fail(`Retrieving original reviewers failed`);
    logger.error(
      `Could mot retrieve original reviewers of PRs ${pullNumber}`,
      e,
    );
    return;
  }
}
