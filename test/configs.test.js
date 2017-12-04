const configs = require('../src/lib/configs');
const rpc = require('../src/lib/rpc');
const inquirer = require('inquirer');

const os = require('os');

describe('maybeCreateGlobalConfig', () => {
  it('should create config and succeed', () => {
    os.homedir = jest.fn(() => '/myHomeDir');
    rpc.writeFile = jest.fn(() => Promise.resolve());

    return configs.maybeCreateGlobalConfig().then(() => {
      expect(rpc.writeFile).toHaveBeenCalledWith(
        '/myHomeDir/.backport/config.json',
        expect.stringContaining('"accessToken": ""'),
        { flag: 'wx', mode: 384 }
      );
    });
  });

  it('should not fail if config already exists', () => {
    const err = new Error();
    err.code = 'EEXIST';
    rpc.writeFile = jest.fn(() => Promise.reject(err));
    return configs.maybeCreateGlobalConfig();
  });
});

describe('mergeConfigs', () => {
  it('should use globalConfig if projectConfig is missing', () => {
    const projectConfig = null;
    const globalConfig = {
      accessToken: 'myAccessToken',
      username: 'sqren',
      projects: [
        {
          upstream: 'elastic/kibana',
          branches: ['6.1', '6.0']
        }
      ]
    };
    const upstream = 'elastic/kibana';
    expect(configs.mergeConfigs(projectConfig, globalConfig, upstream)).toEqual(
      {
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        branches: ['6.1', '6.0']
      }
    );
  });

  it('should use projectConfig', () => {
    const projectConfig = {
      upstream: 'elastic/kibana',
      branches: ['6.2', '6.0']
    };
    const globalConfig = {
      accessToken: 'myAccessToken',
      username: 'sqren',
      projects: []
    };
    const upstream = 'elastic/kibana';
    expect(configs.mergeConfigs(projectConfig, globalConfig, upstream)).toEqual(
      {
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        branches: ['6.2', '6.0']
      }
    );
  });

  it('should override projectConfig with globalConfig', () => {
    const projectConfig = {
      upstream: 'elastic/kibana',
      branches: ['6.2', '6.0']
    };
    const globalConfig = {
      accessToken: 'myAccessToken',
      username: 'sqren',
      projects: [
        {
          upstream: 'elastic/kibana',
          branches: ['6.1', '6.0']
        }
      ]
    };
    const upstream = 'elastic/kibana';
    expect(configs.mergeConfigs(projectConfig, globalConfig, upstream)).toEqual(
      {
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        branches: ['6.1', '6.0']
      }
    );
  });
});

describe('getCombinedConfig', () => {
  describe('when both configs are empty', () => {
    it('should throw InvalidConfigError', () => {
      expect.assertions(1);
      return configs._getCombinedConfig(null, {}).catch(e => {
        expect(e.message).toEqual('.backportrc.json was not found');
      });
    });
  });

  describe('when project config exists', () => {
    beforeEach(() => {
      return configs
        ._getCombinedConfig(
          {
            upstream: 'elastic/kibana',
            branches: ['6.x', '6.1']
          },
          {
            username: 'sqren',
            accessToken: 'myAccessToken'
          }
        )
        .then(res => {
          this.res = res;
        });
    });

    it('should return correct config', () => {
      expect(this.res).toEqual({
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        branches: ['6.x', '6.1']
      });
    });
  });

  describe('when project config does not exists and global config has project', () => {
    beforeEach(() => {
      jest.spyOn(inquirer, 'prompt').mockReturnValueOnce(
        Promise.resolve({
          promptResult: 'elastic/kibana'
        })
      );

      return configs
        ._getCombinedConfig(null, {
          projects: [
            {
              username: 'sqren',
              accessToken: 'myAccessToken',
              upstream: 'elastic/kibana',
              branches: ['6.x', '6.1']
            }
          ]
        })
        .then(res => {
          this.res = res;
        });
    });

    it('should return correct config', () => {
      expect(this.res).toEqual({
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        branches: ['6.x', '6.1']
      });
    });
  });
});
