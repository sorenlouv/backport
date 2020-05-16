import { BackportOptions } from '../options/options';
import { listCommitsPrompt } from '../prompts/listCommitsPrompt';
import { fetchCommitBySha } from '../services/github/v3/fetchCommitBySha';
import { fetchCommitByPullNumber } from '../services/github/v4/fetchCommitByPullNumber';
import { fetchCommitsByAuthor } from '../services/github/v4/fetchCommitsByAuthor';
import { fetchPullRequestBySearchQuery } from '../services/github/v4/fetchPullRequestBySearchQuery';

export async function getCommits(options: BackportOptions) {
  if (options.sha) {
    return [await fetchCommitBySha({ ...options, sha: options.sha })]; // must extract sha to satisfy the ts gods
  }

  if (options.pullNumber) {
    return [
      await fetchCommitByPullNumber({
        ...options,
        pullNumber: options.pullNumber, // must extract pullNumber to satisfy the ts gods
      }),
    ];
  }

  if (options.sourcePRsFilter) {
    const commitChoices = await fetchPullRequestBySearchQuery(options);

    return listCommitsPrompt({
      commitChoices,
      isMultipleChoice: options.multipleCommits,
    });
  }

  const commitChoices = await fetchCommitsByAuthor(options);
  return listCommitsPrompt({
    commitChoices,
    isMultipleChoice: options.multipleCommits,
  });
}
