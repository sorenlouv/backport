import * as fs from '../../services/fs-promisified';
import { PromiseReturnType } from '../../types/PromiseReturnType';
import { getGlobalConfig, maybeCreateGlobalConfig } from './globalConfig';
import makeDir from 'make-dir';

describe('config', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('getGlobalConfig', () => {
    let res: PromiseReturnType<typeof getGlobalConfig>;
    beforeEach(async () => {
      jest.spyOn(fs, 'chmod').mockResolvedValue();
      jest.spyOn(fs, 'writeFile').mockResolvedValue();
      jest.spyOn(fs, 'readFile').mockResolvedValue(
        JSON.stringify({
          accessToken: 'myAccessToken',
          username: 'sqren',
        })
      );
      res = await getGlobalConfig();
    });

    it("should create config if it doesn't exist", () => {
      expect(
        fs.writeFile
      ).toHaveBeenCalledWith(
        '/myHomeDir/.backport/config.json',
        expect.any(String),
        { flag: 'wx', mode: 384 }
      );
    });

    it("should create config folders if it they don't exist", () => {
      expect(makeDir).toHaveBeenCalledWith('/myHomeDir/.backport/repositories');
    });

    it('should load config', () => {
      expect(fs.readFile).toHaveBeenCalledWith(
        '/myHomeDir/.backport/config.json',
        'utf8'
      );
    });

    it('should return config', () => {
      expect(res).toEqual({
        accessToken: 'myAccessToken',
        username: 'sqren',
      });
    });
  });

  describe('maybeCreateGlobalConfig', () => {
    it('should create config and succeed', async () => {
      jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
      const didCreate = await maybeCreateGlobalConfig(
        '/path/to/globalConfig',
        'myConfigTemplate'
      );

      expect(didCreate).toEqual(true);

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/path/to/globalConfig',
        expect.stringContaining('myConfigTemplate'),
        { flag: 'wx', mode: 384 }
      );
    });

    it('should not fail if config already exists', async () => {
      const err = new Error();
      (err as any).code = 'EEXIST';
      jest.spyOn(fs, 'writeFile').mockRejectedValueOnce(err);

      const didCreate = await maybeCreateGlobalConfig(
        'myPath',
        'myConfigTemplate'
      );

      expect(didCreate).toEqual(false);
    });
  });
});
