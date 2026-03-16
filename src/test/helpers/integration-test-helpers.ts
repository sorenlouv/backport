/**
 * Returns the npm command to use in integration tests.
 * npm ships with Node, so no special resolution is needed.
 */
export function getNpmCommand(): string {
  return 'npm';
}
