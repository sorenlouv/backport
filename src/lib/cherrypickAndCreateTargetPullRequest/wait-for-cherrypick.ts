import chalk from 'chalk';
import type { Commit } from '../../entrypoint.api.js';
import { BackportError } from '../../entrypoint.api.js';
import type { Ora } from '../../lib/ora.js';
import { ora } from '../../lib/ora.js';
import type { ValidConfigOptions } from '../../options/options.js';
import type { CommitAuthor } from '../author.js';
import { getCommitAuthor } from '../author.js';
import { spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';
import type { ConflictingFiles } from '../git/index.js';
import {
  cherrypick,
  cherrypickAbort,
  commitChanges,
  gitAddAll,
} from '../git/index.js';
import { getFirstLine } from '../github/commit-formatters.js';
import { consoleLog, logger } from '../logger.js';
import { getCommitsWithoutBackports } from './get-commits-without-backports.js';
import { listConflictingAndUnstagedFiles } from './list-conflicting-and-unstaged-files.js';

export type CherrypickResult = {
  hasCommitsWithConflicts: boolean;
  unresolvedFiles: string[];
};

export async function waitForCherrypick(
  options: ValidConfigOptions,
  commit: Commit,
  targetBranch: string,
): Promise<CherrypickResult> {
  const spinnerText = `Cherry-picking: ${chalk.greenBright(
    getFirstLine(commit.sourceCommit.message),
  )}`;
  const cherrypickSpinner = ora(options.interactive, spinnerText).start();
  const commitAuthor = getCommitAuthor({ options, commit });

  const result = await cherrypickAndHandleConflicts({
    options,
    commit,
    commitAuthor,
    targetBranch,
    cherrypickSpinner,
  });

  // At this point conflict are resolved (or committed if `conflictResolution: 'commit'`) and files are staged
  // Now we just need to commit them (user may already have done this manually)

  try {
    // Run `git commit` in case conflicts were not manually committed
    await commitChanges({ options, commit, commitAuthor });

    cherrypickSpinner.succeed();

    return result;
  } catch (error) {
    cherrypickSpinner.fail();
    throw error;
  }
}

async function cherrypickAndHandleConflicts({
  options,
  commit,
  commitAuthor,
  targetBranch,
  cherrypickSpinner,
}: {
  options: ValidConfigOptions;
  commit: Commit;
  commitAuthor: CommitAuthor;
  targetBranch: string;
  cherrypickSpinner: Ora;
}): Promise<CherrypickResult> {
  const mergedTargetPullRequest = commit.targetPullRequestStates.find(
    (pr) => pr.state === 'MERGED' && pr.branch === targetBranch,
  );

  let conflictingFiles: ConflictingFiles;
  let unstagedFiles: string[];
  let needsResolving: boolean;

  try {
    ({ conflictingFiles, unstagedFiles, needsResolving } = await cherrypick({
      options,
      sha: commit.sourceCommit.sha,
      mergedTargetPullRequest,
      commitAuthor,
    }));

    // no conflicts encountered
    if (!needsResolving) {
      return { hasCommitsWithConflicts: false, unresolvedFiles: [] };
    }
    // cherrypick failed due to conflicts
    cherrypickSpinner.fail();
  } catch (error) {
    cherrypickSpinner.fail();
    throw error;
  }

  const repoPath = getRepoPath(options);

  // resolve conflicts automatically
  if (options.autoFixConflicts) {
    const autoResolveSpinner = ora(
      options.interactive,
      'Attempting to resolve conflicts automatically',
    ).start();

    const didAutoFix = await options.autoFixConflicts({
      files: conflictingFiles.map((f) => f.absolute),
      directory: repoPath,
      logger,
      targetBranch,
    });

    // conflicts were automatically resolved
    if (didAutoFix) {
      autoResolveSpinner.succeed();
      return { hasCommitsWithConflicts: false, unresolvedFiles: [] };
    }
    autoResolveSpinner.fail();
  }

  // abort and retry cherry-pick with --strategy-option=theirs
  if (!options.interactive && options.conflictResolution === 'theirs') {
    await cherrypickAbort({ options });
    const retryResult = await cherrypick({
      options,
      sha: commit.sourceCommit.sha,
      mergedTargetPullRequest,
      commitAuthor,
      strategyOption: 'theirs',
    });

    const unresolvedFiles = retryResult.needsResolving
      ? retryResult.conflictingFiles.map((f) => f.relative)
      : [];

    if (unresolvedFiles.length > 0) {
      logger.warn(
        `Cherry-pick retry with --strategy-option=theirs still has unresolved files: ${unresolvedFiles.join(', ')}`,
      );
    }

    return { hasCommitsWithConflicts: true, unresolvedFiles };
  }

  // commits with conflicts should be committed and pushed to the target branch
  if (!options.interactive && options.conflictResolution === 'commit') {
    await gitAddAll({ options });
    await commitChanges({ options, commit, commitAuthor });
    return { hasCommitsWithConflicts: true, unresolvedFiles: [] };
  }

  const conflictingFilesRelative = conflictingFiles
    .map((f) => f.relative)
    .slice(0, 50);

  let commitsWithoutBackports: Awaited<
    ReturnType<typeof getCommitsWithoutBackports>
  >;

  try {
    commitsWithoutBackports = await getCommitsWithoutBackports({
      options,
      commit,
      targetBranch,
      conflictingFiles: conflictingFilesRelative,
    });
  } catch (error) {
    commitsWithoutBackports = [];
    if (error instanceof Error) {
      logger.warn(
        `Unable to fetch commits without backports: ${error.message}`,
      );
    }
  }

  if (!options.interactive) {
    throw new BackportError({
      code: 'merge-conflict-exception',
      commitsWithoutBackports,
      conflictingFiles: conflictingFilesRelative,
    });
  }

  consoleLog(
    chalk.bold('\nThe commit could not be backported due to conflicts\n'),
  );
  consoleLog(`Please fix the conflicts in ${repoPath}`);

  if (commitsWithoutBackports.length > 0) {
    consoleLog(
      chalk.italic(
        `Hint: Before fixing the conflicts manually you should consider backporting the following pull requests to "${targetBranch}":`,
      ),
    );

    consoleLog(
      `${commitsWithoutBackports.map((c) => c.formatted).join('\n')}\n\n`,
    );
  }

  /*
   * Commit could not be cleanly cherrypicked: Initiating conflict resolution
   */

  if (options.editor) {
    await spawnPromise(options.editor, [repoPath], options.cwd, true);
  }

  // list files with conflict markers + unstaged files and require user to resolve them
  await listConflictingAndUnstagedFiles({
    retries: 0,
    options,
    conflictingFiles: conflictingFiles.map((f) => f.absolute),
    unstagedFiles,
  });

  return { hasCommitsWithConflicts: false, unresolvedFiles: [] };
}
