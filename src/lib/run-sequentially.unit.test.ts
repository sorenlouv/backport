import {
  defaultConfigOptions,
  type ValidConfigOptions,
} from '../options/options.js';
import * as cherrypickModule from './cherrypickAndCreateTargetPullRequest/cherrypick-and-create-target-pull-request.js';
import { runSequentially } from './run-sequentially.js';

describe('WHEN a target pull request is created', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SHOULD include the conflict state in the success result', async () => {
    vi.spyOn(
      cherrypickModule,
      'cherrypickAndCreateTargetPullRequest',
    ).mockResolvedValue({
      number: 1,
      url: 'https://github.com/org/repo/pull/1',
      hasConflicts: true,
    });

    const options: ValidConfigOptions = {
      ...defaultConfigOptions,
      authenticatedUsername: 'authenticated-user',
      author: 'sorenlouv',
      githubToken: 'token',
      repoForkOwner: 'sorenlouv',
      repoName: 'repo',
      repoOwner: 'org',
      sourceBranch: 'main',
    };

    const results = await runSequentially({
      options,
      commits: [],
      targetBranches: ['7.x'],
    });

    expect(results).toEqual([
      {
        status: 'success',
        targetBranch: '7.x',
        pullRequestUrl: 'https://github.com/org/repo/pull/1',
        pullRequestNumber: 1,
        hasConflicts: true,
      },
    ]);
  });
});
