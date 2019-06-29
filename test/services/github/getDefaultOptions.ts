import { BackportOptions } from '../../../src/options/options';

export function getDefaultOptions(options: Partial<BackportOptions> = {}) {
  return {
    repoOwner: 'elastic',
    repoName: 'kibana',
    accessToken: 'myAccessToken',
    username: 'sqren',
    apiHostname: 'api.github.com',
    ...options
  } as BackportOptions;
}
