import type { ValidConfigOptions } from '../../options/options.js';
import { SpawnError, spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';
import { getShortSha } from '../github/commit-formatters.js';
import { logger } from '../logger.js';
import type { CommitAuthor } from '../author.js';
import type { Commit } from '../sourceCommit/parse-source-commit.js';

export async function gitAddAll({ options }: { options: ValidConfigOptions }) {
  const cwd = getRepoPath(options);
  return spawnPromise('git', ['add', '--all'], cwd);
}

async function gitCommit({
  options,
  commitAuthor,
  message,
}: {
  options: ValidConfigOptions;
  commitAuthor: CommitAuthor;
  message?: string;
}) {
  const cwd = getRepoPath(options);

  return spawnPromise(
    'git',
    [
      `-c`,
      `user.name="${commitAuthor.name}"`,
      `-c`,
      `user.email="${commitAuthor.email}"`,
      'commit',
      ...(message ? [`--message=${message}`] : ['--no-edit']),
      ...(options.noVerify ? ['--no-verify'] : []), // bypass pre-commit and commit-msg hooks
      ...(options.signoff ? ['--signoff'] : []),
    ],
    cwd,
  );
}

export async function commitChanges({
  options,
  commit,
  commitAuthor,
}: {
  options: ValidConfigOptions;
  commit: Commit;
  commitAuthor: CommitAuthor;
}) {
  try {
    await gitCommit({ options, commitAuthor });
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;

    if (isSpawnError) {
      if (e.context.stdout.includes('nothing to commit')) {
        logger.info(
          `Could not run "git commit". Probably because the changes were manually committed`,
          e,
        );
        return;
      }

      // manually set the commit message if the inferred commit message is empty
      // this can happen if the user runs `git reset HEAD` and thereby aborts the cherrypick process
      if (
        e.context.stderr.includes('Aborting commit due to empty commit message')
      ) {
        await gitCommit({
          options,
          commitAuthor,
          message: commit.sourceCommit.message,
        });
        return;
      }
    }

    // rethrow error if it can't be handled
    throw e;
  }
}

export async function getIsCommitInBranch(
  options: ValidConfigOptions,
  commitSha: string,
) {
  try {
    const cwd = getRepoPath(options);
    await spawnPromise(
      'git',
      ['merge-base', '--is-ancestor', commitSha, 'HEAD'],
      cwd,
    );
    return true;
  } catch (e) {
    logger.warn('getIsCommitInBranch threw', e);
    return false;
  }
}

export async function getIsMergeCommit(
  options: ValidConfigOptions,
  sha: string,
) {
  const cwd = getRepoPath(options);
  try {
    const res = await spawnPromise(
      'git',
      ['rev-list', '-1', '--merges', `${sha}~1..${sha}`],
      cwd,
    );

    return res.stdout !== '';
  } catch (e) {
    const shortSha = getShortSha(sha);
    logger.info(
      `Could not determine if ${shortSha} is a merge commit. Will assume it is not`,
      e,
    );
    return false;
  }
}

export async function getShasInMergeCommit(
  options: ValidConfigOptions,
  sha: string,
) {
  try {
    const cwd = getRepoPath(options);
    const res = await spawnPromise(
      'git',
      ['--no-pager', 'log', `${sha}^1..${sha}^2`, '--pretty=format:%H'],
      cwd,
    );

    return res.stdout.split('\n');
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;

    // swallow error
    if (isSpawnError && e.context.code === 128) {
      return [];
    }

    throw e;
  }
}
