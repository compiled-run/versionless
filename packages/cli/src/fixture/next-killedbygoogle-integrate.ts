import { access, cp, mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	canonicalize,
	deriveCorpusTransactionState,
	nextKilledByGoogleAggregateMember,
	witnessAngularRealworldAggregateMember,
	witnessReactBoilerplateAggregateMember,
	witnessNextKilledByGoogleAggregateMember,
	verifyNextKilledByGoogleEvidence,
} from '../../../core/src/index.ts';
import { verifyTrustPackage } from '../../../trust/src/verify.ts';

const root = path.resolve(import.meta.dirname, '../../../..');
const historicalIds = [
	'react-boilerplate-v4',
	'angular-phonecat',
	'react-boilerplate-v4-node24',
	'angular-phonecat-route-resolve',
	'angular-phonecat-composed',
	'react-boilerplate-v4-vite8',
	'react-boilerplate-v4-composed',
	'react-boilerplate-v4-data-flow',
	'angular-phonecat-vite8',
	'angular-realworld-v15-to-v16',
] as const;

async function exists(file: string): Promise<boolean> {
	return access(file).then(
		() => true,
		() => false,
	);
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Killed by Google integration ${label} must be an object`);
	return value as Record<string, unknown>;
}

function assertAggregate(value: unknown, requireIntegrated: boolean): Record<string, unknown> {
	const aggregate = record(value, 'aggregate');
	if (
		aggregate.schemaVersion !== 'versionless.aggregate.v1' ||
		!Array.isArray(aggregate.fixtures) ||
		!Array.isArray(aggregate.unsupported) ||
		aggregate.unsupported.length !== 0
	)
		throw new Error('Killed by Google aggregate shape differs');
	const fixtures = aggregate.fixtures.map((value) => record(value, 'aggregate member'));
	try {
		if (deriveCorpusTransactionState(fixtures).kind === 'react-zero-sw-reconciliation')
			return aggregate;
	} catch {
		// Fall through to the legacy member-specific conflict diagnostics below.
	}
	for (const id of historicalIds)
		if (fixtures.filter((fixture) => fixture.id === id).length !== 1)
			throw new Error(`Killed by Google historical aggregate member differs: ${id}`);
	const additions = fixtures.filter(
		(fixture) => fixture.id === 'next-killedbygoogle-derived-state-to-memo',
	);
	const witnesses = fixtures.filter((fixture) => fixture.id === 'witness-angular-realworld');
	const reactWitnesses = fixtures.filter((fixture) => fixture.id === 'witness-react-boilerplate');
	const nextWitnesses = fixtures.filter(
		(fixture) => fixture.id === 'witness-next-killedbygoogle',
	);
	let exactWitness: Record<string, unknown> | null = null;
	if (witnesses.length === 1) {
		const digest = witnesses[0]?.digest;
		exactWitness = witnessAngularRealworldAggregateMember(
			typeof digest === 'string' ? digest : '',
		);
	}
	let exactReactWitness: Record<string, unknown> | null = null;
	if (reactWitnesses.length === 1) {
		const digest = reactWitnesses[0]?.digest;
		exactReactWitness = witnessReactBoilerplateAggregateMember(
			typeof digest === 'string' ? digest : '',
		);
	}
	let exactNextWitness: Record<string, unknown> | null = null;
	if (nextWitnesses.length === 1) {
		const digest = nextWitnesses[0]?.digest;
		exactNextWitness = witnessNextKilledByGoogleAggregateMember(
			typeof digest === 'string' ? digest : '',
		);
	}
	if (
		fixtures.length !==
			historicalIds.length +
				(requireIntegrated ? 1 : additions.length) +
				witnesses.length +
				reactWitnesses.length +
				nextWitnesses.length ||
		additions.length > 1 ||
		witnesses.length > 1 ||
		reactWitnesses.length > 1 ||
		nextWitnesses.length > 1 ||
		(requireIntegrated && additions.length !== 1) ||
		(witnesses.length === 1 && additions.length !== 1) ||
		(witnesses.length === 1 && canonicalize(witnesses[0]) !== canonicalize(exactWitness)) ||
		(reactWitnesses.length === 1 &&
			(witnesses.length !== 1 ||
				canonicalize(reactWitnesses[0]) !== canonicalize(exactReactWitness) ||
				(nextWitnesses.length === 0 &&
					deriveCorpusTransactionState(fixtures).kind !== 'react-candidate'))) ||
		(nextWitnesses.length === 1 &&
			(reactWitnesses.length !== 1 ||
				canonicalize(nextWitnesses[0]) !== canonicalize(exactNextWitness) ||
				deriveCorpusTransactionState(fixtures).kind !== 'next-candidate'))
	)
		throw new Error('Killed by Google aggregate membership differs');
	return aggregate;
}

export function integrateNextKilledByGoogleAggregate(value: unknown, digest: string) {
	const aggregate = assertAggregate(value, false);
	const expected = nextKilledByGoogleAggregateMember(digest);
	const fixtures = aggregate.fixtures as Array<Record<string, unknown>>;
	const existing = fixtures.find(
		(fixture) => fixture.id === 'next-killedbygoogle-derived-state-to-memo',
	);
	if (existing) {
		if (canonicalize(existing) !== canonicalize(expected))
			throw new Error('Killed by Google aggregate member conflicts');
		return aggregate;
	}
	const insertionIndex = fixtures.findIndex(
		(fixture) => fixture.id === 'react-boilerplate-v4-data-flow',
	);
	if (insertionIndex < 0)
		throw new Error('Killed by Google canonical insertion anchor is missing');
	const integrated = {
		...aggregate,
		fixtures: [
			...fixtures.slice(0, insertionIndex),
			expected,
			...fixtures.slice(insertionIndex),
		],
	};
	assertAggregate(integrated, true);
	return integrated;
}

export async function verifyNextKilledByGoogleInputs(
	rootDir = root,
	environment: NodeJS.ProcessEnv = process.env,
) {
	if (
		environment.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		environment.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Killed by Google integration requires dual offline controls');
	return await verifyNextKilledByGoogleEvidence(path.resolve(rootDir), false);
}

export async function verifyNextKilledByGoogleIntegrated(
	rootDir = root,
	environment: NodeJS.ProcessEnv = process.env,
) {
	if (
		environment.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		environment.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Killed by Google integrated verification requires dual offline controls');
	const resolvedRoot = path.resolve(rootDir);
	const verified = await verifyNextKilledByGoogleEvidence(resolvedRoot, true);
	assertAggregate(
		JSON.parse(await readFile(path.join(resolvedRoot, 'evidence/runs/aggregate.json'), 'utf8')),
		true,
	);
	return verified;
}

export async function publishNextKilledByGoogleAggregateTransaction(options: {
	target: string;
	stageRoot: string;
	integrated: Record<string, unknown>;
	verifyIntegrated: () => Promise<unknown>;
}) {
	const { target, stageRoot, integrated, verifyIntegrated } = options;
	const staged = path.join(stageRoot, 'aggregate.json');
	const previous = path.join(stageRoot, 'aggregate.previous.json');
	if (await exists(stageRoot))
		throw new Error('Killed by Google aggregate staging residue exists');
	await mkdir(stageRoot, { recursive: true });
	try {
		await writeFile(staged, `${JSON.stringify(integrated, null, 2)}\n`, { flag: 'wx' });
		assertAggregate(JSON.parse(await readFile(staged, 'utf8')), true);
		await rename(target, previous);
		await rename(staged, target);
		await verifyIntegrated();
		await rm(stageRoot, { recursive: true, force: true });
	} catch (error) {
		if (await exists(previous)) {
			await unlink(target).catch(() => undefined);
			await rename(previous, target);
		}
		await rm(stageRoot, { recursive: true, force: true });
		throw error;
	}
}

export async function publishNextKilledByGoogleAggregate(rootDir = root) {
	const verified = await verifyNextKilledByGoogleInputs(rootDir);
	const resolvedRoot = path.resolve(rootDir);
	const target = path.join(resolvedRoot, 'evidence/runs/aggregate.json');
	const aggregate = JSON.parse(await readFile(target, 'utf8')) as unknown;
	const integrated = integrateNextKilledByGoogleAggregate(aggregate, verified.digest);
	if (canonicalize(aggregate) === canonicalize(integrated)) {
		await verifyNextKilledByGoogleIntegrated(resolvedRoot);
		return;
	}
	const stageRoot = path.join(resolvedRoot, '.versionless/stage/next-killedbygoogle/aggregate');
	await publishNextKilledByGoogleAggregateTransaction({
		target,
		stageRoot,
		integrated,
		verifyIntegrated: async () => await verifyNextKilledByGoogleIntegrated(resolvedRoot),
	});
	assertAggregate(JSON.parse(await readFile(target, 'utf8')), true);
}

export async function publishNextKilledByGoogleTrust(
	source: string,
	rootDir = root,
	environment: NodeJS.ProcessEnv = process.env,
) {
	if (
		environment.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		environment.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Killed by Google trust publication requires dual offline controls');
	const resolvedRoot = path.resolve(rootDir);
	const resolvedSource = path.resolve(resolvedRoot, source);
	await verifyTrustPackage({
		rootDir: resolvedRoot,
		outputDir: resolvedSource,
		environment,
	});
	const staged = path.join(resolvedRoot, '.versionless/stage/next-killedbygoogle/trust-current');
	const target = path.join(resolvedRoot, 'evidence/trust/current');
	const previous = path.join(
		resolvedRoot,
		'.versionless/stage/next-killedbygoogle/trust-previous',
	);
	if ((await exists(staged)) || (await exists(previous)))
		throw new Error('Killed by Google trust staging residue exists');
	await mkdir(path.dirname(staged), { recursive: true });
	await cp(resolvedSource, staged, { recursive: true });
	await verifyTrustPackage({
		rootDir: resolvedRoot,
		outputDir: staged,
		compareDir: resolvedSource,
		environment,
	});
	await rename(target, previous);
	try {
		await rename(staged, target);
		await verifyTrustPackage({
			rootDir: resolvedRoot,
			outputDir: target,
			compareDir: resolvedSource,
			environment,
		});
		await rm(previous, { recursive: true, force: true });
		await rm(path.dirname(staged), { recursive: true, force: true });
	} catch (error) {
		await rm(target, { recursive: true, force: true });
		if (await exists(previous)) await rename(previous, target);
		throw error;
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (args.length === 1 && args[0] === '--verify-inputs') await verifyNextKilledByGoogleInputs();
	else if (args.length === 1 && args[0] === '--verify-integrated')
		await verifyNextKilledByGoogleIntegrated();
	else if (args.length === 1 && args[0] === '--publish-aggregate')
		await publishNextKilledByGoogleAggregate();
	else if (args[0] === '--publish-trust' && args[1] === '--source' && args.length === 3)
		await publishNextKilledByGoogleTrust(args[2]!);
	else throw new Error('Killed by Google integration mode differs');
	process.stdout.write(`${JSON.stringify({ result: 'pass', mode: args[0] })}\n`);
}

if (process.argv[1]?.endsWith('next-killedbygoogle-integrate.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
