import type { OperationResultWithMeta } from './client/graphql-client.js';
import { getInvalidGithubTokenMessage } from './get-invalid-github-token-message.js';

describe('getInvalidGithubTokenMessage', () => {
  describe('when status code is', () => {
    it('should handle invalid github token (no token provided)', () => {
      const result = {
        statusCode: 401,
        responseHeaders: new Headers({}),
      } as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toContain('The GitHub token "undefined" is invalid');
    });

    it('should handle invalid github token (token provided)', () => {
      const result = {
        statusCode: 401,
        responseHeaders: new Headers({}),
      } as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
          githubToken: 'ghp_abc123xyz789',
        }),
      ).toContain('The GitHub token "ghp_...z789" is invalid');
    });

    it('should handle SSO error', () => {
      const result = {
        statusCode: 200,
        responseHeaders: new Headers({
          'x-github-sso': 'required; url=https://ssourl.com',
        }),
        error: {
          graphQLErrors: [
            {
              type: 'FORBIDDEN',
              extensions: { saml_failure: true },
              message:
                'Resource protected by organization SAML enforcement. You must grant your Personal Access token access to this organization.',
            },
          ],
        },
      } as unknown as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toMatchInlineSnapshot(`
        "Please follow the link to authorize your GitHub token with SSO:

        https://ssourl.com"
      `);
    });

    it('should handle non-existing repo', () => {
      const result = {
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
      } as unknown as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toBe(`The repository "elastic/kibana" doesn't exist`);
    });

    it('should handle insufficient permissions (oauth scopes)', () => {
      const result = {
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
      } as unknown as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toMatchInlineSnapshot(`
        "You do not have access to the repository "elastic/kibana". Please make sure your GitHub token has the required scopes.

        Required scopes: a,b,c
        Granted scopes: a,b"
      `);
    });

    it('should ignore whitespace when comparing scopes', () => {
      const result = {
        statusCode: 200,
        responseHeaders: new Headers({
          'x-oauth-scopes': 'gist, read:org, repo, workflow',
          'x-accepted-oauth-scopes': 'repo',
        }),
        error: {
          graphQLErrors: [
            { originalError: { type: 'NOT_FOUND' }, path: ['repository'] },
          ],
        },
      } as unknown as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toBe(`The repository "elastic/kibana" doesn't exist`);
    });

    it('should not handle unknown cases', () => {
      const result = {
        statusCode: 500,
        responseHeaders: {},
      } as OperationResultWithMeta;

      return expect(
        getInvalidGithubTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toBe(undefined);
    });
  });
});
