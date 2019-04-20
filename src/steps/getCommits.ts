import { BackportOptions } from '../options/options';
import { fetchCommit, fetchCommits } from '../services/github';
import { listCommits } from '../services/prompts';
import isEmpty from 'lodash.isempty';
import ora = require('ora');

export async function getCommits(options: BackportOptions) {
  const [owner, repoName] = options.upstream.split('/');
  const author = options.all ? null : options.username;
  return options.sha
    ? [await getCommitBySha(owner, repoName, options.sha)]
    : await getCommitsByPrompt(
        owner,
        repoName,
        author,
        options.multipleCommits
      );
}

export async function getCommitBySha(
  owner: string,
  repoName: string,
  sha: string
) {
  const spinner = ora(`Loading commit "${sha}"`).start();
  try {
    const commit = await fetchCommit(owner, repoName, sha);
    spinner.text = `Loaded commit "${commit.message}" from "${sha}"`;
    spinner.succeed();
    return commit;
  } catch (e) {
    spinner.stop();
    throw e;
  }
}

async function getCommitsByPrompt(
  owner: string,
  repoName: string,
  author: string | null,
  multipleCommits: boolean
) {
  const spinner = ora('Loading commits...').start();
  try {
    const commits = await fetchCommits(owner, repoName, author);
    if (isEmpty(commits)) {
      const warningText = author
        ? 'There are no commits by you in this repository'
        : 'There are no commits in this repository';

      spinner.fail(warningText);
      process.exit(1);
    }
    spinner.stop();
    return listCommits(commits, multipleCommits);
  } catch (e) {
    spinner.fail();
    throw e;
  }
}
