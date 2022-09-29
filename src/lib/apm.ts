import apm from 'elastic-apm-node';
import { accessTokenReplacer } from './logger';

const environment = process.env.NODE_ENV || 'production';

apm
  .start({
    serviceName: 'backport',
    secretToken: 'GZui3tX4jFYjszDweu',
    serverUrl:
      'https://f27ab01db9584e008c443b7137d16425.apm.europe-west2.gcp.elastic-cloud.com:443',
    logLevel: 'off',
    captureBody: 'all',
    errorOnAbortedRequests: false,
    logUncaughtExceptions: false,
    environment,
  })
  .addFilter((payload) => {
    return JSON.parse(JSON.stringify(payload, accessTokenReplacer));
  });
