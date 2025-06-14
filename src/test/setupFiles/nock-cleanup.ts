/*
 * Global cleanup for nock to prevent Jest 30 memory warnings
 * This ensures nock interceptors are properly cleaned up between test files
 */

import nock from 'nock';

// Clean up nock interceptors after each test file
afterAll(() => {
  nock.cleanAll();
  nock.restore();
});
