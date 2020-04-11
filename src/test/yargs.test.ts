import { execSync, spawn, ChildProcessWithoutNullStreams } from 'child_process';

const options = {
  stdio: 'pipe',
  encoding: 'utf-8',
} as const;

// get global config: either from .backport/config.json or via env variables
function getGlobalConfig() {
  return JSON.parse(
    execSync(
      `./node_modules/.bin/ts-node --transpile-only ./src/test/getGlobalConfig.ts`,
      options
    )
  );
}

describe('yargs', () => {
  let accessToken: string;
  let username: string;

  beforeAll(() => {
    const config = getGlobalConfig();

    // eslint-disable-next-line no-console
    console.log(
      `Config values came from ${
        config.isConfigFile ? 'config file' : 'environment variables'
      }`
    );

    accessToken = config.accessToken;
    username = config.username;
  });

  it('--version', () => {
    const res = execSync(`node ./dist/index.js --version`, options);
    expect(res).toContain(process.env.npm_package_version);
  });

  it('-v', () => {
    const res = execSync(`node ./dist/index.js -v`, options);
    expect(res).toContain(process.env.npm_package_version);
  });

  it('--help', () => {
    const res = execSync(`node ./dist/index.js --help`, options);
    expect(res).toContain('Show version number');
  });

  it('should return error when branch is missing', () => {
    const res = execSync(`node ./dist/index.js --upstream foo`, options);
    expect(res).toMatchInlineSnapshot(`
      "Invalid option \\"branches\\"

      You can add it with either:
       - Config file: \\".backportrc.json\\". Read more: https://github.com/sqren/backport/blob/434a28b431bb58c9a014d4489a95f561e6bb2769/docs/configuration.md#project-config-backportrcjson
       - CLI: \\"--branches 6.1\\"
      "
    `);
  });

  it('should return error when upstream is missing', () => {
    const res = execSync(`node ./dist/index.js --branch foo`, options);
    expect(res).toMatchInlineSnapshot(`
      "Invalid option \\"upstream\\"

      You can add it with either:
       - Config file: \\".backportrc.json\\". Read more: https://github.com/sqren/backport/blob/434a28b431bb58c9a014d4489a95f561e6bb2769/docs/configuration.md#project-config-backportrcjson
       - CLI: \\"--upstream elastic/kibana\\"
      "
    `);
  });

  it('should return error when access token is invalid', () => {
    const res = execSync(
      `node ./dist/index.js --branch foo --upstream foo/bar --username some-user --accessToken some-token`,
      options
    );
    expect(res).toContain(
      'Please check your access token and make sure it is valid'
    );
  });

  it(`should return error when repo doesn't exist`, () => {
    const res = execSync(
      `node ./dist/index.js --branch foo --upstream foo/bar --username ${username} --accessToken ${accessToken}`,
      options
    );
    expect(res).toMatchInlineSnapshot(`
      "The repository \\"foo/bar\\" doesn't exist
      "
    `);
  });

  function getCommitsFromOutput(proc: ChildProcessWithoutNullStreams) {
    return new Promise<string[]>((resolve) => {
      let total = '';
      proc.stdout.on('data', (data) => {
        total += data;
        const lines = total.toString();
        if (lines.includes('Select commit to backport')) {
          resolve(lines);
        }
      });
    });
  }

  it(`should list commits from master`, async () => {
    const proc = spawn('node', [
      './dist/index.js',
      '--branch',
      'foo',
      '--upstream',
      'sqren/backport-demo',
      '--username',
      username,
      '--accessToken',
      accessToken,
      '--commitsCount',
      '6',
    ]);

    const commits = await getCommitsFromOutput(proc);
    expect(commits).toMatchInlineSnapshot(`
      "? Select commit to backport (Use arrow keys)
      ❯ 1. Create \\"conflicting-file.txt\\" in master (f8bb8b70)  
        2. Update romeo-and-juliet.txt (91eee967)  
        3. Add 👻 (2e63475c)  
        4. Add witch (#85)  
        5. Add SF mention (#80) 6.3 
        6. Add backport config (3827bbba)  "
    `);
    proc.kill();
  });

  it(`should list commits from 6.3`, async () => {
    const proc = spawn('node', [
      './dist/index.js',
      '--branch',
      'foo',
      '--upstream',
      'sqren/backport-demo',
      '--username',
      username,
      '--accessToken',
      accessToken,
      '--commitsCount',
      '6',
      '--sourceBranch',
      '6.3',
    ]);

    const commits = await getCommitsFromOutput(proc);
    expect(commits).toMatchInlineSnapshot(`
      "? Select commit to backport (Use arrow keys)
      ❯ 1. Create \`conflicting-file.txt\` in 6.3 (e8128293)  
        2. Add SF mention (#80) 6.3 
        3. Add backport config (3827bbba)  
        4. Initial commit (5ea0da55)  "
    `);
    proc.kill();
  });
});
