import { ora } from '../../../lib/ora.js';
import { logger } from '../../logger.js';
import { createOctokitClient, retryOctokitRequest } from './octokit-client.js';

export async function addAssigneesToPullRequest({
  // options
  githubApiBaseUrlV3,
  repoName,
  repoOwner,
  githubToken,
  autoAssign,
  interactive,
  dryRun,

  // additional args
  pullNumber,
  assignees,
}: {
  githubApiBaseUrlV3?: string;
  repoName: string;
  repoOwner: string;
  githubToken: string;
  autoAssign: boolean;
  interactive: boolean;
  dryRun?: boolean;

  pullNumber: number;
  assignees: string[];
}) {
  const text = autoAssign
    ? `Self-assigning to #${pullNumber}`
    : `Adding assignees to #${pullNumber}: ${assignees.join(', ')}`;
  logger.info(text);
  const spinner = ora(interactive, text).start();

  if (dryRun) {
    spinner.succeed();
    return;
  }

  try {
    const octokit = createOctokitClient({ githubToken, githubApiBaseUrlV3 });

    await retryOctokitRequest(() =>
      octokit.issues.addAssignees({
        owner: repoOwner,
        repo: repoName,
        issue_number: pullNumber,
        assignees: assignees,
      }),
    );

    spinner.succeed();
  } catch (error) {
    spinner.fail();

    logger.error(`Could not add assignees to PR ${pullNumber}`, error);
  }
}
