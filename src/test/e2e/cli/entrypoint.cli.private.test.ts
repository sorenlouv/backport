import fs from 'fs/promises';
import path from 'path';
import {
  BackportAbortResponse,
  BackportFailureResponse,
  BackportSuccessResponse,
} from '../../../backportRun';
import { ConfigFileOptions } from '../../../entrypoint.module';
import { exec } from '../../../lib/child-process-promisified';
import * as packageVersion from '../../../utils/packageVersion';
import { getDevAccessToken } from '../../private/getDevAccessToken';
import { getSandboxPath, resetSandbox } from '../../sandbox';
import { runBackportViaCli } from './runBackportViaCli';

jest.setTimeout(10_000);
const accessToken = getDevAccessToken();

describe('entrypoint cli', () => {
  it('--version', async () => {
    const { output } = await runBackportViaCli([`--version`], {
      showOra: true,
    });

    expect(output).toEqual(process.env.npm_package_version);
  });

  it('-v', async () => {
    const { output } = await runBackportViaCli([`-v`], {
      showOra: true,
    });
    expect(output).toEqual(process.env.npm_package_version);
  });

  it('PACKAGE_VERSION should match', async () => {
    // @ts-expect-error
    expect(packageVersion.UNMOCKED_PACKAGE_VERSION).toBe(
      process.env.npm_package_version
    );
  });

  it('--help', async () => {
    const { output } = await runBackportViaCli([`--help`]);
    expect(output).toMatchInlineSnapshot(`
      "entrypoint.cli.ts [args]

      Options:
        -v, --version                         Show version number                                [boolean]
            --accessToken, --accesstoken      Github access token                                 [string]
        -a, --all                             List all commits                                   [boolean]
            --assignee, --assign              Add assignees to the target pull request             [array]
            --autoAssign                      Auto assign the target pull request to yourself    [boolean]
            --autoMerge                       Enable auto-merge for created pull requests        [boolean]
            --autoMergeMethod                 Sets auto-merge method when using --auto-merge. Default:
                                              merge        [string] [choices: \\"merge\\", \\"rebase\\", \\"squash\\"]
            --cherrypickRef                   Append commit message with \\"(cherry picked from commit...)
                                                                                                 [boolean]
            --projectConfigFile, --config     Path to project config                              [string]
            --globalConfigFile                Path to global config                               [string]
            --since                           ISO-8601 date for filtering commits                 [string]
            --until                           ISO-8601 date for filtering commits                 [string]
            --dir                             Path to temporary backport repo                     [string]
            --details                         Show details about each commit                     [boolean]
            --dryRun                          Run backport locally without pushing to Github     [boolean]
            --editor                          Editor to be opened during conflict resolution      [string]
            --skipRemoteConfig                Use local .backportrc.json config instead of loading from
                                              Github                                             [boolean]
            --fork                            Create backports in fork or origin repo. Defaults to true
                                                                                                 [boolean]
            --gitAuthorName                   Set commit author name                              [string]
            --gitAuthorEmail                  Set commit author email                             [string]
            --nonInteractive, --json          Disable interactive prompts and return response as JSON
                                                                                                 [boolean]
            --ls                              List commits instead of backporting them           [boolean]
            --mainline                        Parent id of merge commit. Defaults to 1 when supplied
                                              without arguments                                   [number]
        -n, --maxNumber, --number             Number of commits to choose from                    [number]
            --multiple                        Select multiple branches/commits                   [boolean]
            --multipleBranches                Backport to multiple branches                      [boolean]
            --multipleCommits                 Backport multiple commits                          [boolean]
            --noCherrypickRef                 Do not append commit message with \\"(cherry picked from
                                              commit...)\\"                                        [boolean]
            --noStatusComment                 Don't publish status comment to Github             [boolean]
            --noVerify                        Bypass the pre-commit and commit-msg hooks         [boolean]
            --noFork                          Create backports in the origin repo                [boolean]
            --onlyMissing                     Only list commits with missing or unmerged backports
                                                                                                 [boolean]
        -p, --path                            Only list commits touching files under the specified path
                                                                                                   [array]
            --prDescription, --description    Description to be added to pull request             [string]
            --prTitle, --title                Title of pull request                               [string]
            --prFilter                        Filter source pull requests by a query              [string]
            --pullNumber, --pr                Pull request to backport                            [number]
            --resetAuthor                     Set yourself as commit author                      [boolean]
            --reviewer                        Add reviewer to the target PR                        [array]
            --repoForkOwner                   The owner of the fork where the backport branch is pushed.
                                              Defaults to the currently authenticated user        [string]
            --repo                            Repo owner and name                                 [string]
            --sha, --commit                   Commit sha to backport                              [string]
            --sourceBranch                    Specify a non-default branch (normally \\"master\\") to backport
                                              from                                                [string]
            --sourcePRLabel, --sourcePrLabel  Add labels to the source (original) PR               [array]
        -b, --targetBranch, --branch          Branch(es) to backport to                            [array]
            --targetBranchChoice              List branches to backport to                         [array]
        -l, --targetPRLabel, --label          Add labels to the target (backport) PR               [array]
            --verify                          Opposite of no-verify                              [boolean]
            --help                            Show help                                          [boolean]

      For bugs, feature requests or questions: https://github.com/sqren/backport/issues
      Or contact me directly: https://twitter.com/sorenlouv"
    `);
  });

  it('should list commits based on .git/config when `repoOwner`/`repoName` is missing', async () => {
    const sandboxPath = getSandboxPath({ filename: __filename });
    await resetSandbox(sandboxPath);
    await exec(`git init`, { cwd: sandboxPath });
    await exec(
      `git remote add origin git@github.com:backport-org/backport-e2e.git`,
      { cwd: sandboxPath }
    );

    const { output } = await runBackportViaCli(
      [`--accessToken=${accessToken}`],
      {
        cwd: sandboxPath,
        waitForString: 'Select commit',
      }
    );

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Add sheep emoji (#9) 7.8 
        2. Change Ulysses to Gretha (conflict) (#8) 7.x 
        3. Add 🍏 emoji (#5) 7.x, 7.8 
        4. Add family emoji (#2) 7.x 
        5. Add \`backport\` dep  
        6. Merge pull request #1 from backport-org/add-heart-emoji  
        7. Add ❤️ emoji  
        8. Update .backportrc.json  
        9. Bump to 8.0.0  
        10.Add package.json"
    `);
  });

  it(`should list commits from master`, async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=foo',
        '--repo=backport-org/backport-e2e',
        '--author=sqren',
        `--accessToken=${accessToken}`,
        '--max-number=6',
      ],
      { waitForString: 'Select commit' }
    );

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Add sheep emoji (#9) 7.8 
        2. Change Ulysses to Gretha (conflict) (#8) 7.x 
        3. Add 🍏 emoji (#5) 7.x, 7.8 
        4. Add family emoji (#2) 7.x 
        5. Add \`backport\` dep  
        6. Merge pull request #1 from backport-org/add-heart-emoji"
    `);
  });

  it(`should filter commits by "since" and "until"`, async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=foo',
        '--repo=backport-org/backport-e2e',
        `--accessToken=${accessToken}`,
        '--since=2020-08-15T10:00:00.000Z',
        '--until=2020-08-15T10:30:00.000Z',
      ],
      { waitForString: 'Select commit' }
    );

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Bump to 8.0.0  
        2. Add package.json  
        3. Update .backportrc.json  
        4. Create .backportrc.json"
    `);
  });

  it(`should list commits from 7.x`, async () => {
    const { output } = await runBackportViaCli(
      [
        '--branch=foo',
        '--repo=backport-org/backport-e2e',
        '--author=sqren',
        `--accessToken=${accessToken}`,
        '--max-number=6',
        '--source-branch=7.x',
      ],
      { waitForString: 'Select commit' }
    );

    expect(output).toMatchInlineSnapshot(`
      "? Select commit (Use arrow keys)
      ❯ 1. Add 🍏 emoji (#5) (#6)  
        2. Change Ulysses to Carol  
        3. Add family emoji (#2) (#4)  
        4. Update .backportrc.json  
        5. Branch off: 7.9.0 (7.x)  
        6. Bump to 8.0.0"
    `);
  });

  async function createConfigFile(options: ConfigFileOptions) {
    const sandboxPath = getSandboxPath({ filename: __filename });
    const configPath = path.join(sandboxPath, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(options));
    return configPath;
  }

  describe('errors in interactive mode (non-json)', () => {
    it('when branch is missing', async () => {
      const { output } = await runBackportViaCli([
        '--skip-remote-config',
        '--repo=backport-org/backport-e2e',
        `--accessToken=${accessToken}`,
      ]);
      expect(output).toMatchInlineSnapshot(`
        "Please specify a target branch: \\"--branch 6.1\\".

        Read more: https://github.com/sqren/backport/blob/main/docs/configuration.md#project-config-backportrcjson"
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

    it(`should output error when repo doesn't exist`, async () => {
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

    it(`should output error when given branch is invalid`, async () => {
      const { output } = await runBackportViaCli([
        '--branch=foo',
        '--repo=backport-org/backport-e2e',
        '--pr=9',
        `--accessToken=${accessToken}`,
      ]);
      expect(output).toMatchInlineSnapshot(`
        "Backporting to foo:
        The branch \\"foo\\" is invalid or doesn't exist"
      `);
    });

    it(`should output merge conflict`, async () => {
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

      //@ts-expect-error
      const lineToReplace = output.match(
        /Conflicting files:[\s]+- (.*[\s].*)la-liga.md/
      )[1];

      const lineWithoutBreaks = lineToReplace.replace(/\s/g, '');
      const outputReplaced = output
        .replace(lineToReplace, lineWithoutBreaks)
        .replaceAll(backportDir, '<BACKPORT_DIR>');

      expect(outputReplaced).toMatchInlineSnapshot(`
        "Backporting to 7.x:

        The commit could not be backported due to conflicts

        Please fix the conflicts in <BACKPORT_DIR>
        Hint: Before fixing the conflicts manually you should consider backporting the following pull requests to \\"7.x\\":
         - Change Barca to Braithwaite (#8) (backport missing)
           https://github.com/backport-org/repo-with-conflicts/pull/8


        ? Fix the following conflicts manually:

        Conflicting files:
         - <BACKPORT_DIR>/la-liga.md


        Press ENTER when the conflicts are resolved and files are staged (Y/n)"
      `);
    });
  });

  describe('failure cases in json mode (and non-interactive)', () => {
    it(`when access token is missing`, async () => {
      const configFilePath = await createConfigFile({});
      const { output, code } = await runBackportViaCli([
        '--json',
        `--globalConfigFile=${configFilePath}`,
      ]);

      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(code).toBe(1);
      expect(backportResult.status).toBe('failure');
      expect(backportResult.errorMessage).toMatchInlineSnapshot(`
        "Please update your config file: \\"/Users/sqren/.backport/config.json\\".
        It must contain a valid \\"accessToken\\".

        Read more: https://github.com/sqren/backport/blob/main/docs/configuration.md#global-config-backportconfigjson"
      `);
    });

    it('when target branches cannot be inferred from pull request', async () => {
      const { output, code } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e',
        '--pr=9',
        `--accessToken=${accessToken}`,
      ]);

      expect(code).toBe(0);
      const backportResult = JSON.parse(output) as BackportAbortResponse;
      expect(backportResult.status).toBe('aborted');
      expect(backportResult.error).toEqual({
        errorContext: { code: 'no-branches-exception' },
        name: 'BackportError',
      });
      expect(backportResult.errorMessage).toBe(
        'There are no branches to backport to. Aborting.'
      );
    });

    it(`when target branch and branch label mapping are missing`, async () => {
      const { output, code } = await runBackportViaCli([
        '--json',
        `--access-token=${accessToken}`,
      ]);

      expect(code).toBe(1);
      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(backportResult.status).toBe('failure');
      expect(backportResult.errorMessage).toMatchInlineSnapshot(`
        "Please specify a target branch: \\"--branch 6.1\\".

        Read more: https://github.com/sqren/backport/blob/main/docs/configuration.md#project-config-backportrcjson"
      `);
    });

    it(`when argument is invalid`, async () => {
      const { output } = await runBackportViaCli(['--json', '--foo'], {});

      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(backportResult.status).toBe('failure');
      expect(backportResult.errorMessage).toEqual('Unknown argument: foo');
    });

    it('when `--repo` is invalid', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e-foo',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(backportResult.status).toBe('failure');
      expect(backportResult.errorMessage).toEqual(
        'The repository "backport-org/backport-e2e-foo" doesn\'t exist'
      );
    });

    it('when `--sha` is invalid', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e',
        '--sha=abcdefg',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(backportResult.status).toBe('failure');
      expect(backportResult.errorMessage).toEqual(
        'No commit found on branch "master" with sha "abcdefg"'
      );
    });

    it('when `--branch` is invalid', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e',
        '--pr=9',
        '--branch=foobar',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportSuccessResponse;
      expect(backportResult.status).toBe('success');
      expect(backportResult.results[0]).toEqual({
        error: {
          errorContext: {
            code: 'message-only-exception',
            message: 'The branch "foobar" is invalid or doesn\'t exist',
          },
          name: 'BackportError',
        },
        status: 'handled-error',
        targetBranch: 'foobar',
      });
    });

    it('when `--pr` is invalid', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e',
        '--pr=900',
        '--branch=foobar',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(backportResult.status).toEqual('failure');
      expect(backportResult.errorMessage).toEqual(
        'Could not resolve to a PullRequest with the number of 900. (Github API v4)'
      );
    });

    it('when having conflicts in non-interactive mode', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/repo-with-conflicts',
        '--pr=12',
        '--branch=7.x',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportSuccessResponse;
      expect(backportResult.status).toEqual('success');
      expect(
        //@ts-expect-error
        backportResult.results[0].error.errorContext.conflictingFiles
      ).toEqual(['la-liga.md']);
    });

    it('when `--source-branch` is invalid', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e',
        '--pr=9',
        '--branch=7.x',
        '--source-branch=foo',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportSuccessResponse;
      expect(backportResult.status).toBe('success');
      expect(backportResult.results[0]).toEqual({
        error: {
          context: {
            cmdArgs: ['checkout', 'foo'],
            code: 1,
            stderr:
              "error: pathspec 'foo' did not match any file(s) known to git\n",
            stdout: '',
          },
          name: 'SpawnError',
        },
        status: 'unhandled-error',
        targetBranch: '7.x',
      });
    });

    it('when PR is not merged', async () => {
      const { output } = await runBackportViaCli([
        '--json',
        '--repo=backport-org/backport-e2e',
        '--pr=12',
        `--accessToken=${accessToken}`,
      ]);

      const backportResult = JSON.parse(output) as BackportFailureResponse;
      expect(backportResult.status).toBe('failure');
      expect(backportResult.error).toEqual({
        errorContext: {
          code: 'message-only-exception',
          message: 'The PR #12 is not merged',
        },
        name: 'BackportError',
      });
    });
  });
});
