import { BackportOptions } from '../../../options/options';
import { getTestCredentials } from '../../../test/private/getTestCredentials';
import { fetchAuthorId } from './fetchAuthorId';

describe('fetchAuthorId', () => {
  let accessToken: string;

  beforeAll(async () => {
    const config = await getTestCredentials();
    accessToken = config.accessToken;
  });

  describe('all = true', () => {
    it('returns null', async () => {
      const options = {
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        all: true,
      } as BackportOptions;

      expect(await fetchAuthorId(options)).toEqual(null);
    });
  });

  describe('all = false', () => {
    it('returns author id', async () => {
      const options = {
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
        all: false,
        author: 'sqren',
      } as BackportOptions;

      expect(await fetchAuthorId(options)).toEqual('MDQ6VXNlcjIwOTk2Ng==');
    });
  });
});
