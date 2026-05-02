/** Barrel export for GitHub GraphQL (v4) API operations. */

// Client
export { graphqlRequest } from './client/graphql-client.js';
export type {
  GitHubGraphQLError,
  OperationResultWithMeta,
} from './client/graphql-client.js';

// Commit fetching
export { fetchCommitsByPullNumber } from './fetchCommits/fetch-commit-by-pull-number.js';
export { fetchCommitBySha } from './fetchCommits/fetch-commit-by-sha.js';
export { fetchCommitsByAuthor } from './fetchCommits/fetch-commits-by-author.js';
export { fetchCommitsForRebaseAndMergeStrategy } from './fetchCommits/fetch-commits-for-rebase-and-merge-strategy.js';
export { fetchPullRequestsBySearchQuery } from './fetchCommits/fetch-pull-requests-by-search-query.js';

// PR operations
export { fetchExistingPullRequest } from './fetch-existing-pull-request.js';
export { fetchPullRequestId } from './fetch-pull-request-id.js';
export { fetchPullRequestAutoMergeMethod } from './fetch-pull-request-auto-merge-method.js';
export { enablePullRequestAutoMerge } from './enable-pull-request-auto-merge.js';
export { disablePullRequestAutoMerge } from './disable-pull-request-auto-merge.js';

// Auth & config
export { fetchAuthorId } from './fetch-author-id.js';
export { getInvalidGithubTokenMessage } from './get-invalid-github-token-message.js';
export { getRepoOwnerAndNameFromGitRemotes } from './get-repo-owner-and-name-from-git-remotes.js';
export { getOptionsFromGithub } from './getOptionsFromGithub/get-options-from-github.js';
export type { OptionsFromGithub } from './getOptionsFromGithub/get-options-from-github.js';

// Validation
export { validateTargetBranch } from './validate-target-branch.js';
export type { TargetBranchResponse } from './validate-target-branch.js';
