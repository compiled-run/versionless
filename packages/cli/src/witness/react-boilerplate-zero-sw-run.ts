import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import {
	canonicalize,
	parseReactBoilerplateZeroSwReceipt,
	parseWitnessReactBoilerplateZeroSwReceipt,
	REACT_BOILERPLATE_ZERO_SW_FIXTURE,
	REACT_BOILERPLATE_ZERO_SW_RUN_ID,
	REACT_BOILERPLATE_ZERO_SW_SUPERSEDES,
	receiptDigest,
	renderReactBoilerplateZeroSwReceipt,
	renderWitnessReactBoilerplateZeroSwReceipt,
	sha256,
	WITNESS_REACT_BOILERPLATE_ZERO_SW_SCHEMA,
	witnessReactBoilerplateZeroSwBehaviorDigest,
	witnessReactBoilerplateZeroSwAggregateMember,
	witnessReactBoilerplateZeroSwDigest,
	witnessReactBoilerplateZeroSwRawDigest,
	type ReactBoilerplateZeroSwReceipt,
	type WitnessReactBoilerplateZeroSwReceipt,
	type WitnessReactBoilerplateZeroSwRun,
} from '../../../core/src/index.ts';
import { executeReactBoilerplateZeroSwWitnessRun } from './real-app-run.ts';
import {
	assertLinkedWitnessProvenanceEquivalent,
	verifyLinkedWitnessProvenance,
} from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/react-boilerplate-v4-zero-sw');
const witnessEvidence = join(root, 'evidence/runs/witness-react-boilerplate-zero-sw');
const stageRoot = join(root, '.versionless/stage/witness-react-boilerplate-zero-sw');
const aggregatePath = join(root, 'evidence/runs/aggregate.json');
const profilePath = join(fixtureEvidence, 'build-profile.json');
const fixtureReceiptPath = join(fixtureEvidence, 't693-run.json');
const sourceOutputs = {
	baseline: join(root, '.versionless/work/react-boilerplate-v4-zero-sw/baseline/build'),
	migrated: join(root, '.versionless/work/react-boilerplate-v4-zero-sw/target/build-vite'),
} as const;
const zeroObservation = {
	outputFiles: [],
	registrations: 0,
	controller: null,
	requests: [],
	workerEvents: [],
	cacheStorageNames: [],
} as const;
const source = {
	repository: 'https://github.com/react-boilerplate/react-boilerplate',
	revision: 'd19099afeff64ecfb09133c06c1cb18c0d40887e',
	archiveSha256: 'd6ca60a3c8881ae2be26a8d04e00da4d922a6653f8512f2b12ac55d48f2ce2d5',
	license: 'MIT',
	licenseSha256: 'e773e6b91c13f55310668e15ce178a2fcf779ff39dbcc0b910b4b5f1ecb17acb',
} as const;

async function exists(path: string): Promise<boolean> {
	return access(path).then(
		() => true,
		() => false,
	);
}

async function files(directory: string): Promise<string[]> {
	const output: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) output.push(...(await files(path)));
		else if (entry.isFile()) output.push(path);
	}
	return output.sort();
}

async function protectedHashes(): Promise<void> {
	for (const binding of Object.values(REACT_BOILERPLATE_ZERO_SW_SUPERSEDES))
		if (sha256(await readFile(join(root, binding.path))) !== binding.sha256)
			throw new Error(`Protected evidence silently rebound: ${binding.path}`);
}

async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(sourceOutputs[lane])))
			throw new Error(`React Boilerplate zero-SW ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessReactBoilerplateZeroSwRun[]> {
	const runs: WitnessReactBoilerplateZeroSwRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeReactBoilerplateZeroSwWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessReactBoilerplateZeroSwRun;
			if (run.semanticDigest !== witnessReactBoilerplateZeroSwRawDigest(run))
				throw new Error(
					`React Boilerplate zero-SW ${lane} pass ${pass} raw digest differs`,
				);
			runs.push({ ...run, behaviorDigest: witnessReactBoilerplateZeroSwBehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('React Boilerplate zero-SW baseline/target behavior parity differs');
	return runs;
}

async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessReactBoilerplateZeroSwReceipt['mutations']['semantic']> {
	const expected = Buffer.from('Beginnen Sie Ihr nächstes React Projekt in Sekunden');
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset >= 0) {
			if (bytes.lastIndexOf(expected) !== offset)
				throw new Error('German heading semantic seam is not unique within its file');
			candidates.push({ path, offset });
		}
	}
	if (candidates.length !== 1)
		throw new Error('German heading semantic seam is not unique across target output');
	const target = candidates[0]!;
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeReactBoilerplateZeroSwWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'semantic-mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(
				'Beginnen Sie Ihr nächstes React Projekt in Sekunden',
			);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('German heading mutation was not exact red and byte-restored');
	const restoredRaw = await executeReactBoilerplateZeroSwWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'semantic-restoration-receipt'),
	});
	const restored = restoredRaw as WitnessReactBoilerplateZeroSwRun;
	if (witnessReactBoilerplateZeroSwBehaviorDigest(restored) !== behaviorDigest)
		throw new Error('German heading restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		path: relative(laneRoot, target.path),
		beforeSha256,
		mutatedSha256,
		afterRestoreSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
	};
}

async function serviceWorkerMutation(): Promise<
	WitnessReactBoilerplateZeroSwReceipt['mutations']['serviceWorker']
> {
	const laneRoot = join(root, '.versionless/stage/react-boilerplate-v4-zero-sw/mutation-output');
	if (!(await exists(join(laneRoot, 'sw.js'))))
		throw new Error('Service-worker mutation output is absent');
	let intendedFailure = false;
	try {
		await executeReactBoilerplateZeroSwWitnessRun({
			lane: 'baseline',
			pass: 1,
			laneRoot,
			receiptRoot: join(stageRoot, 'service-worker-mutation-receipt'),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		intendedFailure = message.includes('zero-service-worker policy assertion failed');
	}
	if (!intendedFailure)
		throw new Error('Service-worker mutation did not make the runtime zero-SW guard red');
	return {
		failure: 'zero-service-worker-policy-assertion',
		intendedFailure: true,
		observedOutputFiles: ['sw.js'],
		observedRegistrationOrWorker: true,
	};
}

async function writeFixtureReceipt(
	runs: WitnessReactBoilerplateZeroSwRun[],
	mutations: WitnessReactBoilerplateZeroSwReceipt['mutations'],
): Promise<ReactBoilerplateZeroSwReceipt> {
	const artifactsRoot = join(fixtureEvidence, 'artifacts');
	const journeyPath = join(artifactsRoot, 'witness-journeys.json');
	const mutationPath = join(artifactsRoot, 'witness-mutations.json');
	await writeFile(journeyPath, `${canonicalize(runs)}\n`, { flag: 'wx' });
	await writeFile(mutationPath, `${canonicalize(mutations)}\n`, { flag: 'wx' });
	const buildPath = join(artifactsRoot, 'build.json');
	const receipt = {
		schemaVersion: 'versionless.receipt.v1' as const,
		runId: REACT_BOILERPLATE_ZERO_SW_RUN_ID,
		fixture: REACT_BOILERPLATE_ZERO_SW_FIXTURE,
		source,
		tooling: {
			legacyNode: '16.20.2',
			targetNode: '24.15.0',
			legacyBundler: 'webpack-4.30.0',
			targetBundler: 'Vite-8.0.16',
			witness: 'direct-linked-local-0.8.0',
		},
		consent: [
			{
				id: 'T693-local-reconciliation',
				purpose: 'reuse already-ingested immutable fixture and local dependencies',
				mode: 'consented' as const,
			},
		],
		migration: {
			file: 'app/app.js + internals/webpack/webpack.prod.babel.js',
			transform: 'react-boilerplate-zero-service-worker-profile',
			edits: 3,
			dependency: {
				name: 'offline-plugin',
				from: 'executed-and-registered',
				to: 'retained-unused-unshipped',
				license: 'MIT',
			},
			lockPatch: 'none; dependency closure retained',
		},
		verification: {
			result: 'pass' as const,
			builds: 'pass' as const,
			journeys: 'pass' as const,
			mutation: 'pass' as const,
			locality: {
				mode: 'offline' as const,
				scope: 'Versionless-spawned build processes and Playwright browser requests',
				osWideIsolation: false as const,
				successfulNonLoopback: 0 as const,
				browserBlockedRequests: 0,
			},
			deterministicCore: {
				first: runs[0]!.behaviorDigest,
				second: runs[3]!.behaviorDigest,
				equal: true as const,
			},
		},
		artifacts: [buildPath, journeyPath, mutationPath].map((path) => ({
			path: relative(root, path),
			sha256: '',
		})),
		integrity: {
			algorithm: 'sha256' as const,
			canonicalDigest: '',
			authenticity: 'not-established' as const,
		},
		limitations: [
			'This reconciles one already-counted React lineage and does not advance official or aligned readiness before Judge audit.',
			'The zero-service-worker profile supersedes T060 only for current policy; original offline-first evidence remains valid and retained.',
			'Locality is process-scoped and does not establish OS-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		supersedes: {
			scope: 'current-zero-service-worker-policy-only' as const,
			t060: REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.t060,
			witness: REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness,
			originalOfflineFirstEvidenceRetained: true as const,
			historicalZeroSwParityClaimed: false as const,
		},
		policyProfile: {
			removals: [
				'offline-plugin-runtime-registration',
				'offline-plugin-webpack-execution',
			] as const,
			dependencyClosure: 'retained-unused-unshipped' as const,
			baselineBuilds: 2 as const,
			targetBuilds: 2 as const,
			zeroServiceWorker: zeroObservation,
		},
	} satisfies ReactBoilerplateZeroSwReceipt;
	for (const artifact of receipt.artifacts)
		artifact.sha256 = sha256(await readFile(join(root, artifact.path)));
	receipt.integrity.canonicalDigest = receiptDigest(receipt);
	parseReactBoilerplateZeroSwReceipt(receipt);
	await writeFile(fixtureReceiptPath, `${canonicalize(receipt)}\n`, { flag: 'wx' });
	await writeFile(
		join(fixtureEvidence, 't693-run.md'),
		renderReactBoilerplateZeroSwReceipt(receipt),
		{ flag: 'wx' },
	);
	return receipt;
}

async function appendAggregate(
	receipt: WitnessReactBoilerplateZeroSwReceipt,
	canonicalReceipt: ReactBoilerplateZeroSwReceipt,
): Promise<void> {
	const aggregate = JSON.parse(await readFile(aggregatePath, 'utf8')) as {
		fixtures?: Array<Record<string, unknown>>;
	};
	if (!Array.isArray(aggregate.fixtures)) throw new Error('Corpus aggregate fixtures are absent');
	const migrationMember = {
		id: 'react-boilerplate-v4-zero-sw',
		framework: 'react',
		track: 'current-zero-service-worker-policy-reconciliation',
		bundler: 'webpack-4.30.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		receipt: 'evidence/runs/react-boilerplate-v4-zero-sw/t693-run.json',
		digest: canonicalReceipt.integrity.canonicalDigest,
	};
	const member = witnessReactBoilerplateZeroSwAggregateMember(receipt.integrity.canonicalDigest);
	const migrationIndex = aggregate.fixtures.findIndex((item) => item.id === migrationMember.id);
	if (migrationIndex >= 0) aggregate.fixtures[migrationIndex] = migrationMember;
	else aggregate.fixtures.push(migrationMember);
	const index = aggregate.fixtures.findIndex((item) => item.id === member.id);
	if (index >= 0) aggregate.fixtures[index] = member;
	else aggregate.fixtures.push(member);
	await writeFile(aggregatePath, `${JSON.stringify(aggregate, null, 2)}\n`);
}

export async function runWitnessReactBoilerplateZeroSw(): Promise<WitnessReactBoilerplateZeroSwReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('React Boilerplate zero-SW Witness requires dual offline controls');
	if (await exists(witnessEvidence))
		throw new Error('React Boilerplate zero-SW Witness output collision');
	await protectedHashes();
	const provenance = await verifyLinkedWitnessProvenance(root);
	const profile = JSON.parse(await readFile(profilePath, 'utf8')) as { result?: string };
	if (profile.result !== 'build-profile-complete-not-promoted')
		throw new Error('React Boilerplate zero-SW build profile is absent or differs');
	const lanes = await stageInputs();
	const runs = await executeRuns(lanes);
	const mutations = {
		semantic: await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest),
		serviceWorker: await serviceWorkerMutation(),
	};
	const canonicalReceipt = await writeFixtureReceipt(runs, mutations);
	const canonicalBytes = await readFile(fixtureReceiptPath);
	const receipt: WitnessReactBoilerplateZeroSwReceipt = {
		schemaVersion: WITNESS_REACT_BOILERPLATE_ZERO_SW_SCHEMA,
		result: 'pass',
		fixture: REACT_BOILERPLATE_ZERO_SW_FIXTURE,
		source,
		provenance,
		canonicalReceipt: {
			path: relative(root, fixtureReceiptPath),
			canonicalDigest: canonicalReceipt.integrity.canonicalDigest,
			sha256: sha256(canonicalBytes),
		},
		supersedes: {
			...REACT_BOILERPLATE_ZERO_SW_SUPERSEDES.witness,
			scope: 'current-zero-service-worker-policy-only',
			originalOfflineFirstEvidenceRetained: true,
		},
		runs,
		mutations,
		zeroServiceWorker: zeroObservation,
		readiness: {
			reactLineage: { ready: 1, total: 4, counted: true },
			alignedReact: { ready: 0, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'This is one already-counted React lineage and does not establish generic React support or advance readiness before Judge audit.',
			'T060 original offline-first behavior remains valid; this receipt supersedes it only for current zero-service-worker policy.',
			'Drag remains not-tested because the application has no genuine drag surface.',
			'Locality is process-scoped and does not establish OS-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactBoilerplateZeroSwDigest(receipt);
	parseWitnessReactBoilerplateZeroSwReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessReactBoilerplateZeroSwReceipt(receipt),
		{ flag: 'wx' },
	);
	await appendAggregate(receipt, canonicalReceipt);
	await protectedHashes();
	return receipt;
}

export async function verifyWitnessReactBoilerplateZeroSw(
	output = witnessEvidence,
): Promise<WitnessReactBoilerplateZeroSwReceipt> {
	await protectedHashes();
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessReactBoilerplateZeroSwReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	assertLinkedWitnessProvenanceEquivalent(receipt.provenance, expectedProvenance, "React Boilerplate zero-SW");
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('React Boilerplate zero-SW canonical receipt bytes drifted');
	parseReactBoilerplateZeroSwReceipt(JSON.parse(canonicalBytes.toString('utf8')));
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessReactBoilerplateZeroSwReceipt(receipt)
	)
		throw new Error('React Boilerplate zero-SW human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('React Boilerplate zero-SW receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence)
			throw new Error('React Boilerplate zero-SW publish path differs');
		const receipt = await runWitnessReactBoilerplateZeroSw();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessReactBoilerplateZeroSw(
			resolve(root, args[verifyIndex + 1]!),
		);
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'React Boilerplate zero-SW Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (basename(process.argv[1] ?? '') === 'react-boilerplate-zero-sw-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
