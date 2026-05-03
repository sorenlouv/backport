import type { ValidConfigOptions } from '../../../options/options.js';
import { getDevGithubToken } from '../../../test/helpers/get-dev-github-token.js';
import { fetchAuthorId } from './fetch-author-id.js';

const githubToken = getDevGithubToken();

describe('fetchAuthorId', () => {
  describe('author = null', () => {
    it('returns null', async () => {
      const options = {
        githubToken,
        author: null,
      } as ValidConfigOptions;

      expect(await fetchAuthorId(options)).toEqual(null);
    });
  });

  describe('author is "sorenlouv"', () => {
    it('returns author id', async () => {
      const options = {
        githubToken,
        author: 'sorenlouv',
      } as ValidConfigOptions;

      expect(await fetchAuthorId(options)).toEqual('MDQ6VXNlcjIwOTk2Ng==');
    });
  });
});
