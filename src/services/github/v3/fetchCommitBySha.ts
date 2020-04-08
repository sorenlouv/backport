import axios, { AxiosResponse } from 'axios';
import isEmpty from 'lodash.isempty';
import { BackportOptions } from '../../../options/options';
import { HandledError } from '../../HandledError';
import { CommitSelected } from '../Commit';
import { handleGithubV3Error } from './handleGithubV3Error';
import { getFormattedCommitMessage } from '../commitFormatters';

export interface GithubCommit {
  commit: {
    message: string;
  };
  sha: string;
}

interface GithubSearch<T> {
  items: T[];
}

export async function fetchCommitBySha(
  options: BackportOptions & { sha: string }
): Promise<CommitSelected> {
  const {
    githubApiBaseUrlV3,
    repoName,
    repoOwner,
    sha,
    accessToken,
    username,
  } = options;

  let res: AxiosResponse<GithubSearch<GithubCommit>>;
  try {
    res = await axios.get<GithubSearch<GithubCommit>>(
      `${githubApiBaseUrlV3}/search/commits?q=hash:${sha}%20repo:${repoOwner}/${repoName}&per_page=1`,
      {
        auth: {
          username: username,
          password: accessToken,
        },
        headers: {
          Accept: 'application/vnd.github.cloak-preview',
        },
      }
    );
  } catch (e) {
    throw handleGithubV3Error(e);
  }

  // TODO: it should be possible to backport from other branches than master
  if (isEmpty(res.data.items)) {
    throw new HandledError(`No commit found on master with sha "${sha}"`);
  }

  const commitRes = res.data.items[0];
  const fullSha = commitRes.sha;

  const formattedMessage = getFormattedCommitMessage({
    message: commitRes.commit.message,
    sha: fullSha,
  });

  return {
    branch: 'master',
    formattedMessage,
    sha: fullSha,
  };
}
