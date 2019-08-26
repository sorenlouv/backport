export function getShortSha(sha: string) {
  return sha.slice(0, 8);
}

export function getFirstCommitMessageLine(message: string) {
  return message.split('\n')[0];
}
