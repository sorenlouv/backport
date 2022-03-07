import { ValidConfigOptions } from './options/options';
import { HandledError } from './services/HandledError';
import { logger, consoleLog } from './services/logger';
import { sequentially } from './services/sequentially';
import { Commit } from './services/sourceCommit/parseSourceCommit';
import { cherrypickAndCreateTargetPullRequest } from './ui/cherrypickAndCreateTargetPullRequest';
import { GitConfigAuthor } from './ui/getGitConfigAuthor';

export type Result =
  | {
      status: 'success';
      didUpdate: boolean;
      targetBranch: string;
      pullRequestUrl: string;
      pullRequestNumber: number;
    }
  | {
      status: 'handled-error';
      targetBranch: string;
      error: HandledError;
    }
  | {
      status: 'unhandled-error';
      targetBranch: string;
      error: Error;
    };

export async function runSequentially({
  options,
  commits,
  targetBranches,
  gitConfigAuthor,
}: {
  options: ValidConfigOptions;
  commits: Commit[];
  targetBranches: string[];
  gitConfigAuthor?: GitConfigAuthor;
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
          gitConfigAuthor: gitConfigAuthor,
        });

      results.push({
        targetBranch,
        status: 'success',
        didUpdate,
        pullRequestUrl: url,
        pullRequestNumber: number,
      });
    } catch (e) {
      const isHandledError = e instanceof HandledError;

      results.push({
        targetBranch,
        status: isHandledError ? 'handled-error' : 'unhandled-error',
        error: e,
      });

      // consoleLog(
      //   isHandledError
      //     ? e.message
      //     : 'An error occurred while backporting commit. Please see the logs for details'
      // );

      consoleLog(e.message);

      logger.error('runSequentially failed', e);
    }
  });

  // return the results for consumers to programatically read
  return results;
}
