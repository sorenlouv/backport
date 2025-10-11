import fs from 'fs/promises';
import { BackportError } from '../../lib/backport-error';
import { parseConfigFile, readConfigFile } from './read-config-file';

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('parseConfigFile', () => {
  describe('when environment variables are used', () => {
    describe('and a single environment variable is defined', () => {
      it('should substitute the environment variable', () => {
        process.env.GITHUB_ACCESS_TOKEN = 'ghp_mytoken123';

        const config = parseConfigFile(`{
          "accessToken": "\${GITHUB_ACCESS_TOKEN}",
          "repoOwner": "elastic",
          "repoName": "kibana"
        }`);

        expect(config).toEqual({
          accessToken: 'ghp_mytoken123',
          repoOwner: 'elastic',
          repoName: 'kibana',
        });
      });
    });

    describe('and multiple environment variables are defined', () => {
      it('should substitute all environment variables', () => {
        process.env.ACCESS_TOKEN = 'token123';
        process.env.REPO_OWNER = 'myorg';
        process.env.REPO_NAME = 'myrepo';
        process.env.EDITOR = 'code';

        const config = parseConfigFile(`{
          "accessToken": "\${ACCESS_TOKEN}",
          "repoOwner": "\${REPO_OWNER}",
          "repoName": "\${REPO_NAME}",
          "editor": "\${EDITOR}"
        }`);

        expect(config).toEqual({
          accessToken: 'token123',
          repoOwner: 'myorg',
          repoName: 'myrepo',
          editor: 'code',
        });
      });
    });

    describe('and environment variable has whitespace in placeholder', () => {
      it('should trim and substitute the environment variable', () => {
        process.env.TOKEN = 'my-token';

        const config = parseConfigFile('{"accessToken": "${ TOKEN }"}');

        expect(config).toEqual({
          accessToken: 'my-token',
        });
      });
    });

    describe('when environment variable is not defined', () => {
      it('should throw BackportError with clear message', () => {
        expect(() => {
          parseConfigFile(`{
            "accessToken": "\${UNDEFINED_TOKEN}",
            "repoOwner": "elastic"
          }`);
        }).toThrow(BackportError);

        expect(() => {
          parseConfigFile(`{
            "accessToken": "\${UNDEFINED_TOKEN}",
            "repoOwner": "elastic"
          }`);
        }).toThrow(
          'Environment variable "UNDEFINED_TOKEN" is not defined.\n\n' +
            'Please set the environment variable or use a literal value in your config file.',
        );
      });
    });

    describe('when environment variable is empty', () => {
      it('should throw BackportError with clear message', () => {
        process.env.EMPTY_VAR = '';

        expect(() => {
          parseConfigFile('{"accessToken": "${EMPTY_VAR}"}');
        }).toThrow(BackportError);

        expect(() => {
          parseConfigFile('{"accessToken": "${EMPTY_VAR}"}');
        }).toThrow(
          'Environment variable "EMPTY_VAR" is empty.\n\n' +
            'Please set a valid value for the environment variable or use a literal value in your config file.',
        );
      });
    });

    describe('and environment variable contains special characters', () => {
      it('should substitute the value correctly', () => {
        process.env.SPECIAL_TOKEN =
          'ghp_token-with-dashes_and_underscores123!@#$%';

        const config = parseConfigFile('{"accessToken": "${SPECIAL_TOKEN}"}');

        expect(config).toEqual({
          accessToken: 'ghp_token-with-dashes_and_underscores123!@#$%',
        });
      });
    });

    describe('and invalid placeholder syntax is used', () => {
      it('should not substitute invalid placeholders', () => {
        const config = parseConfigFile(`{
          "value": "$INVALID",
          "another": "$(ALSO_INVALID)"
        }`);

        expect(config).toEqual({
          value: '$INVALID',
          another: '$(ALSO_INVALID)',
        });
      });
    });
  });

  describe('when JSON contains comments', () => {
    describe('and environment variables are used', () => {
      it('should strip comments and substitute environment variables', () => {
        process.env.MY_TOKEN = 'token123';

        const config = parseConfigFile(`{
          // This is my access token
          "accessToken": "\${MY_TOKEN}",
          /* Multi-line
             comment */
          "repoOwner": "myorg"
        }`);

        expect(config).toEqual({
          accessToken: 'token123',
          repoOwner: 'myorg',
        });
      });
    });
  });

  describe('when backward compatibility options are used', () => {
    describe('and environment variables are present', () => {
      it('should handle environment variables with deprecated config options', () => {
        process.env.TOKEN = 'mytoken';

        const config = parseConfigFile(`{
          "accessToken": "\${TOKEN}",
          "upstream": "owner/repo",
          "branches": ["main", "7.x"]
        }`);

        expect(config).toEqual({
          accessToken: 'mytoken',
          repoOwner: 'owner',
          repoName: 'repo',
          targetBranchChoices: ['main', '7.x'],
        });
      });
    });
  });
});

describe('readConfigFile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when reading a config file', () => {
    describe('and environment variables are used', () => {
      it('should read file and substitute environment variables', async () => {
        process.env.MY_ACCESS_TOKEN = 'ghp_secret123';

        jest.spyOn(fs, 'readFile').mockResolvedValue(
          JSON.stringify({
            accessToken: '${MY_ACCESS_TOKEN}',
            repoOwner: 'elastic',
            repoName: 'kibana',
          }),
        );

        const config = await readConfigFile('/path/to/config.json');

        expect(fs.readFile).toHaveBeenCalledWith(
          '/path/to/config.json',
          'utf8',
        );
        expect(config).toEqual({
          accessToken: 'ghp_secret123',
          repoOwner: 'elastic',
          repoName: 'kibana',
        });
      });
    });

    describe('and file contains comments', () => {
      describe('and environment variables are used', () => {
        it('should strip comments and substitute environment variables', async () => {
          process.env.GITHUB_TOKEN = 'token456';

          jest.spyOn(fs, 'readFile').mockResolvedValue(`{
            // Access token from environment
            "accessToken": "\${GITHUB_TOKEN}",
            "repoOwner": "myorg"
          }`);

          const config = await readConfigFile('/path/to/.backportrc.json');

          expect(config).toEqual({
            accessToken: 'token456',
            repoOwner: 'myorg',
          });
        });
      });
    });

    describe('and multiple environment variables are used', () => {
      it('should substitute all environment variables', async () => {
        process.env.ACCESS_TOKEN = 'token789';
        process.env.OWNER = 'testorg';
        process.env.REPO = 'testrepo';

        jest.spyOn(fs, 'readFile').mockResolvedValue(`{
          "accessToken": "\${ACCESS_TOKEN}",
          "repoOwner": "\${OWNER}",
          "repoName": "\${REPO}"
        }`);

        const config = await readConfigFile('/config.json');

        expect(config).toEqual({
          accessToken: 'token789',
          repoOwner: 'testorg',
          repoName: 'testrepo',
        });
      });
    });

    describe('when environment variable is not defined', () => {
      it('should throw BackportError with clear message', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValue(`{
          "accessToken": "\${UNDEFINED_VAR}",
          "repoOwner": "elastic"
        }`);

        await expect(readConfigFile('/config.json')).rejects.toThrow(
          BackportError,
        );

        await expect(readConfigFile('/config.json')).rejects.toThrow(
          'Environment variable "UNDEFINED_VAR" is not defined.\n\n' +
            'Please set the environment variable or use a literal value in your config file.',
        );
      });
    });

    describe('when environment variable is empty', () => {
      it('should throw BackportError with clear message', async () => {
        process.env.EMPTY_VAR = '';

        jest.spyOn(fs, 'readFile').mockResolvedValue(`{
          "accessToken": "\${EMPTY_VAR}",
          "repoOwner": "elastic"
        }`);

        await expect(readConfigFile('/config.json')).rejects.toThrow(
          BackportError,
        );

        await expect(readConfigFile('/config.json')).rejects.toThrow(
          'Environment variable "EMPTY_VAR" is empty.\n\n' +
            'Please set a valid value for the environment variable or use a literal value in your config file.',
        );
      });
    });

    describe('and config file contains invalid JSON', () => {
      it('should throw BackportError', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValue(`{
          "accessToken": "token",
          invalid json here
        }`);

        await expect(
          readConfigFile('/path/to/bad-config.json'),
        ).rejects.toThrow(BackportError);

        await expect(
          readConfigFile('/path/to/bad-config.json'),
        ).rejects.toThrow('"/path/to/bad-config.json" contains invalid JSON');
      });

      it('should include file contents in error message', async () => {
        const invalidConfig = '{ "accessToken": }';
        jest.spyOn(fs, 'readFile').mockResolvedValue(invalidConfig);

        await expect(readConfigFile('/config.json')).rejects.toThrow(
          invalidConfig,
        );
      });
    });

    describe('and backward compatibility options are used', () => {
      describe('and environment variables are present', () => {
        it('should handle environment variables with deprecated options', async () => {
          process.env.TOKEN = 'compat-token';

          jest.spyOn(fs, 'readFile').mockResolvedValue(`{
            "accessToken": "\${TOKEN}",
            "upstream": "owner/repo",
            "branches": ["main", "develop"]
          }`);

          const config = await readConfigFile('/config.json');

          expect(config).toEqual({
            accessToken: 'compat-token',
            repoOwner: 'owner',
            repoName: 'repo',
            targetBranchChoices: ['main', 'develop'],
          });
        });
      });
    });

    describe('and using a real-world config format', () => {
      describe('and multiple environment variables are present', () => {
        it('should handle complex config with comments and mixed content', async () => {
          process.env.GITHUB_ACCESS_TOKEN = 'ghp_realtoken';
          process.env.EDITOR_COMMAND = 'vim';

          jest.spyOn(fs, 'readFile').mockResolvedValue(`{
            // Create a personal access token here: https://github.com/settings/tokens
            // Must have "Repo: Full control of private repositories"
            "accessToken": "\${GITHUB_ACCESS_TOKEN}",

            // Optional editor
            "editor": "\${EDITOR_COMMAND}",

            // Repository settings
            "repoOwner": "elastic",
            "repoName": "kibana",
            "targetBranchChoices": ["8.x", "7.x"]
          }`);

          const config = await readConfigFile(
            '/home/user/.backport/config.json',
          );

          expect(config).toEqual({
            accessToken: 'ghp_realtoken',
            editor: 'vim',
            repoOwner: 'elastic',
            repoName: 'kibana',
            targetBranchChoices: ['8.x', '7.x'],
          });
        });
      });
    });
  });
});
