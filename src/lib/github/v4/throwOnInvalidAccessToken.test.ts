import {
  GithubV4Exception,
  OperationResultWithMeta,
} from './fetchCommits/graphqlClient';
import { throwOnInvalidAccessToken } from './throwOnInvalidAccessToken';

describe('throwOnInvalidAccessToken', () => {
  describe('when status code is', () => {
    it('should handle invalid access token', () => {
      const error = new GithubV4Exception({
        statusCode: 401,
        responseHeaders: new Headers({}),
      } as OperationResultWithMeta);

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        }),
      ).toThrow('Please check your access token and make sure it is valid');
    });

    it('should handle SSO error', () => {
      const error = new GithubV4Exception({
        statusCode: 200,
        responseHeaders: new Headers({
          'x-github-sso': 'required; url=https://ssourl.com',
        }),
        error: {
          graphQLErrors: [{ originalError: { type: 'FORBIDDEN' } }],
        },
      } as unknown as OperationResultWithMeta);

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    it('should handle non-existing repo', () => {
      const error = new GithubV4Exception({
        statusCode: 200,
        responseHeaders: new Headers({
          'x-oauth-scopes': 'a,b,c',
          'x-accepted-oauth-scopes': 'a,b,c',
        }),
        error: {
          graphQLErrors: [
            { originalError: { type: 'NOT_FOUND' }, path: ['repository'] },
          ],
        },
      } as unknown as OperationResultWithMeta);

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        }),
      ).toThrow(`The repository "elastic/kibana" doesn't exist`);
    });

    it('should handle insufficient permissions (oauth scopes)', () => {
      const error = new GithubV4Exception({
        statusCode: 200,
        responseHeaders: new Headers({
          'x-oauth-scopes': 'a,b',
          'x-accepted-oauth-scopes': 'a,b,c',
        }),
        error: {
          graphQLErrors: [
            { originalError: { type: 'NOT_FOUND' }, path: ['repository'] },
          ],
        },
      } as unknown as OperationResultWithMeta);

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    it('should not handle unknown cases', () => {
      const error = new GithubV4Exception({
        statusCode: 500,
        responseHeaders: {},
      } as OperationResultWithMeta);

      return expect(
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        }),
      ).toBe(undefined);
    });
  });
});
