import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import stripAnsi from 'strip-ansi';
import pkg from '../../../../package.json';
import { getDevAccessToken } from '../../private/get-dev-access-token';

const accessToken = getDevAccessToken();

describe('CLI “backport” binary', () => {
  const binPath = path.resolve(__dirname, '../../../../bin/backport');

  beforeAll(() => {
    // ensure dist folder exists
    const distPath = path.resolve(__dirname, '../../../../dist');
    if (!fs.existsSync(distPath)) {
      throw new Error(`Please run "yarn build" before running this test.`);
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
