const github = require('../lib/github');
const {
  promptCommits,
  getCommitBySha,
  promptBranches,
  doBackportVersions,
  handleErrors,
  maybeSetupRepo
} = require('./cliService');

function initSteps(options) {
  const [owner, repoName] = options.upstream.split('/');

  let commits, branches;
  github.setAccessToken(options.accessToken);

  const promise = options.sha
    ? getCommitBySha({ owner, repoName, sha: options.sha })
    : promptCommits({
        owner,
        repoName,
        author: options.own ? options.username : null,
        multipleCommits: options.multipleCommits
      });

  return promise
    .then(c => {
      commits = c;
    })
    .then(() => promptBranches(options.branches, options.multipleBranches))
    .then(v => {
      branches = v;
    })
    .then(() => maybeSetupRepo(owner, repoName, options.username))
    .then(() =>
      doBackportVersions({
        owner,
        repoName,
        commits,
        branches,
        username: options.username,
        labels: options.labels
      })
    )
    .catch(handleErrors);
}

module.exports = initSteps;
