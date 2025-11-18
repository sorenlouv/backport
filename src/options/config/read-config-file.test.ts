import fs from 'fs/promises';
import { BackportError } from '../../lib/backport-error';
import { parseConfigFile, readConfigFile } from './read-config-file';

describe('parseConfigFile', () => {
  describe('when JSON contains comments', () => {
    it('should strip comments', () => {
      const config = parseConfigFile(`{
        // This is my access token
        "accessToken": "token123",
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

  describe('when backward compatibility options are used', () => {
    it('should handle deprecated config options', () => {
      const config = parseConfigFile(`{
        "accessToken": "token",
        "upstream": "owner/repo",
        "branches": ["main", "7.x"]
      }`);

      expect(config).toEqual({
        accessToken: 'token',
        repoOwner: 'owner',
        repoName: 'repo',
        targetBranchChoices: ['main', '7.x'],
      });
    });
  });
});

describe('readConfigFile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('when reading a config file', () => {
    it('should read file and parse JSON', async () => {
      jest.spyOn(fs, 'readFile').mockResolvedValue(
        JSON.stringify({
          accessToken: 'token123',
          repoOwner: 'elastic',
          repoName: 'kibana',
        }),
      );

      const config = await readConfigFile('/path/to/config.json');

      expect(fs.readFile).toHaveBeenCalledWith('/path/to/config.json', 'utf8');
      expect(config).toEqual({
        accessToken: 'token123',
        repoOwner: 'elastic',
        repoName: 'kibana',
      });
    });

    describe('and file contains comments', () => {
      it('should strip comments', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValue(`{
          // Access token
          "accessToken": "token456",
          "repoOwner": "myorg"
        }`);

        const config = await readConfigFile('/path/to/.backportrc.json');

        expect(config).toEqual({
          accessToken: 'token456',
          repoOwner: 'myorg',
        });
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
      it('should handle deprecated options', async () => {
        jest.spyOn(fs, 'readFile').mockResolvedValue(`{
          "accessToken": "token",
          "upstream": "owner/repo",
          "branches": ["main", "develop"]
        }`);

        const config = await readConfigFile('/config.json');

        expect(config).toEqual({
          accessToken: 'token',
          repoOwner: 'owner',
          repoName: 'repo',
          targetBranchChoices: ['main', 'develop'],
        });
      });
    });
  });
});
