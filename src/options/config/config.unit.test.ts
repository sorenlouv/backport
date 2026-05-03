import fs from 'node:fs/promises';
import { mockConfigFiles } from '../../test/helpers/mock-config-files.js';
import { getOptionsFromConfigFiles } from './config.js';

describe('getOptionsFromConfigFiles', () => {
  let res: Awaited<ReturnType<typeof getOptionsFromConfigFiles>>;

  beforeEach(async () => {
    vi.spyOn(fs, 'writeFile').mockResolvedValueOnce();
    vi.spyOn(fs, 'chmod').mockResolvedValue();
    mockConfigFiles({
      globalConfig: { githubToken: 'abc', editor: 'vim' },
      projectConfig: { repoName: 'kibana', repoOwner: 'elastic' },
    });

    res = await getOptionsFromConfigFiles({
      optionsFromCliArgs: {},
      optionsFromModule: {},
    });
  });

  it('should return globalConfig and projectConfig separately', () => {
    expect(res.globalConfig).toEqual({
      githubToken: 'abc',
      editor: 'vim',
    });
    expect(res.projectConfig).toEqual({
      repoName: 'kibana',
      repoOwner: 'elastic',
    });
  });
});
