import axios, { AxiosResponse } from 'axios';
import { BackportOptions } from '../../../options/options';
import { logger } from '../../logger';
import { handleGithubV3Error } from './handleGithubV3Error';

interface GithubIssue {
  html_url: string;
  number: number;
}

export async function createPullRequest(
  {
    githubApiBaseUrlV3,
    repoName,
    repoOwner,
    accessToken,
    username,
  }: BackportOptions,
  payload: {
    title: string;
    body: string;
    head: string;
    base: string;
  }
) {
  logger.info(
    `Creating PR with title: "${payload.title}". ${payload.head} -> ${payload.base}`
  );

  try {
    const res: AxiosResponse<GithubIssue> = await axios.post(
      `${githubApiBaseUrlV3}/repos/${repoOwner}/${repoName}/pulls`,
      payload,
      {
        auth: {
          username: username,
          password: accessToken,
        },
      }
    );
    return {
      html_url: res.data.html_url,
      number: res.data.number,
    };
  } catch (e) {
    throw handleGithubV3Error(e);
  }
}
