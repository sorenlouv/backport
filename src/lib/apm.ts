import apm from 'elastic-apm-node';

apm.start({
  serviceName: 'backport',
  secretToken: '',
  apiKey: '',
  serverUrl: '',
  logLevel: 'off',
});

export { apm };
