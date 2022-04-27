import { getDevAccessToken } from '../../private/getDevAccessToken';
import { getSandboxPath, resetSandbox } from '../../sandbox';
import { runBackportViaCli } from './runBackportViaCli';

const accessToken = getDevAccessToken();

describe('interactive error handling', () => {
  it('when branch is missing', async () => {
    const { output } = await runBackportViaCli([
      '--skip-remote-config',
      '--repo=backport-org/backport-e2e',
      `--accessToken=${accessToken}`,
    ]);
    expect(output).toMatchInlineSnapshot(`
        "Please specify a target branch: \\"--branch 6.1\\".

        Read more: https://github.com/sqren/backport/blob/main/docs/config-file-options.md#project-config-backportrcjson"
      `);
  });

  it('when supplying invalid argument', async () => {
    const { output } = await runBackportViaCli([`--foo`]);
    expect(output).toMatchInlineSnapshot(`
        "Unknown argument: foo
        Run \\"backport --help\\" to see all options"
      `);
  });

  it('when access token is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--branch=foo',
      '--repo=foo/bar',
      '--accessToken=some-token',
    ]);
    expect(output).toContain(
      'Please check your access token and make sure it is valid'
    );
  });

  it(`when repo doesn't exist`, async () => {
    const { output } = await runBackportViaCli([
      '--branch=foo',
      '--repo=foo/bar',
      '--author=sqren',
      `--accessToken=${accessToken}`,
    ]);
    expect(output).toMatchInlineSnapshot(
      `"The repository \\"foo/bar\\" doesn't exist"`
    );
  });

  it(`when given branch is invalid`, async () => {
    const { output } = await runBackportViaCli([
      '--branch=foo',
      '--repo=backport-org/backport-e2e',
      '--pr=9',
      `--accessToken=${accessToken}`,
    ]);
    expect(output).toMatchInlineSnapshot(
      `"The branch \\"foo\\" does not exist"`
    );
  });

  it(`when encountering conflicts`, async () => {
    const backportDir = getSandboxPath({ filename: __filename });
    await resetSandbox(backportDir);
    const { output } = await runBackportViaCli(
      [
        '--repo=backport-org/repo-with-conflicts',
        '--pr=12',
        '--branch=7.x',
        `--accessToken=${accessToken}`,
        `--dir=${backportDir}`,
        '--dry-run',
      ],
      {
        waitForString: 'Press ENTER when the conflicts',
        timeoutSeconds: 5,
      }
    );

    // //@ts-expect-error
    // const lineToReplace = output.match(
    //   /Conflicting files:[\s]+- (.*[\s].*)la-liga.md/
    // )[1];

    // const lineWithoutBreaks = lineToReplace.replace(/\s/g, '');
    // const outputReplaced = output
    //   .replace(lineToReplace, lineWithoutBreaks)
    //   .replaceAll(backportDir, '<BACKPORT_DIR>');

    const outputReplaced = output
      .replaceAll('\n', '')
      .replaceAll(backportDir, '<BACKPORT_DIR>');

    expect(outputReplaced).toMatchInlineSnapshot(
      `"Backporting to 7.x:The commit could not be backported due to conflictsPlease fix the conflicts in <BACKPORT_DIR>Hint: Before fixing the conflicts manually you should consider backporting the following pull requests to \\"7.x\\": - Change Barca to Braithwaite (#8) (backport missing)   https://github.com/backport-org/repo-with-conflicts/pull/8? Fix the following conflicts manually:Conflicting files: - <BACKPORT_DIR>/la-liga.mdPress ENTER when the conflicts are resolved and files are staged (Y/n)"`
    );
  });
});
