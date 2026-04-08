import fs from 'node:fs/promises';
import path from 'node:path';
import type { BackportResponse } from '../../backport-run.js';
import type { ConfigFileOptions } from '../../entrypoint.api.js';
import type { ErrorResult } from '../../lib/run-sequentially.js';
import { getDevAccessToken } from '../helpers/get-dev-access-token.js';
import { getSandboxPath, resetSandbox } from '../helpers/sandbox.js';
import { runBackportViaCli } from './run-backport-via-cli.js';

const accessToken = getDevAccessToken();
vi.setConfig({ testTimeout: 15_000 });

describe('non interactive (json) error handling', () => {
  it(`when access token is missing`, async () => {
    const configFilePath = await createConfigFile({ editor: 'code' });
    const { output, code } = await runBackportViaCli([
      '--json',
      `--globalConfigFile=${configFilePath}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;

    // remove absolute path to avoid issues on ci
    const errorMessage = error.errorMessage.replace(
      configFilePath,
      '<GLOBAL_CONFIG_FILE>',
    );

    expect(code).toBe(1);
    expect(error.status).toBe('error');
    expect(errorMessage).toMatchInlineSnapshot(`
      "Please update your config file: "<GLOBAL_CONFIG_FILE>".
      It must contain a valid "accessToken".

      Read more: https://github.com/sorenlouv/backport/blob/main/docs/config-file-options.md#global-config-backportconfigjson"
    `);
  });

  it('when target branches cannot be inferred from pull request', async () => {
    const { output, code } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--pr=9',
      `--accessToken=${accessToken}`,
    ]);

    expect(code).toBe(0);
    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorCode).toBe('no-branches-exception');
    expect(error.errorMessage).toBe(
      'There are no branches to backport to. Aborting.',
    );
  });

  it(`when target branch and branch label mapping are missing`, async () => {
    const { output, code } = await runBackportViaCli([
      '--json',
      `--access-token=${accessToken}`,
    ]);

    expect(code).toBe(1);
    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorMessage).toMatchInlineSnapshot(`
      "Please specify a target branch: "--branch 6.1".

      Read more: https://github.com/sorenlouv/backport/blob/main/docs/config-file-options.md#project-config-backportrcjson"
    `);
  });

  it(`when argument is invalid`, async () => {
    const { output } = await runBackportViaCli(['--json', '--foo'], {});

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorMessage).toEqual('Unknown argument: foo');
  });

  it('when `--repo` is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e-foo',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorMessage).toEqual(
      `The repository "backport-org/backport-e2e-foo" doesn't exist`,
    );
  });

  it('when `--sha` is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--sha=abcdefg',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorMessage).toEqual(
      'No commit found on branch "master" with sha "abcdefg"',
    );
  });

  it('when `--branch` is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--pr=9',
      '--branch=foobar',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult
      .results[0] as ErrorResult<'invalid-branch-exception'>;
    expect(error.status).toBe('error');
    expect(error.errorCode).toBe('invalid-branch-exception');
    expect(error.errorContext).toEqual({
      code: 'invalid-branch-exception',
      branchName: 'foobar',
    });
  });

  it('when `--branch` tries to inject argument', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--pr=9',
      '--branch=--foo bar',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult
      .results[0] as ErrorResult<'invalid-branch-exception'>;
    expect(error.status).toBe('error');
    expect(error.errorCode).toBe('invalid-branch-exception');
    expect(error.errorContext).toEqual({
      code: 'invalid-branch-exception',
      branchName: '--foo bar',
    });
  });

  it('when `--pr` is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--pr=900',
      '--branch=7.x',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorMessage).toContain(
      'Could not resolve to a PullRequest with the number of 900',
    );
  });

  it('when encountering conflicts', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/repo-with-conflicts',
      '--pr=12',
      '--branch=7.x',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult
      .results[0] as ErrorResult<'merge-conflict-exception'>;
    expect(error.status).toBe('error');
    expect(error.errorContext?.conflictingFiles).toEqual(['la-liga.md']);
  });

  it('when `--source-branch` is invalid', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--pr=9',
      '--branch=7.x',
      '--source-branch=foo',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorCode).toBe('unhandled-exception');
    expect(error.targetBranch).toBe('7.x');
    expect(error.errorMessage).toContain(
      "error: pathspec 'foo' did not match any file(s) known to git",
    );
  });

  it('when attempting to backport unmerged PR', async () => {
    const { output } = await runBackportViaCli([
      '--json',
      '--repo=backport-org/backport-e2e',
      '--pr=12',
      `--accessToken=${accessToken}`,
    ]);

    const backportResult = JSON.parse(output) as BackportResponse;
    const error = backportResult.results[0] as ErrorResult;
    expect(error.status).toBe('error');
    expect(error.errorCode).toBe('pr-not-merged-exception');
    expect(error.errorMessage).toBe('The PR #12 is not merged');
  });
});

async function createConfigFile(options: ConfigFileOptions) {
  const sandboxPath = getSandboxPath({ filename: import.meta.filename });
  await resetSandbox(sandboxPath);
  const configPath = path.join(sandboxPath, 'config.json');
  await fs.writeFile(configPath, JSON.stringify(options));
  return configPath;
}
