import { graphql } from '../../../../graphql/generated';
import { getDevAccessToken } from '../../../../test/private/getDevAccessToken';
import {
  GitHubGraphQLError,
  OperationResultWithMeta,
  getGraphQLClient,
} from './graphqlClient';

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
      const client = getGraphQLClient({
        accessToken: 'foobar',
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      });
      result = await client.query(getViewerQuery, {});
    });

    it('includes status code', async () => {
      expect(result.statusCode).toBe(401);
    });

    it('does not include graphql errors', async () => {
      expect(result.error?.graphQLErrors).toEqual([]);
    });

    it('includes error message', async () => {
      expect(result.error?.message).toBe('[Network] Unauthorized');
    });
  });

  describe('when the access token is valid', () => {
    const accessToken = getDevAccessToken();
    beforeAll(async () => {
      const client = getGraphQLClient({
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      });
      result = await client.query(getViewerQuery, {});
    });

    it('includes status code', async () => {
      expect(result.statusCode).toBe(200);
    });

    it('includes x-oauth-scopes headers', async () => {
      expect(result.responseHeaders?.get('x-oauth-scopes')).toContain('repo');
    });
  });

  describe('when repo is not found', () => {
    const accessToken = getDevAccessToken();
    beforeAll(async () => {
      const client = getGraphQLClient({
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      });
      result = await client.query(getRepoQuery, {
        repoName: 'backportNonExisting',
        repoOwner: 'sorenlouv',
      });
    });

    it('includes status code', async () => {
      expect(result.statusCode).toBe(200);
    });

    it('includes error path', async () => {
      expect(result.error?.graphQLErrors[0].path).toEqual(['repository']);
    });

    it('includes error type', async () => {
      expect(
        (result.error?.graphQLErrors[0] as GitHubGraphQLError).originalError
          ?.type,
      ).toBe('NOT_FOUND');
    });

    it('includes graphql errors', async () => {
      expect(result.error?.graphQLErrors).toMatchInlineSnapshot(`
[
  [GraphQLError: Could not resolve to a Repository with the name 'sorenlouv/backportNonExisting'.],
]
`);
    });

    it('includes error message', async () => {
      expect(result.error?.message).toBe(
        "[GraphQL] Could not resolve to a Repository with the name 'sorenlouv/backportNonExisting'.",
      );
    });

    it('includes x-oauth-scopes headers', async () => {
      expect(result.responseHeaders?.get('x-oauth-scopes')).toContain('repo');
    });
  });
});
