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
    throw new BackportError(
      `"${filepath}" contains invalid JSON:\n\n${fileContents}`,
    );
  }
}
// ensure backwards compatability when config options are renamed
export function parseConfigFile(fileContents: string): ConfigFileOptions {
  const configWithoutComments = stripJsonComments(fileContents);
  const { upstream, labels, branches, addOriginalReviewers, ...config } =
    JSON.parse(configWithoutComments);

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
