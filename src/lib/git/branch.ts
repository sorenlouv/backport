import type { ValidConfigOptions } from '../../options/options.js';
import { BackportError } from '../backport-error.js';
import { SpawnError, spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';
import { logger } from '../logger.js';
import { ora } from '../ora.js';

export async function fetchBranch(options: ValidConfigOptions, branch: string) {
  const cwd = getRepoPath(options);
  await spawnPromise(
    'git',
    ['fetch', options.repoOwner, `${branch}:${branch}`, '--force'],
    cwd,
  );
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

  const cwd = getRepoPath(options);

  try {
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
      cwd,
    );

    // delete tmp branch (if it still exists)
    try {
      await spawnPromise('git', ['branch', '-D', tmpBranchName], cwd);
    } catch (error) {
      logger.debug(
        `Could not delete temporary branch "${tmpBranchName}": ${error}`,
      );
    }

    // fetch commits for source branch
    await fetchBranch(options, sourceBranch);
  } catch (error) {
    spinner.fail();

    if (error instanceof SpawnError) {
      const invalidRemoteRef = error.context.stderr
        .toLowerCase()
        .match(/couldn't find remote ref (.*)/)
        ?.at(1);

      const invalidCommit = error.context.stderr
        .toLowerCase()
        .match(
          /'(.+) is not a commit and a branch .+ cannot be created from it/,
        )
        ?.at(1);

      const invalidBranch = invalidRemoteRef ?? invalidCommit;

      if (invalidBranch) {
        throw new BackportError(
          `The branch "${invalidBranch}" is invalid or doesn't exist`,
        );
      }

      const invalidRefSpec = error.context.stderr
        .toLowerCase()
        .match(/invalid refspec (.*)/)
        ?.at(1);

      if (invalidRefSpec) {
        throw new BackportError(
          `The remote "${invalidRefSpec}" is invalid or doesn't exist`,
        );
      }
    }

    throw error;
  }

  spinner.succeed();
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
    cwd,
  );

  spinner.stop();
}
