import { spawnSync } from 'node:child_process';
import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import stripAnsi from 'strip-ansi';
import { getDevAccessToken } from '../helpers/get-dev-access-token.js';
import { getSandboxPath, resetSandbox } from '../helpers/sandbox.js';

const ROOT = process.cwd();
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const accessToken = getDevAccessToken();
const sandboxPath = getSandboxPath({ filename: import.meta.filename });

describe('CLI "backport" binary', () => {
  const binPath = path.resolve(ROOT, 'bin/backport');

  beforeAll(async () => {
    const distPath = path.resolve(ROOT, 'dist');
    if (!fs.existsSync(distPath)) {
      throw new Error(`Please run "npm run build" before running this test.`);
    }
    await resetSandbox(sandboxPath);
  });

  it('exists and is executable', () => {
    expect(fs.existsSync(binPath)).toBe(true);
    const fileContent = fs.readFileSync(binPath, 'utf8');
    expect(fileContent).toContain('#!/usr/bin/env node');
  });

  it('prints version with `--version`', () => {
    const result = spawnSync('node', [binPath, '--version'], {
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it('list commits', () => {
    const result = spawnSync(
      'node',
      [
        binPath,
        '--repo',
        'elastic/kibana',
        `--accessToken`,
        accessToken,
        `--dir=${sandboxPath}`,
      ],
      {
        encoding: 'utf8',
      },
    );

    const strippedStdout = stripAnsi(result.stdout);
    expect(strippedStdout).toContain('repo: elastic/kibana');
    expect(strippedStdout).toContain('Select commit');
  });

  it('displays help section', () => {
    const result = spawnSync('node', [binPath, '--help'], {
      encoding: 'utf8',
    });

    const strippedStdout = stripAnsi(result.stdout);
    expect(result.status).toBe(0);
    expect(strippedStdout).toContain('backport [args]');
    expect(strippedStdout).toContain('-v, --version');
  });
});
