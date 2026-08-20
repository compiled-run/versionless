import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT,
	NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
	NEXT_KILLEDBYGOOGLE_V3_SOURCE,
	parseWitnessNextKilledbygoogleV3Receipt,
	renderWitnessNextKilledbygoogleV3Receipt,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCHEMA,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCRIPT_EXECUTION_DIFFERENCE,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_SERVICE_WORKER,
	witnessNextKilledbygoogleV3BehaviorDigest,
	witnessNextKilledbygoogleV3Digest,
	witnessNextKilledbygoogleV3RawDigest,
	type WitnessNextKilledbygoogleV3Mutation,
	type WitnessNextKilledbygoogleV3Receipt,
	type WitnessNextKilledbygoogleV3Run,
} from '../../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import { laneInventory } from '../fixture/next-killedbygoogle-v3-0-0-static-run.ts';
import { executeNextKilledbygoogleV3WitnessRun, KBG_MUTATION_SEAM } from './real-app-run.ts';
import {
	assertLinkedWitnessProvenanceEquivalent,
	verifyLinkedWitnessProvenance,
} from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/next-killedbygoogle-v3-0-0');
const witnessEvidence = join(root, 'evidence/runs/witness-next-killedbygoogle-v3-0-0');
const stageRoot = join(root, '.versionless/stage/witness-next-killedbygoogle-v3-0-0');

/**
 * The two lanes exactly as the build unit left them: the era lane's own export
 * directory, and the migrated lane's Vite output. Neither is rebuilt here, and
 * both are digest-checked against the published lane digests before a browser is
 * launched.
 */
const sourceOutputs = {
	baseline: join(root, '.versionless/cache/next-killedbygoogle-v3-0-0-baseline/app/out-run1'),
	migrated: join(root, '.versionless/work/next-killedbygoogle-v3-0-0/target/dist-vite-run1'),
} as const;

const laneDigests = {
	baseline: NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.eraLaneDigest,
	migrated: NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.targetLaneDigest,
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

/**
 * Stage both lanes, refusing either one whose contents are not the bytes the
 * build unit published. The digest is recomputed with the build unit's own
 * inventory function rather than re-implemented, so the two answers cannot drift
 * apart.
 */
async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(sourceOutputs[lane])))
			throw new Error(`KilledByGoogle v3 ${lane} production output is absent`);
		const inventory = await laneInventory(sourceOutputs[lane]);
		if (inventory.digest !== laneDigests[lane])
			throw new Error(`KilledByGoogle v3 ${lane} lane digest differs`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessNextKilledbygoogleV3Run[]> {
	const runs: WitnessNextKilledbygoogleV3Run[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeNextKilledbygoogleV3WitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessNextKilledbygoogleV3Run;
			if (run.semanticDigest !== witnessNextKilledbygoogleV3RawDigest(run))
				throw new Error(`KilledByGoogle v3 ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessNextKilledbygoogleV3BehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('KilledByGoogle v3 baseline/migrated behavior parity differs');
	return runs;
}

/**
 * Byte mutation on the migrated build: locate a string the journey asserts by
 * its rendered text, overwrite it in place with an equal-length filler, require
 * the journey to go red on that exact assertion, restore the original bytes, and
 * require the restored journey to reproduce the parity behavior digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessNextKilledbygoogleV3Mutation> {
	const expected = Buffer.from(KBG_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('KilledByGoogle v3 semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const modules = candidates.filter((candidate) => candidate.path.endsWith('.js'));
	const target = modules[0];
	if (modules.length !== 1 || target === undefined)
		throw new Error('KilledByGoogle v3 semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeNextKilledbygoogleV3WitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(KBG_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('KilledByGoogle v3 semantic mutation was not exact red and byte-restored');
	const restored = (await executeNextKilledbygoogleV3WitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessNextKilledbygoogleV3Run;
	const restoredBehaviorDigest = witnessNextKilledbygoogleV3BehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('KilledByGoogle v3 restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: KBG_MUTATION_SEAM,
		path: relative(laneRoot, target.path),
		offset: target.offset,
		beforeSha256,
		mutatedSha256,
		afterRestoreSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
		restoredBehaviorDigest,
	};
}

export async function runWitnessNextKilledbygoogleV3(): Promise<WitnessNextKilledbygoogleV3Receipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('KilledByGoogle v3 Witness requires dual offline controls');
	if (await exists(witnessEvidence))
		throw new Error('KilledByGoogle v3 Witness output collision');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalBytes = await readFile(
		join(root, NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.path),
	);
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		schemaVersion?: unknown;
		revision?: unknown;
		eraLane: { digest: string; runtime: { node: string }; framework: string; bundler: string };
		targetLane: {
			digest: string;
			runtime: { node: string };
			framework: string;
			bundler: string;
		};
	};
	if (
		canonical.schemaVersion !== NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.schemaVersion ||
		canonical.revision !== NEXT_KILLEDBYGOOGLE_V3_SOURCE.revision ||
		canonical.eraLane.digest !== NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.eraLaneDigest ||
		canonical.targetLane.digest !== NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.targetLaneDigest ||
		sha256(canonicalBytes) !== NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT.sha256
	)
		throw new Error('KilledByGoogle v3 canonical build receipt identity differs');
	const lanes = await stageInputs();
	const runs = await executeRuns(lanes);
	const mutation = await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest);
	const artifacts = join(fixtureEvidence, 'artifacts');
	await mkdir(artifacts, { recursive: true });
	await writeFile(join(artifacts, 'witness-journeys.json'), `${canonicalize(runs)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(artifacts, 'witness-mutation.json'), `${canonicalize(mutation)}\n`, {
		flag: 'wx',
	});
	const receipt: WitnessNextKilledbygoogleV3Receipt = {
		schemaVersion: WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCHEMA,
		result: 'pass',
		fixture: NEXT_KILLEDBYGOOGLE_V3_FIXTURE,
		source: NEXT_KILLEDBYGOOGLE_V3_SOURCE,
		provenance,
		canonicalReceipt: NEXT_KILLEDBYGOOGLE_V3_CANONICAL_RECEIPT,
		runs,
		mutation,
		serviceWorker: WITNESS_NEXT_KILLEDBYGOOGLE_V3_SERVICE_WORKER,
		consoleErrors: WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS,
		failedRequests: WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS,
		mockedNonLoopbackSeams: {
			category: WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS,
			pathPolicy: runs[0]!.mockedNonLoopbackSeams.pathPolicy,
			instances: runs.map((run) => ({
				lane: run.lane,
				pass: run.pass,
				observed: run.mockedNonLoopbackSeams.observed,
				absent: run.mockedNonLoopbackSeams.absent,
			})),
		},
		scriptExecutionDifference: WITNESS_NEXT_KILLEDBYGOOGLE_V3_SCRIPT_EXECUTION_DIFFERENCE,
		routerHistoryDifference: WITNESS_NEXT_KILLEDBYGOOGLE_V3_ROUTER_HISTORY_DIFFERENCE,
		renderedStyles: runs[0]!.renderedStyles,
		trackedEvents: runs[0]!.witnessRecord.trackedEventCounts,
		scrollSurface: runs[0]!.scrollSurface,
		buildLanes: {
			baseline: {
				framework: canonical.eraLane.framework,
				bundler: canonical.eraLane.bundler,
				node: canonical.eraLane.runtime.node,
				digest: canonical.eraLane.digest,
				files: 41,
			},
			migrated: {
				framework: canonical.targetLane.framework,
				bundler: canonical.targetLane.bundler,
				node: canonical.targetLane.runtime.node,
				digest: canonical.targetLane.digest,
				files: 27,
			},
		},
		documentDelivery: {
			baseline: 'pre-rendered-application-document',
			migrated: 'client-mounted-application-document',
			baselineIndexBytes: 291004,
			migratedIndexBytes: 268,
			parityOracle: 'settled-dom-and-behaviour',
			byteParity: 'not-claimed',
		},
		persistence: {
			store: 'in-memory-react-state',
			browserStorage: 'none-written',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: false,
		},
		readiness: {
			nextLineage: { ready: 0, total: 1, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			mockedNonLoopbackSeams: WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS.baseline.length,
			osWideIsolation: false,
		},
		nonclaims: [
			'This application has a single authored route and no router, so no navigation journey is claimed here and nothing in this receipt says anything about routed Next applications.',
			'This is one Next lineage under direct Witness and does not establish generic Next support. The lift is only defensible because this application is single-route, zero-API and server-free, and nothing here generalises to API routes, middleware, server rendering, next/image, next/dynamic or next/router.',
			'The Next lineage readiness score is unchanged; this vertical is not counted before Judge audit.',
			'Document bytes are not compared and no byte parity is claimed. The era lane delivers the whole application inside its document and the migrated lane delivers a mount element and a module that builds it, which is the central difference of the lift; the oracle used here is the settled DOM and the behaviour on top of it.',
			"The era lane records one client-router history entry after hydration that the lifted lane has no router to record. Both entries name the same URL, the journey never navigates anywhere, and each lane's navigation count is asserted exactly rather than relaxed to fit both.",
			'The era lane fetches three third-party destinations and the migrated lane fetches one. That difference is recorded rather than normalised away: the two scripts the era document has the parser insert are produced by React after the lift, and a script element React inserts is never executed by the browser.',
			'No third-party destination was contacted. Every request outside the bounded loopback origin was answered by the harness inside the browser context, so no advertising, analytics or card endpoint received a request and successfulNonLoopback is zero.',
			'Emotion styling parity is a measurement, not an inference: seven laid-out elements were read for resolved appearance in both lanes and required to agree. The generated class names differ between the lanes because the lift drops Emotion’s Babel plugin, and that difference is in the shipped bytes rather than in what the browser resolved.',
			'Scroll is claimed for the one route this application has, whose document overflows the 1280x720 viewport with the full list rendered.',
			'Drag is not tested because this application has no drag surface.',
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessNextKilledbygoogleV3Digest(receipt);
	/**
	 * Published from the canonical form rather than from the object in hand. The
	 * canonicalizer sorts keys, so the human receipt has to be rendered from the
	 * same shape a reader will parse back out of the JSON — otherwise the two
	 * disagree about the order of a rendered key list and the verifier, rightly,
	 * refuses them.
	 */
	const published = parseWitnessNextKilledbygoogleV3Receipt(JSON.parse(canonicalize(receipt)));
	await mkdir(witnessEvidence, { recursive: true });
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonicalize(published)}\n`, {
		flag: 'wx',
	});
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessNextKilledbygoogleV3Receipt(published),
		{ flag: 'wx' },
	);
	return published;
}

export async function verifyWitnessNextKilledbygoogleV3(
	output = witnessEvidence,
): Promise<WitnessNextKilledbygoogleV3Receipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessNextKilledbygoogleV3Receipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	assertLinkedWitnessProvenanceEquivalent(
		receipt.provenance,
		expectedProvenance,
		'KilledByGoogle v3',
	);
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('KilledByGoogle v3 canonical receipt bytes drifted');
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessNextKilledbygoogleV3Receipt(receipt)
	)
		throw new Error('KilledByGoogle v3 human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('KilledByGoogle v3 receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('KilledByGoogle v3 publish path differs');
		const receipt = await runWitnessNextKilledbygoogleV3();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessNextKilledbygoogleV3(
			resolve(root, args[verifyIndex + 1]!),
		);
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'KilledByGoogle v3 Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (basename(process.argv[1] ?? '') === 'next-killedbygoogle-v3-0-0-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
