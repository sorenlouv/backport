import fs from 'node:fs/promises';
import { mockConfigFiles } from '../../test/mock-config-files.js';
import { getOptionsFromConfigFiles } from './config.js';

describe('getOptionsFromConfigFiles', () => {
  let res: Awaited<ReturnType<typeof getOptionsFromConfigFiles>>;

  beforeEach(async () => {
    vi.spyOn(fs, 'writeFile').mockResolvedValueOnce();
    vi.spyOn(fs, 'chmod').mockResolvedValue();
    mockConfigFiles({
      globalConfig: { accessToken: 'abc', editor: 'vim' },
      projectConfig: { repoName: 'kibana', repoOwner: 'elastic' },
    });

    res = await getOptionsFromConfigFiles({
      optionsFromCliArgs: {},
      optionsFromModule: {},
    });
  });

  it('should return values from config files', () => {
    expect(res).toEqual({
      accessToken: 'abc',
      editor: 'vim',
      repoName: 'kibana',
      repoOwner: 'elastic',
    });
  });
});
