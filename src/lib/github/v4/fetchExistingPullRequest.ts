import { ValidConfigOptions } from '../../../options/options';
import { PullRequestPayload } from '../v3/getPullRequest/createPullRequest';
import { getV4Client } from './apiRequestV4';

export async function fetchExistingPullRequest({
  options,
  prPayload,
}: {
  options: ValidConfigOptions;
  prPayload: PullRequestPayload;
}) {
  const { githubApiBaseUrlV4, accessToken } = options;
  const { repoForkOwner, head } = splitHead(prPayload);
  const client = getV4Client({ githubApiBaseUrlV4, accessToken });
  const res = await client.ExistingPullRequest({
    repoOwner: repoForkOwner,
    repoName: prPayload.repo,
    base: prPayload.base,
    head: head,
  });

  const existingPullRequest =
    res.data.repository?.ref?.associatedPullRequests.edges?.[0]?.node;

  if (!existingPullRequest) {
    return;
  }

  return {
    url: existingPullRequest.url,
    number: existingPullRequest.number,
  };
}

function splitHead(prPayload: PullRequestPayload) {
  const [repoForkOwner, head] = prPayload.head.split(':');
  return { repoForkOwner, head };
}
