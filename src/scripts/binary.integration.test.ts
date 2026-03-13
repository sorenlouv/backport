import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Integration test to verify that the `bin` field in package.json exposes a working `backport` CLI.
// Strategy:
// 1. Pack the current project into a tarball (npm pack)
// 2. Create a fresh temp project and install the tarball with npm install
// 3. Assert that node_modules/.bin/backport exists and is executable
// 4. Run `backport --version` and compare output with package.json version
// 5. (Smoke) Run `backport --help` to ensure it exits 0 (no interactive prompt)

describe('binary backport file', () => {
  let workDir: string; // consumer project
  let tarballPath: string;
  let version: string;
  let repoRoot: string;
  let binPath: string;

  vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

  beforeAll(() => {
    repoRoot = path.resolve(import.meta.dirname, '../..');

    // read version early
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
    );
    version = pkgJson.version;

    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backport-bin-consumer-'));

    // pack project; npm pack outputs the tarball filename as the last line of stdout
    const tarballName = execSync('npm pack', {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .pop()!;
    tarballPath = path.join(repoRoot, tarballName);

    // create consumer package.json
    fs.writeFileSync(
      path.join(workDir, 'package.json'),
      JSON.stringify({ name: 'consumer-project', private: true }, null, 2),
    );

    // install tarball (this creates node_modules/.bin/backport symlink / shim)
    execSync(`npm install ${tarballPath}`, {
      cwd: workDir,
      stdio: 'ignore',
    });

    binPath = path.join(workDir, 'node_modules', '.bin', 'backport');
  });

  afterAll(() => {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
      if (tarballPath) fs.rmSync(tarballPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('creates the CLI binary in node_modules/.bin', () => {
    expect(fs.existsSync(binPath)).toBe(true);
    const stat = fs.statSync(binPath);
    // at least one execute bit set (symlink or wrapper script)
    expect((stat.mode & 0o111) !== 0).toBe(true);
  });

  it('reports correct version with --version', () => {
    const res = spawnSync(binPath, ['--version'], {
      cwd: workDir,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
      shell: false,
      timeout: 15_000,
    });
    if (res.error) throw res.error;
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe(version);
  });

  it('shows help with --help (smoke test)', () => {
    const res = spawnSync(binPath, ['--help'], {
      cwd: workDir,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' },
      shell: false,
      timeout: 15_000,
    });
    if (res.error) throw res.error;
    expect(res.status).toBe(0);
    // Basic sanity: Should mention backport or usage
    expect(res.stdout.toLowerCase()).toContain('backport');
  });
});
