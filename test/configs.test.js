const configs = require('../src/lib/configs');
const rpc = require('../src/lib/rpc');
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
          versions: ['6.1', '6.0']
        }
      ]
    };
    const upstream = 'elastic/kibana';
    expect(configs.mergeConfigs(projectConfig, globalConfig, upstream)).toEqual(
      {
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        versions: ['6.1', '6.0']
      }
    );
  });

  it('should use projectConfig', () => {
    const projectConfig = {
      upstream: 'elastic/kibana',
      versions: ['6.2', '6.0']
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
        versions: ['6.2', '6.0']
      }
    );
  });

  it('should override projectConfig with globalConfig', () => {
    const projectConfig = {
      upstream: 'elastic/kibana',
      versions: ['6.2', '6.0']
    };
    const globalConfig = {
      accessToken: 'myAccessToken',
      username: 'sqren',
      projects: [
        {
          upstream: 'elastic/kibana',
          versions: ['6.1', '6.0']
        }
      ]
    };
    const upstream = 'elastic/kibana';
    expect(configs.mergeConfigs(projectConfig, globalConfig, upstream)).toEqual(
      {
        accessToken: 'myAccessToken',
        username: 'sqren',
        upstream: 'elastic/kibana',
        versions: ['6.1', '6.0']
      }
    );
  });
});
