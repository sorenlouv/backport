import { BranchChoice } from '../options/ConfigOptions';
import { ValidConfigOptions } from '../options/options';
import { ExistingTargetPullRequests } from '../services/github/v4/getExistingTargetPullRequests';
import * as prompts from '../services/prompts';
import { Commit } from '../types/Commit';
import { SpyHelper } from '../types/SpyHelper';
import {
  getTargetBranches,
  getTargetBranchChoices,
  getTargetBranchesFromLabels,
} from './getTargetBranches';

describe('getTargetBranches', () => {
  let promptSpy: SpyHelper<typeof prompts.promptForTargetBranches>;

  beforeEach(() => {
    jest.clearAllMocks();

    promptSpy = jest
      .spyOn(prompts, 'promptForTargetBranches')
      .mockResolvedValueOnce(['branchA']);
  });

  describe('when `sourcePRLabels=["7.x"]`', () => {
    let targetBranchChoices: BranchChoice[];
    beforeEach(async () => {
      const options = ({
        targetBranches: [],
        multipleBranches: true,
        targetBranchChoices: [
          { name: 'master' },
          { name: '7.x' },
          { name: '7.7' },
          { name: '7.6' },
          { name: '7.5' },
        ] as BranchChoice[],
        sourceBranch: 'master',
      } as unknown) as ValidConfigOptions;

      const commits = [
        {
          sourceBranch: 'master',
          sourcePRLabels: ['7.x'],
          sha: 'my-sha',
          formattedMessage: '[backport] Bump to 5.1.3 (#62286)',
          originalMessage: '[backport] Bump to 5.1.3 (#62286)',
          pullNumber: 62286,
          existingTargetPullRequests: [],
        },
      ];

      await getTargetBranches(options, commits);
      targetBranchChoices = promptSpy.mock.calls[0][0].targetBranchChoices;
    });

    it('should list the correct branches', async () => {
      expect(targetBranchChoices).toEqual([
        { name: '7.x', checked: true },
        { name: '7.7', checked: false },
        { name: '7.6', checked: false },
        { name: '7.5', checked: false },
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

  describe('when `sourcePRLabels=["8.0.0"]`', () => {
    let targetBranchChoices: BranchChoice[];
    beforeEach(async () => {
      const options = ({
        targetBranches: [],
        multipleBranches: true,
        targetBranchChoices: [
          { name: '7.x' },
          { name: '7.7' },
          { name: '7.6' },
          { name: '7.5' },
        ] as BranchChoice[],
        sourceBranch: 'master',
      } as unknown) as ValidConfigOptions;

      const commits = [
        {
          sourceBranch: 'master',
          sourcePRLabels: ['8.0.0'],
          sha: 'my-sha',
          formattedMessage: '[backport] Bump to 5.1.3 (#62286)',
          originalMessage: '[backport] Bump to 5.1.3 (#62286)',
          pullNumber: 62286,
          existingTargetPullRequests: [],
        },
      ];

      await getTargetBranches(options, commits);
      targetBranchChoices = promptSpy.mock.calls[0][0].targetBranchChoices;
    });

    it('should list the correct branches', async () => {
      expect(targetBranchChoices).toEqual([
        { name: '7.x' },
        { name: '7.7' },
        { name: '7.6' },
        { name: '7.5' },
      ]);
    });
  });

  describe('when `options.targetBranches` is empty', () => {
    let branches: ReturnType<typeof getTargetBranches>;

    beforeEach(async () => {
      const options = ({
        targetBranches: [],
        targetBranchChoices: [{ name: 'branchA' }, { name: 'branchB' }],
        multipleBranches: false,
      } as unknown) as ValidConfigOptions;

      const commits: Commit[] = [
        {
          formattedMessage: 'hey',
          originalMessage: 'hey',
          sourcePRLabels: [],
          sha: 'abcd',
          sourceBranch: '7.x',
          pullNumber: 1337,
          existingTargetPullRequests: [],
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
    let branches: ReturnType<typeof getTargetBranches>;

    beforeEach(() => {
      branches = getTargetBranches(
        ({
          targetBranches: ['branchA', 'branchB'],
          targetBranchChoices: [],
          multipleBranches: false,
        } as unknown) as ValidConfigOptions,
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
});

describe('getTargetBranchChoices', () => {
  const options = ({
    ci: false,
    targetBranchChoices: [
      { name: 'master', checked: true },
      { name: '7.x', checked: true },
      { name: '7.8', checked: false },
      { name: '7.7', checked: false },
    ],
  } as unknown) as ValidConfigOptions;

  const sourceBranch = 'master';

  it('should pre-select default branches if no labels match', () => {
    const sourcePRLabels = [] as string[];
    const branches = getTargetBranchChoices(
      options,
      sourcePRLabels,
      sourceBranch
    );

    expect(branches).toEqual([
      { checked: true, name: '7.x' },
      { checked: false, name: '7.8' },
      { checked: false, name: '7.7' },
    ]);
  });

  it('should pre-select branches based on labels', () => {
    const sourcePRLabels = ['7.7'];

    const branches = getTargetBranchChoices(
      options,
      sourcePRLabels,
      sourceBranch
    );

    expect(branches).toEqual([
      { checked: false, name: '7.x' },
      { checked: false, name: '7.8' },
      { checked: true, name: '7.7' },
    ]);
  });
});

describe('getTargetBranchesFromLabels', () => {
  it(`should support Kibana's label format`, () => {
    const targetBranchChoices = [
      { name: 'master', sourcePRLabels: ['v8.0.0'] },
      { name: '7.x', sourcePRLabels: ['v7.8.0'] },
      { name: '7.7', sourcePRLabels: ['v7.7.0'] },
      { name: '7.6', sourcePRLabels: ['v7.6.0'] },
      { name: '7.5', sourcePRLabels: ['v7.5.0'] },
      { name: '7.4', sourcePRLabels: ['v7.4.1'] },
      { name: '7.3', sourcePRLabels: ['v7.3.3'] },
      { name: '7.2', sourcePRLabels: ['v7.2.2'] },
      { name: '7.1', sourcePRLabels: ['v7.1.2'] },
      { name: '7.0', sourcePRLabels: ['v7.0.2'] },
      { name: '6.8', sourcePRLabels: ['v6.8.4'] },
      { name: '6.7', sourcePRLabels: ['v6.7.2'] },
      { name: '6.6', sourcePRLabels: ['v6.6.3'] },
      { name: '6.5', sourcePRLabels: ['v6.5.5'] },
      { name: '6.4', sourcePRLabels: ['v6.4.4'] },
      { name: '6.3', sourcePRLabels: ['v6.3.3'] },
      { name: '6.2', sourcePRLabels: ['v6.2.5'] },
      { name: '6.1', sourcePRLabels: ['v6.1.4'] },
      { name: '6.0', sourcePRLabels: ['v6.0.1'] },
      { name: '5.6', sourcePRLabels: ['v5.6.16'] },
    ];
    const sourceBranch = 'master';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;
    const sourcePRLabels = [
      'release_note:fix',
      'v5.4.3',
      'v5.5.3',
      'v5.6.16',
      'v6.0.1',
      'v6.1.4',
      'v6.2.5',
      'v6.3.3',
      'v6.4.4',
      'v6.5.5',
      'v6.6.3',
      'v6.7.2',
      'v6.8.4',
      'v7.0.2',
      'v7.1.2',
      'v7.2.2',
      'v7.3.3',
      'v7.4.1',
      'v7.5.0',
      'v7.6.0',
      'v7.7.0',
      'v7.8.0', // 7.x
      'v8.0.0', // master
    ];
    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual([
      '7.x',
      '7.7',
      '7.6',
      '7.5',
      '7.4',
      '7.3',
      '7.2',
      '7.1',
      '7.0',
      '6.8',
      '6.7',
      '6.6',
      '6.5',
      '6.4',
      '6.3',
      '6.2',
      '6.1',
      '6.0',
      '5.6',
    ]);
  });

  it('matches if all items in sourcePRLabels matches', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;
    const sourcePRLabels = ['label-foo', 'label-bar'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-foo', 'label-bar'] },
      { name: 'branch-2', sourcePRLabels: [] },
      { name: 'branch-3', sourcePRLabels: [] },
    ];
    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-1']);
  });

  it('does not match if only some items in sourcePRLabels matches', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;
    const sourcePRLabels = ['label-foo'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-foo', 'label-bar'] },
      { name: 'branch-2', sourcePRLabels: [] },
      { name: 'branch-3', sourcePRLabels: [] },
    ];
    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual([]);
  });

  it('should remove branches if a related PR is already open', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [
      { branch: 'branch-1', state: 'OPEN' },
    ] as ExistingTargetPullRequests;

    const sourcePRLabels = ['label-foo', 'label-bar', 'label-baz'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-foo', 'label-bar'] },
      { name: 'branch-2', sourcePRLabels: ['label-baz'] },
      { name: 'branch-3', sourcePRLabels: [] },
    ];

    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-2']);
  });

  it('should remove branches if a related PR is already merged', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [
      { branch: 'branch-2', state: 'MERGED' },
    ] as ExistingTargetPullRequests;

    const sourcePRLabels = ['label-foo', 'label-bar', 'label-baz'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-foo', 'label-bar'] },
      { name: 'branch-2', sourcePRLabels: ['label-baz'] },
      { name: 'branch-3', sourcePRLabels: [] },
    ];

    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-1']);
  });

  it('should remove branches if sourceBranch is identical', () => {
    const sourceBranch = 'branch-2';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;

    const sourcePRLabels = ['label-foo', 'label-bar', 'label-baz'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-foo', 'label-bar'] },
      { name: 'branch-2', sourcePRLabels: ['label-baz'] },
      { name: 'branch-3', sourcePRLabels: [] },
    ];

    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-1']);
  });

  it('should ignore non-matching labels', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;

    const sourcePRLabels = [
      'label-foo',
      'label-bar',
      'label-baz',
      'label-unknown',
    ];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-foo', 'label-bar'] },
      { name: 'branch-2', sourcePRLabels: ['label-baz'] },
      { name: 'branch-3', sourcePRLabels: [] },
    ];

    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-1', 'branch-2']);
  });

  it('supports wildcard matching', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;
    const sourcePRLabels = ['label-c-foo'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-a'] },
      { name: 'branch-2', sourcePRLabels: ['label-b'] },
      { name: 'branch-3', sourcePRLabels: ['label-c-*'] },
      { name: 'branch-4', sourcePRLabels: ['label-d'] },
    ];
    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-3']);
  });

  it('supports literal wildcards', () => {
    const sourceBranch = 'master';
    const existingTargetPullRequests = [] as ExistingTargetPullRequests;
    const sourcePRLabels = ['label-wildcard-*'];
    const targetBranchChoices = [
      { name: 'branch-1', sourcePRLabels: ['label-a'] },
      { name: 'branch-2', sourcePRLabels: ['label-b'] },
      { name: 'branch-3', sourcePRLabels: ['label-wildcard-*'] },
      { name: 'branch-4', sourcePRLabels: ['label-d'] },
    ];
    const targetBranches = getTargetBranchesFromLabels({
      commit: {
        sourceBranch,
        existingTargetPullRequests,
        sourcePRLabels,
      } as Commit,
      options: {
        targetBranchChoices,
      } as ValidConfigOptions,
    });
    expect(targetBranches).toEqual(['branch-3']);
  });
});
