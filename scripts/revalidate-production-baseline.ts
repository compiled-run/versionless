import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../packages/core/src/receipts/canonicalize.ts';
import { verifyMigration } from '../packages/cli/src/fixture/angular-realworld-v15-to-v16-run.ts';
import { runReactBoilerplateZeroSw } from '../packages/cli/src/fixture/react-boilerplate-v4-zero-sw-run.ts';
import {
	runWitnessAngularRealworld,
	verifyWitnessAngularRealworld,
} from '../packages/cli/src/witness/angular-realworld-run.ts';
import {
	runWitnessReactBoilerplateZeroSw,
	verifyWitnessReactBoilerplateZeroSw,
} from '../packages/cli/src/witness/react-boilerplate-zero-sw-run.ts';
import { generateTrustPackage } from '../packages/trust/src/generate.ts';
import { verifyTrustPackage } from '../packages/trust/src/verify.ts';

const root = resolve(import.meta.dirname, '..');
const recoveryStage = join(root, '.versionless/stage/recovery-t003-production-baseline');
const aggregatePath = join(root, 'evidence/runs/aggregate.json');
const currentTrust = join(root, 'evidence/trust/current');
const reactEvidence = join(root, 'evidence/runs/react-boilerplate-v4-zero-sw');
const reactWitness = join(root, 'evidence/runs/witness-react-boilerplate-zero-sw');
const angularWitness = join(root, 'evidence/runs/witness-angular-realworld');

interface WitnessRun {
	assertions: string[];
	lane: 'baseline' | 'migrated';
	pass: 1 | 2;
	result: 'pass';
	successfulNonLoopback: number;
}

function requireFlag(name: string): void {
	if (!process.argv.includes(name)) throw new Error(`Missing required flag ${name}`);
}

function valueAfter(name: string): string {
	const index = process.argv.indexOf(name);
	const value = process.argv[index + 1];
	if (index < 0 || value === undefined || value.startsWith('--')) {
		throw new Error(`Missing required value for ${name}`);
	}
	return value;
}

async function filesBelow(directory: string): Promise<string[]> {
	const result: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = join(directory, entry.name);
		if (entry.isDirectory()) result.push(...(await filesBelow(item)));
		else if (entry.isFile()) result.push(item);
		else throw new Error('Production output contains a special filesystem entry');
	}
	return result.sort();
}

async function treeDigest(directory: string): Promise<string> {
	const rows = await Promise.all(
		(await filesBelow(directory)).map(
			async (file) => `${relative(directory, file)}\0${sha256(await readFile(file))}`,
		),
	);
	return sha256(rows.join('\n'));
}

async function findProductionRoot(directory: string): Promise<string> {
	const indexes = (await filesBelow(directory)).filter((file) => file.endsWith('/index.html'));
	if (indexes.length !== 1) throw new Error('Angular production build index inventory differs');
	return resolve(indexes[0]!, '..');
}

async function execute(
	command: string,
	args: string[],
	cwd: string,
	environment: NodeJS.ProcessEnv,
) {
	await new Promise<void>((accept, reject) => {
		const child = spawn(command, args, { cwd, env: environment, stdio: 'inherit' });
		child.once('error', reject);
		child.once('exit', (code) => {
			if (code === 0) accept();
			else reject(new Error(`Production build exited ${code ?? -1}`));
		});
	});
}

async function rebuildAngularLane(
	lane: 'legacy' | 'target',
	expectedDigest: string,
): Promise<string> {
	const work = join(root, '.versionless/work/angular-realworld-v15-to-v16');
	const source = join(work, 'lanes', lane);
	const runtime = join(work, 'runtime/node-v18.20.8-darwin-arm64');
	const node = join(runtime, 'bin/node');
	const launcher = join(
		work,
		'launcher-dist',
		lane === 'legacy' ? 'legacy' : 'target-restored',
		'architect-launcher.cjs',
	);
	const environment = {
		...process.env,
		PATH: `${join(runtime, 'bin')}:${process.env.PATH ?? ''}`,
		NODE_PATH: join(source, 'node_modules'),
		VERSIONLESS_NETWORK_MODE: 'offline',
		NPM_CONFIG_OFFLINE: 'true',
		npm_config_offline: 'true',
	};
	const digests: string[] = [];
	let productionRoot = '';
	for (const _repetition of [1, 2]) {
		await execute(node, [launcher, source], source, environment);
		productionRoot = await findProductionRoot(join(source, 'dist'));
		digests.push(await treeDigest(productionRoot));
	}
	if (digests[0] !== expectedDigest || digests[1] !== expectedDigest) {
		throw new Error(`Angular ${lane} repeated production build digest differs`);
	}
	const retained = join(work, 'dist', lane);
	await rm(retained, { recursive: true, force: true });
	await cp(productionRoot, retained, { recursive: true, force: false });
	return expectedDigest;
}

function verifyWitnessRuns(value: unknown, minimumJourneys: number): WitnessRun[] {
	if (!Array.isArray(value) || value.length !== 4) {
		throw new Error('Witness replay must contain two repetitions for both lanes');
	}
	const runs = value as WitnessRun[];
	const expected = ['baseline:1', 'baseline:2', 'migrated:1', 'migrated:2'];
	if (
		canonicalize(runs.map((run) => `${run.lane}:${run.pass}`)) !== canonicalize(expected) ||
		runs.some(
			(run) =>
				run.result !== 'pass' ||
				run.successfulNonLoopback !== 0 ||
				run.assertions.length < minimumJourneys,
		)
	) {
		throw new Error('Witness repetitions, journeys, or locality do not satisfy the gate');
	}
	return runs;
}

function evidenceBindings(angular: boolean): ReadonlyArray<readonly [string, string]> {
	const react = [
		[reactEvidence, 'react-evidence'],
		[reactWitness, 'react-witness'],
	] as const;
	if (!angular) return react;
	return [...react, [angularWitness, 'angular-witness'], [currentTrust, 'trust']] as const;
}

async function backupEvidence(angular: boolean): Promise<void> {
	await rm(recoveryStage, { recursive: true, force: true });
	await mkdir(recoveryStage, { recursive: true });
	for (const [source, name] of evidenceBindings(angular)) {
		await cp(source, join(recoveryStage, name), { recursive: true, force: false });
	}
	await cp(aggregatePath, join(recoveryStage, 'aggregate.json'), { force: false });
}

async function restoreEvidence(angular: boolean): Promise<void> {
	for (const [target, name] of evidenceBindings(angular)) {
		await rm(target, { recursive: true, force: true });
		await cp(join(recoveryStage, name), target, { recursive: true, force: false });
	}
	await cp(join(recoveryStage, 'aggregate.json'), aggregatePath, { force: true });
}

async function directoryDigest(directory: string): Promise<string> {
	const rows = await Promise.all(
		(await filesBelow(directory)).map(async (file) => ({
			path: relative(directory, file),
			sha256: createHash('sha256')
				.update(await readFile(file))
				.digest('hex'),
		})),
	);
	return sha256(canonicalize(rows));
}

async function main(): Promise<void> {
	for (const flag of ['--offline', '--mutation-red', '--restore-bytes', '--independent-verify']) {
		requireFlag(flag);
	}
	const angular = process.argv.includes('--angular');
	if (
		valueAfter('--react') !== 'react-boilerplate-v4-zero-sw' ||
		(angular && valueAfter('--angular') !== 'angular-realworld-v15-to-v16') ||
		valueAfter('--build-repetitions') !== '2' ||
		valueAfter('--witness-repetitions') !== '2' ||
		valueAfter('--minimum-journeys') !== '3'
	) {
		throw new Error('Production baseline revalidation scope or gate differs');
	}
	if (process.env.npm_config_offline !== 'true' && process.env.NPM_CONFIG_OFFLINE !== 'true') {
		throw new Error('Production baseline revalidation requires package-manager offline mode');
	}
	process.env.VERSIONLESS_NETWORK_MODE = 'offline';
	process.env.NPM_CONFIG_OFFLINE = 'true';
	process.env.npm_config_offline = 'true';

	await backupEvidence(angular);
	try {
		await rm(join(root, '.versionless/work/react-boilerplate-v4-zero-sw'), {
			recursive: true,
			force: true,
		});
		await rm(join(root, '.versionless/stage/react-boilerplate-v4-zero-sw'), {
			recursive: true,
			force: true,
		});
		await rm(join(root, '.versionless/stage/witness-react-boilerplate-zero-sw'), {
			recursive: true,
			force: true,
		});
		await rm(reactEvidence, { recursive: true, force: true });
		await rm(reactWitness, { recursive: true, force: true });
		await runReactBoilerplateZeroSw();
		const react = await runWitnessReactBoilerplateZeroSw();
		await verifyWitnessReactBoilerplateZeroSw();
		verifyWitnessRuns(react.runs, 3);

		const scope: Record<string, unknown> = {
			result: 'pass',
			reactDigest: react.integrity.canonicalDigest,
			reactReadiness: react.readiness,
		};

		if (angular) {
			const angularCanonical = verifyMigration(
				JSON.parse(
					await readFile(
						join(root, 'evidence/runs/angular-realworld-v15-to-v16/receipt.json'),
						'utf8',
					),
				),
			);
			scope.angularBuilds = {
				legacy: await rebuildAngularLane('legacy', angularCanonical.legacy.distDigest),
				target: await rebuildAngularLane('target', angularCanonical.target.distDigest),
			};
			await rm(join(root, '.versionless/stage/witness-angular-realworld'), {
				recursive: true,
				force: true,
			});
			await rm(angularWitness, { recursive: true, force: true });
			const angularWitnessReceipt = await runWitnessAngularRealworld(angularWitness);
			await verifyWitnessAngularRealworld(angularWitness);
			verifyWitnessRuns(angularWitnessReceipt.runs, 3);
			scope.angularDigest = angularWitnessReceipt.integrity.canonicalDigest;
			scope.angularReadiness = angularWitnessReceipt.readiness;

			const observedAt = (
				JSON.parse(await readFile(join(currentTrust, 'manifest.json'), 'utf8')) as {
					observation: { generatedAt: string };
				}
			).observation.generatedAt;
			const firstTrust = join(recoveryStage, 'trust-first');
			const secondTrust = join(recoveryStage, 'trust-second');
			await generateTrustPackage({
				offline: true,
				policyPath: 'trust/policy.json',
				outputDir: firstTrust,
				observedAt,
				environment: process.env,
			});
			await generateTrustPackage({
				offline: true,
				policyPath: 'trust/policy.json',
				outputDir: secondTrust,
				observedAt,
				environment: process.env,
			});
			const firstDigest = await directoryDigest(firstTrust);
			const secondDigest = await directoryDigest(secondTrust);
			if (firstDigest !== secondDigest) {
				throw new Error('Independent trust regeneration differs by bytes or digest');
			}
			await rm(currentTrust, { recursive: true, force: true });
			await cp(firstTrust, currentTrust, { recursive: true, force: false });
			await verifyTrustPackage({
				outputDir: currentTrust,
				compareDir: secondTrust,
				environment: process.env,
				now: observedAt,
			});
			scope.trustDigest = firstDigest;
		}

		process.stdout.write(`${canonicalize(scope)}\n`);
	} catch (error) {
		await restoreEvidence(angular);
		throw error;
	}
}

await main();
