import { Commit } from '../../entrypoint.api';
import { ValidConfigOptions } from '../../options/options';
import { getBackportBranchName } from './getBackportBranchName';

const commit = { sourcePullRequest: { number: 1234 } } as Commit;

describe('getBackportBranchName', () => {
  it('returns the default name', () => {
    const name = getBackportBranchName({
      options: {
        backportBranchName: undefined,
      } as ValidConfigOptions,
      targetBranch: '7.x',
      commits: [commit],
    });
    expect(name).toBe('backport/7.x/pr-1234');
  });

  it('returns a custom name', () => {
    const name = getBackportBranchName({
      options: {
        backportBranchName: 'bp/pull-{{sourcePullRequest.number}}',
      } as ValidConfigOptions,
      targetBranch: '7.x',
      commits: [commit],
    });
    expect(name).toBe('bp/pull-1234');
  });
});
