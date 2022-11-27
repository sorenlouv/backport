import { Octokit } from '@octokit/rest';
import { uniq } from 'lodash';
import { ora } from '../../../lib/ora';
import { ValidConfigOptions } from '../../../options/options';
import { logger } from '../../logger';
import { addReviewersToPullRequest } from './addReviewersToPullRequest';

export async function addOriginalReviewersToPullRequest(
  options: ValidConfigOptions,
  pullNumber: number
) {
  const {
    githubApiBaseUrlV3,
    repoName,
    repoOwner,
    accessToken,
    interactive,
    pullNumber: originalPullNumbers,
  } = options;
  const text = `Retriving original reviewers`;
  const spinnerList = ora(interactive, text).start();

  const reviewers = new Array<string>();
  let author: string | undefined;

  try {
    const octokit = new Octokit({
      auth: accessToken,
      baseUrl: githubApiBaseUrlV3,
      log: logger,
    });

    const pullIds = Array.isArray(originalPullNumbers)
      ? originalPullNumbers
      : originalPullNumbers
      ? [originalPullNumbers]
      : [];

    const targetPull = await octokit.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: pullNumber,
    });

    author = targetPull.data.user?.login;

    for (const pullId of pullIds) {
      const reviews = await octokit.pulls.listReviews({
        owner: repoOwner,
        repo: repoName,
        pull_number: pullId,
      });

      const reviewersOfPull = reviews.data
        .map((review) => review.user?.login)
        .filter((login) => !!login) as string[];

      reviewers.push(...reviewersOfPull);
    }
    spinnerList.succeed();
  } catch (e) {
    //@ts-expect-error
    const message = e.response?.data?.message;
    spinnerList.fail(`Retriving original reviewers. ${message ? message : ''}`);
    logger.error(
      `Could retrieve original reviewers of PRs ${originalPullNumbers}`,
      e
    );
    return;
  }

  const filteredReviewers = reviewers.filter((login) => login !== author);

  if (!filteredReviewers.length) {
    return;
  }

  addReviewersToPullRequest(options, pullNumber, uniq(filteredReviewers));
}
