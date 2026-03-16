/**
 * Integration tests for backportRun() that exercise the full flow
 * from CLI args → options → commits → cherry-pick → PR creation,
 * with all GitHub API calls mocked via vi.spyOn(globalThis, 'fetch')
 * and git commands mocked via vi.spyOn.
 *
 * These tests fill the gap between fully-mocked unit tests and
 * credential-requiring private/mutation tests.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import type { BackportResponse } from '../../../backport-run.js';
import { backportRun } from '../../../backport-run.js';
import * as childProcess from '../../../lib/child-process-promisified.js';
import * as setupRepoModule from '../../../lib/setup-repo.js';
import { mockConfigFiles } from '../../mock-config-files.js';
import {
  cleanupFetchMock,
  mockFetchResponse,
  mockGraphqlRequest,
  setupFetchMock,
} from '../../mock-fetch.js';

const GRAPHQL_URL = 'http://localhost/graphql';
const REST_URL = 'http://localhost/rest';

vi.setConfig({ testTimeout: 15_000 });

describe('backportRun integration', () => {
  beforeEach(() => {
    setupFetchMock();
    vi.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
    vi.spyOn(fs, 'writeFile').mockResolvedValue();
    vi.spyOn(fs, 'chmod').mockResolvedValue();

    mockConfigFiles({
      projectConfig: {
        repoOwner: 'my-org',
        repoName: 'my-repo',
        targetBranchChoices: ['7.x', '8.0'],
        githubApiBaseUrlV4: GRAPHQL_URL,
        githubApiBaseUrlV3: REST_URL,
      },
      globalConfig: {
        accessToken: 'my-token',
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanupFetchMock();
  });

  it('successfully backports a commit by SHA in non-interactive mode', async () => {
    // Mock GithubConfigOptions query (startup check)
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'GithubConfigOptions',
      headers: { 'x-oauth-scopes': 'repo' },
      body: {
        data: {
          viewer: { login: 'test-user' },
          repository: {
            isPrivate: false,
            illegalBackportBranch: null,
            defaultBranchRef: {
              name: 'main',
              target: {
                __typename: 'Commit',
                remoteConfigHistory: { edges: [] },
              },
            },
          },
        },
      },
    });

    // Mock CommitsBySha query
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'CommitsBySha',
      body: {
        data: {
          repository: {
            object: {
              __typename: 'Commit',
              repository: {
                name: 'my-repo',
                owner: { login: 'my-org' },
              },
              sha: 'abc123abc123abc123abc123abc123abc123abc1',
              message: 'Fix bug in login flow (#42)',
              committedDate: '2024-01-15T00:00:00Z',
              author: {
                name: 'Test User',
                email: 'test@example.com',
              },
              associatedPullRequests: {
                edges: [
                  {
                    node: {
                      title: 'Fix bug in login flow',
                      url: 'https://github.com/my-org/my-repo/pull/42',
                      number: 42,
                      labels: { nodes: [] },
                      baseRefName: 'main',
                      mergeCommit: {
                        __typename: 'Commit',
                        remoteConfigHistory: { edges: [] },
                        sha: 'abc123abc123abc123abc123abc123abc123abc1',
                        message: 'Fix bug in login flow (#42)',
                      },
                      timelineItems: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    // Mock setupRepo (avoids real git clone/remote setup)
    vi.spyOn(setupRepoModule, 'setupRepo').mockResolvedValue();

    // Mock git commands via spawnPromise (cherry-pick, push, etc.)
    const execSpy = vi
      .spyOn(childProcess, 'spawnPromise')
      .mockResolvedValue({ stdout: '', stderr: '', code: 0, cmdArgs: [] });

    // Mock GetBranchId (validateTargetBranch)
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'GetBranchId',
      body: {
        data: {
          repository: {
            ref: { id: 'branch-ref-id' },
          },
        },
      },
    });

    // Mock PR creation (REST: POST /repos/.../pulls)
    const createPrCalls = mockFetchResponse({
      url: `${REST_URL}/repos/my-org/my-repo/pulls`,
      method: 'POST',
      responseBody: {
        number: 100,
        html_url: 'https://github.com/my-org/my-repo/pull/100',
      },
    });

    // Mock adding labels (REST: POST /repos/.../issues/.../labels)
    mockFetchResponse({
      url: `${REST_URL}/repos/my-org/my-repo/issues/100/labels`,
      method: 'POST',
      responseBody: {},
    });

    const res: BackportResponse = await backportRun({
      processArgs: [
        '--sha=abc123abc123abc123abc123abc123abc123abc1',
        '--targetBranch=7.x',
        '--nonInteractive',
      ],
      optionsFromModule: {},
      exitCodeOnFailure: false,
    });

    if (res.status === 'failure') {
      throw new Error(`Expected success but got failure: ${res.errorMessage}`);
    }

    expect(res.status).toBe('success');
    expect(res.results).toHaveLength(1);
    expect(res.results[0].targetBranch).toBe('7.x');
    expect(res.results[0].status).toBe('success');

    // Verify PR was created with correct body
    expect(createPrCalls).toHaveLength(1);

    // Verify git commands were invoked (cherry-pick, push, etc.)
    // spawnPromise signature: (cmd, cmdArgs, cwd, isInteractive)
    const gitCalls = execSpy.mock.calls.filter((call) => call[0] === 'git');
    expect(gitCalls.length).toBeGreaterThan(0);

    const pushCall = gitCalls.find((call) =>
      (call[1] as string[]).includes('push'),
    );
    expect(pushCall).toBeDefined();
  });

  it('returns failure when access token is missing', async () => {
    mockConfigFiles({
      projectConfig: {
        repoOwner: 'my-org',
        repoName: 'my-repo',
        targetBranchChoices: ['7.x'],
        githubApiBaseUrlV4: GRAPHQL_URL,
      },
      globalConfig: {},
    });

    const res = await backportRun({
      processArgs: ['--sha=abc123', '--targetBranch=7.x', '--nonInteractive'],
      optionsFromModule: {},
      exitCodeOnFailure: false,
    });

    expect(res.status).toBe('failure');
    if (res.status === 'failure') {
      expect(res.errorMessage).toContain('accessToken');
    }
  });

  it('returns failure for invalid CLI args', async () => {
    const res = await backportRun({
      processArgs: ['--mainline', 'not-a-number'],
      optionsFromModule: {},
      exitCodeOnFailure: false,
    });

    expect(res.status).toBe('failure');
    if (res.status === 'failure') {
      expect(res.errorMessage).toContain('--mainline must be an integer');
    }
  });

  it('returns failure when an option is set to empty string (GitHub Actions compat)', async () => {
    // Mock GithubConfigOptions query (needed before empty-string check runs)
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'GithubConfigOptions',
      headers: { 'x-oauth-scopes': 'repo' },
      body: {
        data: {
          viewer: { login: 'test-user' },
          repository: {
            isPrivate: false,
            illegalBackportBranch: null,
            defaultBranchRef: {
              name: 'main',
              target: {
                __typename: 'Commit',
                remoteConfigHistory: { edges: [] },
              },
            },
          },
        },
      },
    });

    const res = await backportRun({
      processArgs: [
        '--sha=abc123',
        '--targetBranch=7.x',
        '--nonInteractive',
        '--author=',
      ],
      optionsFromModule: {},
      exitCodeOnFailure: false,
    });

    expect(res.status).toBe('failure');
    if (res.status === 'failure') {
      expect(res.errorMessage).toContain('"author" cannot be empty');
    }
  });

  it('succeeds with --dryRun without calling GitHub APIs for PR creation', async () => {
    // Mock GithubConfigOptions query (startup check)
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'GithubConfigOptions',
      headers: { 'x-oauth-scopes': 'repo' },
      body: {
        data: {
          viewer: { login: 'test-user' },
          repository: {
            isPrivate: false,
            illegalBackportBranch: null,
            defaultBranchRef: {
              name: 'main',
              target: {
                __typename: 'Commit',
                remoteConfigHistory: { edges: [] },
              },
            },
          },
        },
      },
    });

    // Mock CommitsBySha query
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'CommitsBySha',
      body: {
        data: {
          repository: {
            object: {
              __typename: 'Commit',
              repository: {
                name: 'my-repo',
                owner: { login: 'my-org' },
              },
              sha: 'abc123abc123abc123abc123abc123abc123abc1',
              message: 'Fix bug (#42)',
              committedDate: '2024-01-15T00:00:00Z',
              author: {
                name: 'Test User',
                email: 'test@example.com',
              },
              associatedPullRequests: {
                edges: [
                  {
                    node: {
                      title: 'Fix bug',
                      url: 'https://github.com/my-org/my-repo/pull/42',
                      number: 42,
                      labels: { nodes: [] },
                      baseRefName: 'main',
                      mergeCommit: {
                        __typename: 'Commit',
                        remoteConfigHistory: { edges: [] },
                        sha: 'abc123abc123abc123abc123abc123abc123abc1',
                        message: 'Fix bug (#42)',
                      },
                      timelineItems: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    // Mock setupRepo
    vi.spyOn(setupRepoModule, 'setupRepo').mockResolvedValue();

    // Mock git commands
    vi.spyOn(childProcess, 'spawnPromise').mockResolvedValue({
      stdout: '',
      stderr: '',
      code: 0,
      cmdArgs: [],
    });

    // Mock GetBranchId (validateTargetBranch)
    mockGraphqlRequest({
      apiBaseUrl: GRAPHQL_URL,
      operationName: 'GetBranchId',
      body: {
        data: {
          repository: {
            ref: { id: 'branch-ref-id' },
          },
        },
      },
    });

    // NOTE: No REST API mocks for PR creation — dry-run should skip them

    const res: BackportResponse = await backportRun({
      processArgs: [
        '--sha=abc123abc123abc123abc123abc123abc123abc1',
        '--targetBranch=7.x',
        '--nonInteractive',
        '--dryRun',
      ],
      optionsFromModule: {},
      exitCodeOnFailure: false,
    });

    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect(res.results).toHaveLength(1);
      expect(res.results[0].status).toBe('success');
      if (res.results[0].status === 'success') {
        expect(res.results[0].pullRequestUrl).toBe('this-is-a-dry-run');
      }
    }
  });
});
