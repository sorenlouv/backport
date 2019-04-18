import { getOptionsFromConfigFiles } from '../../../src/lib/options/config/config';
import { PromiseReturnType } from '../../../src/types/commons';
import * as rpc from '../../../src/lib/rpc';

describe('getOptionsFromConfigFiles', () => {
  let res: PromiseReturnType<typeof getOptionsFromConfigFiles>;

  beforeEach(async () => {
    jest.spyOn(rpc, 'readFile').mockImplementation(async filepath => {
      if (typeof filepath !== 'string') {
        throw new Error('unknown filepath');
      }

      if (filepath.includes('/configTemplate.json')) {
        return 'myConfigTemplate';
      } else if (filepath === '/path/to/project/config') {
        return JSON.stringify({
          upstream: 'elastic/kibana',
          branches: ['6.x', '6.1']
        });
      } else if (filepath === '/myHomeDir/.backport/config.json') {
        return JSON.stringify({
          username: 'sqren',
          accessToken: 'myAccessToken'
        });
      }

      throw new Error(`Unknown filepath: "${filepath}"`);
    });
    res = await getOptionsFromConfigFiles();
  });

  it('should return correct config', () => {
    expect(res).toEqual({
      accessToken: 'myAccessToken',
      all: false,
      branchChoices: [
        { checked: false, name: '6.x' },
        { checked: false, name: '6.1' }
      ],
      labels: [],
      multiple: false,
      multipleBranches: true,
      multipleCommits: false,
      upstream: 'elastic/kibana',
      username: 'sqren'
    });
  });
});
