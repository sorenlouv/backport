const github = require('../lib/github');
const {
  promptCommits,
  getCommitBySha,
  promptVersions,
  doBackportVersions,
  handleErrors,
  maybeSetupRepo,
  parseUpstream
} = require('./cliService');

function initSteps(options) {
  const { owner, repoName } = parseUpstream(options.upstream);
  let commits, versions;
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
    .then(c => (commits = c))
    .then(() => promptVersions(options.versions, options.multipleVersions))
    .then(v => (versions = v))
    .then(() => maybeSetupRepo(owner, repoName, options.username))
    .then(() =>
      doBackportVersions({
        owner,
        repoName,
        commits,
        versions,
        username: options.username,
        labels: options.labels
      })
    )
    .catch(handleErrors);
}

module.exports = initSteps;
