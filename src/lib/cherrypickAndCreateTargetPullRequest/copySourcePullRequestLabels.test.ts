import { Commit } from '../../entrypoint.api';
import { ValidConfigOptions } from '../../options/options';
import { getLabelsToCopy } from './copySourcePullRequestLabels';

describe('getLabelsToCopy', () => {
  it('should return an empty array when no commits have sourcePullRequest', () => {
    const commits = [{ sourcePullRequest: null }] as unknown as Commit[];
    const options = { copySourcePRLabels: true } as ValidConfigOptions;
    const result = getLabelsToCopy(commits, options);
    expect(result).toEqual([]);
  });

  it('copies all labels except backport labels when copySourcePRLabels is boolean', () => {
    const commits = [
      {
        sourcePullRequest: {
          title: 'My pr title',
          labels: ['a', 'b', 'my-backport-label'],
          number: 1,
        },
        targetPullRequestStates: [{ label: 'my-backport-label' } as any],
      } as unknown as Commit,
    ];

    const options = {
      copySourcePRLabels: true,
    } as unknown as ValidConfigOptions;

    const result = getLabelsToCopy(commits, options);
    expect(result).toEqual(['a', 'b']);
  });

  it('copies labels using regex patterns when copySourcePRLabels is string array', () => {
    const commits = [
      {
        sourcePullRequest: {
          title: 'PR',
          labels: ['feat:new', 'chore', 'important-bug'],
          number: 2,
        },
        targetPullRequestStates: [],
      } as unknown as Commit,
    ];

    const options = {
      copySourcePRLabels: ['^feat', 'bug$'],
    } as unknown as ValidConfigOptions;

    const result = getLabelsToCopy(commits, options);
    expect(result).toEqual(['feat:new', 'important-bug']);
  });

  it('handles multiple commits and flattens results', () => {
    const commits = [
      {
        sourcePullRequest: { title: 'PR1', labels: ['x'], number: 3 },
        targetPullRequestStates: [],
      } as unknown as Commit,
      {
        sourcePullRequest: { title: 'PR2', labels: ['y'], number: 4 },
        targetPullRequestStates: [],
      } as unknown as Commit,
    ];

    const options = {
      copySourcePRLabels: true,
    } as unknown as ValidConfigOptions;

    const result = getLabelsToCopy(commits, options);
    expect(result).toEqual(['x', 'y']);
  });
});
