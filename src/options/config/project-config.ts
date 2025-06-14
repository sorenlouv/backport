import path from 'path';
import findUp from 'find-up';
import { readConfigFile } from '../config/read-config-file';
import type { ConfigFileOptions } from '../config-options';

export async function getProjectConfig(
  projectConfigFile: string | undefined,
  cwd: string | undefined,
): Promise<ConfigFileOptions | undefined> {
  const filepath = projectConfigFile
    ? path.resolve(projectConfigFile)
    : await findUp('.backportrc.json', { cwd });

  if (!filepath) {
    return;
  }

  return readConfigFile(filepath);
}
