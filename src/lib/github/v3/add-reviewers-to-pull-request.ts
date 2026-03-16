import { ora } from '../../../lib/ora.js';
import { logger } from '../../logger.js';
import { createOctokitClient, retryOctokitRequest } from './octokit-client.js';

export async function addReviewersToPullRequest({
  githubApiBaseUrlV3,
  repoName,
  repoOwner,
  accessToken,
  interactive,
  dryRun,

  pullNumber,
  reviewers,
}: {
  // options
  githubApiBaseUrlV3?: string;
  repoName: string;
  repoOwner: string;
  accessToken: string;
  interactive: boolean;
  dryRun?: boolean;

  // additional args
  pullNumber: number;
  reviewers: string[];
}) {
  const text = `Adding reviewers: ${reviewers}`;
  logger.info(text);
  const spinner = ora(interactive, text).start();

  if (dryRun) {
    spinner.succeed();
    return;
  }

  try {
    const octokit = createOctokitClient({ accessToken, githubApiBaseUrlV3 });

    await retryOctokitRequest(() =>
      octokit.pulls.requestReviewers({
        owner: repoOwner,
        repo: repoName,
        pull_number: pullNumber,
        reviewers,
      }),
    );

    spinner.succeed();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    spinner.fail(`Adding reviewers. ${message}`);
    logger.error(`Could not add reviewers to PR ${pullNumber}`, error);
  }
}
