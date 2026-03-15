import { ora } from '../../../lib/ora.js';
import { logger } from '../../logger.js';
import { createOctokitClient, retryOctokitRequest } from './octokit-client.js';

export async function addLabelsToPullRequest({
  githubApiBaseUrlV3,
  repoName,
  repoOwner,
  accessToken,
  interactive,
  dryRun,

  pullNumber,
  labels,
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
  labels: string[];
}): Promise<void> {
  const text = `Adding labels: ${labels.join(', ')}`;
  logger.info(text);
  const spinner = ora(interactive, text).start();

  if (dryRun) {
    spinner.succeed();
    return;
  }

  try {
    const octokit = createOctokitClient({ accessToken, githubApiBaseUrlV3 });

    await retryOctokitRequest(() =>
      octokit.issues.addLabels({
        owner: repoOwner,
        repo: repoName,
        issue_number: pullNumber,
        labels,
      }),
    );

    spinner.succeed();
  } catch (e) {
    spinner.fail();
    logger.error(`Could not add labels to PR ${pullNumber}`, e);
  }
}
