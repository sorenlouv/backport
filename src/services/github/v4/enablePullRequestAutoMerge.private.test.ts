import crypto from 'crypto';
import { Octokit } from '@octokit/rest';
import { ValidConfigOptions } from '../../../options/options';
import { getDevAccessToken } from '../../../test/private/getDevAccessToken';
import { createPullRequest, PullRequestPayload } from '../v3/createPullRequest';
import { disablePullRequestAutoMerge } from './disablePullRequestAutoMerge';
import { enablePullRequestAutoMerge } from './enablePullRequestAutoMerge';
import { fetchPullRequestAutoMergeMethod } from './fetchPullRequestAutoMergeMethod';

// The test repo requires auto-merge being enabled in options, as well as all merge types enabled (merge, squash, rebase)
// The test pull requests should be open, and not currently able to be merged (e.g. because it requires an approval),
// otherwise it will be merged when auto-merge is turned on
const TEST_REPO_OWNER = 'backport-org';
const TEST_REPO_NAME = 'repo-with-auto-merge-enabled';
const COMMIT_SHA = 'e5aac78e2d0f8cd6ef968fd63f32388010d22d1b';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function closePr(octokit: Octokit, pullNumber: number) {
  await octokit.pulls.update({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    pull_number: pullNumber,
    state: 'closed',
  });
}

async function createPr(options: ValidConfigOptions, branchName: string) {
  const prPayload: PullRequestPayload = {
    base: 'main',
    head: branchName,
    body: 'testing...',
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    title: 'my pr title',
  };

  const { number } = await createPullRequest({ options, prPayload });
  return number;
}

async function deleteBranch(octokit: Octokit, branchName: string) {
  await octokit.git.deleteRef({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    ref: `heads/${branchName}`,
  });
}

async function createBranch(octokit: Octokit, branchName: string, sha: string) {
  await octokit.git.createRef({
    owner: TEST_REPO_OWNER,
    repo: TEST_REPO_NAME,
    ref: `refs/heads/${branchName}`,
    sha,
  });
}

// causes flaky test runs on CI because parallel builds are racing each other
// might also be an issue with Github's API being slow at updating after a mutation happens
// eslint-disable-next-line jest/no-disabled-tests
describe('enablePullRequestAutoMerge', () => {
  let pullNumber: number;
  let branchName: string;
  let octokit: Octokit;
  let options: ValidConfigOptions;

  beforeAll(async () => {
    const accessToken = await getDevAccessToken();
    const randomString = crypto.randomBytes(4).toString('hex');
    branchName = `test-${randomString}`;

    options = {
      accessToken,
      githubApiBaseUrlV4: 'https://api.github.com/graphql',
      repoOwner: TEST_REPO_OWNER,
      repoName: TEST_REPO_NAME,
    } as ValidConfigOptions;

    octokit = new Octokit({ auth: accessToken });
    await createBranch(octokit, branchName, COMMIT_SHA);
    pullNumber = await createPr(options, branchName);
  });

  // cleanup
  afterAll(async () => {
    await closePr(octokit, pullNumber);
    await deleteBranch(octokit, branchName);
  });

  // reset auto-merge state between runs
  afterEach(async () => {
    await disablePullRequestAutoMerge(options, pullNumber);
  });

  it('should initially have auto-merge disabled', async () => {
    const autoMergeMethod = await fetchPullRequestAutoMergeMethod(
      options,
      pullNumber
    );
    expect(autoMergeMethod).toBe(undefined);
  });

  it('should enable auto-merge via merge', async () => {
    await enablePullRequestAutoMerge(
      { ...options, autoMergeMethod: 'merge' },
      pullNumber
    );

    // ensure Github API reflects the change before querying
    await sleep(100);

    const autoMergeMethod = await fetchPullRequestAutoMergeMethod(
      options,
      pullNumber
    );
    expect(autoMergeMethod).toBe('MERGE');
  });

  it('should not enable auto-merge via rebase because it is disallowed', async () => {
    await enablePullRequestAutoMerge(
      { ...options, autoMergeMethod: 'rebase' },
      pullNumber
    );

    // ensure Github API reflects the change before querying
    await sleep(100);

    const autoMergeMethod = await fetchPullRequestAutoMergeMethod(
      options,
      pullNumber
    );
    expect(autoMergeMethod).toBe(undefined);
  });

  it('should enable auto-merge via squash', async () => {
    await enablePullRequestAutoMerge(
      { ...options, autoMergeMethod: 'squash' },
      pullNumber
    );

    // ensure Github API reflects the change before querying
    await sleep(100);

    const autoMergeMethod = await fetchPullRequestAutoMergeMethod(
      options,
      pullNumber
    );
    expect(autoMergeMethod).toBe('SQUASH');
  });
});
