import { exec } from 'child_process';
import { exec } from '../../../lib/child-process-promisified';
import { getDevAccessToken } from '../../private/getDevAccessToken';
import { getSandboxPath, resetSandbox } from '../../sandbox';
import { runBackportViaCli } from './runBackportViaCli';

const accessToken = getDevAccessToken();
jest.setTimeout(15_000);

describe('gradefully handle corrupted repo', () => {
  it('gr', async () => {
    const sandboxPath = getSandboxPath({ filename: __filename });
    // await resetSandbox(sandboxPath);

    console.log({ sandboxPath });

    const { output } = await runBackportViaCli(
      [
        '--repo=backport-org/integration-test',
        '--sha=16cfd987b82f49a79ebc663506f5d215b7a81c5c',
        '--branch=7.x',
        `--accessToken=${accessToken}`,
        `--dir=${sandboxPath}`,
        '--dry-run',
      ],
      {
        showOra: true,
        timeoutSeconds: 10,
      }
    );

    expect(output).toMatchInlineSnapshot(`
      "- Initializing...
      ? Select commit Bump to 8.0.0
      ✔ 100% Cloning repository from github.com (one-time operation)

      Backporting to 7.x:
      - Pulling latest changes
      ✔ Pulling latest changes
      - Cherry-picking: Bump to 8.0.0
      ✔ Cherry-picking: Bump to 8.0.0
      ✔ Dry run complete"
    `);

    // await exec('git remote remove backport-org', { cwd: sandboxPath });
    // await exec('git branch -D main', { cwd: sandboxPath });
    // await exec('git reset --hard 9de58b870a29578ff28c4cb8641ac8eec96e7811', {
    //   cwd: sandboxPath,
    // });
    // await exec('git checkout -B tmp', { cwd: sandboxPath });
    // await exec('git gc --prune=now', { cwd: sandboxPath });
  });
});
