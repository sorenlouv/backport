import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';

/**
 * Gets the actual yarn binary path, bypassing asdf shims.
 *
 * When tests override HOME, `yarn` resolves to the asdf shim which fails because
 * it can't find `asdf` in PATH. This function uses `asdf which yarn` to get the
 * actual binary path (e.g., `~/.asdf/installs/yarn/1.22.22/bin/yarn`) instead of
 * the shim wrapper.
 *
 * @returns The path to the yarn binary if managed by asdf, or 'yarn' to use from PATH
 */
export function getYarnCommand(): string {
  try {
    const asdfPath = findAsdfExecutable();

    if (asdfPath) {
      // Use asdf to resolve the actual yarn binary path (bypasses the shim)
      const asdfYarnPath = execFileSync(asdfPath, ['which', 'yarn'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (asdfYarnPath && fs.existsSync(asdfYarnPath)) {
        return asdfYarnPath;
      }
    }
  } catch {
    // asdf not available or yarn not managed by asdf, use 'yarn' from PATH
  }
  return 'yarn';
}

/**
 * Finds the asdf executable binary, resolving symlinks.
 *
 * Uses `which asdf` to locate it in PATH, then resolves symlinks (e.g., Homebrew
 * installs symlink in /opt pointing to /Cellar).
 *
 * @returns The resolved path to the asdf binary, or undefined if not found
 */
function findAsdfExecutable(): string | undefined {
  try {
    // Find asdf using 'which' command (works on Unix-like systems)
    // On Windows, use 'where' instead
    const whichCommand = os.platform() === 'win32' ? 'where' : 'which';
    const asdfPath = execFileSync(whichCommand, ['asdf'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (!asdfPath) {
      return undefined;
    }

    // Resolve symlinks to get the actual binary location
    // This handles cases where asdf is installed via Homebrew (symlinked to Cellar)
    return fs.realpathSync(asdfPath);
  } catch {
    // asdf not found in PATH
    return undefined;
  }
}
