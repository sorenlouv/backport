const path = require('path');
const fs = require('fs');
const isEmpty = require('lodash.isempty');
const stripJsonComments = require('strip-json-comments');
const findUp = require('find-up');
const constants = require('./constants');
const env = require('./env');
const rpc = require('./rpc');
const prompts = require('./prompts');

function maybeCreateConfigAndFolder() {
  const REPOS_PATH = env.getReposPath();
  return rpc.mkdirp(REPOS_PATH).then(maybeCreateConfig);
}

function maybeCreateConfig() {
  const GLOBAL_CONFIG_PATH = env.getGlobalConfigPath();

  return getConfigTemplate().then(configTemplate => {
    return rpc
      .writeFile(GLOBAL_CONFIG_PATH, configTemplate, {
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

function getConfigTemplate() {
  return rpc.readFile(path.join(__dirname, 'configTemplate.json'), 'utf8');
}

class InvalidConfigError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, InvalidConfigError);
    this.code = constants.INVALID_CONFIG;
  }
}

function validateGlobalConfig({ username, accessToken }) {
  const GLOBAL_CONFIG_PATH = env.getGlobalConfigPath();

  if (!username && !accessToken) {
    throw new InvalidConfigError(
      `Please add your Github username, and Github access token to the config: ${
        GLOBAL_CONFIG_PATH
      }`
    );
  }

  if (!username) {
    throw new InvalidConfigError(
      `Please add your Github username to the config: ${GLOBAL_CONFIG_PATH}`
    );
  }

  if (!accessToken) {
    throw new InvalidConfigError(
      `Please add your Github access token to the config: ${GLOBAL_CONFIG_PATH}`
    );
  }

  const isConfigValid = hasRestrictedPermissions(GLOBAL_CONFIG_PATH);
  if (!isConfigValid) {
    throw new InvalidConfigError(
      `Config file at ${
        GLOBAL_CONFIG_PATH
      } needs to have more restrictive permissions. Run the following to limit access to the file to just your user account:
        chmod 600 "${GLOBAL_CONFIG_PATH}"\n`
    );
  }
}

function hasRestrictedPermissions(GLOBAL_CONFIG_PATH) {
  const stat = rpc.statSync(GLOBAL_CONFIG_PATH);
  const hasGroupRead = stat.mode & fs.constants.S_IRGRP; // eslint-disable-line no-bitwise
  const hasOthersRead = stat.mode & fs.constants.S_IROTH; // eslint-disable-line no-bitwise
  return !hasGroupRead && !hasOthersRead;
}

function getGlobalConfig() {
  const GLOBAL_CONFIG_PATH = env.getGlobalConfigPath();
  return maybeCreateConfigAndFolder()
    .then(() => rpc.readFile(GLOBAL_CONFIG_PATH, 'utf8'))
    .then(fileContents => {
      const globalConfig = JSON.parse(stripJsonComments(fileContents));
      validateGlobalConfig(globalConfig);
      return globalConfig;
    });
}

function getProjectConfig() {
  return findUp('.backportrc.json')
    .then(filepath => {
      if (!filepath) {
        return null;
      }
      return rpc.readFile(filepath, 'utf8');
    })
    .then(fileContents => JSON.parse(stripJsonComments(fileContents)));
}

function getCombinedConfig() {
  return Promise.all([getProjectConfig(), getGlobalConfig()]).then(
    ([projectConfig, globalConfig]) => {
      if (!projectConfig) {
        if (isEmpty(globalConfig.projects)) {
          throw new InvalidConfigError('.backportrc.json was not found');
        }

        return prompts
          .listProjects(globalConfig.projects.map(project => project.upstream))
          .then(upstream =>
            mergeConfigs(projectConfig, globalConfig, upstream)
          );
      }
      return mergeConfigs(projectConfig, globalConfig, projectConfig.upstream);
    }
  );
}

function mergeConfigs(projectConfig, globalConfig, upstream) {
  const globalProjectConfig =
    globalConfig.projects &&
    globalConfig.projects.find(project => project.upstream === upstream);

  return Object.assign(
    {},
    projectConfig,
    {
      accessToken: globalConfig.accessToken,
      username: globalConfig.username
    },
    globalProjectConfig
  );
}

module.exports = {
  maybeCreateConfig,
  getCombinedConfig,
  mergeConfigs
};
