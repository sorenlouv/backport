import { isEmpty } from 'lodash-es';
import type { ValidConfigOptions } from '../../options/options.js';
import { BackportError } from '../backport-error.js';
import { SpawnError, spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';
import { getShortSha } from '../github/commit-formatters.js';
import { logger } from '../logger.js';
import type { TargetPullRequest } from '../sourceCommit/get-pull-request-states.js';
import {
  getConflictingFiles,
  getRerereConfig,
  getStagedFiles,
  getUnstagedFiles,
} from './diff.js';

export async function cherrypickAbort({
  options,
}: {
  options: ValidConfigOptions;
}) {
  const cwd = getRepoPath(options);
  try {
    return await spawnPromise('git', ['cherry-pick', '--abort'], cwd);
  } catch (error) {
    logger.warn('Failed to abort cherry-pick', error);
    throw new BackportError({
      code: 'cherrypick-exception',
      message: 'Failed to abort cherry-pick before retry',
    });
  }
}

export async function cherrypick({
  options,
  sha,
  mergedTargetPullRequest,
  commitAuthor,
  strategyOption,
}: {
  options: ValidConfigOptions;
  sha: string;
  mergedTargetPullRequest?: TargetPullRequest;
  commitAuthor: { name: string; email: string };
  strategyOption?: 'ours' | 'theirs';
}): Promise<{
  conflictingFiles: { absolute: string; relative: string }[];
  unstagedFiles: string[];
  needsResolving: boolean;
}> {
  const cmdArgs = [
    `-c`,
    `user.name="${commitAuthor.name}"`,
    `-c`,
    `user.email="${commitAuthor.email}"`,
    `cherry-pick`,
    ...(options.mainline == undefined
      ? []
      : ['--mainline', `${options.mainline}`]),
    ...(options.cherryPickRef === false ? [] : ['-x']),
    ...(options.signoff ? ['--signoff'] : []),
    ...(strategyOption ? ['--strategy-option', strategyOption] : []),
    sha,
  ];

  try {
    const cwd = getRepoPath(options);
    await spawnPromise('git', cmdArgs, cwd);
    return { conflictingFiles: [], unstagedFiles: [], needsResolving: false };
  } catch (error) {
    const isSpawnError = error instanceof SpawnError;
    if (isSpawnError) {
      // missing `mainline` option
      if (error.message.includes('is a merge but no -m option was given')) {
        throw new BackportError({
          code: 'cherrypick-exception',
          message:
            'Cherrypick failed because the selected commit was a merge commit. Please try again by specifying the parent with the `mainline` argument:\n\n> backport --mainline\n\nor:\n\n> backport --mainline <parent-number>\n\nOr refer to the git documentation for more information: https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt---mainlineparent-number',
        });
      }

      // commit was already backported
      if (error.message.includes('The previous cherry-pick is now empty')) {
        const shortSha = getShortSha(sha);

        throw new BackportError({
          code: 'cherrypick-exception',
          message: `Cherrypick failed because the selected commit (${shortSha}) is empty. ${
            mergedTargetPullRequest?.url
              ? `It looks like the commit was already backported in ${mergedTargetPullRequest.url}`
              : 'Did you already backport this commit? '
          }`,
        });
      }

      if (error.message.includes(`bad object ${sha}`)) {
        throw new BackportError({
          code: 'cherrypick-exception',
          message: `Cherrypick failed because commit "${sha}" was not found`,
        });
      }

      const isCherryPickError =
        error.context.cmdArgs.includes('cherry-pick') && error.context.code > 0;
      if (isCherryPickError) {
        const [conflictingFiles, unstagedFiles, rerereConfig] =
          await Promise.all([
            getConflictingFiles(options),
            getUnstagedFiles(options),
            getRerereConfig(options),
          ]);

        const noConflicts = isEmpty(conflictingFiles);
        const hasUnstaged = !isEmpty(unstagedFiles);

        if (rerereConfig.enabled && noConflicts) {
          const stagedFiles = await getStagedFiles(options);
          const hasStaged = !isEmpty(stagedFiles);

          if (rerereConfig.autoUpdate && hasStaged && !hasUnstaged) {
            logger.info(
              'Git rerere resolved conflicts and staged files automatically',
            );
            return {
              conflictingFiles: [],
              unstagedFiles: [],
              needsResolving: false,
            };
          }

          if (!rerereConfig.autoUpdate && hasUnstaged) {
            logger.info(
              'Git rerere resolved conflicts (files remain unmerged. Please stage manually)',
            );
            return {
              conflictingFiles: [],
              unstagedFiles,
              needsResolving: true,
            };
          }
        }

        // Standard resolution path
        if (!noConflicts || hasUnstaged) {
          return { conflictingFiles, unstagedFiles, needsResolving: true };
        }
      }
    }

    // re-throw error if it didn't match the handled cases above
    throw error;
  }
}
