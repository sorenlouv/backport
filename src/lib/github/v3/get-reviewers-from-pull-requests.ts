import { uniq, flatten } from 'lodash-es';
import { filterNil } from '../../../utils/filter-empty.js';
import { logger } from '../../logger.js';
import { ora } from '../../ora.js';
import { createOctokitClient, retryOctokitRequest } from './octokit-client.js';

export async function getReviewersFromPullRequests({
  options,
  pullNumbers,
}: {
  options: {
    githubApiBaseUrlV3?: string;
    repoName: string;
    repoOwner: string;
    accessToken: string;
    interactive: boolean;
    authenticatedUsername: string;
  };
  pullNumbers: number[];
}) {
  const {
    githubApiBaseUrlV3,
    repoName,
    repoOwner,
    accessToken,
    interactive,
    authenticatedUsername,
  } = options;

  const text = `Retrieving original reviewers`;
  const spinner = ora(interactive, text).start();

  const octokit = createOctokitClient({ accessToken, githubApiBaseUrlV3 });

  try {
    const promises = pullNumbers.map(async (pullNumber) => {
      const reviews = await retryOctokitRequest(() =>
        octokit.pulls.listReviews({
          owner: repoOwner,
          repo: repoName,
          pull_number: pullNumber,
        }),
      );

      return reviews.data
        .map((review) => review.user?.login)
        .filter((username) => username !== authenticatedUsername)
        .filter(filterNil);
    });

    const reviewers = uniq(flatten(await Promise.all(promises)));
    spinner.stop();
    return reviewers;
  } catch (error) {
    logger.error('Retrieving reviewers failed', error);
    spinner.fail(`Retrieving reviewers failed`);
  }
}
