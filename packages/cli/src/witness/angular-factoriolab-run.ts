import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { WITNESS_CANCELLED_DUPLICATE_FETCH_RULE } from '../../../core/src/receipts/witness-real-app.ts';
import {
	ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS,
	ANGULAR_FACTORIOLAB_FIXTURE,
	ANGULAR_FACTORIOLAB_SOURCE,
	parseWitnessAngularFactoriolabReceipt,
	renderWitnessAngularFactoriolabReceipt,
	WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS,
	WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS,
	WITNESS_ANGULAR_FACTORIOLAB_SCHEMA,
	WITNESS_ANGULAR_FACTORIOLAB_SERVICE_WORKER,
	witnessAngularFactoriolabBehaviorDigest,
	witnessAngularFactoriolabDigest,
	witnessAngularFactoriolabRawDigest,
	type WitnessAngularFactoriolabMutation,
	type WitnessAngularFactoriolabReceipt,
	type WitnessAngularFactoriolabRun,
} from '../../../core/src/receipts/witness-angular-factoriolab.ts';
import { executeAngularFactoriolabWitnessRun, FACTORIOLAB_MUTATION_SEAM } from './real-app-run.ts';
import {
	assertLinkedWitnessProvenanceEquivalent,
	verifyLinkedWitnessProvenance,
} from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/angular-factoriolab');
const witnessEvidence = join(root, 'evidence/runs/witness-angular-factoriolab');
const stageRoot = join(root, '.versionless/stage/witness-angular-factoriolab');
/**
 * The two committed build lanes: the era baseline rebuilt on its own Angular 10
 * cell, and the migrated Angular 16.2 browser-builder output. Both are produced
 * offline by `packages/cli/src/fixture/angular-factoriolab-build-lanes-run.ts`.
 */
const sourceOutputs = {
	baseline: join(root, '.versionless/cache/angular-factoriolab-baseline/rebuild/dist-1'),
	migrated: join(root, '.versionless/stage/angular-factoriolab-m2/dist-a'),
} as const;
const laneFileCounts = { baseline: 42, migrated: 39 } as const;

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
			throw new Error(`factoriolab ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
		const staged_files = await files(staged[lane]);
		if (staged_files.length !== laneFileCounts[lane])
			throw new Error(
				`factoriolab ${lane} lane file count differs: ${staged_files.length} against ${laneFileCounts[lane]}`,
			);
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessAngularFactoriolabRun[]> {
	const runs: WitnessAngularFactoriolabRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeAngularFactoriolabWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessAngularFactoriolabRun;
			if (run.semanticDigest !== witnessAngularFactoriolabRawDigest(run))
				throw new Error(`factoriolab ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessAngularFactoriolabBehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('factoriolab baseline/migrated behavior parity differs');
	return runs;
}

/**
 * Byte mutation on the migrated build: locate the visible columns-dialog title
 * in the served module, overwrite it in place with an equal-length filler,
 * require the journey to go red on that exact assertion, restore the original
 * bytes, and require the restored journey to reproduce the parity behavior
 * digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessAngularFactoriolabMutation> {
	const expected = Buffer.from(FACTORIOLAB_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('factoriolab semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const target = candidates[0];
	if (candidates.length !== 1 || target === undefined || !target.path.endsWith('.js'))
		throw new Error('factoriolab semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeAngularFactoriolabWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(FACTORIOLAB_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('factoriolab semantic mutation was not exact red and byte-restored');
	const restored = (await executeAngularFactoriolabWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessAngularFactoriolabRun;
	const restoredBehaviorDigest = witnessAngularFactoriolabBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('factoriolab restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: FACTORIOLAB_MUTATION_SEAM,
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

async function bindCanonicalReceipts(): Promise<
	WitnessAngularFactoriolabReceipt['canonicalReceipts']
> {
	return await Promise.all(
		ANGULAR_FACTORIOLAB_CANONICAL_RECEIPTS.map(async (pinned) => {
			const bytes = await readFile(join(root, pinned.path));
			const value = JSON.parse(bytes.toString('utf8')) as {
				schemaVersion?: unknown;
				digest?: unknown;
			};
			if (
				value.schemaVersion !== pinned.schemaVersion ||
				value.digest !== pinned.digest ||
				sha256(bytes) !== pinned.sha256
			)
				throw new Error(`factoriolab bound build receipt identity differs: ${pinned.path}`);
			return {
				path: pinned.path,
				schemaVersion: pinned.schemaVersion,
				digest: pinned.digest,
				sha256: pinned.sha256,
			};
		}),
	);
}

export async function runWitnessAngularFactoriolab(): Promise<WitnessAngularFactoriolabReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('factoriolab Witness requires dual offline controls');
	if (await exists(witnessEvidence)) throw new Error('factoriolab Witness output collision');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalReceipts = await bindCanonicalReceipts();
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
	const receipt: WitnessAngularFactoriolabReceipt = {
		schemaVersion: WITNESS_ANGULAR_FACTORIOLAB_SCHEMA,
		result: 'pass',
		fixture: ANGULAR_FACTORIOLAB_FIXTURE,
		source: ANGULAR_FACTORIOLAB_SOURCE,
		provenance,
		canonicalReceipts,
		runs,
		mutation,
		serviceWorker: WITNESS_ANGULAR_FACTORIOLAB_SERVICE_WORKER,
		consoleErrors: WITNESS_ANGULAR_FACTORIOLAB_CONSOLE_ERRORS,
		failedRequests: WITNESS_ANGULAR_FACTORIOLAB_FAILED_REQUESTS,
		cancelledDuplicateFetches: {
			category: WITNESS_ANGULAR_FACTORIOLAB_CANCELLED_DUPLICATE_FETCHES,
			corroborationRule: WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
			instances: runs.map((run) => ({
				lane: run.lane,
				pass: run.pass,
				observed: run.cancelledDuplicateFetches.observed,
				absent: run.cancelledDuplicateFetches.absent,
				admitted: run.cancelledDuplicateFetches.admitted,
			})),
		},
		scrollAbsence: runs[0]!.scrollAbsence,
		buildLanes: {
			baseline: {
				angular: 'Angular 10.1',
				builder: '@angular-devkit/build-angular:browser',
				node: 'node 12.14.1 (darwin-x64 under Rosetta 2)',
				distFiles: laneFileCounts.baseline,
			},
			migrated: {
				angular: 'Angular 16.2',
				builder: '@angular-devkit/build-angular:browser',
				node: 'node 16.20.2 (darwin-arm64, native)',
				distFiles: laneFileCounts.migrated,
			},
		},
		persistence: {
			plan: 'url-fragment-encoded',
			preferences: 'browser-local-storage',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: true,
		},
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'This is one Angular lineage under direct Witness and does not establish generic Angular, Angular CLI, or `@angular-devkit/build-angular:browser` support.',
			'The Angular lineage readiness score is unchanged; this vertical is not counted before Judge audit.',
			'The production plan is solved inside the browser by the application itself against the Factorio 1.0 dataset it bundles; no backend exists, nothing was stubbed or seeded by the harness, and no request left the loopback origin successfully.',
			'The saved state is written by the application into the browser’s own local storage under its own key; the harness neither writes nor reads that storage.',
			'Scroll is not claimed. Every visited route was measured with the same generic viewport mechanism a scroll claim would use, and none of them produced a document taller than the 1280x720 viewport, because the application pins the body with `overflow: hidden` and scrolls its own panels. The settings panel does overflow its own box, and the driver scrolls it to bring a control into view; that is actionability, not a claimed scroll gesture, and it is not recorded as one.',
			'Drag is not tested because the visited routes have no genuine drag surface.',
			'Neither lane emits a single console error. That inventory is therefore empty, and empty is the strictest setting of that mechanism rather than a blanket allowance: any message at all lands outside the inventory and fails the run.',
			'The exact failed-request inventory is empty in both lanes and every failed request still fails the run, with one named and corroborated exception that is a category rather than an allowance. The application points every one of its hundreds of `lab-icon` elements at the same 1x1 `assets/transparent.gif`, the bounded origin answers `cache-control: no-store`, and Angular re-renders the icon set when the bundled dataset resolves during bootstrap; the browser therefore has two identical fetches of that gif in flight and cancels one with `net::ERR_ABORTED`, intermittently. Only that exact path, method and reason is in the category, it carries no count, and an instance is admitted only when the same page also fetched the same path successfully in the same run — a cancelled fetch without a successful sibling fails the run, as does a cancelled fetch of any other path or with any other reason. Every admitted instance is recorded in the run and in this receipt with the successful fetches that corroborated it.',
			'Neither build ships or registers a service worker. The browser context allowed registration and the application never attempted one, so the zero is the application’s own behavior rather than a policy imposed to produce it.',
			'The one non-loopback seam the application carries is the Google Analytics tag in its own `index.html`. It is answered inside the browser context and never reaches a network, so it is neither a successful non-loopback request nor a failed one.',
			'The two lanes emit different file names and different byte counts by construction, because the two builders hash their output differently. Byte parity across the lanes is not claimed here and is recorded separately by the bound build-parity receipt.',
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularFactoriolabDigest(receipt);
	parseWitnessAngularFactoriolabReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonicalize(receipt)}\n`, {
		flag: 'wx',
	});
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessAngularFactoriolabReceipt(receipt),
		{ flag: 'wx' },
	);
	return receipt;
}

export async function verifyWitnessAngularFactoriolab(
	output = witnessEvidence,
): Promise<WitnessAngularFactoriolabReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessAngularFactoriolabReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	assertLinkedWitnessProvenanceEquivalent(receipt.provenance, expectedProvenance, 'factoriolab');
	for (const bound of receipt.canonicalReceipts)
		if (sha256(await readFile(join(root, bound.path))) !== bound.sha256)
			throw new Error(`factoriolab bound build receipt bytes drifted: ${bound.path}`);
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessAngularFactoriolabReceipt(receipt)
	)
		throw new Error('factoriolab human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('factoriolab receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('factoriolab publish path differs');
		const receipt = await runWitnessAngularFactoriolab();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessAngularFactoriolab(
			resolve(root, args[verifyIndex + 1]!),
		);
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'factoriolab Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (basename(process.argv[1] ?? '') === 'angular-factoriolab-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
