/*
 * This file is included in `setupFiles` in vitest config
 * It will be run once per test file
 */

import { vi } from 'vitest';
import type * as OraModule from '../../lib/ora.js';
import { registerHandlebarsHelpers } from '../../lib/register-handlebars-helpers.js';
import * as packageVersionModule from '../../utils/package-version.js';

vi.mock('find-up', () => {
  return { findUp: vi.fn(() => '/path/to/project/config') };
});

// Store the real version before mocking, accessible via globalThis
(globalThis as any).__UNMOCKED_PACKAGE_VERSION__ =
  packageVersionModule.getPackageVersion();

vi.spyOn(packageVersionModule, 'getPackageVersion').mockReturnValue(
  '1.2.3-mocked',
);

// Suppress ora spinner output in tests by always using non-interactive mode
vi.mock('../../lib/ora', async (importOriginal) => {
  const original = await importOriginal<typeof OraModule>();
  return {
    ...original,
    ora: () => original.oraNonInteractiveMode,
  };
});

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
    redactGithubToken: vi.fn((str: string) => str),
    consoleLog: vi.fn(),
    setGithubToken: vi.fn(),
    logger,
  };
});

registerHandlebarsHelpers();
