/*
 * Global cleanup for nock to prevent memory warnings
 * This ensures nock interceptors are properly cleaned up between test files
 */

import nock from 'nock';
import { afterAll } from 'vitest';

// Clean up nock interceptors after each test file
afterAll(() => {
  nock.cleanAll();
  nock.restore();
});
