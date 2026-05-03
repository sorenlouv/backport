import fs from 'node:fs/promises';
import { BackportError } from '../../lib/backport-error.js';
import { getBackportDirPath, getGlobalConfigPath } from '../../lib/env.js';
import { isErrnoError } from '../../utils/is-errno-error.js';
import type { ConfigFileOptions } from '../config-options.js';
import { readConfigFile } from './read-config-file.js';

export async function getGlobalConfig(
  globalConfigFile?: string,
): Promise<ConfigFileOptions> {
  const globalConfigPath = getGlobalConfigPath(globalConfigFile);
  await createGlobalConfigAndFolderIfNotExist(globalConfigPath);
  return readConfigFile(globalConfigPath);
}

export async function createGlobalConfigAndFolderIfNotExist(
  globalConfigPath: string,
) {
  // create .backport folder
  await fs.mkdir(getBackportDirPath(), { recursive: true });

  const configTemplate = getConfigTemplate();
  const didCreate = await createGlobalConfigIfNotExist(
    globalConfigPath,
    configTemplate,
  );
  await ensureCorrectPermissions(globalConfigPath);
  return didCreate;
}

function ensureCorrectPermissions(globalConfigPath: string) {
  return fs.chmod(globalConfigPath, '600');
}

export async function createGlobalConfigIfNotExist(
  globalConfigPath: string,
  configTemplate: string,
) {
  try {
    await fs.writeFile(globalConfigPath, configTemplate, {
      flag: 'wx', // create and write file. Error if it already exists
      mode: 0o600, // give the owner read-write privleges, no access for others
    });
    return true;
  } catch (error) {
    if (isErrnoError(error)) {
      // ignore error if file already exists
      const FILE_ALREADY_EXISTS = 'EEXIST';
      if (error.code === FILE_ALREADY_EXISTS) {
        return false;
      }

      // handle error if folder does not exist
      const FOLDER_NOT_EXISTS = 'ENOENT';
      if (error.code === FOLDER_NOT_EXISTS) {
        throw new BackportError({
          code: 'config-error-exception',
          message: `The .backport folder (${globalConfigPath}) does not exist. `,
        });
      }

      throw error;
    }
  }
}

function getConfigTemplate() {
  return `{
    // Create a GitHub token here: https://github.com/settings/tokens
    // Must have "Repo: Full control of private repositories"
    "githubToken": ""
  }`;
}
