/*
 * This file is included in `setupFiles` in jest.config.js
 * It will be run once per test file
 */

import { disableApm } from '../../lib/apm';
import { registerHandlebarsHelpers } from '../../lib/register-handlebars-helpers';
import * as packageVersionModule from '../../utils/package-version';

disableApm();

jest.mock('find-up', () => {
  return jest.fn(async () => '/path/to/project/config');
});

// @ts-expect-error
// eslint-disable-next-line no-import-assign
packageVersionModule.UNMOCKED_PACKAGE_VERSION =
  packageVersionModule.getPackageVersion();

jest
  .spyOn(packageVersionModule, 'getPackageVersion')
  .mockReturnValue('1.2.3-mocked');

jest.mock('make-dir', () => {
  return jest.fn(() => Promise.resolve('/some/path'));
});

jest.mock('del', () => {
  return jest.fn(async (path) => `Attempted to delete ${path}`);
});

jest.mock('../../lib/logger', () => {
  const spy = jest.fn();
  const logger = {
    spy: spy,
    info: (msg: string, meta: unknown) => spy(`[INFO] ${msg}`, meta),
    verbose: (msg: string, meta: unknown) => spy(`[VERBOSE] ${msg}`, meta),
    warn: (msg: string, meta: unknown) => spy(`[WARN] ${msg}`, meta),
    error: (msg: string, meta: unknown) => spy(`[ERROR] ${msg}`, meta),
    debug: (msg: string, meta: unknown) => spy(`[DEBUG] ${msg}`, meta),
  };
  return {
    initLogger: jest.fn(() => logger),
    redactAccessToken: jest.fn((str: string) => str),
    consoleLog: jest.fn(),
    setAccessToken: jest.fn(),
    logger,
  };
});

registerHandlebarsHelpers();
