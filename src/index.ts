#!/usr/bin/env node

import { getOptions } from './options/options';
import { initSteps } from './steps/steps';

async function init() {
  try {
    const options = await getOptions(process.argv);
    return await initSteps(options);
  } catch (e) {
    if (e.name === 'HandledError') {
      console.error(e.message);
    } else {
      console.error(e);
    }

    process.exit(1);
  }
}

init();
