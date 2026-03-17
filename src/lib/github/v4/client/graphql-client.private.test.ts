import { graphql } from '../../../../graphql/generated/index.js';
import { getDevAccessToken } from '../../../../test/helpers/get-dev-access-token.js';
import type {
  GitHubGraphQLError,
  OperationResultWithMeta,
} from './graphql-client.js';
import { graphqlRequest } from './graphql-client.js';

const getViewerQuery = graphql(`
  query GetViewer {
    viewer {
      login
    }
  }
`);

const getRepoQuery = graphql(`
  query GetRepo($repoOwner: String!, $repoName: String!) {
    repository(owner: $repoOwner, name: $repoName) {
      name
    }
  }
`);

describe('graphqlClient', () => {
  let result: OperationResultWithMeta;

  describe('when the access token is invalid', () => {
    beforeAll(async () => {
      result = await graphqlRequest(
        {
          accessToken: 'foobar',
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
        },
        getViewerQuery,
        {},
      );
    });

    it('includes status code', () => {
      expect(result.statusCode).toBe(401);
    });

    it('does not include graphql errors', () => {
      expect(result.error?.graphQLErrors).toEqual([]);
    });

    it('includes error message', () => {
      expect(result.error?.message).toBe('[Network] Unauthorized');
    });
  });

  describe('when the access token is valid', () => {
    const accessToken = getDevAccessToken();
    beforeAll(async () => {
      result = await graphqlRequest(
        {
          accessToken: accessToken,
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
        },
        getViewerQuery,
        {},
      );
    });

    it('includes status code', () => {
      expect(result.statusCode).toBe(200);
    });

    it('includes x-oauth-scopes headers', () => {
      expect(result.responseHeaders?.get('x-oauth-scopes')).toContain('repo');
    });
  });

  describe('when repo is not found', () => {
    const accessToken = getDevAccessToken();
    beforeAll(async () => {
      result = await graphqlRequest(
        {
          accessToken: accessToken,
          githubApiBaseUrlV4: 'https://api.github.com/graphql',
        },
        getRepoQuery,
        {
          repoName: 'backportNonExisting',
          repoOwner: 'sorenlouv',
        },
      );
    });

    it('includes status code', () => {
      expect(result.statusCode).toBe(200);
    });

    it('includes error path', () => {
      expect(result.error?.graphQLErrors[0].path).toEqual(['repository']);
    });

    it('includes error type', () => {
      expect(
        (result.error?.graphQLErrors[0] as GitHubGraphQLError).originalError
          ?.type,
      ).toBe('NOT_FOUND');
    });

    it('includes graphql errors', () => {
      expect(result.error?.graphQLErrors).toMatchInlineSnapshot(`
        [
          [GraphQLError: Could not resolve to a Repository with the name 'sorenlouv/backportNonExisting'.],
        ]
      `);
    });

    it('includes error message', () => {
      expect(result.error?.message).toBe(
        "[GraphQL] Could not resolve to a Repository with the name 'sorenlouv/backportNonExisting'.",
      );
    });

    it('includes x-oauth-scopes headers', () => {
      expect(result.responseHeaders?.get('x-oauth-scopes')).toContain('repo');
    });
  });
});
