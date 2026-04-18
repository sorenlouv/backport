import type { ValidConfigOptions } from '../../../options/options.js';
import { getDevAccessToken } from '../../../test/helpers/get-dev-access-token.js';
import { validateTargetBranch } from './validate-target-branch.js';

const githubToken = getDevAccessToken();

describe('validateTargetBranch', () => {
  it('throws when branch is invalid', async () => {
    const options = {
      repoOwner: 'backport-org',
      repoName: 'repo-with-target-branches',
      githubToken,
    } as ValidConfigOptions;

    await expect(() =>
      validateTargetBranch({ ...options, branchName: 'foo' }),
    ).rejects.toThrow('The branch "foo" does not exist');
  });

  it('resolves when branch is valid', async () => {
    const options = {
      repoOwner: 'backport-org',
      repoName: 'repo-with-target-branches',
      githubToken,
    } as ValidConfigOptions;

    expect(
      await validateTargetBranch({ ...options, branchName: 'production' }),
    ).toEqual(undefined);
  });
});
