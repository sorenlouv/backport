import { spawnSync } from 'child_process';
import fs from 'fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'path';
import stripAnsi from 'strip-ansi';
import { getDevAccessToken } from '../../private/get-dev-access-token.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '../../../../package.json'), 'utf-8'),
);

const accessToken = getDevAccessToken();

describe('CLI “backport” binary', () => {
  const binPath = path.resolve(import.meta.dirname, '../../../../bin/backport');

  beforeAll(() => {
    // ensure dist folder exists
    const distPath = path.resolve(import.meta.dirname, '../../../../dist');
    if (!fs.existsSync(distPath)) {
      throw new Error(`Please run "npm run build" before running this test.`);
    }
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
      [binPath, '--repo', 'elastic/kibana', `--accessToken`, accessToken],
      {
        encoding: 'utf8',
      },
    );

    const strippedStdout = stripAnsi(result.stdout);
    expect(result.status).toBe(0);
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
