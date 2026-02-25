import chalk from 'chalk';
import { difference, isEmpty } from 'lodash';
import type { Commit } from '../../entrypoint.api';
import { BackportError } from '../../entrypoint.api';
import type { Ora } from '../../lib/ora';
import { ora } from '../../lib/ora';
import type { ValidConfigOptions } from '../../options/options';
import type { CommitAuthor } from '../author';
import { getCommitAuthor } from '../author';
import { spawnPromise } from '../child-process-promisified';
import { getRepoPath } from '../env';
import type { ConflictingFiles } from '../git';
import {
  cherrypick,
  cherrypickAbort,
  commitChanges,
  getConflictingFiles,
  getUnstagedFiles,
  gitAddAll,
} from '../git';
import { getFirstLine } from '../github/commit-formatters';
import { consoleLog, logger } from '../logger';
import { confirmPrompt } from '../prompts';
import { getCommitsWithoutBackports } from './get-commits-without-backports';

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

  // At this point conflict are resolved (or committed if `commitConflicts: true`) and files are staged
  // Now we just need to commit them (user may already have done this manually)

  try {
    // Run `git commit` in case conflicts were not manually committed
    await commitChanges({ options, commit, commitAuthor });

    cherrypickSpinner.succeed();

    return result;
  } catch (e) {
    cherrypickSpinner.fail();
    throw e;
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
  } catch (e) {
    cherrypickSpinner.fail();
    throw e;
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
  if (!options.interactive && options.autoResolveConflictsWithTheirs) {
    if (options.commitConflicts) {
      logger.warn(
        'Both "autoResolveConflictsWithTheirs" and "commitConflicts" are enabled. Using "autoResolveConflictsWithTheirs".',
      );
    }
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
  if (!options.interactive && options.commitConflicts) {
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
  } catch (e) {
    commitsWithoutBackports = [];
    if (e instanceof Error) {
      logger.warn(`Unable to fetch commits without backports: ${e.message}`);
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

async function listConflictingAndUnstagedFiles({
  retries,
  options,
  conflictingFiles,
  unstagedFiles,
}: {
  retries: number;
  options: ValidConfigOptions;
  conflictingFiles: string[];
  unstagedFiles: string[];
}): Promise<void> {
  const hasUnstagedFiles = !isEmpty(
    difference(unstagedFiles, conflictingFiles),
  );
  const hasConflictingFiles = !isEmpty(conflictingFiles);

  if (!hasConflictingFiles && !hasUnstagedFiles) {
    return;
  }

  // add divider between prompts
  if (retries > 0) {
    consoleLog('\n----------------------------------------\n');
  }

  const header = chalk.reset(`Fix the following conflicts manually:`);

  // show conflict section if there are conflicting files
  const conflictSection = hasConflictingFiles
    ? `Conflicting files:\n${chalk.reset(
        conflictingFiles.map((file) => ` - ${file}`).join('\n'),
      )}`
    : '';

  const unstagedSection = hasUnstagedFiles
    ? `Unstaged files:\n${chalk.reset(
        unstagedFiles.map((file) => ` - ${file}`).join('\n'),
      )}`
    : '';

  const didConfirm = await confirmPrompt(
    `${header}\n\n${conflictSection}\n${unstagedSection}\n\nPress ENTER when the conflicts are resolved and files are staged`,
  );

  if (!didConfirm) {
    throw new BackportError({ code: 'abort-conflict-resolution-exception' });
  }

  const MAX_RETRIES = 100;
  if (retries++ > MAX_RETRIES) {
    throw new Error(`Maximum number of retries (${MAX_RETRIES}) exceeded`);
  }

  const [_conflictingFiles, _unstagedFiles] = await Promise.all([
    getConflictingFiles(options),
    getUnstagedFiles(options),
  ]);

  await listConflictingAndUnstagedFiles({
    retries,
    options,
    conflictingFiles: _conflictingFiles.map((file) => file.absolute),
    unstagedFiles: _unstagedFiles,
  });
}
