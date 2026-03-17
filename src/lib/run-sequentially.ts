/** Iterates target branches, calling cherrypickAndCreateTargetPullRequest for each, collecting Result[]. */
import type { ValidConfigOptions } from '../options/options.js';
import type { BackportErrorCode, ErrorContext } from './backport-error.js';
import { BackportError } from './backport-error.js';
import { cherrypickAndCreateTargetPullRequest } from './cherrypickAndCreateTargetPullRequest/cherrypick-and-create-target-pull-request.js';
import { getLogfilePath } from './env.js';
import { logger, consoleLog } from './logger.js';
import { sequentially } from './sequential-helper.js';
import type { Commit } from './sourceCommit/parse-source-commit.js';

export type SuccessResult = {
  status: 'success';
  targetBranch: string;
  pullRequestUrl: string;
  pullRequestNumber: number;
};

export type ErrorResult<TCode extends BackportErrorCode = BackportErrorCode> = {
  status: 'error';
  targetBranch?: string;
  errorMessage: string;
  errorCode: TCode | 'unhandled-exception';
  errorContext?: Extract<ErrorContext, { code: TCode }>;
};

export type Result = SuccessResult | ErrorResult;

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
      const { number, url } = await cherrypickAndCreateTargetPullRequest({
        options,
        commits,
        targetBranch,
      });

      results.push({
        targetBranch,
        status: 'success',
        pullRequestUrl: url,
        pullRequestNumber: number,
      });
    } catch (error) {
      const isBackportError = error instanceof BackportError;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode: BackportErrorCode | 'unhandled-exception' =
        isBackportError ? error.errorContext.code : 'unhandled-exception';
      const errorContext = isBackportError ? error.errorContext : undefined;

      results.push({
        status: 'error',
        targetBranch,
        errorMessage,
        errorCode,
        errorContext,
      });

      logger.error('runSequentially failed', error);

      if (isBackportError) {
        if (errorCode !== 'invalid-branch-exception') {
          consoleLog(errorMessage);
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

  return results;
}
