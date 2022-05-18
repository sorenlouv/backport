import fs from 'fs/promises';
import { exec } from '../../../lib/child-process-promisified';
import { getDevAccessToken } from '../../private/getDevAccessToken';
import { replaceStringAndLinebreaks } from '../../replaceStringAndLinebreaks';
import { getSandboxPath, resetSandbox } from '../../sandbox';
import { runBackportViaCli } from './runBackportViaCli';
const accessToken = getDevAccessToken();

jest.setTimeout(40_000);

describe('different-merge-strategies', () => {
  it('list all commits regardless how they were merged', async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=7.x',
        '--repo=backport-org/different-merge-strategies',
        `--accessToken=${accessToken}`,
        '-n=20',
      ],
      { waitForString: 'Select commit', timeoutSeconds: 4 }
    );

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Merge pull request #9 from backport-org/many-merge-commits  
        2. Merge strategy: Eighth of many merges  
        3. Merge strategy: Seventh of many merges  
        4. Merge strategy: Sixth of many merges  
        5. Merge strategy: Fifth of many merges  
        6. Merge strategy: Fourth of many merges  
        7. Merge strategy: Third of many merges  
        8. Merge strategy: Second of many merges  
        9. Merge strategy: First of many merges  
        10.Using squash to merge commits (#3)  
        11.Rebase strategy: Second commit  
        12.Rebase strategy: First commit  
        13.Merge pull request #1 from backport-org/merge-strategy  
        14.Merge strategy: Second commit  
        15.Merge strategy: First commit  
        16.Initial commit"
    `);
  });

  describe('when selecting a merge commit with eight commits', () => {
    let output: string;
    let sandboxPath: string;
    beforeAll(async () => {
      sandboxPath = getSandboxPath({ filename: __filename });
      await resetSandbox(sandboxPath);

      const res = await runBackportViaCli(
        [
          '--branch=7.x',
          '--repo=backport-org/different-merge-strategies',
          `--accessToken=${accessToken}`,
          `--dir=${sandboxPath}`,
          '--pr=9',
          '--dry-run',
        ],
        { showOra: true }
      );
      output = res.output;
    });

    it('runs to completion without errors', () => {
      expect(output).toMatchInlineSnapshot(`
        "- Initializing...
        ? Select pull request Merge pull request #9 from backport-org/many-merge-commits
        ✔ 100% Cloning repository from github.com (one-time operation)

        Backporting to 7.x:
        - Pulling latest changes
        ✔ Pulling latest changes
        - Cherry-picking: Merge strategy: First of many merges
        ✔ Cherry-picking: Merge strategy: First of many merges
        - Cherry-picking: Merge strategy: Second of many merges
        ✔ Cherry-picking: Merge strategy: Second of many merges
        - Cherry-picking: Merge strategy: Third of many merges
        ✔ Cherry-picking: Merge strategy: Third of many merges
        - Cherry-picking: Merge strategy: Fourth of many merges
        ✔ Cherry-picking: Merge strategy: Fourth of many merges
        - Cherry-picking: Merge strategy: Fifth of many merges
        ✔ Cherry-picking: Merge strategy: Fifth of many merges
        - Cherry-picking: Merge strategy: Sixth of many merges
        ✔ Cherry-picking: Merge strategy: Sixth of many merges
        - Cherry-picking: Merge strategy: Seventh of many merges
        ✔ Cherry-picking: Merge strategy: Seventh of many merges
        - Cherry-picking: Merge strategy: Eighth of many merges
        ✔ Cherry-picking: Merge strategy: Eighth of many merges
        ✔ Dry run complete"
      `);
    });

    it('backports all immediate children of the merge commit', async () => {
      const commits = await listCommits(sandboxPath);
      expect(commits).toEqual([
        'Merge strategy: Eighth of many merges',
        'Merge strategy: Seventh of many merges',
        'Merge strategy: Sixth of many merges',
        'Merge strategy: Fifth of many merges',
        'Merge strategy: Fourth of many merges',
        'Merge strategy: Third of many merges',
        'Merge strategy: Second of many merges',
        'Merge strategy: First of many merges',
        'Initial commit',
      ]);
    });
  });

  describe('when selecting a merge commit with two commits', () => {
    let sandboxPath: string;
    beforeAll(async () => {
      sandboxPath = getSandboxPath({ filename: __filename });
      await resetSandbox(sandboxPath);
      await runBackportViaCli(
        [
          '--branch=7.x',
          '--repo=backport-org/different-merge-strategies',
          `--accessToken=${accessToken}`,
          `--dir=${sandboxPath}`,
          '--pr=1',
          '--dry-run',
        ],
        { showOra: true }
      );
    });

    it('backports all immediate children of the merge commit', async () => {
      const commits = await listCommits(sandboxPath);
      expect(commits).toEqual([
        'Merge strategy: Second commit',
        'Merge strategy: First commit',
        'Initial commit',
      ]);
    });
  });

  describe('when selecting a merge commit with eight commits and a conflict occurs', () => {
    let sandboxPath: string;
    let output: string;
    beforeAll(async () => {
      sandboxPath = getSandboxPath({ filename: __filename });
      await resetSandbox(sandboxPath);
      const proc = await runBackportViaCli(
        [
          '--branch=7.1',
          '--repo=backport-org/different-merge-strategies',
          `--accessToken=${accessToken}`,
          `--dir=${sandboxPath}`,
          '--pr=9',
          '--dry-run',
        ],
        {
          keepAlive: true,
          timeoutSeconds: 5,
          showOra: true,
          waitForString:
            'Press ENTER when the conflicts are resolved and files are staged',
        }
      );

      await exec(`git status`, { cwd: sandboxPath });

      const filePath = `${sandboxPath}/new-file-added-with-many-merge-commits.txt`;
      await fs.writeFile(
        filePath,
        `File added directly to 7.1 to cause merge conflict\nPrevious merge commit didn't have enough commits\n`
      );

      await exec(`git add -A`, { cwd: sandboxPath });
      const res = await proc.keypress('enter', {
        showOra: true,
        timeoutSeconds: 5,
      });

      output = replaceStringAndLinebreaks({
        haystack: res.output,
        stringBefore: filePath,
        stringAfter: '<FILE_PATH>',
      });
    });

    it('has the right output', async () => {
      expect(output).toMatchInlineSnapshot(`
        "- Initializing...
        ? Select pull request Merge pull request #9 from backport-org/many-merge-commits
        ✔ 100% Cloning repository from github.com (one-time operation)

        Backporting to 7.1:
        - Pulling latest changes
        ✔ Pulling latest changes
        - Cherry-picking: Merge strategy: First of many merges
        ✖ Cherry-picking: Merge strategy: First of many merges

        The commit could not be backported due to conflicts

        Please fix the conflicts in /Users/sqren/.backport_testing/different-merge-strategies.private.test
        ? Fix the following conflicts manually:

        Conflicting files:
         - <FILE_PATH>


        Press ENTER when the conflicts are resolved and files are staged (Y/n) ? Fix the following conflicts manually:

        Conflicting files:
         - <FILE_PATH>


        Press ENTER when the conflicts are resolved and files are staged Yes
        ✔ Cherry-picking: Merge strategy: First of many merges
        - Cherry-picking: Merge strategy: Second of many merges
        ✔ Cherry-picking: Merge strategy: Second of many merges
        - Cherry-picking: Merge strategy: Third of many merges
        ✔ Cherry-picking: Merge strategy: Third of many merges
        - Cherry-picking: Merge strategy: Fourth of many merges
        ✔ Cherry-picking: Merge strategy: Fourth of many merges
        - Cherry-picking: Merge strategy: Fifth of many merges
        ✔ Cherry-picking: Merge strategy: Fifth of many merges
        - Cherry-picking: Merge strategy: Sixth of many merges
        ✔ Cherry-picking: Merge strategy: Sixth of many merges
        - Cherry-picking: Merge strategy: Seventh of many merges
        ✔ Cherry-picking: Merge strategy: Seventh of many merges
        - Cherry-picking: Merge strategy: Eighth of many merges
        ✔ Cherry-picking: Merge strategy: Eighth of many merges
        ✔ Dry run complete"
      `);
    });

    it('backports all immediate children of the merge commit', async () => {
      const commits = await listCommits(sandboxPath);
      expect(commits).toEqual([
        'Merge strategy: Eighth of many merges',
        'Merge strategy: Seventh of many merges',
        'Merge strategy: Sixth of many merges',
        'Merge strategy: Fifth of many merges',
        'Merge strategy: Fourth of many merges',
        'Merge strategy: Third of many merges',
        'Merge strategy: Second of many merges',
        'Merge strategy: First of many merges',
        'Create new-file-added-with-many-merge-commits.txt',
        'Initial commit',
      ]);
    });
  });
});

async function listCommits(sandboxPath: string) {
  const { stdout } = await exec('git --no-pager log --pretty=format:%s', {
    cwd: sandboxPath,
  });

  return stdout.split('\n');
}
