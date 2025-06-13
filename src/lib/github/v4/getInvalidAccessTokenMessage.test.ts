import { OperationResultWithMeta } from './client/graphqlClient';
import { getInvalidAccessTokenMessage } from './getInvalidAccessTokenMessage';

describe('getInvalidAccessTokenMessage', () => {
  describe('when status code is', () => {
    it('should handle invalid access token', () => {
      const result = {
        statusCode: 401,
        responseHeaders: new Headers({}),
      } as OperationResultWithMeta;

      return expect(
        getInvalidAccessTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toContain('Please check your access token and make sure it is valid');
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
        getInvalidAccessTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toMatchInlineSnapshot(`
"Please follow the link to authorize your personal access token with SSO:

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
        getInvalidAccessTokenMessage({
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
        getInvalidAccessTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toMatchInlineSnapshot(`
"You do not have access to the repository "elastic/kibana". Please make sure your access token has the required scopes.

Required scopes: a,b,c
Access token scopes: a,b"
`);
    });

    it('should not handle unknown cases', () => {
      const result = {
        statusCode: 500,
        responseHeaders: {},
      } as OperationResultWithMeta;

      return expect(
        getInvalidAccessTokenMessage({
          result,
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      ).toBe(undefined);
    });
  });
});
