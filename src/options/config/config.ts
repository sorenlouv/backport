import type { OptionsFromCliArgs } from '../cli-args.js';
import type { ConfigFileOptions } from '../config-options.js';
import { getGlobalConfig } from './global-config.js';
import { getProjectConfig } from './project-config.js';

/**
 * Loads global and project config files, returning them as separate objects
 * so the caller can apply each layer with explicit precedence.
 */
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
    getProjectConfig({ projectConfigFile, cwd }),
    getGlobalConfig(globalConfigFile),
  ]);

  return {
    globalConfig: globalConfig ?? {},
    projectConfig: projectConfig ?? {},
  };
}
