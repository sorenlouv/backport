import apm from 'elastic-apm-node';
//@ts-expect-error
import { NoopTransport } from 'elastic-apm-node/lib/noop-transport';
import { accessTokenReplacer } from './logger';

const environment = process.env.NODE_ENV || 'production-cli';

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
  // remove access token
  .addFilter((payload) => {
    return JSON.parse(JSON.stringify(payload, accessTokenReplacer));
  });

export function disableApm() {
  // hack to disable APM telemetry after loaded config
  //@ts-expect-error
  apm._transport = new NoopTransport();
}
