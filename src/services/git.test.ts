import { BackportOptions } from '../options/options';
import {
  addRemote,
  getUnstagedFiles,
  getFilesWithConflicts,
} from '../services/git';
import * as childProcess from '../services/child-process-promisified';

type ExecReturnType = childProcess.ExecReturnType;

describe('getUnstagedFiles', () => {
  it('should split by linebreak and remove empty items', async () => {
    const stdout = `add 'conflicting-file.txt'\nadd 'another-conflicting-file.js'\n`;
    jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValue({ stdout } as ExecReturnType);

    expect(
      await getUnstagedFiles({
        repoOwner: 'elastic',
        repoName: 'kibana',
      } as BackportOptions)
    ).toEqual([
      ' - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt',
      ' - /myHomeDir/.backport/repositories/elastic/kibana/another-conflicting-file.js',
    ]);
  });
});

describe('getFilesWithConflicts', () => {
  it('should split by linebreak and remove empty and duplicate items', async () => {
    const err = {
      killed: false,
      code: 2,
      signal: null,
      cmd: 'git --no-pager diff --check',
      stdout:
        'conflicting-file.txt:1: leftover conflict marker\nconflicting-file.txt:3: leftover conflict marker\nconflicting-file.txt:5: leftover conflict marker\n',
      stderr: '',
    };
    jest.spyOn(childProcess, 'exec').mockRejectedValue(err as ExecReturnType);

    expect(
      await getFilesWithConflicts({
        repoOwner: 'elastic',
        repoName: 'kibana',
      } as BackportOptions)
    ).toEqual([
      ' - /myHomeDir/.backport/repositories/elastic/kibana/conflicting-file.txt',
    ]);
  });
});

describe('addRemote', () => {
  it('add correct origin remote', async () => {
    const spy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValue({} as ExecReturnType);
    await addRemote(
      {
        accessToken: 'myAccessToken',
        repoOwner: 'elastic',
        repoName: 'kibana',
        gitHostname: 'github.com',
      } as BackportOptions,
      'elastic'
    );

    return expect(
      spy
    ).toHaveBeenCalledWith(
      'git remote add elastic https://myAccessToken@github.com/elastic/kibana.git',
      { cwd: '/myHomeDir/.backport/repositories/elastic/kibana' }
    );
  });

  it('add correct user remote', async () => {
    const spy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValue({} as ExecReturnType);
    await addRemote(
      {
        accessToken: 'myAccessToken',
        repoOwner: 'elastic',
        repoName: 'kibana',
        gitHostname: 'github.com',
      } as BackportOptions,
      'sqren'
    );

    return expect(
      spy
    ).toHaveBeenCalledWith(
      'git remote add sqren https://myAccessToken@github.com/sqren/kibana.git',
      { cwd: '/myHomeDir/.backport/repositories/elastic/kibana' }
    );
  });

  it('allows custom github url', async () => {
    const spy = jest
      .spyOn(childProcess, 'exec')
      .mockResolvedValue({} as ExecReturnType);
    await addRemote(
      {
        accessToken: 'myAccessToken',
        repoOwner: 'elastic',
        repoName: 'kibana',
        gitHostname: 'github.my-company.com',
      } as BackportOptions,
      'sqren'
    );

    return expect(
      spy
    ).toHaveBeenCalledWith(
      'git remote add sqren https://myAccessToken@github.my-company.com/sqren/kibana.git',
      { cwd: '/myHomeDir/.backport/repositories/elastic/kibana' }
    );
  });
});
