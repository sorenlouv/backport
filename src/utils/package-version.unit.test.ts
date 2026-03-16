import { getPackageVersion } from './package-version.js';

describe('getPackageVersion', () => {
  it('returns a valid semver version string', () => {
    const version = getPackageVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('does not return the "unknown" fallback', () => {
    const version = getPackageVersion();
    expect(version).not.toBe('unknown');
  });
});
