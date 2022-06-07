import { Commit } from '../../../entrypoint.module';
import { getDevAccessToken } from '../../private/getDevAccessToken';
import { runBackportViaCli } from './runBackportViaCli';

const accessToken = getDevAccessToken();
jest.setTimeout(15_000);

describe('backport-org/repo-with-changing-branchLabelMapping', () => {
  describe('for commit merged before branchLabelMapping was changed', () => {
    let commit: Commit;
    beforeAll(async () => {
      const { output } = await runBackportViaCli(
        [
          '--repo=backport-org/repo-with-changing-branchLabelMapping',
          '--no-fork',
          `--accessToken=${accessToken}`,
          '--json',
          '--ls',
        ],
        { waitForString: 'Select commit' }
      );

      commit = JSON.parse(output).commits[1];
    });

    it('suggests 3 target branches', async () => {
      expect(commit.suggestedTargetBranches).toEqual([
        '8.3',
        '8.2',
        'production',
      ]);
    });

    it('should shows 2 target branches as NOT_CREATED', () => {
      expect(
        commit.pullRequestStates.map(({ branch, label, state }) => ({
          branch,
          label,
          state,
        }))
      ).toEqual([
        { branch: '8.3', label: 'v8.3.0', state: 'NOT_CREATED' },
        { branch: '8.2', label: 'v8.2.0', state: 'NOT_CREATED' },
      ]);
    });
  });

  it('displays commit correctly', async () => {
    const { output } = await runBackportViaCli(
      [
        '--repo=backport-org/repo-with-changing-branchLabelMapping',
        '--no-fork',
        `--accessToken=${accessToken}`,
      ],
      { waitForString: 'Select commit' }
    );

    expect(output).toContain('Create denmark.txt 8.3, 8.2');
  });

  it('displays pre-selects branches correctly', async () => {
    const { output } = await runBackportViaCli(
      [
        '--repo=backport-org/repo-with-changing-branchLabelMapping',
        '--no-fork',
        '--pr=6',
        `--accessToken=${accessToken}`,
      ],
      { waitForString: 'Select branch' }
    );

    expect(output).toMatchInlineSnapshot(`
      "? Select branch (Press <space> to select, <a> to toggle all, <i> to invert 
      selection, and <enter> to proceed)
      ❯◯ 8.4
       ◉ 8.3
       ◉ 8.2
       ◉ production"
    `);
  });
});
