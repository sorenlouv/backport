import { getGlobalConfigPath } from '../lib/env.js';
import { consoleLog } from '../lib/logger.js';
import { createGlobalConfigAndFolderIfNotExist } from '../options/config/global-config.js';

export async function postinstall() {
  try {
    const globalConfigPath = getGlobalConfigPath();
    const didCreate =
      await createGlobalConfigAndFolderIfNotExist(globalConfigPath);
    if (didCreate) {
      consoleLog(`Global config successfully created in ${globalConfigPath}`);
    }
  } catch (error) {
    const stack = error instanceof Error ? error.stack : String(error);
    consoleLog(`Global config could not be created:\n${stack}`);
  }
}
