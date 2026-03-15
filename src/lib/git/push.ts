import type { ValidConfigOptions } from '../../options/options.js';
import { BackportError } from '../backport-error.js';
import { SpawnError, spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';
import { ora } from '../ora.js';
import { getRepoForkOwner } from './remote.js';

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
    `Pushing branch "${repoForkOwner}:${backportBranch}"`,
  ).start();

  try {
    const cwd = getRepoPath(options);
    const res = await spawnPromise(
      'git',
      ['push', repoForkOwner, `${backportBranch}:${backportBranch}`, '--force'],
      cwd,
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
        `Error pushing to https://github.com/${repoForkOwner}/${options.repoName}. Repository does not exist. Either fork the repository (https://github.com/${options.repoOwner}/${options.repoName}) or disable fork mode via "--no-fork".\nRead more about fork mode in the docs: https://github.com/sorenlouv/backport/blob/main/docs/config-file-options.md#fork`,
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
