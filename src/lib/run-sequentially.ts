import type { ValidConfigOptions } from '../options/options.js';
import { BackportError } from './backport-error.js';
import { cherrypickAndCreateTargetPullRequest } from './cherrypickAndCreateTargetPullRequest/cherrypick-and-create-target-pull-request.js';
import { getLogfilePath } from './env.js';
import { logger, consoleLog } from './logger.js';
import { sequentially } from './sequentially.js';
import type { Commit } from './sourceCommit/parse-source-commit.js';

export type SuccessResult = {
  status: 'success';
  didUpdate: boolean;
  targetBranch: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
};

export type HandledErrorResult = {
  status: 'handled-error';
  targetBranch: string;
  error: BackportError;
};

export type UnhandledErrorResult = {
  status: 'unhandled-error';
  targetBranch: string;
  error: Error;
};

export type Result = SuccessResult | HandledErrorResult | UnhandledErrorResult;

export async function runSequentially({
  options,
  commits,
  targetBranches,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranches: string[];
}): Promise<Result[]> {
  logger.verbose('Backport options', options);

  const results = [] as Result[];

  await sequentially(targetBranches, async (targetBranch) => {
    logger.info(`Backporting ${JSON.stringify(commits)} to ${targetBranch}`);
    try {
      const { number, url, didUpdate } =
        await cherrypickAndCreateTargetPullRequest({
          options,
          commits,
          targetBranch,
        });

      results.push({
        targetBranch,
        status: 'success',
        didUpdate,
        pullRequestUrl: url,
        pullRequestNumber: number,
      });
    } catch (error) {
      const isHandledError = error instanceof BackportError;
      if (isHandledError) {
        results.push({
          targetBranch,
          status: 'handled-error',
          error: error,
        });
      } else if (error instanceof Error) {
        results.push({
          targetBranch,
          status: 'unhandled-error',
          error: error,
        });
      } else {
        throw error;
      }

      logger.error('runSequentially failed', error);

      if (isHandledError) {
        // don't output anything for `code: invalid-branch-exception`.
        // Outputting is already handled
        if (error.errorContext.code !== 'invalid-branch-exception') {
          consoleLog(error.message);
        }

        return;
      }

      consoleLog(
        `An unhandled error occurred while backporting commit. Please see the logs for details: ${getLogfilePath(
          { logFilePath: options.logFilePath, logLevel: 'info' },
        )}`,
      );
    }
  });

  // return the results for consumers to programatically read
  return results;
}
