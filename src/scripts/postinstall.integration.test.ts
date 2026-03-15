import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseConfigFile } from '../options/config/read-config-file.js';

// This test performs an end-to-end verification that the published package's
// postinstall script executes and creates the expected ~/.backport/config.json
// file with the correct permissions and template content.
//
// It does so by:
// 1. Building the project (so dist/ exists)
// 2. Packing the project into a tarball with `npm pack`
// 3. Creating a temporary consumer project
// 4. Overriding HOME for the install so the script writes into an isolated dir
// 5. Installing the packed tarball via `npm install`
// 6. Asserting that ~/.backport/config.json now exists with mode 600

describe('postinstall (integration)', () => {
  let fakeHomeDir: string;
  let workDir: string;
  let tarballPath: string;

  // Building & packing can be slow
  vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

  beforeAll(() => {
    const repoRoot = path.resolve(import.meta.dirname, '../..');
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backport-consumer-'));

    // 2. Pack the project; npm pack outputs the tarball filename as the last line of stdout
    const tarballName = execSync('npm pack', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .pop()!;
    tarballPath = path.join(repoRoot, tarballName);

    // 3. Create consumer project working directory
    fs.writeFileSync(
      path.join(workDir, 'package.json'),
      JSON.stringify({ name: 'consumer-project', private: true }, null, 2),
    );

    // 4. Prepare fake HOME directory
    fakeHomeDir = path.join(workDir, 'fake-home');
    fs.mkdirSync(fakeHomeDir, { recursive: true });

    // 5. Install the packed tarball (this should trigger postinstall)
    execSync(`npm install ${tarballPath}`, {
      cwd: workDir,
      env: {
        ...process.env,
        // Override HOME so os.homedir() inside the installed package resolves here
        HOME: fakeHomeDir,
      },
      stdio: 'ignore',
    });
  });

  afterAll(() => {
    try {
      if (tarballPath) fs.rmSync(tarballPath, { force: true });
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('creates ~/.backport/config.json', () => {
    const configPath = path.join(fakeHomeDir, '.backport', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const content = fs.readFileSync(configPath, 'utf8');
    // Basic shape: contains the accessToken field (empty string template)
    expect(content).toContain('"accessToken"');

    const stat = fs.statSync(configPath);
    // Mask to permission bits and ensure 0600 (owner read/write only)
    const mode = stat.mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('does not overwrite existing config file', () => {
    // Create a new home directory with an existing config
    const newFakeHomeDir = path.join(workDir, 'fake-home-existing-config');
    fs.mkdirSync(path.join(newFakeHomeDir, '.backport'), { recursive: true });

    const configPath = path.join(newFakeHomeDir, '.backport', 'config.json');
    const customContent =
      '{"accessToken": "test-token", "customSetting": true}';
    fs.writeFileSync(configPath, customContent);

    // Install again with the new HOME
    execSync(`npm install ${tarballPath}`, {
      cwd: workDir,
      env: {
        ...process.env,
        HOME: newFakeHomeDir,
      },
      stdio: 'ignore',
    });

    // Config file should still have our custom content
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toBe(customContent);
  });

  it('creates config with the expected template content', async () => {
    const configPath = path.join(fakeHomeDir, '.backport', 'config.json');
    const content = fs.readFileSync(configPath, 'utf8');
    const config = parseConfigFile(content);
    expect(config).toEqual({ accessToken: '' });
  });
});
