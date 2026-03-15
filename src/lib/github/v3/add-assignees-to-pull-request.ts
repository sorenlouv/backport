import { ora } from '../../../lib/ora.js';
import { logger } from '../../logger.js';
import { createOctokitClient } from './octokit-client.js';

export async function addAssigneesToPullRequest({
  // options
  githubApiBaseUrlV3,
  repoName,
  repoOwner,
  accessToken,
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
  accessToken: string;
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
    const octokit = createOctokitClient({ accessToken, githubApiBaseUrlV3 });

    await octokit.issues.addAssignees({
      owner: repoOwner,
      repo: repoName,
      issue_number: pullNumber,
      assignees: assignees,
    });

    spinner.succeed();
  } catch (e) {
    spinner.fail();

    logger.error(`Could not add assignees to PR ${pullNumber}`, e);
  }
}
