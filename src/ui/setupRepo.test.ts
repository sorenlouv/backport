import os from 'os';
import del from 'del';
import { ValidConfigOptions } from '../options/options';
import * as childProcess from '../services/child-process-promisified';
import * as gitModule from '../services/git';
import { getOraMock } from '../test/mocks';
import { setupRepo } from './setupRepo';

describe('setupRepo', () => {
  let execSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');

    execSpy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValue({ stderr: '', stdout: '' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('if an error occurs while cloning', () => {
    it('should delete repo', async () => {
      expect.assertions(2);

      execSpy = jest
        .spyOn(childProcess, 'execAsCallback')
        .mockImplementation((cmd) => {
          if (cmd.startsWith('git clone')) {
            throw new Error('Simulated git clone failure');
          }

          throw new Error('unknown error');
        });

      await expect(
        setupRepo({
          repoName: 'kibana',
          repoOwner: 'elastic',
          cwd: '/path/to/source/repo',
        } as ValidConfigOptions)
      ).rejects.toThrowError('Simulated git clone failure');

      expect(del).toHaveBeenCalledWith(
        '/myHomeDir/.backport/repositories/elastic/kibana',
        { force: true }
      );
    });
  });

  describe('while cloning the repo', () => {
    it('updates the progress', async () => {
      let onCloneComplete: () => void;
      let dataHandler: (chunk: any) => void;

      const oraMock = getOraMock();
      const spinnerTextSpy = jest.spyOn(oraMock, 'text', 'set');
      const spinnerSuccessSpy = jest.spyOn(oraMock, 'succeed');

      jest.spyOn(gitModule, 'getLocalRepoPath').mockResolvedValue(undefined);

      jest
        .spyOn(childProcess, 'execAsCallback')
        //@ts-expect-error
        .mockImplementation((cmdString, cmdOptions, onComplete) => {
          // callback should be called to finalize the operation
          if (onComplete) {
            //@ts-expect-error
            onCloneComplete = onComplete;
          }

          return {
            stderr: {
              on: (name, handler) => {
                dataHandler = handler;
              },
            },
          };
        });

      setTimeout(() => {
        dataHandler('Receiving objects:   1%');
        dataHandler('Receiving objects:   10%');
        dataHandler('Receiving objects:   20%');
        dataHandler('Receiving objects:   100%');
        dataHandler('Updating files:   1%');
        dataHandler('Updating files:   10%');
        dataHandler('Updating files:   20%');
        dataHandler('Updating files:   100%');
        onCloneComplete();
      }, 50);

      await setupRepo({
        repoName: 'kibana',
        repoOwner: 'elastic',
        gitUserEmail: 'my-email',
        gitUserName: 'my-username',
        gitHostname: 'github.com',
        cwd: '/path/to/source/repo',
      } as ValidConfigOptions);

      expect(spinnerTextSpy.mock.calls.map((call) => call[0]))
        .toMatchInlineSnapshot(`
        Array [
          "0% Cloning repository from github.com (one-time operation)",
          "1% Cloning repository from github.com (one-time operation)",
          "9% Cloning repository from github.com (one-time operation)",
          "18% Cloning repository from github.com (one-time operation)",
          "90% Cloning repository from github.com (one-time operation)",
          "90% Cloning repository from github.com (one-time operation)",
          "91% Cloning repository from github.com (one-time operation)",
          "92% Cloning repository from github.com (one-time operation)",
          "100% Cloning repository from github.com (one-time operation)",
        ]
      `);

      expect(spinnerSuccessSpy).toHaveBeenCalledWith(
        '100% Cloning repository from github.com (one-time operation)'
      );
    });
  });

  describe('if repo already exists', () => {
    beforeEach(() => {
      jest
        .spyOn(childProcess, 'execAsCallback')
        //@ts-expect-error
        .mockImplementation((cmdString, cmdOptions, callback) => {
          //@ts-expect-error
          callback();

          return { stderr: { on: () => null } };
        });
    });

    it('should re-create remotes for both source repo and fork', async () => {
      await setupRepo({
        accessToken: 'myAccessToken',
        authenticatedUsername: 'sqren_authenticated',
        repoName: 'kibana',
        repoOwner: 'elastic',
        gitUserEmail: 'my-email',
        gitUserName: 'my-username',
        cwd: '/path/to/source/repo',
      } as ValidConfigOptions);

      expect(
        execSpy.mock.calls.map(([cmd, { cwd }]) => ({ cmd, cwd }))
      ).toEqual([
        {
          cmd: 'git rev-parse --show-toplevel',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        { cmd: 'git remote --verbose', cwd: '/path/to/source/repo' },
        {
          cmd: 'git config user.name',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git config user.email',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        { cmd: 'git remote --verbose', cwd: '/path/to/source/repo' },
        {
          cmd: 'git config user.name my-username',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git config user.email my-email',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git remote rm origin',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git remote rm sqren_authenticated',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git remote add sqren_authenticated https://x-access-token:myAccessToken@github.com/sqren_authenticated/kibana.git',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git remote rm elastic',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
        {
          cmd: 'git remote add elastic https://x-access-token:myAccessToken@github.com/elastic/kibana.git',
          cwd: '/myHomeDir/.backport/repositories/elastic/kibana',
        },
      ]);
    });
  });

  describe('if git project does not have user.email or user.name set', () => {
    it('should throw an error', async () => {
      jest
        .spyOn(gitModule, 'getGitProjectRootPath')
        .mockResolvedValue('/path/to/backport/dir');

      await expect(async () => {
        await setupRepo({
          accessToken: 'myAccessToken',
          gitHostname: 'github.com',
          repoName: 'kibana',
          repoOwner: 'elastic',
          cwd: '/path/to/source/repo',
          dir: '/path/to/backport/dir',
        } as ValidConfigOptions);
      }).rejects.toThrowErrorMatchingInlineSnapshot(`
              "*** Please tell me who you are.
              Run

                git config user.name \\"Your Name\\"
                git config user.email \\"you@example.com\\"
                
              Or add it to /myHomeDir/.backport/config.json

                {
                  \\"accessToken\\": \\"***\\",
                  \\"gitUserName\\": \\"Your Name\\",
                  \\"gitUserEmail\\": \\"you@example.com\\"
                }"
            `);
    });
  });

  describe('if repo does not exists locally', () => {
    let spinnerSuccessSpy: jest.SpyInstance;
    beforeEach(async () => {
      const oraMock = getOraMock();
      spinnerSuccessSpy = jest.spyOn(oraMock, 'succeed');

      jest
        .spyOn(childProcess, 'execAsCallback')
        //@ts-expect-error
        .mockImplementation((cmdString, cmdOptions, callback) => {
          //@ts-expect-error
          callback();

          return { stderr: { on: () => null } };
        });

      await setupRepo({
        accessToken: 'myAccessToken',
        gitUserEmail: 'my-email',
        gitUserName: 'my-username',
        gitHostname: 'github.com',
        repoName: 'kibana',
        repoOwner: 'elastic',
        cwd: '/path/to/source/repo',
      } as ValidConfigOptions);
    });

    it('should clone it from github.com', async () => {
      expect(spinnerSuccessSpy).toHaveBeenCalledWith(
        '100% Cloning repository from github.com (one-time operation)'
      );

      expect(childProcess.execAsCallback).toHaveBeenCalledWith(
        'git clone https://x-access-token:myAccessToken@github.com/elastic/kibana.git /myHomeDir/.backport/repositories/elastic/kibana --progress',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('if repo exists locally', () => {
    let spinnerSuccessSpy: jest.SpyInstance;
    beforeEach(async () => {
      const oraMock = getOraMock();
      spinnerSuccessSpy = jest.spyOn(oraMock, 'succeed');

      jest
        .spyOn(gitModule, 'getLocalRepoPath')
        .mockResolvedValue('/path/to/source/repo');

      jest
        .spyOn(gitModule, 'getGitConfig')
        .mockResolvedValue('email-or-username');

      jest
        .spyOn(childProcess, 'execAsCallback')
        //@ts-expect-error
        .mockImplementation((cmdString, cmdOptions, callback) => {
          //@ts-expect-error
          callback();

          return { stderr: { on: () => null } };
        });

      await setupRepo({
        repoName: 'kibana',
        repoOwner: 'elastic',
        cwd: '/path/to/source/repo',
      } as ValidConfigOptions);
    });

    it('should clone it from local folder', async () => {
      expect(spinnerSuccessSpy).toHaveBeenCalledWith(
        '100% Cloning repository from /path/to/source/repo (one-time operation)'
      );

      expect(childProcess.execAsCallback).toHaveBeenCalledWith(
        'git clone /path/to/source/repo /myHomeDir/.backport/repositories/elastic/kibana --progress',
        expect.any(Object),
        expect.any(Function)
      );
    });
  });

  describe('if `repoPath` is a parent of current working directory (cwd)', () => {
    it('should clone it from local folder', async () => {
      await expect(() =>
        setupRepo({
          repoName: 'kibana',
          repoOwner: 'elastic',
          cwd: '/myHomeDir/.backport/repositories/owner/repo/foo',
          dir: '/myHomeDir/.backport/repositories/owner/repo',
        } as ValidConfigOptions)
      ).rejects.toThrowError(
        'Refusing to clone repo into "/myHomeDir/.backport/repositories/owner/repo" when current working directory is "/myHomeDir/.backport/repositories/owner/repo/foo". Please change backport directory via `--dir` option or run backport from another location'
      );
    });
  });
});
