import apm from 'elastic-apm-node';
import { BackportError } from './lib/BackportError';
import { cherrypickAndCreateTargetPullRequest } from './lib/cherrypickAndCreateTargetPullRequest/cherrypickAndCreateTargetPullRequest';
import { getLogfilePath } from './lib/env';
import { logger, consoleLog } from './lib/logger';
import { sequentially } from './lib/sequentially';
import { Commit } from './lib/sourceCommit/parseSourceCommit';
import { ValidConfigOptions } from './options/options';

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
    const span = apm.startSpan('Cherrypick commits to target branch');
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
      span?.setOutcome('success');
      span?.end();
    } catch (e) {
      span?.setOutcome('failure');
      span?.setLabel('error_message', (e as Error).message);
      span?.end();
      apm.captureError(e as Error);

      const isHandledError = e instanceof BackportError;
      if (isHandledError) {
        results.push({
          targetBranch,
          status: 'handled-error',
          error: e,
        });
      } else if (e instanceof Error) {
        results.push({
          targetBranch,
          status: 'unhandled-error',
          error: e,
        });
      } else {
        throw e;
      }

      logger.error('runSequentially failed', e);

      if (isHandledError) {
        // don't output anything for `code: invalid-branch-exception`.
        // Outputting is already handled
        if (e.errorContext.code !== 'invalid-branch-exception') {
          consoleLog(e.message);
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
