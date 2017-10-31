const promisify = require('es6-promisify');
const path = require('path');
const fs = require('fs');
const mkdirp = promisify(require('mkdirp'));
const stripJsonComments = require('strip-json-comments');
const constants = require('./constants');
const env = require('./env');
const utils = require('./utils');

function ensureConfigAndFoldersExists() {
  const REPOSITORIES_DIR_PATH = env.getRepositoriesDirPath();
  const CONFIG_FILE_PATH = env.getConfigFilePath();

  return mkdirp(REPOSITORIES_DIR_PATH)
    .then(getConfigTemplate)
    .then(configTemplate => {
      return utils
        .writeFile(CONFIG_FILE_PATH, configTemplate, {
          flag: 'wx', // create and write file. Error if it already exists
          mode: 0o600 // give the owner read-write privleges, no access for others
        })
        .catch(e => {
          const FILE_ALREADY_EXISTS = 'EEXIST';
          if (e.code !== FILE_ALREADY_EXISTS) {
            throw e;
          }
        });
    });
}

function getRepoConfig(owner, repoName, repositories) {
  return repositories.find(repo => repo.name === `${owner}/${repoName}`);
}

function getConfigTemplate() {
  return utils.readFile(path.join(__dirname, 'configTemplate.json'), 'utf8');
}

function validateConfig({ username, accessToken, repositories }) {
  if (!username || !accessToken || !repositories || repositories.length === 0) {
    const e = new Error(constants.INVALID_CONFIG);
    if (!username && !accessToken) {
      e.details = 'username_and_access_token';
    } else if (!username) {
      e.details = 'username';
    } else if (!accessToken) {
      e.details = 'access_token';
    } else if (!repositories || repositories.length === 0) {
      e.details = 'repositories';
    }
    throw e;
  }
}

function getConfig() {
  try {
    const CONFIG_FILE_PATH = env.getConfigFilePath();
    const stat = fs.statSync(CONFIG_FILE_PATH);
    const hasGroupRead = stat.mode & fs.constants.S_IRGRP;
    const hasOthersRead = stat.mode & fs.constants.S_IROTH;
    if (hasGroupRead || hasOthersRead) {
      const error = new Error(
        `Config file at ${CONFIG_FILE_PATH} needs to have more restrictive permissions. Run the ` +
          'following to limit access to the file to just your user account:\n' +
          '\n' +
          `  chmod 600 "${CONFIG_FILE_PATH}"\n`
      );
      error.code = constants.CONFIG_FILE_PERMISSION_ERROR;
      throw error;
    }
    const res = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    return JSON.parse(stripJsonComments(res));
  } catch (e) {
    if (e.code === 'ENOENT') {
      return {};
    }

    throw e;
  }
}

module.exports = {
  ensureConfigAndFoldersExists,
  getConfig,
  getRepoConfig,
  validateConfig
};
