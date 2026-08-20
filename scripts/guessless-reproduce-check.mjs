#!/usr/bin/env node
// Offline-only guessless receipt verification for versionless.
// Delegates to the guessless workspace's reproduce-check, which re-runs each
// *.receipt.json's sibling *.reproduction.json through the guessless CLI and
// exits non-zero on any non-reproduction. No network is used at any point:
// the CLI reads sources from the reproduction envelope, never from disk or
// the registry, consistent with VERSIONLESS_NETWORK_MODE=offline phases.
// Usage: node scripts/guessless-reproduce-check.mjs [--help] <dir-or-files...>
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args.includes('--help') || args.length === 0) {
	console.log(
		'usage: node scripts/guessless-reproduce-check.mjs <dir-or-files...>\nVerifies guessless *.receipt.json files offline via the guessless reproduce-check.',
	);
	process.exit(0);
}
const result = spawnSync(
	'node',
	['/Users/jacksm5pro/dev/open-source/guessless/scripts/reproduce-check.mjs', ...args],
	{ stdio: 'inherit' },
);
process.exit(result.status ?? 1);
