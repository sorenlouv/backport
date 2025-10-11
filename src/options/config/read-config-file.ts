import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { BackportError } from '../../lib/backport-error';
import { logger } from '../../lib/logger';
import { excludeUndefined } from '../../utils/exclude-undefined';
import type { ConfigFileOptions } from '../config-options';

export async function readConfigFile(
  filepath: string,
): Promise<ConfigFileOptions> {
  const fileContents = await readFile(filepath, 'utf8');

  try {
    return parseConfigFile(fileContents);
  } catch (e) {
    logger.debug(e);

    // If it's already a BackportError (e.g., from undefined env var), re-throw it as-is
    if (e instanceof BackportError) {
      throw e;
    }

    throw new BackportError(
      `"${filepath}" contains invalid JSON:\n\n${fileContents}`,
    );
  }
}
/**
 * Substitutes environment variables in the config file contents.
 * Supports the syntax ${VARIABLE_NAME}
 * @param contents - The config file contents
 * @returns The contents with environment variables substituted
 * @throws {BackportError} When an environment variable is not defined or is empty
 */
function substituteEnvironmentVariables(contents: string): string {
  return contents.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const trimmedVarName = varName.trim();
    const value = process.env[trimmedVarName];

    if (value === undefined) {
      throw new BackportError(
        `Environment variable "${trimmedVarName}" is not defined.\n\n` +
          `Please set the environment variable or use a literal value in your config file.`,
      );
    }

    if (value === '') {
      throw new BackportError(
        `Environment variable "${trimmedVarName}" is empty.\n\n` +
          `Please set a valid value for the environment variable or use a literal value in your config file.`,
      );
    }

    return value;
  });
}

// ensure backwards compatability when config options are renamed
export function parseConfigFile(fileContents: string): ConfigFileOptions {
  const configWithoutComments = stripJsonComments(fileContents);
  const configWithEnvVars = substituteEnvironmentVariables(
    configWithoutComments,
  );
  const { upstream, labels, branches, addOriginalReviewers, ...config } =
    JSON.parse(configWithEnvVars);

  const { repoName, repoOwner } = parseUpstream(upstream, config);

  return excludeUndefined({
    ...config,

    // `branches` was renamed `targetBranchChoices`
    targetBranchChoices: config.targetBranchChoices ?? branches,

    // `upstream` has been renamed to `repoOwner`/`repoName`
    repoName,
    repoOwner,

    // `addOriginalReviewers` has been renamed to `copySourcePRReviewers`
    copySourcePRReviewers: config.copySourcePRReviewers ?? addOriginalReviewers,

    // `labels` was renamed `targetPRLabels`
    targetPRLabels: config.targetPRLabels ?? labels,
  });
}

function parseUpstream(
  upstream: string | undefined,
  config: ConfigFileOptions,
) {
  if (upstream) {
    const [repoOwner, repoName] = upstream.split('/');
    return { repoOwner, repoName };
  }

  return {
    repoOwner: config.repoOwner,
    repoName: config.repoName,
  };
}
