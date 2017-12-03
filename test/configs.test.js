const configs = require('../src/lib/configs');

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
