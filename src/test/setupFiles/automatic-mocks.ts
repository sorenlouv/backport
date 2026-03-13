/*
 * This file is included in `setupFiles` in vitest config
 * It will be run once per test file
 */

import { vi } from 'vitest';
import { registerHandlebarsHelpers } from '../../lib/register-handlebars-helpers.js';
import * as packageVersionModule from '../../utils/package-version.js';

vi.mock('find-up', () => {
  return { findUp: vi.fn(async () => '/path/to/project/config') };
});

// Store the real version before mocking, accessible via globalThis
(globalThis as any).__UNMOCKED_PACKAGE_VERSION__ =
  packageVersionModule.getPackageVersion();

vi.spyOn(packageVersionModule, 'getPackageVersion').mockReturnValue(
  '1.2.3-mocked',
);

// Spy on fs.rm and fs.mkdir to prevent actual filesystem operations in tests.
// We use dynamic import + spyOn instead of vi.mock to avoid interfering
// with other fs method spies (readFile, writeFile, chmod) in individual tests.
const fsPromises = await import('fs/promises');
vi.spyOn(fsPromises.default, 'rm').mockResolvedValue(undefined);
vi.spyOn(fsPromises.default, 'mkdir').mockResolvedValue('/some/path' as any);

vi.mock('../../lib/logger', () => {
  const spy = vi.fn();
  const logger = {
    spy: spy,
    info: (msg: string, meta: unknown) => spy(`[INFO] ${msg}`, meta),
    verbose: (msg: string, meta: unknown) => spy(`[VERBOSE] ${msg}`, meta),
    warn: (msg: string, meta: unknown) => spy(`[WARN] ${msg}`, meta),
    error: (msg: string, meta: unknown) => spy(`[ERROR] ${msg}`, meta),
    debug: (msg: string, meta: unknown) => spy(`[DEBUG] ${msg}`, meta),
  };
  return {
    initLogger: vi.fn(() => logger),
    redactAccessToken: vi.fn((str: string) => str),
    consoleLog: vi.fn(),
    setAccessToken: vi.fn(),
    logger,
  };
});

registerHandlebarsHelpers();
