import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'pathe';

type RecoveryStatus = 'tracked-modified' | 'untracked';
type RecoveryEntry = readonly [RecoveryStatus, string, string, string];

interface RecoveryManifest {
	base: string;
	entries: RecoveryEntry[];
	recoveryCommit: string;
	recoveryRef: string;
	version: number;
}

function readArgument(name: string): string {
	const position = process.argv.indexOf(name);
	const value = process.argv[position + 1];
	if (position < 0 || value === undefined || value.startsWith('--')) {
		throw new Error(`Missing required argument ${name}`);
	}
	return value;
}

function readStatusPaths(root: string): Set<string> {
	const output = execFileSync(
		'git',
		['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all'],
		{ encoding: 'utf8' },
	);
	const paths = new Set<string>();
	let offset = 0;
	while (offset < output.length) {
		const end = output.indexOf('\0', offset);
		if (end < 0) {
			throw new Error('Git returned an unterminated porcelain status record');
		}
		paths.add(output.slice(offset + 3, end));
		offset = end + 1;
	}
	return paths;
}

function statusForPath(root: string, relativePath: string): RecoveryStatus {
	const output = execFileSync(
		'git',
		['-C', root, 'status', '--porcelain=v1', '--untracked-files=all', '--', relativePath],
		{ encoding: 'utf8' },
	);
	return output.startsWith('??') ? 'untracked' : 'tracked-modified';
}

const root = resolve(readArgument('--root'));
const expectedBase = readArgument('--base');
const manifestPath = resolve(readArgument('--manifest'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RecoveryManifest;

if (manifest.version !== 1 || manifest.base !== expectedBase) {
	throw new Error('Recovery manifest version or base does not match the request');
}

const actualBase = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
	encoding: 'utf8',
}).trim();
if (actualBase !== expectedBase) {
	throw new Error('Recovery worktree is not detached at the declared base');
}

const remainingPaths = readStatusPaths(root);
for (const [expectedStatus, expectedMode, expectedDigest, relativePath] of manifest.entries) {
	if (!remainingPaths.delete(relativePath)) {
		throw new Error(`Missing restored path: ${relativePath}`);
	}
	const absolutePath = resolve(root, relativePath);
	const bytes = readFileSync(absolutePath);
	const digest = createHash('sha256').update(bytes).digest('hex');
	if (digest !== expectedDigest) {
		throw new Error(`Restored digest mismatch: ${relativePath}`);
	}
	const mode = statSync(absolutePath).mode & 0o111 ? '100755' : '100644';
	if (mode !== expectedMode) {
		throw new Error(`Restored mode mismatch: ${relativePath}`);
	}
	if (statusForPath(root, relativePath) !== expectedStatus) {
		throw new Error(`Restored status mismatch: ${relativePath}`);
	}
}

if (remainingPaths.size > 0) {
	throw new Error(`Unexpected restored paths: ${[...remainingPaths].join(', ')}`);
}

process.stdout.write(
	`${JSON.stringify({ entries: manifest.entries.length, recoveryCommit: manifest.recoveryCommit, verified: true })}\n`,
);
