import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { ANGULAR_CONTACTS_TECHNICAL_BOUNDARY } from '../../../core/src/receipts/angular-contacts-angular9-to16.ts';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const closureRoot = path.join(root, '.versionless/cache/angular-contacts-production/closures');
const work = path.join(root, '.versionless/work/angular-contacts/t603/t625-run');

export function angularContactsProductionRunPlan() {
	return {
		schemaVersion: 'versionless.angular-contacts-t625-run-plan.v1',
		baseline: {
			lane: 'angular9-node16-native-compat',
			node: '16.20.2',
			architecture: 'darwin-arm64',
			angular: '9.0.0',
			builder: 'webpack',
			aotBuilds: 2,
			compatibilityLabel: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY.compatibilityBaseline,
		},
		migration: {
			sequentialMajors: [9, 10, 11, 12, 13, 14, 15, 16],
			officialMigrationsRequired: true,
			aotAtEveryMajor: true,
			filesLimit: 64,
			spansLimit: 256,
		},
		target: {
			lane: 'angular16-node18',
			node: '18.20.8',
			architecture: 'darwin-arm64',
			angular: '16.2.12',
			cli: '16.2.16',
			builder: 'browser-esbuild',
			aotBuilds: 2,
		},
		journeys: {
			directWitnessModule: 'link:../witness',
			names: ['rest-visible-crud', 'two-client-socket-causality'],
			runsPerLane: 2,
			observations: 8,
		},
		mutation: {
			seam: 'contactsAdapter.removeOne(id, state)',
			expectedRed: 'immediate deletion/count only',
			byteRestoration: true,
		},
		locality: {
			loopbackOnly: true,
			serviceWorkers: 0,
			remoteAssets: 0,
			browserStateInjection: false,
		},
		boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
	};
}

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

export async function verifyAngularContactsRunPreconditions(
	environment: NodeJS.ProcessEnv = process.env,
): Promise<{
	closure: string;
	closureSha256: string;
	planSha256: string;
}> {
	if (
		environment.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		environment.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Angular Contacts run requires dual offline controls');
	const entries = (await readdir(closureRoot, { withFileTypes: true })).filter((entry) =>
		entry.isDirectory(),
	);
	if (entries.length !== 1)
		throw new Error('Angular Contacts requires exactly one accepted closure');
	const closure = path.join(closureRoot, entries[0]!.name);
	const bytes = await readFile(path.join(closure, 'closure.json'));
	const receipt = JSON.parse(bytes.toString('utf8')) as Record<string, any>;
	if (
		receipt.result !== 'accepted' ||
		receipt.baseline?.compatibilityLabel !==
			ANGULAR_CONTACTS_TECHNICAL_BOUNDARY.compatibilityBaseline ||
		receipt.lanes?.length !== 8 ||
		receipt.scriptsDisabled !== true ||
		receipt.strictPeerDependencies !== true
	)
		throw new Error('Angular Contacts accepted closure differs');
	return {
		closure,
		closureSha256: sha256(bytes),
		planSha256: sha256(canonicalize(angularContactsProductionRunPlan())),
	};
}

async function run(
	command: string,
	args: readonly string[],
	cwd: string,
	runtime: string,
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			env: {
				PATH: `${path.join(runtime, 'bin')}:${process.env.PATH ?? ''}`,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				npm_config_offline: 'true',
				npm_config_ignore_scripts: 'true',
			},
			stdio: ['ignore', 'ignore', 'pipe'],
		});
		const errors: Buffer[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
		child.once('error', reject);
		child.once('exit', (code) =>
			code === 0
				? resolve()
				: reject(
						new Error(
							`contacts-production-command-failed-${sha256(Buffer.concat(errors))}`,
						),
					),
		);
	});
}

async function treeDigest(directory: string): Promise<string> {
	const rows: string[] = [];
	const visit = async (current: string): Promise<void> => {
		for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) =>
			left.name.localeCompare(right.name),
		)) {
			const absolute = path.join(current, entry.name);
			if (entry.isDirectory()) await visit(absolute);
			else if (entry.isFile())
				rows.push(
					`${path.relative(directory, absolute)}\0${sha256(await readFile(absolute))}`,
				);
		}
	};
	await visit(directory);
	return sha256(rows.join('\n'));
}

export async function runAngularContactsBuildMatrix(): Promise<Readonly<Record<string, unknown>>> {
	const preflight = await verifyAngularContactsRunPreconditions();
	if (await exists(work)) throw new Error('Angular Contacts run work root already exists');
	await mkdir(work, { recursive: true });
	try {
		const node16 = path.join(preflight.closure, 'runtimes/node16');
		const node18Extract = path.join(work, 'node18-extract');
		await mkdir(node18Extract, { recursive: true });
		await run(
			'tar',
			[
				'-xzf',
				path.join(preflight.closure, 'runtimes/node18.tar.gz'),
				'--strip-components=1',
				'-C',
				node18Extract,
			],
			work,
			node16,
		);
		if (
			(await new Promise<string>((resolve, reject) => {
				const child = spawn(path.join(node18Extract, 'bin/node'), ['--version']);
				const output: Buffer[] = [];
				child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
				child.once('error', reject);
				child.once('exit', (code) =>
					code === 0
						? resolve(Buffer.concat(output).toString('utf8').trim())
						: reject(new Error('Angular Contacts Node18 runtime failed')),
				);
			})) !== 'v18.20.8'
		)
			throw new Error('Angular Contacts Node18 runtime identity differs');
		const builds: Array<Record<string, unknown>> = [];
		for (let major = 9; major <= 16; major += 1) {
			const directory = path.join(work, `angular${major}`);
			await cp(path.join(preflight.closure, `sources/angular${major}`), directory, {
				recursive: true,
			});
			await cp(
				path.join(preflight.closure, `lanes/angular${major}/package-lock.json`),
				path.join(directory, 'package-lock.json'),
			);
			const runtime = major < 15 ? node16 : node18Extract;
			await run(
				path.join(runtime, 'bin/npm'),
				[
					'ci',
					'--offline',
					'--ignore-scripts',
					'--no-audit',
					'--no-fund',
					'--strict-peer-deps',
					'--omit=optional',
					'--cache',
					path.join(preflight.closure, 'npm-cache'),
				],
				directory,
				runtime,
			);
			if (major > 9)
				await run(
					path.join(directory, 'node_modules/.bin/ng'),
					[
						'update',
						`@angular/core@${major}`,
						`@angular/cli@${major}`,
						'--migrate-only',
						'--from',
						`${major - 1}`,
						'--to',
						`${major}`,
						'--allow-dirty',
					],
					directory,
					runtime,
				);
			const digests: string[] = [];
			for (let build = 1; build <= 2; build += 1) {
				await rm(path.join(directory, 'dist'), { recursive: true, force: true });
				await run(
					path.join(directory, 'node_modules/.bin/ng'),
					['build', '--configuration=local', '--aot'],
					directory,
					runtime,
				);
				digests.push(await treeDigest(path.join(directory, 'dist/angular-contacts')));
			}
			if (digests[0] !== digests[1])
				throw new Error(`Angular Contacts Angular${major} build is nondeterministic`);
			builds.push({
				major,
				runtime: major < 15 ? '16.20.2' : '18.20.8',
				aot: true,
				builder: major === 16 ? 'browser-esbuild' : 'webpack',
				digest: digests[0],
			});
		}
		const result = {
			schemaVersion: 'versionless.angular-contacts-t625-build-matrix.v1',
			result: 'pass',
			closureSha256: preflight.closureSha256,
			builds,
			networkAttempts: 0,
			boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY,
		};
		await mkdir(path.join(root, 'evidence/runs/angular-contacts-angular16'), {
			recursive: true,
		});
		await writeFile(
			path.join(root, 'evidence/runs/angular-contacts-angular16/build-matrix.json'),
			`${canonicalize(result)}\n`,
			{ flag: 'wx' },
		);
		return result;
	} catch (error) {
		await mkdir(path.join(root, 'evidence/runs/angular-contacts-angular16'), {
			recursive: true,
		});
		await writeFile(
			path.join(root, 'evidence/runs/angular-contacts-angular16/terminal.json'),
			`${canonicalize({ schemaVersion: 'versionless.angular-contacts-t625-run-terminal.v1', result: 'excluded', code: error instanceof Error && error.message.startsWith('Angular Contacts') ? error.message : 'contacts-production-run-failed', retryAllowed: false, boundary: ANGULAR_CONTACTS_TECHNICAL_BOUNDARY })}\n`,
			{ flag: 'wx' },
		);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length === 1 && args[0] === '--verify-only')
		process.stdout.write(`${canonicalize(await verifyAngularContactsRunPreconditions())}\n`);
	else if (args.length === 0)
		process.stdout.write(`${canonicalize(await runAngularContactsBuildMatrix())}\n`);
	else throw new Error('Angular Contacts production run arguments differ');
}

if (process.argv[1]?.endsWith('angular-contacts-production-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
