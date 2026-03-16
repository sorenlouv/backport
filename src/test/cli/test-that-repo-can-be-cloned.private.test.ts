import { exec } from '../helpers/child-process-helper.js';
import { getDevAccessToken } from '../helpers/get-dev-access-token.js';
import { getSandboxPath, resetSandbox } from '../helpers/sandbox.js';
import { runBackportViaCli } from './run-backport-via-cli.js';
const accessToken = getDevAccessToken();
vi.setConfig({ testTimeout: 15_000, hookTimeout: 30_000 });

describe('test-that-repo-can-be-cloned', () => {
  describe('when local repo does not exist', () => {
    let sandboxPath: string;
    beforeAll(async () => {
      sandboxPath = getSandboxPath({
        filename: import.meta.filename,
        specname: 'no-local-repo',
      });
      await resetSandbox(sandboxPath);
    });

    function run() {
      return runBackportViaCli(
        [
          '--repo=backport-org/test-that-repo-can-be-cloned',
          '--branch=production',
          '--pr=1',
          `--dir=${sandboxPath}`,
          '--dry-run',
          `--accessToken=${accessToken}`,
        ],
        { showOra: true, timeoutSeconds: 15 },
      );
    }

    it('clones the repo remote repo', async () => {
      const { output } = await run();

      expect(output).toContain('Cloning repository from github.com');
      expect(output).toMatchInlineSnapshot(`
        "- Initializing...
        repo: backport-org/test-that-repo-can-be-cloned | sourceBranch: main | pullNumber: 1 | author: sorenlouv

        ? Select pull request Beginning of a beautiful repo (#1)
        ✔ 100% Cloning repository from github.com (one-time operation)

        Backporting to production:
        - Pulling latest changes
        ✔ Pulling latest changes
        - Cherry-picking: Beginning of a beautiful repo (#1)
        ✔ Cherry-picking: Beginning of a beautiful repo (#1)
        - Creating pull request
        ✔ Creating pull request
        View pull request: this-is-a-dry-run"
      `);
    });

    it('does not clone again on subsequent runs', async () => {
      const { output } = await run();

      expect(output).not.toContain('Cloning repository from github.com');
      expect(output).toMatchInlineSnapshot(`
        "- Initializing...
        repo: backport-org/test-that-repo-can-be-cloned | sourceBranch: main | pullNumber: 1 | author: sorenlouv

        ? Select pull request Beginning of a beautiful repo (#1)

        Backporting to production:
        - Pulling latest changes
        ✔ Pulling latest changes
        - Cherry-picking: Beginning of a beautiful repo (#1)
        ✔ Cherry-picking: Beginning of a beautiful repo (#1)
        - Creating pull request
        ✔ Creating pull request
        View pull request: this-is-a-dry-run"
      `);
    });
  });

  describe('when local repo exists', () => {
    let sourceRepo: string;
    let backportRepo: string;

    beforeEach(async () => {
      const sandboxPath = getSandboxPath({
        filename: import.meta.filename,
        specname: 'local-repo',
      });
      await resetSandbox(sandboxPath);
      sourceRepo = `${sandboxPath}/source`;
      backportRepo = `${sandboxPath}/backport`;

      await exec(
        `git clone https://github.com/backport-org/test-that-repo-can-be-cloned.git ${sourceRepo}`,
        { cwd: sandboxPath },
      );
    });

    function run() {
      return runBackportViaCli(
        [
          '--branch=production',
          '--pr=1',
          `--dir=${backportRepo}`,
          '--dry-run',
          `--accessToken=${accessToken}`,
        ],
        { cwd: sourceRepo, showOra: true, timeoutSeconds: 15 },
      );
    }

    it('clones using the local repo', async () => {
      const { output } = await run();

      expect(
        output.replaceAll('\n', '').replaceAll(sourceRepo, '<SOURCE_REPO>'),
      ).toContain(
        '✔ 100% Cloning repository from <SOURCE_REPO> (one-time operation)',
      );
    });
  });
});
