import os from 'node:os';
import * as logger from '../lib/logger.js';
import * as globalConfig from '../options/config/global-config.js';
import { postinstall } from './postinstall.js';

describe('postinstall', () => {
  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue('/myHomeDir');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create global config if it doesn't exist", async () => {
    const createGlobalConfigAndFolderIfNotExistSpy = vi
      .spyOn(globalConfig, 'createGlobalConfigAndFolderIfNotExist')
      .mockResolvedValueOnce(true);

    await postinstall();
    expect(createGlobalConfigAndFolderIfNotExistSpy).toHaveBeenCalledTimes(1);
    expect(logger.consoleLog).toHaveBeenCalledWith(
      'Global config successfully created in /myHomeDir/.backport/config.json',
    );
  });

  it('should not create global config if it already exists', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const createGlobalConfigAndFolderIfNotExistSpy = vi
      .spyOn(globalConfig, 'createGlobalConfigAndFolderIfNotExist')
      .mockResolvedValueOnce(false);

    await postinstall();
    expect(createGlobalConfigAndFolderIfNotExistSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledTimes(0);
  });
});
