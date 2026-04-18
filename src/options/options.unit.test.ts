import fs from 'node:fs/promises';
import os from 'node:os';
import type {
  GithubConfigOptionsQuery,
  RepoOwnerAndNameQuery,
} from '../graphql/generated/graphql.js';
import * as git from '../lib/git/index.js';
import * as logger from '../lib/logger.js';
import { mockConfigFiles } from '../test/helpers/mock-config-files.js';
import {
  cleanupFetchMock,
  mockGraphqlRequest,
  setupFetchMock,
} from '../test/helpers/mock-fetch.js';
import type { ConfigFileOptions } from './config-options.js';
import { getOptions } from './options.js';

const defaultConfigs = {
  projectConfig: {
    githubApiBaseUrlV4: 'http://localhost/graphql',
    repoOwner: 'elastic',
    repoName: 'kibana',
    targetBranchChoices: ['7.9', '8.0'],
  },
  globalConfig: { githubToken: 'abc', editor: 'code' },
};

describe('getOptions', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanupFetchMock();
  });

  beforeEach(() => {
    setupFetchMock();
    mockConfigFiles(defaultConfigs);
    vi.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
    vi.spyOn(fs, 'writeFile').mockResolvedValue();
    vi.spyOn(fs, 'chmod').mockResolvedValue();
  });

  describe('should throw', () => {
    beforeEach(() => {
      mockGithubConfigOptions({});
    });

    it('when githubToken is missing', async () => {
      mockConfigFiles({
        projectConfig: defaultConfigs.projectConfig,
        globalConfig: { githubToken: undefined },
      });

      await expect(() =>
        getOptions({
          optionsFromCliArgs: {},
          optionsFromModule: {},
        }),
      ).rejects.toThrow(
        'Please update your config file: "/myHomeDir/.backport/config.json".\nIt must contain a valid "githubToken".',
      );
    });

    it('when `targetBranches`, `targetBranchChoices` and `branchLabelMapping` are all empty', async () => {
      mockProjectConfig({
        targetBranches: undefined,
        targetBranchChoices: undefined,
        branchLabelMapping: undefined,
      });

      await expect(() =>
        getOptions({ optionsFromCliArgs: {}, optionsFromModule: {} }),
      ).rejects.toThrow('Please specify a target branch: "--branch 6.1".');
    });

    it('when `ls` is true, should NOT throw even if target branches are empty', async () => {
      mockProjectConfig({
        targetBranches: undefined,
        targetBranchChoices: undefined,
        branchLabelMapping: undefined,
      });

      await expect(
        getOptions({ optionsFromCliArgs: { ls: true }, optionsFromModule: {} }),
      ).resolves.toBeDefined();
    });

    describe('whe option is an empty string', () => {
      it('throws for "username"', async () => {
        await expect(() =>
          getOptions({
            optionsFromCliArgs: {},
            optionsFromModule: { repoForkOwner: '', author: 'sorenlouv' },
          }),
        ).rejects.toThrow('"repoForkOwner" cannot be empty!');
      });

      it('throws for "author"', async () => {
        await expect(() =>
          getOptions({
            optionsFromCliArgs: {},
            optionsFromModule: { author: '' },
          }),
        ).rejects.toThrow('"author" cannot be empty!');
      });

      it('throws for "githubToken"', async () => {
        await expect(() =>
          getOptions({
            optionsFromCliArgs: {},
            optionsFromModule: { githubToken: '' },
          }),
        ).rejects.toThrow(
          'Please update your config file: "/myHomeDir/.backport/config.json".\nIt must contain a valid "githubToken".',
        );
      });
    });

    describe('when repoName and repoOwner are missing', () => {
      beforeEach(() => {
        mockProjectConfig({ repoName: undefined, repoOwner: undefined });
      });

      it('should throw if there are no remotes', async () => {
        vi.spyOn(git, 'getRepoInfoFromGitRemotes').mockResolvedValue([]);

        await expect(() =>
          getOptions({ optionsFromCliArgs: {}, optionsFromModule: {} }),
        ).rejects.toThrow(
          'Please specify a repository: "--repo elastic/kibana".',
        );
      });

      it('should get repoName from the remote', async () => {
        mockRepoOwnerAndName({
          childRepoOwner: 'sorenlouv',
          parentRepoOwner: 'elastic',
          repoName: 'kibana',
        });

        vi.spyOn(git, 'getRepoInfoFromGitRemotes').mockResolvedValue([
          { repoName: 'kibana', repoOwner: 'sorenlouv' },
        ]);

        const options = await getOptions({
          optionsFromCliArgs: {},
          optionsFromModule: {},
        });

        expect(options.repoName).toBe('kibana');
        expect(options.repoOwner).toBe('elastic');
      });
    });
  });

  it('reads options from remote config', async () => {
    mockGithubConfigOptions({ hasRemoteConfig: true });
    const options = await getOptions({
      optionsFromCliArgs: {},
      optionsFromModule: {},
    });
    expect(options.branchLabelMapping).toEqual({
      '^v8.2.0$': 'option-from-remote',
    });

    expect(options.autoMergeMethod).toEqual('rebase');
  });

  it('should ensure that "backport" branch does not exist', async () => {
    mockGithubConfigOptions({ hasBackportBranch: true });
    await expect(
      getOptions({ optionsFromCliArgs: {}, optionsFromModule: {} }),
    ).rejects.toThrow(
      'You must delete the branch "backport" to continue. See https://github.com/sorenlouv/backport/issues/155 for details',
    );
  });

  it('should merge config options and module options', async () => {
    mockGithubConfigOptions({});
    const myFn = () => true;

    const options = await getOptions({
      optionsFromCliArgs: {},
      optionsFromModule: { autoFixConflicts: myFn },
    });
    expect(options.autoFixConflicts).toBe(myFn);
  });

  it('should call setAccessToken', async () => {
    mockGithubConfigOptions({});
    await getOptions({ optionsFromCliArgs: {}, optionsFromModule: {} });

    expect(logger.setAccessToken).toHaveBeenCalledTimes(1);
  });

  it('should return options', async () => {
    mockGithubConfigOptions({
      viewerLogin: 'john.diller',
      defaultBranchRef: 'default-branch-from-github',
    });
    const options = await getOptions({
      optionsFromCliArgs: {},
      optionsFromModule: {},
    });

    expect(options).toEqual({
      githubToken: 'abc',
      assignees: [],
      authenticatedUsername: 'john.diller',
      author: 'john.diller',
      autoAssign: false,
      autoMerge: false,
      autoMergeMethod: 'merge',
      backportBinary: 'backport',
      cherryPickRef: true,
      conflictResolution: 'abort',
      commitPaths: [],
      cwd: expect.any(String),
      since: null,
      until: null,
      verbose: false,
      draft: false,
      editor: 'code',
      fork: true,
      gitHostname: 'github.com',
      githubApiBaseUrlV4: 'http://localhost/graphql',
      interactive: true,
      isRepoPrivate: false,
      maxCount: 10,
      multipleBranches: true,
      multipleCommits: false,
      noUnmergedBackportsHelp: false,
      noVerify: true,
      publishStatusCommentOnAbort: false,
      publishStatusCommentOnFailure: false,
      publishStatusCommentOnSuccess: true,
      repoForkOwner: 'john.diller',
      repoName: 'kibana',
      repoOwner: 'elastic',
      resetAuthor: false,
      reviewers: [],
      signoff: false,
      sourceBranch: 'default-branch-from-github',
      sourcePRLabels: [],
      copySourcePRLabels: false,
      copySourcePRReviewers: false,
      targetBranchChoices: ['7.9', '8.0'],
      targetBranches: [],
      targetPRLabels: [],
    });
  });

  describe('sourceBranch', () => {
    beforeEach(() => {
      mockGithubConfigOptions({ defaultBranchRef: 'some-default-branch' });
    });

    it('uses the `defaultBranchRef` as default', async () => {
      const options = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(options.sourceBranch).toBe('some-default-branch');
    });

    it('uses the sourceBranch given via cli instead of `defaultBranchRef`', async () => {
      const options = await getOptions({
        optionsFromCliArgs: { sourceBranch: 'cli-source-branch' },
        optionsFromModule: {},
      });
      expect(options.sourceBranch).toBe('cli-source-branch');
    });
  });

  describe('fork', () => {
    beforeEach(() => {
      mockGithubConfigOptions({});
    });

    it('is enabled by default', async () => {
      const { fork } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(fork).toBe(true);
    });

    it('can be disabled via cli', async () => {
      const { fork } = await getOptions({
        optionsFromCliArgs: { fork: false },
        optionsFromModule: {},
      });
      expect(fork).toBe(false);
    });

    it('can be disabled via config file', async () => {
      mockProjectConfig({ fork: false });
      const { fork } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(fork).toBe(false);
    });
  });

  describe('reviewers', () => {
    beforeEach(() => {
      mockGithubConfigOptions({});
    });

    it('can be set via cli', async () => {
      const { reviewers } = await getOptions({
        optionsFromCliArgs: { reviewers: ['peter'] },
        optionsFromModule: {},
      });
      expect(reviewers).toEqual(['peter']);
    });

    it('can be set via config file', async () => {
      mockProjectConfig({ reviewers: ['john'] });
      const { reviewers } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(reviewers).toEqual(['john']);
    });
  });

  describe('mainline', () => {
    beforeEach(() => {
      mockGithubConfigOptions({});
    });

    it('is not enabled by default', async () => {
      const { mainline } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(mainline).toBe(undefined);
    });

    it('can be set via `--mainline` flag', async () => {
      const { mainline } = await getOptions({
        optionsFromCliArgs: { mainline: 1 },
        optionsFromModule: {},
      });
      expect(mainline).toBe(1);
    });

    it('accepts numeric values', async () => {
      const { mainline } = await getOptions({
        optionsFromCliArgs: { mainline: 2 },
        optionsFromModule: {},
      });
      expect(mainline).toBe(2);
    });
  });

  describe('author', () => {
    beforeEach(() => {
      mockGithubConfigOptions({ viewerLogin: 'billy.bob' });
    });

    it('defaults to authenticated user', async () => {
      const { author } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(author).toBe('billy.bob');
    });

    it('can be overridden via `--author` flag', async () => {
      const { author } = await getOptions({
        optionsFromCliArgs: { author: 'john.doe' },
        optionsFromModule: {},
      });
      expect(author).toBe('john.doe');
    });

    it('can be reset via config file (similar to `--all` flag)', async () => {
      mockProjectConfig({ author: null });
      const { author } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(author).toBe(null);
    });

    it('can be overridden via config file', async () => {
      mockProjectConfig({ author: 'jane.doe' });
      const { author } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(author).toBe('jane.doe');
    });
  });

  describe('access token scopes', () => {
    it('throw if no scopes are granted', async () => {
      mockGithubConfigOptions({ headers: { 'x-oauth-scopes': '' } });

      await expect(
        getOptions({
          optionsFromCliArgs: {},
          optionsFromModule: {},
        }),
      ).rejects.toThrow(
        'You must grant the "repo" or "public_repo" scope to your personal access token',
      );
    });

    it('should throw if only `public_repo` scope is granted but the repo is private', async () => {
      mockGithubConfigOptions({
        isRepoPrivate: true,
        headers: { 'x-oauth-scopes': 'public_repo' },
      });

      await expect(
        getOptions({
          optionsFromCliArgs: {},
          optionsFromModule: {},
        }),
      ).rejects.toThrow(
        'You must grant the "repo" scope to your personal access token',
      );
    });

    it('should not throw if `public_repo` scope is granted and the repo is public', async () => {
      mockGithubConfigOptions({
        isRepoPrivate: false,
        headers: { 'x-oauth-scopes': 'public_repo' },
      });

      const options = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });

      expect(options).toBeDefined();
    });
  });

  describe('cherryPickRef', () => {
    beforeEach(() => {
      mockGithubConfigOptions({});
    });

    it('should default to true', async () => {
      const { cherryPickRef } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(cherryPickRef).toBe(true);
    });

    it('should be settable via config file', async () => {
      mockProjectConfig({ cherryPickRef: false });
      const { cherryPickRef } = await getOptions({
        optionsFromCliArgs: {},
        optionsFromModule: {},
      });
      expect(cherryPickRef).toBe(false);
    });

    it('cli args overwrites config', async () => {
      mockProjectConfig({ cherryPickRef: false });
      const { cherryPickRef } = await getOptions({
        optionsFromCliArgs: { cherryPickRef: true },
        optionsFromModule: {},
      });
      expect(cherryPickRef).toBe(true);
    });
  });
});

function mockProjectConfig(projectConfig: ConfigFileOptions) {
  return mockConfigFiles({
    globalConfig: { githubToken: 'abc' },
    projectConfig: {
      githubApiBaseUrlV4: 'http://localhost/graphql',
      repoOwner: 'elastic',
      repoName: 'kibana',
      targetBranchChoices: ['7.9', '8.0'],
      ...projectConfig,
    },
  });
}

function mockGithubConfigOptions({
  viewerLogin = 'DO_NOT_USE-sorenlouv',
  defaultBranchRef = 'DO_NOT_USE-default-branch-name',
  hasBackportBranch,
  hasRemoteConfig,
  isRepoPrivate = false,
  headers = { 'x-oauth-scopes': 'repo' },
}: {
  viewerLogin?: string;
  defaultBranchRef?: string;
  hasBackportBranch?: boolean;
  hasRemoteConfig?: boolean;
  isRepoPrivate?: boolean;
  headers?: Record<string, string>;
}) {
  return mockGraphqlRequest<GithubConfigOptionsQuery>({
    operationName: 'GithubConfigOptions',
    headers,
    body: {
      data: {
        viewer: {
          login: viewerLogin,
        },

        repository: {
          isPrivate: isRepoPrivate,
          illegalBackportBranch: hasBackportBranch ? { id: 'foo' } : null,
          defaultBranchRef: {
            name: defaultBranchRef,
            target: {
              __typename: 'Commit',
              remoteConfigHistory: {
                edges: hasRemoteConfig
                  ? [
                      {
                        remoteConfig: {
                          committedDate: '2020-08-15T00:00:00.000Z',
                          file: {
                            __typename: 'TreeEntry',
                            object: {
                              __typename: 'Blob',
                              text: JSON.stringify({
                                autoMergeMethod: 'rebase',
                                branchLabelMapping: {
                                  '^v8.2.0$': 'option-from-remote',
                                },
                              } as ConfigFileOptions),
                            },
                          },
                        },
                      },
                    ]
                  : [],
              },
            },
          },
        },
      },
    },
  });
}

function mockRepoOwnerAndName({
  repoName,
  parentRepoOwner,
  childRepoOwner,
}: {
  repoName: string;
  parentRepoOwner: string;
  childRepoOwner: string;
}) {
  return mockGraphqlRequest<RepoOwnerAndNameQuery>({
    operationName: 'RepoOwnerAndName',
    body: {
      data: {
        repository: {
          isFork: true,
          name: repoName,
          owner: {
            login: childRepoOwner,
          },
          parent: {
            owner: {
              login: parentRepoOwner,
            },
          },
        },
      },
    },
  });
}
