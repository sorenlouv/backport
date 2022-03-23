import { TargetBranchChoice } from '../options/ConfigOptions';
import { ValidConfigOptions } from '../options/options';
import { SpyHelper } from '../types/SpyHelper';
import { getTargetBranches, getTargetBranchChoices } from './getTargetBranches';
import * as validateTargetBranches from './github/v4/validateTargetBranches';
import * as prompts from './prompts';
import { Commit } from './sourceCommit/parseSourceCommit';

describe('getTargetBranches', () => {
  let promptSpy: SpyHelper<typeof prompts.promptForTargetBranches>;

  beforeEach(() => {
    jest.clearAllMocks();

    promptSpy = jest
      .spyOn(prompts, 'promptForTargetBranches')
      .mockResolvedValueOnce(['branchA']);
  });

  describe('when `options.targetBranches` is empty', () => {
    let branches: string[];

    beforeEach(async () => {
      const options = {
        targetBranches: [] as string[],
        targetBranchChoices: [{ name: 'branchA' }, { name: 'branchB' }],
        multipleBranches: false,
        interactive: true,
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: { email: 'soren.louv@elastic.co', name: 'Søren Louv-Jansen' },
          sourceCommit: {
            committedDate: 'aaa',
            message: 'hey',
            sha: 'abcd',
          },
          sourcePullRequest: {
            url: 'foo',
            number: 1337,
            mergeCommit: {
              message: 'hey',
              sha: 'abcd',
            },
          },
          sourceBranch: '7.x',
          expectedTargetPullRequests: [],
        },
      ];

      branches = await getTargetBranches(options, commits);
    });

    it('should return branches from prompt', () => {
      expect(branches).toEqual(['branchA']);
    });

    it('should call prompt with correct args', () => {
      expect(promptSpy).toHaveBeenLastCalledWith({
        targetBranchChoices: [{ name: 'branchA' }, { name: 'branchB' }],
        isMultipleChoice: false,
      });
    });
  });

  describe('when `options.targetBranches` is not empty', () => {
    let branches: string[];

    beforeEach(async () => {
      jest
        .spyOn(validateTargetBranches, 'validateTargetBranches')
        .mockResolvedValueOnce();

      branches = await getTargetBranches(
        {
          targetBranches: ['branchA', 'branchB'],
          targetBranchChoices: [],
          multipleBranches: false,
        } as unknown as ValidConfigOptions,
        []
      );
    });

    it('should return branches from `options.branches`', () => {
      expect(branches).toEqual(['branchA', 'branchB']);
    });

    it('should not call prompt', () => {
      expect(promptSpy).not.toHaveBeenCalled();
    });
  });

  describe('when interactive=false', () => {
    it('should throw when there are no missing backports', async () => {
      const commits: Commit[] = [];

      await expect(() => {
        return getTargetBranches(
          {
            expectedTargetPullRequests: [],
            interactive: false,
          } as unknown as ValidConfigOptions,
          commits
        );
      }).rejects.toThrowError(
        'There are no branches to backport to. Aborting.'
      );
    });

    it('should return missing backports', async () => {
      const commits = [
        {
          expectedTargetPullRequests: [
            { branch: '7.2', state: 'MERGED' },
            { branch: '7.1', state: 'OPEN' },
            { branch: '7.x', state: 'NOT_CREATED' },
          ],
        },
      ] as Commit[];

      const targetBranches = await getTargetBranches(
        { interactive: false } as unknown as ValidConfigOptions,
        commits
      );
      expect(targetBranches).toEqual(['7.x']);
    });
  });

  describe('when `expectedTargetPullRequests` is missing a backport to 7.x', () => {
    let targetBranchChoices: TargetBranchChoice[];
    beforeEach(async () => {
      const options = {
        interactive: true,
        targetBranches: [] as string[],
        multipleBranches: true,
        targetBranchChoices: [
          { name: 'master' },
          { name: '7.x' },
          { name: '7.7' },
          { name: '7.6' },
          { name: '7.5' },
        ] as TargetBranchChoice[],
        branchLabelMapping: {},
        sourceBranch: 'master',
      } as ValidConfigOptions;

      const commits: Commit[] = [
        {
          author: { email: 'soren.louv@elastic.co', name: 'Søren Louv-Jansen' },
          sourceCommit: {
            committedDate: 'bbb',
            message: '[backport] Bump to 5.1.3 (#62286)',
            sha: 'my-sha',
          },
          sourcePullRequest: {
            url: 'foo',
            number: 62286,
            mergeCommit: {
              message: '[backport] Bump to 5.1.3 (#62286)',
              sha: 'my-sha',
            },
          },
          sourceBranch: 'master',
          expectedTargetPullRequests: [{ branch: '7.x', state: 'NOT_CREATED' }],
        },
      ];

      await getTargetBranches(options, commits);
      targetBranchChoices = promptSpy.mock.calls[0][0].targetBranchChoices;
    });

    it('should list the correct branches', async () => {
      expect(targetBranchChoices).toEqual([
        { checked: true, name: '7.x' },
        { checked: false, name: '7.7' },
        { checked: false, name: '7.6' },
        { checked: false, name: '7.5' },
      ]);
    });

    it('should not list the sourceBranch (master)', async () => {
      expect(targetBranchChoices).not.toContainEqual(
        expect.objectContaining({ name: 'master' })
      );
    });

    it('should select 7.x', async () => {
      expect(targetBranchChoices).toContainEqual({
        name: '7.x',
        checked: true,
      });
    });
  });
});

describe('getTargetBranchChoices', () => {
  const options = {
    interactive: true,
    targetBranchChoices: [
      { name: 'master', checked: true },
      { name: '7.x', checked: true },
      { name: '7.8', checked: false },
      { name: '7.7', checked: false },
    ],
    branchLabelMapping: {},
  } as unknown as ValidConfigOptions;

  const sourceBranch = 'master';

  it('should not check any branches if no labels match', () => {
    const targetBranchesFromLabels = [] as string[];
    const branches = getTargetBranchChoices(
      options,
      targetBranchesFromLabels,
      sourceBranch
    );

    expect(branches).toEqual([
      { checked: false, name: '7.x' },
      { checked: false, name: '7.8' },
      { checked: false, name: '7.7' },
    ]);
  });

  it('should pre-select branches based on labels', () => {
    const targetBranchesFromLabels = ['7.7'];

    const branches = getTargetBranchChoices(
      options,
      targetBranchesFromLabels,
      sourceBranch
    );

    expect(branches).toEqual([
      { checked: false, name: '7.x' },
      { checked: false, name: '7.8' },
      { checked: true, name: '7.7' },
    ]);
  });
});
