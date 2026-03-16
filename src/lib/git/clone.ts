import { BackportError } from '../backport-error.js';
import { spawnStream } from '../child-process-promisified.js';
import { logger } from '../logger.js';

export async function cloneRepo(
  { sourcePath, targetPath }: { sourcePath: string; targetPath: string },
  onProgress: (progress: number) => void,
) {
  logger.info(`Cloning repo from ${sourcePath} to ${targetPath}`);

  return new Promise<void>((resolve, reject) => {
    const subprocess = spawnStream('git', [
      'clone',
      sourcePath,
      targetPath,
      '--progress',
    ]);

    const progress = {
      fileUpdate: 0,
      objectReceive: 0,
    };

    subprocess.on('error', (err) => reject(err));

    subprocess.stderr.on('data', (data: string) => {
      logger.verbose(data.toString());
      const [, objectReceiveProgress] =
        data.toString().match(/^Receiving objects:\s+(\d+)%/) ?? [];

      if (objectReceiveProgress) {
        progress.objectReceive = Number.parseInt(objectReceiveProgress, 10);
      }

      const [, fileUpdateProgress] =
        data.toString().match(/^Updating files:\s+(\d+)%/) ?? [];

      if (fileUpdateProgress) {
        progress.objectReceive = 100;
        progress.fileUpdate = Number.parseInt(fileUpdateProgress, 10);
      }

      const progressSum = Math.round(
        progress.fileUpdate * 0.1 + progress.objectReceive * 0.9,
      );

      if (progressSum > 0) {
        onProgress(progressSum);
      }
    });

    subprocess.on('close', (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(
          new BackportError({
            code: 'clone-exception',
            message: `Git clone failed with exit code: ${code}`,
          }),
        );
      }
    });
  });
}
