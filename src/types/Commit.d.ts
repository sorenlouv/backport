// Commit object selected from list or via commit sha
export interface CommitSelected {
  sourceBranch: string;
  targetBranchesFromLabels: string[];
  sha: string;
  formattedMessage: string;
  originalMessage: string;
  pullNumber?: number;
  existingTargetPullRequests?: {
    branch: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
  }[];
}
