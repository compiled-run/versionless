import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, relative, resolve } from 'pathe';
import { sha256 } from '../../../core/src/index.ts';

const executeFile = promisify(execFile);
const EXPECTED = {
	version: '0.8.0',
	commit: '83b86de431db306170cd8bb85317a88070512f9d',
	packageSha256: 'd166f03192c6d022568e56ef02031db740141a29ed9a435b9a4a2c921f6a7be4',
	declarationSha256: '4e249b3c60178168dd876fac5c3ae5cfc537b4f492e6574f2c4b7f76a2eb0360',
	runtimeSha256: 'd1fd099bf9de85f10518b5c94c3f6b2d3ad4c0b68c6b1449fd4bf9446dd1cea5',
} as const;

export type LinkedWitnessProvenance = {
	dependency: '@async/witness';
	linkTarget: '../witness';
	version: '0.8.0';
	commit: string;
	tracked: 'clean';
	index: 'clean';
	untracked: ['.async/', 'design/'];
	packageSha256: string;
	declarationSha256: string;
	runtimeSha256: string;
	localOnly: true;
	portableReleaseDependency: false;
};

async function git(witnessRoot: string, ...args: string[]): Promise<string> {
	return (await executeFile('git', ['-C', witnessRoot, ...args])).stdout.trim();
}

export async function verifyLinkedWitnessProvenance(
	root = resolve(import.meta.dirname, '../../../..'),
): Promise<LinkedWitnessProvenance> {
	const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
		devDependencies?: Record<string, string>;
	};
	if (packageJson.devDependencies?.['@async/witness'] !== 'link:../witness')
		throw new Error('linked Witness dependency must be exactly link:../witness');
	const resolvedPackage = await realpath(join(root, 'node_modules/@async/witness/package.json'));
	const witnessRoot = dirname(resolvedPackage);
	if (relative(root, witnessRoot) !== '../witness')
		throw new Error('linked Witness resolved target differs');
	const packageBytes = await readFile(resolvedPackage);
	const linkedPackage = JSON.parse(packageBytes.toString('utf8')) as { version?: string };
	const status = await git(witnessRoot, 'status', '--porcelain');
	const statusLines = status === '' ? [] : status.split('\n');
	const trackedDirty = statusLines.some((line) => !line.startsWith('?? '));
	const untracked = statusLines
		.filter((line) => line.startsWith('?? '))
		.map((line) => line.slice(3))
		.sort();
	const commit = await git(witnessRoot, 'rev-parse', 'HEAD');
	const declarationBytes = await readFile(join(witnessRoot, 'dist/index.d.mts'));
	const runtimeBytes = await readFile(join(witnessRoot, 'dist/index.mjs'));
	const packageSha256 = sha256(packageBytes);
	const declarationSha256 = sha256(declarationBytes);
	const runtimeSha256 = sha256(runtimeBytes);
	const indexDirty = (
		await executeFile('git', ['-C', witnessRoot, 'diff', '--cached', '--name-only'])
	).stdout.trim();
	if (
		linkedPackage.version !== EXPECTED.version ||
		commit !== EXPECTED.commit ||
		trackedDirty ||
		indexDirty !== '' ||
		untracked.join(',') !== '.async/,design/' ||
		packageSha256 !== EXPECTED.packageSha256 ||
		declarationSha256 !== EXPECTED.declarationSha256 ||
		runtimeSha256 !== EXPECTED.runtimeSha256
	)
		throw new Error('linked Witness audited identity or working-tree state drifted');
	return {
		dependency: '@async/witness',
		linkTarget: '../witness',
		version: '0.8.0',
		commit,
		tracked: 'clean',
		index: 'clean',
		untracked: ['.async/', 'design/'],
		packageSha256,
		declarationSha256,
		runtimeSha256,
		localOnly: true,
		portableReleaseDependency: false,
	};
}
