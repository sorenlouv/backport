import { resolve as pathResolve } from 'node:path';
import { uniq } from 'lodash-es';
import type { ValidConfigOptions } from '../../options/options.js';
import { SpawnError, spawnPromise } from '../child-process-promisified.js';
import { getRepoPath } from '../env.js';

export type ConflictingFiles = Awaited<ReturnType<typeof getConflictingFiles>>;
export async function getConflictingFiles(options: ValidConfigOptions) {
  const repoPath = getRepoPath(options);
  try {
    const cwd = repoPath;
    await spawnPromise('git', ['--no-pager', 'diff', '--check'], cwd);

    return [];
  } catch (error) {
    if (error instanceof SpawnError && error.context.code === 2) {
      const files = error.context.stdout
        .split('\n')
        .filter(
          (line: string) =>
            !!line.trim() && !line.startsWith('+') && !line.startsWith('-'),
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
    throw error;
  }
}

async function getFilesFromDiff(
  options: ValidConfigOptions,
  isStaged: boolean,
) {
  const repoPath = getRepoPath(options);
  const cwd = repoPath;
  const res = await spawnPromise(
    'git',
    ['--no-pager', 'diff', '--name-only', ...(isStaged ? ['--cached'] : [])],
    cwd,
  );
  const files = res.stdout
    .split('\n')
    .filter((file) => !!file)
    .map((file) => pathResolve(repoPath, file));

  return uniq(files);
}

// retrieve the list of files that could not be cleanly merged
export function getUnstagedFiles(options: ValidConfigOptions) {
  return getFilesFromDiff(options, false);
}

// retrieve the list of files that are staged and ready to be committed
export function getStagedFiles(options: ValidConfigOptions) {
  return getFilesFromDiff(options, true);
}

// check if git rerere is enabled and what configuration it has
export async function getRerereConfig(options: ValidConfigOptions): Promise<{
  enabled: boolean;
  autoUpdate: boolean;
}> {
  const cwd = getRepoPath(options);

  const getConfigValue = async (key: string): Promise<boolean> => {
    try {
      const res = await spawnPromise(
        'git',
        ['config', '--type=bool', '--get', key],
        cwd,
      );
      return JSON.parse(res.stdout.trim());
    } catch {
      return false;
    }
  };

  const [enabled, autoUpdate] = await Promise.all([
    getConfigValue('rerere.enabled'),
    getConfigValue('rerere.autoUpdate'),
  ]);

  return {
    enabled,
    autoUpdate,
  };
}
