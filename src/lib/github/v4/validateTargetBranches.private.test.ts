import { ValidConfigOptions } from '../../../options/options';
import { getDevAccessToken } from '../../../test/private/getDevAccessToken';
import { validateTargetBranches } from './validateTargetBranches';

const accessToken = getDevAccessToken();

describe('validateTargetBranches', () => {
  describe('no branches', () => {
    it('resolves', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
      } as ValidConfigOptions;
      const targetBranches: string[] = [];

      expect(await validateTargetBranches(options, targetBranches)).toEqual(
        undefined
      );
    });
  });

  describe('one invalid and one valid branch', () => {
    it('throws', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
      } as ValidConfigOptions;
      const targetBranches = ['production', 'foo'];

      await expect(() =>
        validateTargetBranches(options, targetBranches)
      ).rejects.toThrowError('The branch "foo" does not exist');
    });
  });

  describe('two valid branches', () => {
    it('resolves', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
      } as ValidConfigOptions;
      const targetBranches = ['production', 'staging'];

      expect(await validateTargetBranches(options, targetBranches)).toEqual(
        undefined
      );
    });
  });

  describe('two invalid branches', () => {
    it('throws', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
      } as ValidConfigOptions;
      const targetBranches = ['foo', 'bar'];

      await expect(() =>
        validateTargetBranches(options, targetBranches)
      ).rejects.toThrow(/The branch "(foo|bar)" does not exist/);
    });
  });
});
