import { resolve as pathResolve } from 'path';
import { uniq, isEmpty } from 'lodash';
import { ora } from '../lib/ora';
import { ValidConfigOptions } from '../options/options';
import { filterNil } from '../utils/filterEmpty';
import { BackportError } from './BackportError';
import { CommitAuthor } from './author';
import {
  spawnPromise,
  SpawnError,
  spawnStream,
} from './child-process-promisified';
import { getRepoPath } from './env';
import { getShortSha } from './github/commitFormatters';
import { logger } from './logger';
import { TargetPullRequest } from './sourceCommit/getPullRequestStates';
import { Commit } from './sourceCommit/parseSourceCommit';

export function getRemoteUrl(
  { repoName, accessToken, gitHostname = 'github.com' }: ValidConfigOptions,
  repoOwner: string
) {
  return `https://x-access-token:${accessToken}@${gitHostname}/${repoOwner}/${repoName}.git`;
}

export async function cloneRepo(
  { sourcePath, targetPath }: { sourcePath: string; targetPath: string },
  onProgress: (progress: number) => void
) {
  logger.info(`Cloning repo from ${sourcePath} to ${targetPath}`);

  return new Promise<void>((resolve, reject) => {
    const subprocess = spawnStream('git', [
      'clone',
      sourcePath,
      targetPath,
      '--progress',
    ]);

    const progress = {
      fileUpdate: 0,
      objectReceive: 0,
    };

    subprocess.on('error', (err) => reject(err));

    subprocess.stderr.on('data', (data: string) => {
      logger.verbose(data.toString());
      const [, objectReceiveProgress]: RegExpMatchArray =
        data.toString().match(/^Receiving objects:\s+(\d+)%/) || [];

      if (objectReceiveProgress) {
        progress.objectReceive = parseInt(objectReceiveProgress, 10);
      }

      const [, fileUpdateProgress]: RegExpMatchArray =
        data.toString().match(/^Updating files:\s+(\d+)%/) || [];

      if (fileUpdateProgress) {
        progress.objectReceive = 100;
        progress.fileUpdate = parseInt(fileUpdateProgress, 10);
      }

      const progressSum = Math.round(
        progress.fileUpdate * 0.1 + progress.objectReceive * 0.9
      );

      if (progressSum > 0) {
        onProgress(progressSum);
      }
    });

    subprocess.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Git clone failed with exit code: ${code}`));
      }
    });
  });
}

export async function getLocalConfigFileCommitDate({ cwd }: { cwd: string }) {
  try {
    const { stdout } = await spawnPromise(
      'git',
      ['--no-pager', 'log', '-1', '--format=%cd', '.backportrc.json'],
      cwd
    );

    const timestamp = Date.parse(stdout);
    if (timestamp > 0) {
      return timestamp;
    }
  } catch (e) {
    return;
  }
}

export async function isLocalConfigFileUntracked({ cwd }: { cwd: string }) {
  try {
    // list untracked files
    const { stdout } = await spawnPromise(
      'git',
      ['ls-files', '.backportrc.json', '--exclude-standard', '--others'],
      cwd
    );

    return !!stdout;
  } catch (e) {
    return;
  }
}

export async function isLocalConfigFileModified({ cwd }: { cwd: string }) {
  try {
    const { stdout } = await spawnPromise(
      'git',
      ['--no-pager', 'diff', 'HEAD', '--name-only', '.backportrc.json'],
      cwd
    );

    return !!stdout;
  } catch (e) {
    return false;
  }
}

export async function getRepoInfoFromGitRemotes({ cwd }: { cwd: string }) {
  try {
    const { stdout } = await spawnPromise('git', ['remote', '--verbose'], cwd);
    const remotes = stdout
      .split('\n')
      .map((line) => {
        const match = line.match(
          /github.com[/|:](.+?)(.git)? \((fetch|push)\)/
        );
        return match?.[1];
      })
      .filter(filterNil);

    return uniq(remotes).map((remote) => {
      const [repoOwner, repoName] = remote.split('/');
      return { repoOwner, repoName };
    });
  } catch (e) {
    return [];
  }
}

export async function getGitProjectRootPath(dir: string) {
  try {
    const cwd = dir;
    const { stdout } = await spawnPromise(
      'git',
      ['rev-parse', '--show-toplevel'],
      cwd
    );
    return stdout.trim();
  } catch (e) {
    logger.error('An error occurred while retrieving git project root', e);
    return;
  }
}

export async function getIsCommitInBranch(
  options: ValidConfigOptions,
  commitSha: string
) {
  try {
    const cwd = getRepoPath(options);
    await spawnPromise(
      'git',
      ['merge-base', '--is-ancestor', commitSha, 'HEAD'],
      cwd
    );
    return true;
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;
    if (isSpawnError) {
      const commitNotInBranch = e.context.code === 1 && e.context.stderr === '';
      const commitNotExist =
        e.context.code === 128 &&
        e.context.stderr.includes('Not a valid object name');

      if (commitNotInBranch || commitNotExist) {
        return false;
      }
    }

    throw e;
  }
}

export async function deleteRemote(
  options: ValidConfigOptions,
  remoteName: string
) {
  try {
    const cwd = getRepoPath(options);
    await spawnPromise('git', ['remote', 'rm', remoteName], cwd);
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;

    if (
      isSpawnError &&
      e.context.code > 0 &&
      e.context.stderr.includes('No such remote')
    ) {
      return;
    }

    // re-throw
    throw e;
  }
}

export async function addRemote(
  options: ValidConfigOptions,
  remoteName: string
) {
  try {
    const cwd = getRepoPath(options);
    await spawnPromise(
      'git',
      ['remote', 'add', remoteName, getRemoteUrl(options, remoteName)],
      cwd
    );
  } catch (e) {
    // note: swallowing error
    return;
  }
}

export async function fetchBranch(options: ValidConfigOptions, branch: string) {
  const cwd = getRepoPath(options);
  await spawnPromise(
    'git',
    ['fetch', options.repoOwner, `${branch}:${branch}`, '--force'],
    cwd
  );
}

export async function getIsMergeCommit(
  options: ValidConfigOptions,
  sha: string
) {
  const cwd = getRepoPath(options);
  try {
    const res = await spawnPromise(
      'git',
      ['rev-list', '-1', '--merges', `${sha}~1..${sha}`],
      cwd
    );

    return res.stdout !== '';
  } catch (e) {
    const shortSha = getShortSha(sha);
    logger.info(
      `Could not determine if ${shortSha} is a merge commit. Will assume it is not`,
      e
    );
    return false;
  }
}

export async function getShasInMergeCommit(
  options: ValidConfigOptions,
  sha: string
) {
  try {
    const cwd = getRepoPath(options);
    const res = await spawnPromise(
      'git',
      ['--no-pager', 'log', `${sha}^1..${sha}^2`, '--pretty=format:%H'],
      cwd
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

export async function cherrypick({
  options,
  sha,
  mergedTargetPullRequest,
  commitAuthor,
}: {
  options: ValidConfigOptions;
  sha: string;
  mergedTargetPullRequest?: TargetPullRequest;
  commitAuthor: CommitAuthor;
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
    ...(options.mainline != undefined
      ? ['--mainline', `${options.mainline}`]
      : []),
    ...(options.cherrypickRef === false ? [] : ['-x']),
    ...(options.signoff ? ['--signoff'] : []),
    sha,
  ];

  try {
    const cwd = getRepoPath(options);
    await spawnPromise('git', cmdArgs, cwd);
    return { conflictingFiles: [], unstagedFiles: [], needsResolving: false };
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;
    if (isSpawnError) {
      // missing `mainline` option
      if (e.message.includes('is a merge but no -m option was given')) {
        throw new BackportError(
          'Cherrypick failed because the selected commit was a merge commit. Please try again by specifying the parent with the `mainline` argument:\n\n> backport --mainline\n\nor:\n\n> backport --mainline <parent-number>\n\nOr refer to the git documentation for more information: https://git-scm.com/docs/git-cherry-pick#Documentation/git-cherry-pick.txt---mainlineparent-number'
        );
      }

      // commit was already backported
      if (e.message.includes('The previous cherry-pick is now empty')) {
        const shortSha = getShortSha(sha);

        throw new BackportError(
          `Cherrypick failed because the selected commit (${shortSha}) is empty. ${
            mergedTargetPullRequest?.url
              ? `It looks like the commit was already backported in ${mergedTargetPullRequest.url}`
              : 'Did you already backport this commit? '
          }`
        );
      }

      if (e.message.includes(`bad object ${sha}`)) {
        throw new BackportError(
          `Cherrypick failed because commit "${sha}" was not found`
        );
      }

      const isCherryPickError =
        e.context.cmdArgs.includes('cherry-pick') && e.context.code > 0;
      if (isCherryPickError) {
        const [conflictingFiles, unstagedFiles] = await Promise.all([
          getConflictingFiles(options),
          getUnstagedFiles(options),
        ]);

        if (!isEmpty(conflictingFiles) || !isEmpty(unstagedFiles))
          return { conflictingFiles, unstagedFiles, needsResolving: true };
      }
    }

    // re-throw error if it didn't match the handled cases above
    throw e;
  }
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
  const noVerifyFlag = options.noVerify ? ['--no-verify'] : [];
  const cwd = getRepoPath(options);

  try {
    await spawnPromise(
      'git',
      [
        `-c`,
        `user.name="${commitAuthor.name}"`,
        `-c`,
        `user.email="${commitAuthor.email}"`,
        'commit',
        '--no-edit', // Use the selected commit message without launching an editor.
        ...noVerifyFlag, // bypass pre-commit and commit-msg hooks
      ],
      cwd
    );
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;

    if (isSpawnError) {
      if (e.context.stdout.includes('nothing to commit')) {
        logger.info(
          `Could not run "git commit". Probably because the changes were manually committed`,
          e
        );
        return;
      }

      // manually set the commit message if the inferred commit message is empty
      // this can happen if the user runs `git reset HEAD` and thereby aborts the cherrypick process
      if (
        e.context.stderr.includes('Aborting commit due to empty commit message')
      ) {
        await spawnPromise(
          'git',
          [
            `-c`,
            `user.name="${commitAuthor.name}"`,
            `-c`,
            `user.email="${commitAuthor.email}"`,
            'commit',
            `--message=${commit.sourceCommit.message}`,
            ...noVerifyFlag, // bypass pre-commit and commit-msg hooks
          ],
          cwd
        );

        return;
      }
    }

    // rethrow error if it can't be handled
    throw e;
  }
}

export type ConflictingFiles = Awaited<ReturnType<typeof getConflictingFiles>>;
export async function getConflictingFiles(options: ValidConfigOptions) {
  const repoPath = getRepoPath(options);
  try {
    const cwd = repoPath;
    await spawnPromise('git', ['--no-pager', 'diff', '--check'], cwd);

    return [];
  } catch (e) {
    const isSpawnError = e instanceof SpawnError;
    const isConflictError = isSpawnError && e.context.code === 2;
    if (isConflictError) {
      const files = (e.context.stdout as string)
        .split('\n')
        .filter(
          (line: string) =>
            !!line.trim() && !line.startsWith('+') && !line.startsWith('-')
        )
        .map((line: string) => {
          const posSeparator = line.indexOf(':');
          const filename = line.slice(0, posSeparator).trim();
          return filename;
        });

      const uniqueFiles = uniq(files);

      return uniqueFiles.map((file) => {
        return {
          absolute: pathResolve(repoPath, file),
          relative: file,
        };
      });
    }

    // rethrow error since it's unrelated
    throw e;
  }
}

// retrieve the list of files that could not be cleanly merged
export async function getUnstagedFiles(options: ValidConfigOptions) {
  const repoPath = getRepoPath(options);
  const cwd = repoPath;
  const res = await spawnPromise(
    'git',
    ['--no-pager', 'diff', '--name-only'],
    cwd
  );
  const files = res.stdout
    .split('\n')
    .filter((file) => !!file)
    .map((file) => pathResolve(repoPath, file));

  return uniq(files);
}

export async function getGitConfig({
  dir,
  key,
}: {
  dir: string;
  key: 'user.name' | 'user.email';
}) {
  try {
    const cwd = dir;
    const res = await spawnPromise('git', ['config', key], cwd);
    return res.stdout.trim();
  } catch (e) {
    return;
  }
}

// How the commit flows:
// ${sourceBranch} ->   ${backportBranch}   -> ${targetBranch}
//     master      ->  backport/7.x/pr-1234 ->      7.x
export async function createBackportBranch({
  options,
  sourceBranch,
  backportBranch,
  targetBranch,
}: {
  options: ValidConfigOptions;
  sourceBranch: string;
  backportBranch: string;
  targetBranch: string;
}) {
  const spinner = ora(options.interactive, 'Pulling latest changes').start();

  try {
    const cwd = getRepoPath(options);

    await spawnPromise('git', ['reset', '--hard'], cwd);
    await spawnPromise('git', ['clean', '-d', '--force'], cwd);

    // create tmp branch. This can be necessary when fetching to the currently selected branch
    const tmpBranchName = '__backport_tool_tmp';
    await spawnPromise('git', ['checkout', '-B', tmpBranchName], cwd);

    // fetch target branch
    await fetchBranch(options, targetBranch);

    // checkout backport branch and point it to target branch
    await spawnPromise(
      'git',
      [
        'checkout',
        '-B',
        backportBranch,
        `${options.repoOwner}/${targetBranch}`,
        '--no-track',
      ],
      cwd
    );

    // delete tmp branch (if it still exists)
    try {
      await spawnPromise('git', ['branch', '-D', tmpBranchName], cwd);
    } catch (e) {
      //
    }

    // fetch commits for source branch
    await fetchBranch(options, sourceBranch);

    spinner.succeed();
  } catch (e) {
    spinner.fail();

    if (e instanceof SpawnError) {
      const isBranchInvalid =
        e.context.stderr.toLowerCase().includes(`couldn't find remote ref`) ||
        e.context.stderr.toLowerCase().includes(`invalid refspec`) ||
        e.context.stderr
          .toLowerCase()
          .includes(
            `is not a commit and a branch '${backportBranch}' cannot be created from it`
          );

      if (isBranchInvalid) {
        throw new BackportError(
          `The branch "${targetBranch}" is invalid or doesn't exist`
        );
      }
    }

    throw e;
  }
}

export async function deleteBackportBranch({
  options,
  backportBranch,
}: {
  options: ValidConfigOptions;
  backportBranch: string;
}) {
  const spinner = ora(options.interactive).start();
  const cwd = getRepoPath(options);

  await spawnPromise('git', ['reset', '--hard'], cwd);
  await spawnPromise('git', ['checkout', options.sourceBranch], cwd);
  await spawnPromise(
    'git',
    ['branch', '--delete', '--force', backportBranch],
    cwd
  );

  spinner.stop();
}

/*
 * Returns the repo owner of the forked repo or the source repo
 */
export function getRepoForkOwner(options: ValidConfigOptions) {
  return options.fork ? options.repoForkOwner : options.repoOwner;
}

export async function pushBackportBranch({
  options,
  backportBranch,
}: {
  options: ValidConfigOptions;
  backportBranch: string;
}) {
  const repoForkOwner = getRepoForkOwner(options);
  const spinner = ora(
    options.interactive,
    `Pushing branch "${repoForkOwner}:${backportBranch}"`
  ).start();

  try {
    const cwd = getRepoPath(options);
    const res = await spawnPromise(
      'git',
      ['push', repoForkOwner, `${backportBranch}:${backportBranch}`, '--force'],
      cwd
    );

    spinner.succeed();
    return res;
  } catch (e) {
    spinner.fail();

    if (
      e instanceof SpawnError &&
      e.context.stderr.toLowerCase().includes(`repository not found`)
    ) {
      throw new BackportError(
        `Error pushing to https://github.com/${repoForkOwner}/${options.repoName}. Repository does not exist. Either fork the repository (https://github.com/${options.repoOwner}/${options.repoName}) or disable fork mode via "--no-fork".\nRead more about fork mode in the docs: https://github.com/sqren/backport/blob/main/docs/config-file-options.md#fork`
      );
    }

    if (
      e instanceof SpawnError &&
      e.context.stderr.includes(`could not read Username for`)
    ) {
      throw new BackportError(`Invalid credentials: ${e.message}`);
    }

    throw e;
  }
}

// retrieve path to local repo (cwd) if it matches `repoName` / `repoOwner`
export async function getLocalSourceRepoPath(options: ValidConfigOptions) {
  const remotes = await getRepoInfoFromGitRemotes({ cwd: options.cwd });
  const hasMatchingGitRemote = remotes.some(
    (remote) =>
      remote.repoName === options.repoName &&
      remote.repoOwner === options.repoOwner
  );

  return hasMatchingGitRemote ? getGitProjectRootPath(options.cwd) : undefined;
}
