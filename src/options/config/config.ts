import { PromiseReturnType } from '../../types/PromiseReturnType';
import { getGlobalConfig } from './globalConfig';
import { getProjectConfig } from './projectConfig';

export type OptionsFromConfigFiles = PromiseReturnType<
  typeof getOptionsFromConfigFiles
> &
  Record<string, unknown>;
export async function getOptionsFromConfigFiles() {
  const [projectConfig, globalConfig] = await Promise.all([
    getProjectConfig(),
    getGlobalConfig(),
  ]);
  // global and project config combined
  return { ...globalConfig, ...projectConfig };
}
