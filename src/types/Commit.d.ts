export interface BackportCommit {
  sourceBranch: string;
  targetBranchesFromLabels: string[];
  sha: string;
  formattedMessage: string;
  originalMessage: string;
  pullNumber?: number;
  existingTargetPullRequests: {
    branch: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
  }[];
}
