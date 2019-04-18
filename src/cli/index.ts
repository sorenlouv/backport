#!/usr/bin/env node

import { initSteps } from './steps';
import { printHandledError } from '../lib/HandledError';
import { getOptions } from '../lib/options/options';

async function init() {
  try {
    const options = await getOptions(process.argv);
    return initSteps(options);
  } catch (e) {
    printHandledError(e, { rethrow: false });
    process.exit(1);
  }
}

init();
