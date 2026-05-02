import { getDevAccessToken } from '../helpers/get-dev-access-token.js';
import { removeLinesBreaksInConflictingFiles } from '../helpers/replace-string-and-linebreaks.js';
import { getSandboxPath, resetSandbox } from '../helpers/sandbox.js';
import { runBackportViaCli } from './run-backport-via-cli.js';

const githubToken = getDevAccessToken();
vi.setConfig({ testTimeout: 15_000 });

describe('interactive error handling', () => {
  it('when branch is missing', async () => {
    const { output } = await runBackportViaCli([
      '--skip-remote-config',
      '--repo=backport-org/backport-e2e',
      `--github-token=${githubToken}`,
    ]);
    expect(output).toMatchInlineSnapshot(`
      "Please specify a target branch: "--branch 6.1".

      Read more: https://github.com/sorenlouv/backport/blob/main/docs/configuration.md#project-config-backportrcjson"
    `);
  });

  it('when supplying invalid argument', async () => {
    const { output } = await runBackportViaCli([`--foo`]);
    expect(output).toMatchInlineSnapshot(`
      "Unknown argument: foo
      Run "backport --help" to see all options"
    `);
  });

  it('when access token is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--branch=foo',
      '--repo=foo/bar',
      '--github-token=some-token',
    ]);
    expect(output).toContain('The GitHub token "some...oken" is invalid');
  });

  it(`when repo doesn't exist`, async () => {
    const { output } = await runBackportViaCli([
      '--branch=foo',
      '--repo=foo/bar',
      '--author=sorenlouv',
      `--github-token=${githubToken}`,
    ]);
    expect(output).toMatchInlineSnapshot(
      `"The repository "foo/bar" doesn't exist"`,
    );
  });

  it(`when given branch is invalid`, async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=foo',
        '--repo=backport-org/backport-e2e',
        '--pr=9',
        `--github-token=${githubToken}`,
      ],
      { showOra: true },
    );
    expect(output).toContain('✖ The branch "foo" does not exist');
  });

  it(`when encountering conflicts`, async () => {
    const backportDir = getSandboxPath({ filename: import.meta.filename });
    await resetSandbox(backportDir);
    const { output } = await runBackportViaCli(
      [
        '--editor=false',
        '--repo=backport-org/repo-with-conflicts',
        '--pr=12',
        '--branch=7.x',
        `--github-token=${githubToken}`,
        `--dir=${backportDir}`,
        '--dry-run',
      ],
      {
        waitForString: 'Press ENTER when the conflicts',
      },
    );

    expect(
      removeLinesBreaksInConflictingFiles(output).replaceAll(
        backportDir,
        '<BACKPORT_DIR>',
      ),
    ).toMatchInlineSnapshot(`
      "repo: backport-org/repo-with-conflicts | sourceBranch: main | pr: 12 | author: sorenlouv


      Backporting to 7.x:

      The commit could not be backported due to conflicts

      Please fix the conflicts in <BACKPORT_DIR>
      Hint: Before fixing the conflicts manually you should consider backporting the following pull requests to "7.x":
       - Change Barca to Braithwaite (#8) (backport missing)
         https://github.com/backport-org/repo-with-conflicts/pull/8


      ? Fix the following conflicts manually:

      Conflicting files: - <BACKPORT_DIR>/la-liga.md

      Press ENTER when the conflicts are resolved and files are staged (Y/n)"
    `);
  });
});
