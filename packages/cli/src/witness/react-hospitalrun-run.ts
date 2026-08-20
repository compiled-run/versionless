import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessReactHospitalrunReceipt,
	REACT_HOSPITALRUN_CANONICAL_DIGEST,
	REACT_HOSPITALRUN_FIXTURE,
	REACT_HOSPITALRUN_RECEIPT_PATH,
	REACT_HOSPITALRUN_RECEIPT_SHA256,
	REACT_HOSPITALRUN_SOURCE,
	renderWitnessReactHospitalrunReceipt,
	WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS,
	WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS,
	WITNESS_REACT_HOSPITALRUN_SCHEMA,
	WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_DIFFERENCE,
	witnessReactHospitalrunBehaviorDigest,
	witnessReactHospitalrunDigest,
	witnessReactHospitalrunRawDigest,
	type WitnessReactHospitalrunMutation,
	type WitnessReactHospitalrunReceipt,
	type WitnessReactHospitalrunRun,
} from '../../../core/src/receipts/witness-react-hospitalrun.ts';
import { executeReactHospitalrunWitnessRun, HOSPITALRUN_MUTATION_SEAM } from './real-app-run.ts';
import {
	assertLinkedWitnessProvenanceEquivalent,
	verifyLinkedWitnessProvenance,
} from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/react-hospitalrun');
const witnessEvidence = join(root, 'evidence/runs/witness-react-hospitalrun');
const stageRoot = join(root, '.versionless/stage/witness-react-hospitalrun');
const sourceOutputs = {
	baseline: join(root, '.versionless/work/react-hospitalrun/baseline/build-run1'),
	migrated: join(root, '.versionless/work/react-hospitalrun/target/build-vite-run1'),
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

async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(sourceOutputs[lane])))
			throw new Error(`HospitalRun ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessReactHospitalrunRun[]> {
	const runs: WitnessReactHospitalrunRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeReactHospitalrunWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessReactHospitalrunRun;
			if (run.semanticDigest !== witnessReactHospitalrunRawDigest(run))
				throw new Error(`HospitalRun ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessReactHospitalrunBehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('HospitalRun baseline/migrated behavior parity differs');
	return runs;
}

/**
 * Byte mutation on the migrated build: locate the visible intake-success text
 * in the served module, overwrite it in place with an equal-length filler,
 * require the journey to go red on that exact assertion, restore the original
 * bytes, and require the restored journey to reproduce the parity behavior
 * digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessReactHospitalrunMutation> {
	const expected = Buffer.from(HOSPITALRUN_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('HospitalRun semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const modules = candidates.filter((candidate) => candidate.path.endsWith('.js'));
	const target = modules[0];
	if (
		modules.length !== 1 ||
		target === undefined ||
		canonicalize(candidates.map((candidate) => candidate.path).sort()) !==
			canonicalize([target.path, `${target.path}.map`].sort())
	)
		throw new Error(
			'HospitalRun semantic seam is not a single served module and its sourcemap',
		);
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeReactHospitalrunWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(HOSPITALRUN_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('HospitalRun semantic mutation was not exact red and byte-restored');
	const restored = (await executeReactHospitalrunWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessReactHospitalrunRun;
	const restoredBehaviorDigest = witnessReactHospitalrunBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('HospitalRun restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: HOSPITALRUN_MUTATION_SEAM,
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

export async function runWitnessReactHospitalrun(): Promise<WitnessReactHospitalrunReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('HospitalRun Witness requires dual offline controls');
	if (await exists(witnessEvidence)) throw new Error('HospitalRun Witness output collision');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalBytes = await readFile(join(root, REACT_HOSPITALRUN_RECEIPT_PATH));
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		fixture?: unknown;
		integrity: { canonicalDigest: string };
	};
	if (
		canonical.fixture !== REACT_HOSPITALRUN_FIXTURE ||
		canonical.integrity.canonicalDigest !== REACT_HOSPITALRUN_CANONICAL_DIGEST ||
		sha256(canonicalBytes) !== REACT_HOSPITALRUN_RECEIPT_SHA256
	)
		throw new Error('HospitalRun canonical build receipt identity differs');
	const lanes = await stageInputs();
	const runs = await executeRuns(lanes);
	const mutation = await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest);
	const blockedServiceWorker = {
		registration: 'application-register-refused-by-context' as const,
		checkpoints: runs[0]!.blockedServiceWorkerRuntime.checkpoints,
		emittedOutputFiles: runs
			.flatMap((run) => run.blockedServiceWorkerRuntime.emittedOutputFiles)
			.filter(
				(file, index, all) =>
					all.findIndex((item) => canonicalize(item) === canonicalize(file)) === index,
			)
			.sort((left, right) => left.path.localeCompare(right.path)),
		requests: runs[0]!.blockedServiceWorkerRuntime.requests,
		requestTally: runs[0]!.blockedServiceWorkerRuntime.requestTally,
		workerEvents: [] as [],
	};
	const artifacts = join(fixtureEvidence, 'artifacts');
	await mkdir(artifacts, { recursive: true });
	await writeFile(join(artifacts, 'witness-journeys.json'), `${canonicalize(runs)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(artifacts, 'witness-mutation.json'), `${canonicalize(mutation)}\n`, {
		flag: 'wx',
	});
	const receipt: WitnessReactHospitalrunReceipt = {
		schemaVersion: WITNESS_REACT_HOSPITALRUN_SCHEMA,
		result: 'pass',
		fixture: REACT_HOSPITALRUN_FIXTURE,
		source: REACT_HOSPITALRUN_SOURCE,
		provenance,
		canonicalReceipt: {
			path: REACT_HOSPITALRUN_RECEIPT_PATH,
			canonicalDigest: canonical.integrity.canonicalDigest,
			sha256: sha256(canonicalBytes),
		},
		runs,
		mutation,
		blockedServiceWorker,
		serviceWorkerDifference: WITNESS_REACT_HOSPITALRUN_SERVICE_WORKER_DIFFERENCE,
		consoleErrors: WITNESS_REACT_HOSPITALRUN_CONSOLE_ERRORS,
		failedRequests: WITNESS_REACT_HOSPITALRUN_FAILED_REQUESTS,
		scrollSurface: runs[0]!.scrollSurface,
		persistence: {
			store: 'browser-local-pouchdb',
			stubbed: false,
			survivesOnlineReload: true,
		},
		readiness: {
			reactLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'This is one React lineage under direct Witness and does not establish generic React or create-react-app support.',
			'The React lineage readiness score is unchanged; this vertical is not counted before Judge audit.',
			'The patient record is created inside the browser by the application itself against its own PouchDB store; no database was stubbed, seeded, or answered by the harness, and no real patient data is involved.',
			'Scroll is claimed only for the appointment schedule, the one visited route whose document overflows the 1280x720 viewport; the other visited routes report scrollHeight equal to clientHeight and are not claimed as scroll coverage.',
			'Drag is not tested because the visited routes have no genuine drag surface.',
			'Service-worker registration is refused at the browser context in both lanes. The refusal is not silenced: each lane emits exactly the console errors and failed requests pinned in this receipt, and anything outside those inventories fails the run.',
			'The baseline still emits and registers a create-react-app service-worker.js while the migrated build emits none; that difference is recorded as a real behavioral migration difference rather than normalized away.',
			'Neither lane has a silent console. The application itself calls serviceWorker.register() in both lanes, so both are noisy and noisy in different ways: the baseline serves its retained worker script and its own error handler reports the refused registration, while the migrated build has no worker script to serve and the registration probe 404s. A console-silent migrated lane would require changing the application source, which this migration deliberately does not do.',
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactHospitalrunDigest(receipt);
	parseWitnessReactHospitalrunReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessReactHospitalrunReceipt(receipt),
		{ flag: 'wx' },
	);
	return receipt;
}

export async function verifyWitnessReactHospitalrun(
	output = witnessEvidence,
): Promise<WitnessReactHospitalrunReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessReactHospitalrunReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	assertLinkedWitnessProvenanceEquivalent(receipt.provenance, expectedProvenance, 'HospitalRun');
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('HospitalRun canonical receipt bytes drifted');
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessReactHospitalrunReceipt(receipt)
	)
		throw new Error('HospitalRun human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('HospitalRun receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('HospitalRun publish path differs');
		const receipt = await runWitnessReactHospitalrun();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessReactHospitalrun(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'HospitalRun Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (basename(process.argv[1] ?? '') === 'react-hospitalrun-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
