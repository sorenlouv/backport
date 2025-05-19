import { graphql } from '../../../graphql/generated';
import { getDevAccessToken } from '../../../test/private/getDevAccessToken';
import {
  GithubV4Exception,
  getGraphQLClient,
} from './fetchCommits/graphqlClient';

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

describe('GithubV4Exception', () => {
  let error: GithubV4Exception<unknown>;

  describe('when the access token is invalid', () => {
    beforeAll(async () => {
      const client = getGraphQLClient({
        accessToken: 'foobar',
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      });
      const result = await client.query(getViewerQuery, {});

      error = new GithubV4Exception(result);
    });

    it('includes status code', async () => {
      expect(error.result.statusCode).toBe(401);
    });

    it('does not include graphql errors', async () => {
      expect(error.result.error?.graphQLErrors).toEqual([]);
    });

    it('includes error message', async () => {
      expect(error.result.error?.message).toBe('[Network] Unauthorized');
    });

    it('includes custom github response headers', async () => {
      expect(error.result.responseHeaders?.has('x-github-request-id')).toBe(
        true,
      );
    });
  });

  describe('when the access token is valid', () => {
    const accessToken = getDevAccessToken();
    beforeAll(async () => {
      const client = getGraphQLClient({
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      });
      const result = await client.query(getViewerQuery, {});

      error = new GithubV4Exception(result);
    });

    it('includes status code', async () => {
      expect(error.result.statusCode).toBe(200);
    });

    it('includes custom github response headers', async () => {
      expect(error.result.responseHeaders?.get('x-oauth-scopes')).toBe(
        'repo, workflow',
      );
    });
  });

  describe('when repo is not found', () => {
    const accessToken = getDevAccessToken();
    beforeAll(async () => {
      const client = getGraphQLClient({
        accessToken: accessToken,
        githubApiBaseUrlV4: 'https://api.github.com/graphql',
      });
      const result = await client.query(getRepoQuery, {
        repoName: 'backportNonExisting',
        repoOwner: 'sorenlouv',
      });

      error = new GithubV4Exception(result);
    });

    it('includes status code', async () => {
      expect(error.result.statusCode).toBe(200);
    });

    it('includes error path', async () => {
      expect(error.result.error?.graphQLErrors[0].path).toEqual(['repository']);
    });

    it('includes error type', async () => {
      //@ts-expect-error
      expect(error.result.error?.graphQLErrors[0].originalError.type).toBe(
        'NOT_FOUND',
      );
    });

    it('includes graphql errors', async () => {
      expect(error.result.error?.graphQLErrors).toMatchInlineSnapshot(`
[
  [GraphQLError: Could not resolve to a Repository with the name 'sorenlouv/backportNonExisting'.],
]
`);
    });

    it('includes error message', async () => {
      expect(error.result.error?.message).toBe(
        "[GraphQL] Could not resolve to a Repository with the name 'sorenlouv/backportNonExisting'.",
      );
    });

    it('includes custom github response headers', async () => {
      expect(error.result.responseHeaders?.get('x-oauth-scopes')).toBe(
        'repo, workflow',
      );
    });
  });
});
