import { BackportError } from '../backport-error.js';
import { spawnStream } from '../child-process-promisified.js';
import { logger } from '../logger.js';

export async function cloneRepo(
  {
    sourcePath,
    targetPath,
    depth,
    filter,
  }: {
    sourcePath: string;
    targetPath: string;
    depth?: number;
    filter?: string;
  },
  onProgress: (progress: number) => void,
) {
  logger.info(`Cloning repo from ${sourcePath} to ${targetPath}`);

  return new Promise<void>((resolve, reject) => {
    const subprocess = spawnStream('git', [
      'clone',
      sourcePath,
      targetPath,
      '--progress',
      ...(depth ? ['--depth', `${depth}`] : []),
      ...(filter ? ['--filter', filter] : []),
    ]);

    const progress = {
      fileUpdate: 0,
      objectReceive: 0,
    };

    subprocess.on('error', (err) => reject(err));

    // No encoding is set on the stream, so chunks arrive as Buffers
    subprocess.stderr.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      logger.verbose(data);
      const [, objectReceiveProgress] =
        data.match(/^Receiving objects:\s+(\d+)%/) ?? [];

      if (objectReceiveProgress) {
        progress.objectReceive = Number(objectReceiveProgress);
      }

      const [, fileUpdateProgress] =
        data.match(/^Updating files:\s+(\d+)%/) ?? [];

      if (fileUpdateProgress) {
        progress.objectReceive = 100;
        progress.fileUpdate = Number(fileUpdateProgress);
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
