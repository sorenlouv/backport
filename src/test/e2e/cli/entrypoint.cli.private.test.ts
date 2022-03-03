import { exec } from '../../../services/child-process-promisified';
import * as packageVersion from '../../../utils/packageVersion';
import { getDevAccessToken } from '../../private/getDevAccessToken';
import { getSandboxPath, resetSandbox } from '../../sandbox';
import { runBackportViaCli } from './runBackportViaCli';

const TIMEOUT_IN_SECONDS = 15;
jest.setTimeout(TIMEOUT_IN_SECONDS * 1000);
const accessToken = getDevAccessToken();

describe('entrypoint cli', () => {
  it('--version', async () => {
    const res = await runBackportViaCli([`--version`], {
      showOra: true,
    });
    expect(res).toEqual(process.env.npm_package_version);
  });

  it('-v', async () => {
    const res = await runBackportViaCli([`-v`], {
      showOra: true,
    });
    expect(res).toEqual(process.env.npm_package_version);
  });

  it('PACKAGE_VERSION should match', async () => {
    // @ts-expect-error
    expect(packageVersion.UNMOCKED_PACKAGE_VERSION).toBe(
      process.env.npm_package_version
    );
  });

  it('--help', async () => {
    const res = await runBackportViaCli([`--help`]);
    expect(res).toMatchInlineSnapshot(`
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
            --ci                              Disable interactive prompts                        [boolean]
            --cherrypickRef                   Append commit message with \\"(cherry picked from commit...)
                                                                                                 [boolean]
            --projectConfigFile, --config     Path to project config                              [string]
            --since                           ISO-8601 date for filtering commits                 [string]
            --until                           ISO-8601 date for filtering commits                 [string]
            --dir                             Location where the temporary repository will be stored
                                                                                                  [string]
            --details                         Show details about each commit                     [boolean]
            --dryRun                          Run backport locally without pushing to Github     [boolean]
            --editor                          Editor to be opened during conflict resolution      [string]
            --skipRemoteConfig                Use local .backportrc.json config instead of loading from
                                              Github                                             [boolean]
            --fork                            Create backports in fork or origin repo. Defaults to true
                                                                                                 [boolean]
            --gitAuthorName                   Set commit author name                              [string]
            --gitAuthorEmail                  Set commit author email                             [string]
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

  it('should return error when branch is missing', async () => {
    const res = await runBackportViaCli([
      '--skip-remote-config',
      '--repo=backport-org/backport-e2e',
      `--accessToken=${accessToken}`,
    ]);
    expect(res).toMatchInlineSnapshot(`
      "Please specify a target branch: \\"--branch 6.1\\".
      Read more: https://github.com/sqren/backport/blob/main/docs/configuration.md#project-config-backportrcjson"
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

    const res = await runBackportViaCli([`--accessToken=${accessToken}`], {
      cwd: sandboxPath,
      waitForString: 'Select commit',
    });

    expect(res).toMatchInlineSnapshot(`
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

  it('should return error when access token is invalid', async () => {
    const res = await runBackportViaCli([
      '--branch=foo',
      '--repo=foo/bar',
      '--accessToken=some-token',
    ]);
    expect(res).toContain(
      'Please check your access token and make sure it is valid'
    );
  });

  it(`should return error when repo doesn't exist`, async () => {
    const res = await runBackportViaCli([
      '--branch=foo',
      '--repo=foo/bar',
      '--author=sqren',
      `--accessToken=${accessToken}`,
    ]);
    expect(res).toMatchInlineSnapshot(
      `"The repository \\"foo/bar\\" doesn't exist"`
    );
  });

  it(`should list commits from master`, async () => {
    const output = await runBackportViaCli(
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
    const output = await runBackportViaCli(
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
    const output = await runBackportViaCli(
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
});
