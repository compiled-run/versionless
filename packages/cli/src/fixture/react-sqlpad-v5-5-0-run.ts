import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	planSqlpadTargetPackage,
	transformSqlpadBootstrap,
} from '../../../frameworks/react/src/react-sqlpad-v5-5-0-migration.ts';
import {
	verifySqlpadClosure,
	type SqlpadClosureArtifact,
	type SqlpadClosureReceipt,
} from './react-sqlpad-v5-5-0-ingest.ts';

const root = resolve(import.meta.dirname, '../../../..');
const sourceRoot = join(root, '.versionless/cache/react-sqlpad-v5-5-0-source/verify/extracted');
const closureRoot = join(root, '.versionless/cache/react-sqlpad-v5-5-0-closure');
const workRoot = join(root, '.versionless/work/react-sqlpad-v5-5-0');
const outputRoot = join(root, 'evidence/runs/react-sqlpad-v5-5-0');
const node16 = join(root, '.versionless/cache/react-boilerplate-v4/node16/bin/node');
const node24 = join(root, '.versionless/cache/react-boilerplate-v4-node24/node24/bin/node');
const vite = join(root, 'node_modules/vite/bin/vite.js');
const viteConfig = join(root, 'packages/cli/src/fixture/react-sqlpad-v5-5-0-vite.config.ts');
const indexGitSha = '59bf7bc40ea2a6b7d9e7fd90c540553c1465b113';
const packageGitSha = '3d46427647de6870e48096fee7efde3511770620';

type BuildEvidence = {
	schemaVersion: 'versionless.react-sqlpad-v5-5-0-builds.v1';
	closureDigest: string;
	scriptsExecuted: false;
	lanes: Array<{
		name: 'baseline-1' | 'baseline-2' | 'target-1' | 'target-2';
		node: '16.20.2' | '24.15.0';
		bundler: 'react-scripts-3.4.1-webpack-4.42.0' | 'vite-8.0.16';
		outputDigest: string;
		files: number;
	}>;
	parity: { baselineDeterministic: true; targetDeterministic: true };
	serviceWorkerOutputFiles: { baseline: number; target: number };
	integrity: { canonicalDigest: string };
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;
const exists = (path: string): Promise<boolean> =>
	access(path).then(
		() => true,
		() => false,
	);

async function execute(
	command: string,
	args: readonly string[],
	cwd = root,
	env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
	return await new Promise((resolvePromise, reject) => {
		const child = spawn(command, [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolvePromise(Buffer.concat(stdout).toString('utf8'))
				: reject(
						new Error(
							`${basename(command)} exited ${code ?? -1}: ${Buffer.concat(stderr).toString('utf8')}`,
						),
					),
		);
	});
}

export function sqlpadPlacementPath(lane: string, scopedPlacement: string): string {
	const separator = scopedPlacement.indexOf(':');
	if (separator < 1) throw new Error('SQLPad closure placement scope differs');
	const scope = scopedPlacement.slice(0, separator);
	const placement = scopedPlacement.slice(separator + 1);
	if (!['root', 'client', 'server'].includes(scope))
		throw new Error('SQLPad closure placement scope differs');
	const segments = placement.split('>');
	if (
		segments.length === 0 ||
		segments.some(
			(segment) =>
				!segment ||
				segment === '.' ||
				segment === '..' ||
				segment.startsWith('/') ||
				segment.includes('\\'),
		)
	)
		throw new Error('SQLPad closure placement path differs');
	let destination = join(lane, scope);
	for (const segment of segments) destination = join(destination, 'node_modules', segment);
	if (relative(lane, destination).startsWith('..'))
		throw new Error('SQLPad placement escapes lane');
	return destination;
}

async function extractPackage(tarball: string, destination: string): Promise<void> {
	await mkdir(destination, { recursive: true });
	await execute('/usr/bin/tar', ['-xzf', tarball, '-C', destination, '--strip-components', '1']);
}

function targetClientArtifactAllowed(artifact: SqlpadClosureArtifact): boolean {
	if (
		artifact.name === 'react-scripts' ||
		artifact.name === 'webpack' ||
		artifact.name.startsWith('webpack-') ||
		artifact.name.startsWith('workbox-')
	)
		return false;
	return true;
}

async function materializeLane(
	name: 'baseline-template' | 'target-template',
	receipt: SqlpadClosureReceipt,
	target: boolean,
): Promise<string> {
	const lane = join(workRoot, name);
	await cp(sourceRoot, lane, { recursive: true, force: false });
	for (const artifact of receipt.artifacts) {
		const tarball = join(closureRoot, 'mirror', artifact.mirror);
		if (sha256(await readFile(tarball)) !== artifact.sha256)
			throw new Error('SQLPad materialization tarball differs');
		for (const placement of artifact.placements) {
			if (!placement.startsWith('client:') && !placement.startsWith('server:')) continue;
			if (placement.startsWith('server:') && ['sqlite3', 'odbc'].includes(artifact.name))
				continue;
			if (target && placement.startsWith('client:') && !targetClientArtifactAllowed(artifact))
				continue;
			await extractPackage(tarball, sqlpadPlacementPath(lane, placement));
		}
	}
	if (target) {
		for (const artifact of receipt.targetArtifacts) {
			const destination = sqlpadPlacementPath(lane, `client:${artifact.name}`);
			await rm(destination, { recursive: true, force: true });
			await extractPackage(join(closureRoot, 'mirror', artifact.mirror), destination);
		}
		const indexPath = join(lane, 'client/src/index.js');
		const transformed = transformSqlpadBootstrap({
			sourceBytes: await readFile(indexPath),
			expectedGitSha: indexGitSha,
		});
		await writeFile(indexPath, transformed.code);
		const packagePath = join(lane, 'client/package.json');
		const targetPackage = planSqlpadTargetPackage({
			packageBytes: await readFile(packagePath),
			expectedGitSha: packageGitSha,
		});
		await writeFile(packagePath, targetPackage.packageJson);
	}
	return lane;
}

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const absolute = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await filesBelow(absolute)));
		else if (entry.isFile()) result.push(absolute);
		else if (!entry.isSymbolicLink()) throw new Error('SQLPad build contains a special entry');
	}
	return result.sort(compareText);
}

async function treeDigest(
	directory: string,
): Promise<{ digest: string; files: number; paths: string[] }> {
	const files = await filesBelow(directory);
	const rows = await Promise.all(
		files.map(async (file) => ({
			path: relative(directory, file),
			sha256: sha256(await readFile(file)),
		})),
	);
	return {
		digest: sha256(canonicalize(rows)),
		files: files.length,
		paths: rows.map((row) => row.path),
	};
}

async function buildBaseline(lane: string): Promise<ReturnType<typeof treeDigest>> {
	const client = join(lane, 'client');
	await execute(node16, [join(client, 'node_modules/react-scripts/scripts/build.js')], client, {
		...process.env,
		CI: 'true',
		NODE_ENV: 'production',
		GENERATE_SOURCEMAP: 'false',
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
	});
	return treeDigest(join(client, 'build'));
}

async function buildTarget(lane: string): Promise<ReturnType<typeof treeDigest>> {
	const client = join(lane, 'client');
	await execute(node24, [vite, 'build', '--config', viteConfig], client, {
		...process.env,
		NODE_ENV: 'production',
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		VERSIONLESS_SQLPAD_CLIENT_ROOT: client,
	});
	return treeDigest(join(client, 'dist'));
}

function serviceWorkerFiles(paths: string[]): number {
	return paths.filter((path) => {
		const lower = path.toLowerCase();
		return (
			lower.includes('service-worker') ||
			lower.includes('serviceworker') ||
			lower.includes('workbox') ||
			lower.includes('precache')
		);
	}).length;
}

export async function buildSqlpadLanes(): Promise<BuildEvidence> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('SQLPad build requires strict offline controls');
	if (await exists(workRoot)) throw new Error('SQLPad work root already exists');
	const verified = await verifySqlpadClosure();
	const receipt = JSON.parse(
		await readFile(join(closureRoot, 'closure.json'), 'utf8'),
	) as SqlpadClosureReceipt;
	await mkdir(workRoot, { recursive: true });
	const baselineTemplate = await materializeLane('baseline-template', receipt, false);
	const targetTemplate = await materializeLane('target-template', receipt, true);
	const lanes = {
		baseline1: join(workRoot, 'baseline-1'),
		baseline2: join(workRoot, 'baseline-2'),
		target1: join(workRoot, 'target-1'),
		target2: join(workRoot, 'target-2'),
	};
	await cp(baselineTemplate, lanes.baseline1, { recursive: true, force: false });
	await cp(baselineTemplate, lanes.baseline2, { recursive: true, force: false });
	await cp(targetTemplate, lanes.target1, { recursive: true, force: false });
	await cp(targetTemplate, lanes.target2, { recursive: true, force: false });
	const [baseline1, baseline2, target1, target2] = await Promise.all([
		buildBaseline(lanes.baseline1),
		buildBaseline(lanes.baseline2),
		buildTarget(lanes.target1),
		buildTarget(lanes.target2),
	]);
	if (baseline1.digest !== baseline2.digest) throw new Error('SQLPad baseline builds differ');
	if (target1.digest !== target2.digest) throw new Error('SQLPad target builds differ');
	const baselineSw = serviceWorkerFiles(baseline1.paths);
	const targetSw = serviceWorkerFiles(target1.paths);
	if (baselineSw !== 0 || targetSw !== 0)
		throw new Error('SQLPad build emitted service-worker output');
	const unsigned = {
		schemaVersion: 'versionless.react-sqlpad-v5-5-0-builds.v1' as const,
		closureDigest: verified.digest,
		scriptsExecuted: false as const,
		lanes: [
			{
				name: 'baseline-1' as const,
				node: '16.20.2' as const,
				bundler: 'react-scripts-3.4.1-webpack-4.42.0' as const,
				outputDigest: baseline1.digest,
				files: baseline1.files,
			},
			{
				name: 'baseline-2' as const,
				node: '16.20.2' as const,
				bundler: 'react-scripts-3.4.1-webpack-4.42.0' as const,
				outputDigest: baseline2.digest,
				files: baseline2.files,
			},
			{
				name: 'target-1' as const,
				node: '24.15.0' as const,
				bundler: 'vite-8.0.16' as const,
				outputDigest: target1.digest,
				files: target1.files,
			},
			{
				name: 'target-2' as const,
				node: '24.15.0' as const,
				bundler: 'vite-8.0.16' as const,
				outputDigest: target2.digest,
				files: target2.files,
			},
		],
		parity: { baselineDeterministic: true as const, targetDeterministic: true as const },
		serviceWorkerOutputFiles: { baseline: baselineSw, target: targetSw },
	};
	const evidence: BuildEvidence = {
		...unsigned,
		integrity: { canonicalDigest: sha256(canonicalize(unsigned)) },
	};
	await mkdir(outputRoot, { recursive: true });
	await writeFile(join(outputRoot, 'builds.json'), `${canonicalize(evidence)}\n`);
	return evidence;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length !== 1 || args[0] !== '--build')
		throw new Error('SQLPad runner arguments differ');
	process.stdout.write(`${canonicalize(await buildSqlpadLanes())}\n`);
}

if (basename(process.argv[1] ?? '') === 'react-sqlpad-v5-5-0-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
