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
        targetBranches: [],
      };

      expect(await validateTargetBranches(options)).toEqual(undefined);
    });
  });

  describe('one invalid and one valid branch', () => {
    it('throws', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
        targetBranches: ['production', 'foo'],
      };

      await expect(() => validateTargetBranches(options)).rejects.toThrowError(
        'The branch "foo" does not exist'
      );
    });
  });

  describe('two valid branches', () => {
    it('resolves', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
        targetBranches: ['production', 'staging'],
      };

      expect(await validateTargetBranches(options)).toEqual(undefined);
    });
  });

  describe('two invalid branches', () => {
    it('throws', async () => {
      const options = {
        repoOwner: 'backport-org',
        repoName: 'repo-with-target-branches',
        accessToken,
        targetBranches: ['foo', 'bar'],
      };

      await expect(() => validateTargetBranches(options)).rejects.toThrow(
        /The branch "(foo|bar)" does not exist/
      );
    });
  });
});
