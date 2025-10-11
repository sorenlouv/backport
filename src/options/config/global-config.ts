import { chmod, writeFile } from 'fs/promises';
import makeDir from 'make-dir';
import { BackportError } from '../../lib/backport-error';
import { getBackportDirPath, getGlobalConfigPath } from '../../lib/env';
import { isErrnoError } from '../../utils/is-errno-error';
import type { ConfigFileOptions } from '../config-options';
import { readConfigFile } from './read-config-file';

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
  await makeDir(getBackportDirPath());

  const configTemplate = getConfigTemplate();
  const didCreate = await createGlobalConfigIfNotExist(
    globalConfigPath,
    configTemplate,
  );
  await ensureCorrectPermissions(globalConfigPath);
  return didCreate;
}

function ensureCorrectPermissions(globalConfigPath: string) {
  return chmod(globalConfigPath, '600');
}

export async function createGlobalConfigIfNotExist(
  globalConfigPath: string,
  configTemplate: string,
) {
  try {
    await writeFile(globalConfigPath, configTemplate, {
      flag: 'wx', // create and write file. Error if it already exists
      mode: 0o600, // give the owner read-write privleges, no access for others
    });
    return true;
  } catch (e) {
    if (isErrnoError(e)) {
      // ignore error if file already exists
      const FILE_ALREADY_EXISTS = 'EEXIST';
      if (e.code === FILE_ALREADY_EXISTS) {
        return false;
      }

      // handle error if folder does not exist
      const FOLDER_NOT_EXISTS = 'ENOENT';
      if (e.code === FOLDER_NOT_EXISTS) {
        throw new BackportError(
          `The .backport folder (${globalConfigPath}) does not exist. `,
        );
      }

      throw e;
    }
  }
}

function getConfigTemplate() {
  return `{
    // Create a personal access token here: https://github.com/settings/tokens
    // Must have "Repo: Full control of private repositories"
    // You can use environment variables with the syntax \${VARIABLE_NAME}
    // For example: "accessToken": "\${GITHUB_ACCESS_TOKEN}"
    "accessToken": ""
  }`;
}
