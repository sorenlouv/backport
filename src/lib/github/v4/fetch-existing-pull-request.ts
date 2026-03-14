import { first } from 'lodash-es';
import { graphql } from '../../../graphql/generated/index.js';
import type { ValidConfigOptions } from '../../../options/options.js';
import type { PullRequestPayload } from '../v3/getPullRequest/create-pull-request.js';
import { graphqlRequest, GithubV4Exception } from './client/graphql-client.js';

export async function fetchExistingPullRequest({
  options,
  prPayload,
}: {
  options: ValidConfigOptions;
  prPayload: PullRequestPayload;
}) {
  const { githubApiBaseUrlV4, accessToken } = options;
  const query = graphql(`
    query ExistingPullRequest(
      $repoOwner: String!
      $repoName: String!
      $base: String!
      $head: String!
    ) {
      repository(owner: $repoOwner, name: $repoName) {
        name
        ref(qualifiedName: $head) {
          name
          associatedPullRequests(
            first: 1
            states: OPEN
            baseRefName: $base
            headRefName: $head
          ) {
            edges {
              node {
                number
                url
              }
            }
          }
        }
      }
    }
  `);

  const { repoForkOwner, head } = splitHead(prPayload);

  const variables = {
    repoOwner: repoForkOwner,
    repoName: prPayload.repo,
    base: prPayload.base,
    head: head,
  };
  const result = await graphqlRequest(
    { accessToken, githubApiBaseUrlV4 },
    query,
    variables,
  );

  if (result.error) {
    throw new GithubV4Exception(result);
  }

  const existingPullRequest = first(
    result.data?.repository?.ref?.associatedPullRequests.edges,
  );

  if (!existingPullRequest?.node) {
    return;
  }

  return {
    url: existingPullRequest.node.url,
    number: existingPullRequest.node.number,
  };
}

function splitHead(prPayload: PullRequestPayload) {
  const [repoForkOwner, head] = prPayload.head.split(':');
  return { repoForkOwner, head };
}
