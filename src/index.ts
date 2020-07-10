#!/usr/bin/env node
import { runWithArgs } from './runWithArgs';
const args = process.argv.slice(2);

// this is the entrypoint when running from command line
runWithArgs(args);
