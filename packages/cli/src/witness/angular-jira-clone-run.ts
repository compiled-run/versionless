import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
	WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
	WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
} from '../../../core/src/receipts/witness-real-app.ts';
import {
	ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS,
	ANGULAR_JIRA_CLONE_FIXTURE,
	ANGULAR_JIRA_CLONE_SOURCE,
	parseWitnessAngularJiraCloneReceipt,
	renderWitnessAngularJiraCloneReceipt,
	WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
	WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
	WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
	WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
	WITNESS_ANGULAR_JIRA_CLONE_SCHEMA,
	WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER,
	witnessAngularJiraCloneBehaviorDigest,
	witnessAngularJiraCloneDigest,
	witnessAngularJiraCloneRawDigest,
	type WitnessAngularJiraCloneMutation,
	type WitnessAngularJiraCloneReceipt,
	type WitnessAngularJiraCloneRun,
} from '../../../core/src/receipts/witness-angular-jira-clone.ts';
import { executeAngularJiraCloneWitnessRun, JIRA_CLONE_MUTATION_SEAM } from './real-app-run.ts';
import {
	assertLinkedWitnessProvenanceEquivalent,
	verifyLinkedWitnessProvenance,
} from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/angular-jira-clone');
const witnessEvidence = join(root, 'evidence/runs/witness-angular-jira-clone');
const stageRoot = join(root, '.versionless/stage/witness-angular-jira-clone');
/**
 * The two committed build lanes: the era baseline rebuilt on its own Angular
 * 13.2 custom-webpack cell, and the migrated Angular 16.2 browser-builder
 * output. Both are produced offline by
 * `packages/cli/src/fixture/angular-jira-clone-build-lanes-run.ts` and are
 * bound to this proof by the four receipts the schema pins.
 */
const sourceOutputs = {
	baseline: join(root, '.versionless/cache/angular-jira-clone-baseline/rebuild/dist-1'),
	migrated: join(root, '.versionless/stage/angular-jira-clone-mj2/dist-a'),
} as const;
const laneFileCounts = { baseline: 24, migrated: 24 } as const;

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
			throw new Error(`jira-clone ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
		const stagedFiles = await files(staged[lane]);
		if (stagedFiles.length !== laneFileCounts[lane])
			throw new Error(
				`jira-clone ${lane} lane file count differs: ${stagedFiles.length} against ${laneFileCounts[lane]}`,
			);
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessAngularJiraCloneRun[]> {
	const runs: WitnessAngularJiraCloneRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeAngularJiraCloneWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const run = raw as WitnessAngularJiraCloneRun;
			if (run.semanticDigest !== witnessAngularJiraCloneRawDigest(run))
				throw new Error(`jira-clone ${lane} pass ${pass} raw digest differs`);
			runs.push({ ...run, behaviorDigest: witnessAngularJiraCloneBehaviorDigest(run) });
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('jira-clone baseline/migrated behavior parity differs');
	return runs;
}

/**
 * Byte mutation on the migrated build.
 *
 * The seam is the status the board reports for the column the drag moves the
 * issue into. It was chosen because it is load-bearing three times over: it is
 * a string a reader sees, the journey asserts it exactly off the reopened issue
 * modal, and it is the settled Akita state rather than the drop animation. The
 * uniqueness demanded here is the same discipline the corpus uses everywhere —
 * exactly one served module may carry it, exactly once — so overwriting it in
 * place cannot be absorbed by a second copy somewhere else in the bundle.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessAngularJiraCloneMutation> {
	const expected = Buffer.from(JIRA_CLONE_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('jira-clone semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const target = candidates[0];
	if (candidates.length !== 1 || target === undefined || !target.path.endsWith('.js'))
		throw new Error('jira-clone semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeAngularJiraCloneWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(JIRA_CLONE_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('jira-clone semantic mutation was not exact red and byte-restored');
	const restored = (await executeAngularJiraCloneWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessAngularJiraCloneRun;
	const restoredBehaviorDigest = witnessAngularJiraCloneBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('jira-clone restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: JIRA_CLONE_MUTATION_SEAM,
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
	WitnessAngularJiraCloneReceipt['canonicalReceipts']
> {
	return await Promise.all(
		ANGULAR_JIRA_CLONE_CANONICAL_RECEIPTS.map(async (pinned) => {
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
				throw new Error(`jira-clone bound build receipt identity differs: ${pinned.path}`);
			return {
				path: pinned.path,
				schemaVersion: pinned.schemaVersion,
				digest: pinned.digest,
				sha256: pinned.sha256,
			};
		}),
	);
}

/**
 * The tracked-event counts every run must agree on, taken from the first run
 * and required of the rest. The behavior digest already carries them, so this
 * is a second, louder statement of the same fact rather than a new one.
 */
function trackedEvents(runs: readonly WitnessAngularJiraCloneRun[]): Record<string, number> {
	const first = runs[0]?.witnessRecord.trackedEventCounts;
	if (first === undefined) throw new Error('jira-clone published no runs to summarize');
	for (const run of runs)
		if (canonicalize(run.witnessRecord.trackedEventCounts) !== canonicalize(first))
			throw new Error('jira-clone tracked-event counts differ between runs');
	return first;
}

export async function runWitnessAngularJiraClone(): Promise<WitnessAngularJiraCloneReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('jira-clone Witness requires dual offline controls');
	if (await exists(witnessEvidence)) throw new Error('jira-clone Witness output collision');
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
	const receipt: WitnessAngularJiraCloneReceipt = {
		schemaVersion: WITNESS_ANGULAR_JIRA_CLONE_SCHEMA,
		result: 'pass',
		fixture: ANGULAR_JIRA_CLONE_FIXTURE,
		source: ANGULAR_JIRA_CLONE_SOURCE,
		provenance,
		canonicalReceipts,
		runs,
		mutation,
		serviceWorker: WITNESS_ANGULAR_JIRA_CLONE_SERVICE_WORKER,
		consoleErrors: WITNESS_ANGULAR_JIRA_CLONE_CONSOLE_ERRORS,
		failedRequests: WITNESS_ANGULAR_JIRA_CLONE_FAILED_REQUESTS,
		mockedNonLoopbackSeams: {
			category: WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS,
			pathPolicy: WITNESS_NON_LOOPBACK_QUERY_FREE_PATH_RULE,
			instances: runs.map((run) => ({
				lane: run.lane,
				pass: run.pass,
				observed: run.mockedNonLoopbackSeams.observed,
				absent: run.mockedNonLoopbackSeams.absent,
			})),
		},
		cancelledDuplicateFetches: {
			category: WITNESS_ANGULAR_JIRA_CLONE_CANCELLED_DUPLICATE_FETCHES,
			corroborationRule: WITNESS_CANCELLED_DUPLICATE_FETCH_RULE,
			nonLoopbackScope: WITNESS_CANCELLED_DUPLICATE_FETCH_NON_LOOPBACK_SCOPE,
			instances: runs.map((run) => ({
				lane: run.lane,
				pass: run.pass,
				observed: run.cancelledDuplicateFetches.observed,
				absent: run.cancelledDuplicateFetches.absent,
				admitted: run.cancelledDuplicateFetches.admitted,
			})),
		},
		renderedStyles: runs[0]!.renderedStyles,
		trackedEvents: trackedEvents(runs),
		scrollAbsence: runs[0]!.scrollAbsence,
		buildLanes: {
			baseline: {
				angular: 'Angular 13.2',
				builder: '@angular-builders/custom-webpack:browser over ./webpack.config.js',
				node: 'node 16.20.2 (darwin-arm64, native)',
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
			board: 'in-memory-store',
			browserStorage: 'none-written',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: false,
		},
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			mockedNonLoopbackSeams: WITNESS_ANGULAR_JIRA_CLONE_MOCKED_SEAMS.migrated.length,
			osWideIsolation: false,
		},
		nonclaims: [
			'This is one Angular lineage under direct Witness and does not establish generic Angular, Angular CLI, `@angular-builders/custom-webpack:browser`, or `@angular-devkit/build-angular:browser` support.',
			'The Angular lineage readiness score is unchanged; this vertical is not counted before Judge audit.',
			'The board is solved inside the browser by the application itself from the project document it bundles; no backend exists, nothing was stubbed or seeded by the harness, and no request left the loopback origin successfully.',
			'Nothing the journey does survives a reload, and that is the recorded behavior rather than a limitation of the run: the application keeps the board in an in-memory store, writes no browser storage, and restores the seeded board on every load. The drag, the title edit and the created issue are all gone afterwards, and the journey measures that they are.',
			'Editing the issue description is not claimed. It is a Quill surface that does not accept the synthetic keystrokes the driver produces, so what a claim would record is the harness’s own limitation rather than the application’s behavior; the journey asserts only that the seeded description renders.',
			'Scroll is not claimed. Every stage of the journey was measured with the same generic viewport mechanism a scroll claim would use, and none of them produced a document taller than the 1280x720 viewport, because the application pins the document to the viewport and gives the board columns their own overflow.',
			'Neither lane emits a single console error. That inventory is therefore empty, and empty is the strictest setting of that mechanism rather than a blanket allowance: any message at all lands outside the inventory and fails the run.',
			'The exact failed-request inventory is empty in both lanes and every failed request still fails the run, with one named and corroborated exception that is a category rather than an allowance. The journey’s final gesture is an online reload, and the reload can tear down a page with an error-reporting envelope still in flight, which the browser cancels with `net::ERR_ABORTED`. Only that exact method, path and reason is in the category, it carries no count, and an instance is admitted only when the same page also delivered the same report successfully in the same run.',
			'Every endpoint the application reaches for outside the bounded loopback origin is declared, and each one is answered by the harness inside the browser context, so none of them left the machine. The declared paths carry scheme, host and pathname only: the analytics measurement id and the error-reporting public key both live in the query, and the query is never recorded. Two of the ten are the animated images embedded in the seeded description of the issue the journey opens, fetched the moment the modal renders that description, which the journey asserts.',
			'How many times a declared seam was requested is recorded per run as it was measured and is never pinned, and the two are not the same thing. The seam inventory is an accounting mechanism over endpoint identity: every declared endpoint must be observed or explicitly absent, nothing outside the inventory may be reached, and no request may succeed against a network. Repeat counts are load timing — the browser may reuse a response it already holds for an image the board renders more than once — so two passes of the same lane can legitimately record different counts for the same endpoint, and this receipt records what each pass actually did rather than a number the passes were made to agree on. What is required to agree, and does across every published pass, is the behavioral parity digest.',
			'Neither build ships or registers a service worker. The browser context allowed registration and the application never attempted one, so the zero is the application’s own behavior rather than a policy imposed to produce it.',
			'The two lanes emit different file names and different byte counts by construction, and the migration deliberately replaced the component library’s narrow style entry points with its single aggregate stylesheet. Byte parity across the lanes is not claimed here and is recorded separately by the bound build-parity receipt; what is claimed is that the seven rendered-appearance measurements are identical in both lanes.',
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularJiraCloneDigest(receipt);
	parseWitnessAngularJiraCloneReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	const canonical = canonicalize(receipt);
	/**
	 * The companion is rendered from the receipt as published rather than from
	 * the object in memory, and the difference is not cosmetic. Canonicalization
	 * sorts object keys, so the tracked-event counts and the resolved style
	 * properties come back in a different order than the browser reported them.
	 * A companion rendered from the in-memory object would therefore disagree
	 * with the same companion rendered from the file, and `verify` — which only
	 * ever has the file — would be right to reject it. Rendering from the
	 * round trip makes the human receipt a function of the bytes it accompanies.
	 */
	const published = parseWitnessAngularJiraCloneReceipt(JSON.parse(canonical));
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonical}\n`, { flag: 'wx' });
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessAngularJiraCloneReceipt(published),
		{ flag: 'wx' },
	);
	return published;
}

export async function verifyWitnessAngularJiraClone(
	output = witnessEvidence,
): Promise<WitnessAngularJiraCloneReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessAngularJiraCloneReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	assertLinkedWitnessProvenanceEquivalent(receipt.provenance, expectedProvenance, "jira-clone");
	for (const bound of receipt.canonicalReceipts)
		if (sha256(await readFile(join(root, bound.path))) !== bound.sha256)
			throw new Error(`jira-clone bound build receipt bytes drifted: ${bound.path}`);
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessAngularJiraCloneReceipt(receipt)
	)
		throw new Error('jira-clone human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('jira-clone receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('jira-clone publish path differs');
		const receipt = await runWitnessAngularJiraClone();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessAngularJiraClone(resolve(root, args[verifyIndex + 1]!));
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error('jira-clone Witness runner requires --run-twice --publish <dir> or --verify <dir>');
}

if (basename(process.argv[1] ?? '') === 'angular-jira-clone-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
