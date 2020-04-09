import os from 'os';
import axios from 'axios';
import inquirer from 'inquirer';
import { commitsWithPullRequestsMock } from '../../services/github/v4/mocks/commitsByAuthorMock';
import childProcess = require('child_process');
import {
  HOMEDIR_PATH,
  REMOTE_ORIGIN_REPO_PATH,
  REMOTE_FORK_REPO_PATH,
} from './envConstants';

const unmockedExec = childProcess.exec;

export function createSpies({ commitCount }: { commitCount: number }) {
  // set alternative homedir
  jest.spyOn(os, 'homedir').mockReturnValue(HOMEDIR_PATH);

  // proxy exec calls and make a few modifications
  jest.spyOn(childProcess, 'exec').mockImplementation((cmd, options, cb) => {
    const nextCmd = cmd
      .replace(
        'https://myAccessToken@github.com/elastic/backport-demo.git',
        REMOTE_ORIGIN_REPO_PATH
      )
      .replace(
        'https://myAccessToken@github.com/sqren/backport-demo.git',
        REMOTE_FORK_REPO_PATH
      );

    return unmockedExec(nextCmd, options, cb);
  });

  // mock github API v4
  const axiosPostSpy = jest
    .spyOn(axios, 'post')

    // mock `getDefaultRepoBranchAndPerformStartupChecks`
    .mockResolvedValueOnce({
      data: {
        data: { repository: { defaultBranchRef: { name: 'master' } } },
      },
    })

    // mock `getIdByLogin`
    .mockResolvedValueOnce({
      data: {
        data: {
          user: {
            id: 'sqren_author_id',
          },
        },
      },
    })

    // mock `fetchCommitsByAuthor`
    .mockResolvedValueOnce({
      data: {
        data: commitsWithPullRequestsMock,
      },
    });

  // mock githb API v3
  const axiosRequestSpy = jest
    .spyOn(axios, 'request')

    // mock create pull request
    .mockResolvedValueOnce({ data: {} });

  // mock prompt
  jest
    .spyOn(inquirer, 'prompt')

    .mockImplementationOnce((async (args: any) => {
      return {
        promptResult:
          commitCount === 2
            ? [args[0].choices[0].value, args[0].choices[1].value]
            : args[0].choices[1].value,
      };
    }) as any)
    .mockImplementationOnce((async (args: any) => {
      return { promptResult: args[0].choices[0].name };
    }) as any);

  return {
    getAxiosCalls: () => {
      const [
        getDefaultRepoBranchAndPerformStartupChecks,
        getAuthorRequestConfig,
        getCommitsRequestConfig,
      ] = axiosPostSpy.mock.calls.map((call) => call[1]);

      const [createPullRequestPayload] = axiosRequestSpy.mock.calls.map(
        (call) => call[0].data
      );

      return {
        getDefaultRepoBranchAndPerformStartupChecks,
        getAuthorRequestConfig,
        getCommitsRequestConfig,
        createPullRequestPayload,
      };
    },
  };
}
