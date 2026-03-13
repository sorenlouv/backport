import fs from 'fs/promises';
import type { ConfigFileOptions } from '../options/config-options.js';

export function mockConfigFiles({
  projectConfig,
  globalConfig,
}: {
  projectConfig: ConfigFileOptions;
  globalConfig: ConfigFileOptions;
}) {
  vi.spyOn(fs, 'readFile')
    //@ts-expect-error
    .mockImplementation(async (filepath: string) => {
      if (filepath === '/path/to/project/config') {
        return JSON.stringify(projectConfig);
      }

      if (filepath.endsWith('.backport/config.json')) {
        return JSON.stringify(globalConfig);
      }
    });
}
