#!/usr/bin/env node
import 'ts-polyfill/lib/es2019-array';

import { runWithArgs } from './runWithArgs';
const args = process.argv.slice(2);

runWithArgs(args);
