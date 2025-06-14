import type { OptionsFromCliArgs } from '../cli-args';
import type { ConfigFileOptions } from '../config-options';
import { getGlobalConfig } from './global-config';
import { getProjectConfig } from './project-config';

export type OptionsFromConfigFiles = Awaited<
  ReturnType<typeof getOptionsFromConfigFiles>
>;
export async function getOptionsFromConfigFiles({
  optionsFromCliArgs,
  optionsFromModule,
}: {
  optionsFromCliArgs: OptionsFromCliArgs;
  optionsFromModule: ConfigFileOptions;
}) {
  const projectConfigFile =
    optionsFromCliArgs.projectConfigFile ?? optionsFromModule.projectConfigFile;

  const globalConfigFile = optionsFromCliArgs.globalConfigFile;

  const cwd = optionsFromCliArgs.cwd ?? process.cwd();
  const [projectConfig, globalConfig] = await Promise.all([
    getProjectConfig(projectConfigFile, cwd),
    getGlobalConfig(globalConfigFile),
  ]);

  return {
    ...globalConfig,
    ...projectConfig,
    ...optionsFromModule,
  };
}
