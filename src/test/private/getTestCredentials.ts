import { promises as fs } from 'fs';

// get global config: either from .backport/config.json or via env variables
export async function getTestCredentials(): Promise<{
  username: string;
  accessToken: string;
}> {
  const username = process.env.username || 'sqren';
  const accessToken = process.env.accessToken;

  // get credentials from env vars
  if (username && accessToken) {
    return { username, accessToken };
  }

  // get credentials from config file
  const credentialsFile = './src/test/private/credentials.json';
  try {
    const config = await fs.readFile(credentialsFile, {
      encoding: 'utf-8',
    });

    return JSON.parse(config as string);
  } catch (e) {
    throw new Error(`Missing username or accessToken in "${credentialsFile}"`);
  }
}
