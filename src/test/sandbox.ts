import fs from 'fs/promises';
import { fileURLToPath } from 'node:url';
import path, { resolve } from 'path';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
export const SANDBOX_PATH = resolve(REPO_ROOT, '.integration_testing');

export function getSandboxPath({
  filename,
  specname,
}: {
  filename: string;
  specname?: string;
}) {
  // Support both file paths and import.meta.url
  const resolvedPath = filename.startsWith('file:')
    ? fileURLToPath(filename)
    : filename;
  const baseFilename = getFilenameWithoutExtension(resolvedPath);
  return resolve(
    `${SANDBOX_PATH}/${baseFilename}${specname ? `/${specname}` : ''}`,
  );
}

export async function resetSandbox(sandboxPath: string) {
  if (sandboxPath.length < 30) {
    throw new Error(`sandboxPath "${sandboxPath}" is too short. Reset aborted`);
  }

  await fs.rm(sandboxPath, { recursive: true, force: true });
  await fs.mkdir(sandboxPath, { recursive: true });
}

function getFilenameWithoutExtension(filename: string) {
  return path.basename(filename, path.extname(filename));
}
