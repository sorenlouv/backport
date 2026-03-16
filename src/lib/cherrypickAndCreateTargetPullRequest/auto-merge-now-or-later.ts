import type { ValidConfigOptions } from '../../options/options.js';
import { BackportError } from '../backport-error.js';
import { mergePullRequest } from '../github/v3/merge-pull-request.js';
import { enablePullRequestAutoMerge } from '../github/v4/enable-pull-request-auto-merge.js';
import { logger } from '../logger.js';
import { ora } from '../ora.js';

export async function autoMergeNowOrLater(
  options: ValidConfigOptions,
  pullNumber: number,
) {
  const text = `Auto-merge: Enabling via "${options.autoMergeMethod}"`;
  logger.info(text);

  const spinner = ora(options.interactive, text).start();

  if (options.dryRun) {
    spinner.succeed();
    return;
  }

  try {
    try {
      await enablePullRequestAutoMerge(options, pullNumber);
    } catch (error) {
      if (!(error instanceof BackportError)) {
        throw error;
      }

      logger.info(
        `Auto merge: Failed to enable auto merge for PR "#${pullNumber}" due to ${error.message}`,
      );

      if (error.errorContext.code !== 'auto-merge-not-available-exception') {
        throw error;
      }

      logger.info('Auto merge: Attempting to merge immediately');
      await mergePullRequest(options, pullNumber);
      spinner.text = 'Auto-merge: Pull request was merged immediately';
    }

    spinner.succeed();
  } catch (error) {
    logger.warn(`Auto merge: An error occurred ${error}`);
    spinner.fail();
  }
}
