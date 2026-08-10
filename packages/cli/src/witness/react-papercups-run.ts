import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessReactPapercupsReceipt,
	REACT_PAPERCUPS_CANONICAL_DIGEST,
	REACT_PAPERCUPS_RECEIPT_PATH,
	REACT_PAPERCUPS_RECEIPT_SHA256,
	REACT_PAPERCUPS_SOURCE,
	REACT_PAPERCUPS_FIXTURE,
	renderWitnessReactPapercupsReceipt,
	WITNESS_REACT_PAPERCUPS_SCHEMA,
	witnessReactPapercupsBehaviorDigest,
	witnessReactPapercupsDigest,
	witnessReactPapercupsRawDigest,
	type WitnessReactPapercupsMutation,
	type WitnessReactPapercupsReceipt,
	type WitnessReactPapercupsRun,
} from '../../../core/src/receipts/witness-react-papercups.ts';
import { executeReactPapercupsWitnessRun } from './real-app-run.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/react-papercups-v1-0-0');
const witnessEvidence = join(root, 'evidence/runs/witness-react-papercups');
const stageRoot = join(root, '.versionless/stage/witness-react-papercups');
const sourceOutputs = {
	baseline: join(root, '.versionless/work/react-papercups-v1-0-0/baseline/build'),
	migrated: join(root, '.versionless/work/react-papercups-v1-0-0/target/build-vite'),
} as const;

/**
 * Visible sign-in heading shipped inside the migrated module. It is the first
 * text the journey asserts, so replacing its bytes must make the browser
 * journey genuinely red rather than merely changing an unread constant.
 */
const MUTATION_SEAM = 'Welcome back' as const;

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
			throw new Error(`Papercups ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessReactPapercupsRun[]> {
	const runs: WitnessReactPapercupsRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeReactPapercupsWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessReactPapercupsRun;
			if (run.semanticDigest !== witnessReactPapercupsRawDigest(run))
				throw new Error(`Papercups ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessReactPapercupsBehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('Papercups baseline/migrated behavior parity differs');
	return runs;
}

/**
 * Byte mutation on the migrated build: locate the visible sign-in heading in
 * the served module, overwrite it in place with an equal-length filler, require
 * the journey to go red on that exact assertion, restore the original bytes,
 * and require the restored journey to reproduce the parity behavior digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessReactPapercupsMutation> {
	const expected = Buffer.from(MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('Papercups semantic seam is not unique within its file');
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
		throw new Error('Papercups semantic seam is not a single served module and its sourcemap');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeReactPapercupsWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('Papercups semantic mutation was not exact red and byte-restored');
	const restored = (await executeReactPapercupsWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessReactPapercupsRun;
	const restoredBehaviorDigest = witnessReactPapercupsBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('Papercups restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: MUTATION_SEAM,
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

export async function runWitnessReactPapercups(): Promise<WitnessReactPapercupsReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Papercups Witness requires dual offline controls');
	if (await exists(witnessEvidence)) throw new Error('Papercups Witness output collision');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalBytes = await readFile(join(root, REACT_PAPERCUPS_RECEIPT_PATH));
	const canonical = JSON.parse(canonicalBytes.toString('utf8')) as {
		fixture?: unknown;
		integrity: { canonicalDigest: string };
	};
	if (
		canonical.fixture !== REACT_PAPERCUPS_FIXTURE ||
		canonical.integrity.canonicalDigest !== REACT_PAPERCUPS_CANONICAL_DIGEST ||
		sha256(canonicalBytes) !== REACT_PAPERCUPS_RECEIPT_SHA256
	)
		throw new Error('Papercups canonical build receipt identity differs');
	const lanes = await stageInputs();
	const runs = await executeRuns(lanes);
	const mutation = await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest);
	const zeroServiceWorker = {
		registration: 'application-unregister' as const,
		checkpoints: runs[0]!.zeroServiceWorkerRuntime.checkpoints,
		emittedOutputFiles: runs
			.flatMap((run) => run.zeroServiceWorkerRuntime.emittedOutputFiles)
			.filter(
				(file, index, all) =>
					all.findIndex((item) => canonicalize(item) === canonicalize(file)) === index,
			)
			.sort((left, right) => left.path.localeCompare(right.path)),
		requests: [] as [],
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
	const receipt: WitnessReactPapercupsReceipt = {
		schemaVersion: WITNESS_REACT_PAPERCUPS_SCHEMA,
		result: 'pass',
		fixture: REACT_PAPERCUPS_FIXTURE,
		source: REACT_PAPERCUPS_SOURCE,
		provenance,
		canonicalReceipt: {
			path: REACT_PAPERCUPS_RECEIPT_PATH,
			canonicalDigest: canonical.integrity.canonicalDigest,
			sha256: sha256(canonicalBytes),
		},
		runs,
		mutation,
		zeroServiceWorker,
		scrollSurface: {
			state: 'omitted-not-meaningful',
			viewport: { width: 1280, height: 720 },
			observation: 'scrollHeight-equals-clientHeight-on-every-visited-route',
			claimed: false,
		},
		readiness: {
			reactLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'This is one React lineage under direct Witness and does not establish generic React or create-react-app support.',
			'The React lineage readiness score is unchanged at 1/4; this vertical is not counted before Judge audit.',
			'Scroll is not tested: every route the journey visits reports scrollHeight equal to clientHeight at 1280x720, so there is no meaningful scroll surface to exercise.',
			'Drag is not tested because the operator console has no genuine drag surface on the visited routes.',
			'The retained create-react-app baseline still emits an unregistered service-worker.js; the evidence records those bytes and proves the runtime never registers, controls, caches, or requests them.',
			'The Papercups API and Phoenix socket are answered by a frozen synthetic loopback projection authored for this fixture; no captured production payload and no real customer data are involved.',
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessReactPapercupsDigest(receipt);
	parseWitnessReactPapercupsReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessReactPapercupsReceipt(receipt),
		{ flag: 'wx' },
	);
	return receipt;
}

export async function verifyWitnessReactPapercups(
	output = witnessEvidence,
): Promise<WitnessReactPapercupsReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessReactPapercupsReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	if (canonicalize(receipt.provenance) !== canonicalize(expectedProvenance))
		throw new Error('Papercups linked Witness provenance differs');
	const canonicalBytes = await readFile(join(root, receipt.canonicalReceipt.path));
	if (sha256(canonicalBytes) !== receipt.canonicalReceipt.sha256)
		throw new Error('Papercups canonical receipt bytes drifted');
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessReactPapercupsReceipt(receipt)
	)
		throw new Error('Papercups human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('Papercups receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('Papercups publish path differs');
		const receipt = await runWitnessReactPapercups();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessReactPapercups(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error('Papercups Witness runner requires --run-twice --publish <dir> or --verify <dir>');
}

if (basename(process.argv[1] ?? '') === 'react-papercups-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
