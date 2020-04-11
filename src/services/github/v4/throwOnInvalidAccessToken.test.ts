import { throwOnInvalidAccessToken } from './throwOnInvalidAccessToken';

describe('throwOnInvalidAccessToken', () => {
  describe('when status code is', () => {
    it('should handle invalid access token', () => {
      const error = {
        response: {
          status: 401,
          headers: {},
        },
      } as any;

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        })
      ).toThrowError(
        'Please check your access token and make sure it is valid'
      );
    });

    it('should handle SSO error', () => {
      const error = {
        response: {
          status: 200,
          headers: { 'x-github-sso': 'required; url=https://ssourl.com' },
          data: {
            errors: [{ type: 'FORBIDDEN' }],
          },
        },
      } as any;

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        })
      ).toThrowErrorMatchingSnapshot();
    });

    it('should handle non-existing repo', () => {
      const error = {
        response: {
          status: 200,
          headers: {
            'x-oauth-scopes': 'a,b,c',
            'x-accepted-oauth-scopes': 'a,b,c',
          },
          data: {
            errors: [{ type: 'NOT_FOUND' }],
          },
        },
      } as any;

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        })
      ).toThrowError(`The repository "elastic/kibana" doesn't exist`);
    });

    it('should handle insufficient permissions (oauth scopes)', () => {
      const error = {
        response: {
          status: 200,
          headers: {
            'x-oauth-scopes': 'a,b',
            'x-accepted-oauth-scopes': 'a,b,c',
          },
          data: {
            errors: [{ type: 'NOT_FOUND' }],
          },
        },
      } as any;

      return expect(() =>
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        })
      ).toThrowErrorMatchingSnapshot();
    });

    it('should not handle unknown cases', () => {
      const error = {
        response: {
          status: 500,
          headers: {},
        },
      } as any;

      return expect(
        throwOnInvalidAccessToken({
          repoOwner: 'elastic',
          repoName: 'kibana',
          error,
        })
      ).toBe(undefined);
    });
  });
});
