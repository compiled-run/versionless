import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS,
	ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
	ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN,
	ANGULAR_SUPER_PRODUCTIVITY_SOURCE,
	parseWitnessAngularSuperProductivityReceipt,
	renderWitnessAngularSuperProductivityReceipt,
	verifyWitnessAngularSuperProductivityEvidence,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE,
	WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES,
	witnessAngularSuperProductivityBehaviorDigest,
	witnessAngularSuperProductivityDigest,
	witnessAngularSuperProductivityRawDigest,
	type WitnessAngularSuperProductivityMutation,
	type WitnessAngularSuperProductivityReceipt,
	type WitnessAngularSuperProductivityRun,
	type WitnessAngularSuperProductivityScroll,
} from '../../../core/src/receipts/witness-angular-super-productivity.ts';
import {
	angularSuperProductivityWitnessSpec,
	executeAngularSuperProductivityWitnessRun,
	SUPER_PRODUCTIVITY_MUTATION_SEAM,
} from './real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/angular-super-productivity-v2-13-15');
const witnessEvidence = join(root, 'evidence/runs/witness-angular-super-productivity-v2-13-15');
const stageRoot = join(root, '.versionless/stage/witness-angular-super-productivity-v2-13-15');

const spec = angularSuperProductivityWitnessSpec();
const sourceOutputs = {
	baseline: join(root, spec.sources.baseline),
	migrated: join(root, spec.sources.migrated),
} as const;

/**
 * The file census each served lane has to reproduce, taken from the bound build
 * records: the era baseline emits 64 artifacts, the offline-faithful dist-25
 * rebuild 62. A staged copy that came out a different size is refused rather
 * than served, so the browser proof cannot silently stand on a different tree.
 */
const laneFileCounts = {
	baseline: ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS.find(
		(bound) => bound.lane === 'baseline',
	)!.files,
	migrated: ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS.find(
		(bound) => bound.lane === 'migrated',
	)!.files,
} as const;

/**
 * The style probes the receipt declares differ across the eleven-major lift,
 * checked in both directions by the schema. The behaviour projection drops
 * their values and keeps their labels, so the two lanes can agree on everything
 * else while these two genuinely diverge.
 */
const declaredDifferences = WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MEASURED_STYLE_DIFFERENCES.map(
	(difference) => ({ label: difference.label, why: difference.why }),
);
const declaredDifferenceLabels = declaredDifferences.map((difference) => difference.label);

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
 * The two served lane roots, staged as working copies so the byte mutation
 * below can overwrite a served module in place without touching the canonical
 * build trees the receipt binds. Each copy has to come out at the file count
 * its bound record published, or it is refused.
 */
async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(sourceOutputs[lane])))
			throw new Error(`Super Productivity ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(sourceOutputs[lane], staged[lane], { recursive: true, force: false });
		const stagedFiles = await files(staged[lane]);
		if (stagedFiles.length !== laneFileCounts[lane])
			throw new Error(
				`Super Productivity ${lane} lane file count differs: ${stagedFiles.length} against ${laneFileCounts[lane]}`,
			);
	}
	return staged;
}

/**
 * One browser journey, mapped from the shared real-app run shape onto this
 * vertical's run: the journey measures scroll ABSENCE, which this receipt
 * carries under its `scroll` union member, and the raw and behaviour digests
 * are recomputed over the mapped run so the two travel with the bytes the
 * receipt actually publishes rather than the intermediate shape.
 */
function toRun(
	raw: Awaited<ReturnType<typeof executeAngularSuperProductivityWitnessRun>>,
): WitnessAngularSuperProductivityRun {
	const candidate = raw as WitnessAngularSuperProductivityRun;
	const scroll: WitnessAngularSuperProductivityScroll | undefined = candidate.scrollAbsence;
	if (scroll === undefined) throw new Error('Super Productivity run measured no scroll reading');
	const { scrollAbsence: _absence, ...rest } = candidate;
	const run: WitnessAngularSuperProductivityRun = {
		...rest,
		scroll,
		semanticDigest: '',
		behaviorDigest: '',
	};
	run.semanticDigest = witnessAngularSuperProductivityRawDigest(run);
	run.behaviorDigest = witnessAngularSuperProductivityBehaviorDigest(
		run,
		declaredDifferenceLabels,
	);
	return run;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessAngularSuperProductivityRun[]> {
	const runs: WitnessAngularSuperProductivityRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeAngularSuperProductivityWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			runs.push(toRun(raw));
		}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('Super Productivity baseline/migrated behavior parity differs');
	return runs;
}

/**
 * The byte mutation on the migrated build.
 *
 * The seam is the create-project dialog's own host tag — the component selector
 * the leg-(d) project switch opens and asserts a single instance of. The corpus
 * discipline demands it be emitted exactly once across the served bundle, so
 * overwriting it in place renames the host tag with nothing else absorbing the
 * change: the dialog assertion observes zero and the run is red with a message
 * that names the seam. Byte-identical restoration makes the same journey green
 * again at the same shared behaviour digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessAngularSuperProductivityMutation> {
	const expected = Buffer.from(SUPER_PRODUCTIVITY_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		// Only the executable modules are scanned: a `.js.map` is a debug sidecar
		// the browser fetches only if devtools opens it and never executes, and this
		// bundle's source map carries the seam eight times. The corpus discipline the
		// mutation stands on is that exactly one served MODULE carries the selector,
		// exactly once — the map's copies are the compiler's provenance, not code.
		if (!path.endsWith('.js')) continue;
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('Super Productivity semantic seam is not unique within its module');
		candidates.push({ path, offset });
	}
	const target = candidates[0];
	if (candidates.length !== 1 || target === undefined || !target.path.endsWith('.js'))
		throw new Error('Super Productivity semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeAngularSuperProductivityWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(SUPER_PRODUCTIVITY_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('Super Productivity semantic mutation was not exact red and byte-restored');
	const restored = toRun(
		await executeAngularSuperProductivityWitnessRun({
			lane: 'migrated',
			pass: 1,
			laneRoot,
			receiptRoot: join(stageRoot, 'restoration-receipt'),
		}),
	);
	if (restored.behaviorDigest !== behaviorDigest)
		throw new Error('Super Productivity restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: SUPER_PRODUCTIVITY_MUTATION_SEAM,
		path: relative(laneRoot, target.path),
		offset: target.offset,
		beforeSha256,
		mutatedSha256,
		afterRestoreSha256,
		restoredByteIdentically: true,
		restoredRun: 'pass',
		restoredBehaviorDigest: restored.behaviorDigest,
	};
}

/**
 * The nonclaims this proof publishes. Each names something a reader could
 * otherwise assume from the rest of the receipt and states plainly that it is
 * not established here — including the three honest non-claims this cell paid
 * for in the browser: the sub-minute timer value, the undriveable colour input,
 * and the backlog toggle that showed no effect.
 */
export const WITNESS_ANGULAR_SUPER_PRODUCTIVITY_NONCLAIMS: readonly string[] = Object.freeze([
	'This is one Angular lineage under direct Witness — Angular 8.2 pre-Ivy ViewEngine to Angular 16.2 — and does not establish generic Angular, Angular CLI 8.3 workspaces, or `@angular-devkit/build-angular:browser` support beyond this application.',
	'The Angular lineage readiness score is unchanged; this vertical is not counted before Judge audit.',
	'There is no backend and nothing was stubbed or seeded by the harness. The application boots into planning mode with no tasks, and every task, project and setting the journey creates it creates itself; everything it keeps it keeps in the browser’s own IndexedDB store through the application’s own DatabaseService.',
	'Leg (c) accrues a sub-minute duration, and the application’s own `ms-to-string` formats any sub-minute value as `-`, so the journey’s `.time-val` never carries a digit. The timer is anchored on the header play button’s icon flip and the current-task count instead, and the time value is recorded as a truthful non-claim rather than asserted.',
	'The project theme’s native `input[type=color]` is undriveable by the Witness PageHandle — it has no fill/evaluate primitive, and char-press and arrow keys leave the control’s value unchanged — so no colour-save palette shift is claimed. The leg-(d) theme drive is the click-driveable `huePrimary` mat-select, whose value genuinely changes under a click and shifts the measured `--palette-primary-contrast-50` from a dark contrast to a light one.',
	'The `b` (toggleBacklog) shortcut produced no visible toggle in the observed state — the work view rendered no backlog panel to toggle — so no effect is claimed for it; only the `w` (goToWorkView) shortcut, whose work-view host tag renders after the press, is claimed.',
	'The shifted contrast rgb differs across lanes — the Angular 8 `angular-material-css-vars` emits a bare `r,g,b` triple and the Angular 16 one an `rgba(r, g, b, a)` — and that per-lane value is a declared difference kept out of the shared behaviour digest, which carries only the fact that the driven change shifted the var, never the value.',
	'Two of the six rendered-appearance probes are declared to differ across the lift and are checked in both directions — a probe outside the declaration that differs fails the run, and a declared difference that stopped being real fails it too. The pre-MDC→MDC toolbar height and side-nav width also differ by a few pixels; that geometry stays in the run and out of the shared digest because every CSS property the probes read resolves identically.',
	'Byte parity across the lanes is not claimed and is recorded separately by the bound build records; eight majors of bundler produce different file names and different byte counts by construction. Neither lane is byte-stable across rebuilds either — the era lane reseeds a Sass `random()` per build and the migrated lane stamps the build clock into its service-worker manifest — and neither entry claims to be.',
	'Both lanes ship and register a real ngsw from the application’s own root module, and the worker that succeeds is measured at three checkpoints per lane. The typeface degrades identically in both: the linked Roboto stylesheet is answered in-context with an empty body so no `@font-face` rule ever defines the family and the browser falls through to the generic — measured rather than masked, and not a regression of the migration.',
	'The migrated lane was rebuilt with the builder’s font inliner disabled and measured making no non-loopback connection attempt across its two builds; that is a fact about those build processes established by an in-process guard, not a claim that the machine was offline. Locality here is process-scoped and does not establish operating-system-wide isolation.',
	'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
]);

async function bindCanonicalReceipts(): Promise<
	WitnessAngularSuperProductivityReceipt['canonicalReceipts']
> {
	for (const pinned of ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS) {
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
			throw new Error(
				`Super Productivity bound build receipt identity differs: ${pinned.path}`,
			);
	}
	return ANGULAR_SUPER_PRODUCTIVITY_CANONICAL_RECEIPTS;
}

export async function runWitnessAngularSuperProductivity(): Promise<WitnessAngularSuperProductivityReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('Super Productivity Witness requires dual offline controls');
	if (await exists(witnessEvidence))
		throw new Error('Super Productivity Witness output collision');
	const canonicalReceipts = await bindCanonicalReceipts();
	const lanes = await stageInputs();
	const runs = await executeRuns(lanes);
	const mutation = await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest);
	const baseline = runs.find((run) => run.lane === 'baseline')!;
	const migrated = runs.find((run) => run.lane === 'migrated')!;
	const serviceWorkerParity = Object.fromEntries(
		(['baseline', 'migrated'] as const).map((lane) => {
			const run = lane === 'baseline' ? baseline : migrated;
			const final = run.serviceWorker.checkpoints.at(-1)!;
			return [
				lane,
				{
					registeredScriptPath: final.telemetry.registration.scriptPath!,
					scope: final.telemetry.registration.scope!,
					activeAtFinalCheckpoint: final.telemetry.registration.active!,
					controlledAtFinalCheckpoint: final.telemetry.controller !== null,
					cacheNames: final.telemetry.cacheNames,
				},
			];
		}),
	) as WitnessAngularSuperProductivityReceipt['serviceWorkerParity'];
	const artifacts = join(fixtureEvidence, 'witness-artifacts');
	await mkdir(artifacts, { recursive: true });
	await writeFile(join(artifacts, 'witness-journeys.json'), `${canonicalize(runs)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(artifacts, 'witness-mutation.json'), `${canonicalize(mutation)}\n`, {
		flag: 'wx',
	});
	const receipt: WitnessAngularSuperProductivityReceipt = {
		schemaVersion: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SCHEMA,
		result: 'pass',
		fixture: ANGULAR_SUPER_PRODUCTIVITY_FIXTURE,
		source: ANGULAR_SUPER_PRODUCTIVITY_SOURCE,
		provenance: {},
		canonicalReceipts,
		determinism: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DETERMINISM,
		sassRandomBoundary: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SASS_RANDOM_BOUNDARY,
		runs,
		mutation,
		consoleErrors: {
			baseline: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS.baseline],
			migrated: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_CONSOLE_ERRORS.migrated],
		},
		failedRequests: {
			baseline: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS.baseline],
			migrated: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FAILED_REQUESTS.migrated],
		},
		mockedSeams: {
			baseline: [...baseline.mockedNonLoopbackSeams!.category],
			migrated: [...migrated.mockedNonLoopbackSeams!.category],
		},
		fontSeam: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_FONT_SEAM,
		serviceWorker: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_SERVICE_WORKER,
		serviceWorkerParity,
		migratedLaneChain: ANGULAR_SUPER_PRODUCTIVITY_MIGRATED_LANE_CHAIN,
		migrationFindings: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_MIGRATION_FINDINGS,
		typefaceDegradations: {
			baseline: baseline.applicationJourney!.typeface,
			migrated: migrated.applicationJourney!.typeface,
		},
		renderedStyleParity: {
			state: 'measured-resolved-styles-with-declared-differences',
			probes: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_PROBES.length,
			rule: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_STYLE_DIFFERENCE_RULE,
			declaredDifferences,
			otherProbesAgree: true,
		},
		persistence: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_PERSISTENCE,
		routeShape: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ROUTE_SHAPE,
		scroll: runs[0]!.scroll,
		accommodations: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATIONS,
		accommodationPayload: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_ACCOMMODATION_PAYLOAD,
		dragSurface: WITNESS_ANGULAR_SUPER_PRODUCTIVITY_DRAG_SURFACE,
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			osWideIsolation: false,
			mockedNonLoopbackSeams: migrated.mockedNonLoopbackSeams!.category.length,
		},
		nonclaims: [...WITNESS_ANGULAR_SUPER_PRODUCTIVITY_NONCLAIMS],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularSuperProductivityDigest(receipt);
	parseWitnessAngularSuperProductivityReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	const canonical = canonicalize(receipt);
	/**
	 * The companion is rendered from the receipt as PUBLISHED rather than from
	 * the object in memory: canonicalization sorts keys, so a companion rendered
	 * from the in-memory object would disagree with the same companion rendered
	 * from the file, and `verify` — which only ever has the file — would be right
	 * to reject it.
	 */
	const published = parseWitnessAngularSuperProductivityReceipt(JSON.parse(canonical));
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonical}\n`, { flag: 'wx' });
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessAngularSuperProductivityReceipt(published),
		{ flag: 'wx' },
	);
	return published;
}

export async function verifyWitnessAngularSuperProductivity(): Promise<WitnessAngularSuperProductivityReceipt> {
	const verified = await verifyWitnessAngularSuperProductivityEvidence(root);
	return verified.receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('Super Productivity publish path differs');
		const receipt = await runWitnessAngularSuperProductivity();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0) {
		const receipt = await verifyWitnessAngularSuperProductivity();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'Super Productivity Witness runner requires --run-twice --publish <dir> or --verify',
	);
}

if (basename(process.argv[1] ?? '') === 'angular-super-productivity-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
