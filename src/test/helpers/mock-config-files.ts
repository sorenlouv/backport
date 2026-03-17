import fs from 'node:fs/promises';
import type { ConfigFileOptions } from '../../options/config-options.js';

export function mockConfigFiles({
  projectConfig,
  globalConfig,
}: {
  projectConfig: ConfigFileOptions;
  globalConfig: ConfigFileOptions;
}) {
  vi.spyOn(fs, 'readFile').mockImplementation(((filepath: string) => {
    if (filepath === '/path/to/project/config') {
      return Promise.resolve(JSON.stringify(projectConfig));
    }

    if (filepath.endsWith('.backport/config.json')) {
      return Promise.resolve(JSON.stringify(globalConfig));
    }
  }) as typeof fs.readFile);
}
