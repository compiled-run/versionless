#!/usr/bin/env -S node --experimental-strip-types

import { spawnSync } from 'node:child_process';

const result = spawnSync(
	process.execPath,
	['--experimental-strip-types', ...process.argv.slice(2)],
	{ stdio: 'inherit' },
);

if (result.error !== undefined) {
	throw result.error;
}

process.exitCode = result.status ?? 1;
