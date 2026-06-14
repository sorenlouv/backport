import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const NON_UNIT_TEST_FILE_PATTERN =
  /\.(private|mutation|integration)\.test\.ts$/;

// Files allowed to reference external repos.
// `git.private.test.ts` only uses external repo names as offline remote-URL
// fixtures (parsing `git remote` output) and never hits the network.
const ALLOWLIST = new Set(['lib/git/git.private.test.ts']);

const EXTERNAL_REPO_PATTERN = /elastic/;

describe('no external test repos', () => {
  it('non-unit tests must only reference repos under backport-org control', () => {
    const nonUnitTestFiles = readdirSync(SRC_DIR, { recursive: true })
      .map((entry) => entry.toString())
      .filter((relativePath) => NON_UNIT_TEST_FILE_PATTERN.test(relativePath))
      .filter((relativePath) => !ALLOWLIST.has(relativePath));

    // sanity check: the recursive scan must actually find test files
    expect(nonUnitTestFiles.length).toBeGreaterThan(0);

    const offendingFiles = nonUnitTestFiles.filter((relativePath) => {
      const contents = readFileSync(join(SRC_DIR, relativePath), 'utf8');
      return EXTERNAL_REPO_PATTERN.test(contents);
    });

    expect(
      offendingFiles,
      `The following test files reference external repos (matched ${String(
        EXTERNAL_REPO_PATTERN,
      )}):\n\n${offendingFiles.map((f) => `  - src/${f}`).join('\n')}\n\n` +
        'Policy: private/mutation/integration tests must only reference repos under ' +
        'the `backport-org` organization, which we control. Tests that depend on ' +
        'external repos break when those repos change — in June 2026, data drift in ' +
        'elastic/kibana (force-pushed branches and changed PRs) broke the entire ' +
        'private test suite and the fixtures had to be migrated to ' +
        'backport-org/backport-e2e. Point the test at a fixture repo under ' +
        'backport-org instead, or (for offline fixtures that never hit the network) ' +
        'add the file to the ALLOWLIST in this test with a justification.',
    ).toEqual([]);
  });
});
