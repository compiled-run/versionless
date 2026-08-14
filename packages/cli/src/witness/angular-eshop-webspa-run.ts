import { access, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	parseWitnessAngularEshopWebspaReceipt,
	renderWitnessAngularEshopWebspaReceipt,
	witnessAngularEshopWebspaBehaviorDigest,
	witnessAngularEshopWebspaDigest,
	witnessAngularEshopWebspaRawDigest,
	WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE,
	WITNESS_ANGULAR_ESHOP_WEBSPA_APP,
	WITNESS_ANGULAR_ESHOP_WEBSPA_EVIDENCE_DIRECTORY,
	WITNESS_ANGULAR_ESHOP_WEBSPA_FIXTURE,
	WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM,
	WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
	WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_LABEL,
	WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SOURCE,
	WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS,
	WITNESS_ANGULAR_ESHOP_WEBSPA_UNIT,
	type WitnessAngularEshopWebspaLedgerEntry,
	type WitnessAngularEshopWebspaMutation,
	type WitnessAngularEshopWebspaReceipt,
	type WitnessAngularEshopWebspaRun,
} from '../../../core/src/receipts/witness-angular-eshop-webspa.ts';
import {
	ESHOP_WEBSPA_PINNED_COMMIT,
	ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
	ESHOP_WEBSPA_PROJECTION_LABEL,
	ESHOP_WEBSPA_SEED,
	eshopWebspaSeedDigest,
	replayEshopWebspaProjectionBehavior,
	type EshopWebspaProjectionLedgerRecord,
} from './angular-eshop-webspa-projection.ts';
import { angularEshopWebspaProjectionLedger } from './angular-eshop-webspa-spec.ts';
import { executeAngularEshopWebspaWitnessRun } from './real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = join(root, WITNESS_ANGULAR_ESHOP_WEBSPA_EVIDENCE_DIRECTORY);
const stageRoot = join(root, '.versionless/stage/witness-angular-eshop-webspa');
const workRoot = join(root, '.versionless/work/angular-eshop-webspa');

/**
 * The two retained outputs, exactly as the holdout lanes produced them.
 *
 * The baseline is the era lane's first of two byte-identical production builds
 * (Angular 6.1.4, `ng build --prod --aot --extract-css`, node 8.11.4); the
 * migrated is the re-frozen adapter's output (`ng build --configuration
 * production --aot`, node 16.20.2). Neither is rebuilt here.
 */
const buildOutputs = {
	baseline: join(workRoot, 'build-run1'),
	migrated: join(workRoot, 'target/app/wwwroot'),
} as const;

type Lane = 'baseline' | 'migrated';

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

async function inventory(directory: string): Promise<{ files: number; sha256: string }> {
	const paths = await files(directory);
	const entries: Array<{ path: string; sha256: string }> = [];
	for (const path of paths)
		entries.push({ path: relative(directory, path), sha256: sha256(await readFile(path)) });
	return { files: entries.length, sha256: sha256(canonicalize(entries)) };
}

/**
 * Bind the frozen projection before a browser is launched: the committed seed
 * fixture still holds the seed this code compiles against, and the transcript
 * replay still produces the frozen behavior digest that both the CLI projection
 * and the core schema pin.
 */
async function bindProjection(): Promise<string> {
	const bytes = await readFile(join(root, WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE), 'utf8');
	const committed = JSON.parse(bytes) as Record<string, unknown> & { sha256?: unknown };
	const { sha256: committedDigest, ...seed } = committed;
	const digest = eshopWebspaSeedDigest();
	if (canonicalize(seed) !== canonicalize(ESHOP_WEBSPA_SEED) || committedDigest !== digest)
		throw new Error('eShop WebSPA committed projection seed differs from the compiled seed');
	const replay = await replayEshopWebspaProjectionBehavior();
	if (
		replay.digest !== ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST ||
		replay.digest !== WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST
	)
		throw new Error('eShop WebSPA frozen projection behavior digest differs');
	if (ESHOP_WEBSPA_PROJECTION_LABEL !== WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_LABEL)
		throw new Error('eShop WebSPA projection label differs from its receipt projection');
	return digest;
}

async function stageInputs(): Promise<Record<Lane, string>> {
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(buildOutputs[lane])))
			throw new Error(`eShop WebSPA ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(buildOutputs[lane], staged[lane], { recursive: true, force: false });
	}
	return staged;
}

function ledgerEntries(
	records: readonly EshopWebspaProjectionLedgerRecord[],
): WitnessAngularEshopWebspaLedgerEntry[] {
	const tally = new Map<string, WitnessAngularEshopWebspaLedgerEntry>();
	for (const record of records) {
		if (record.decision === 'declined-non-api') continue;
		const key = canonicalize([
			record.method,
			record.pathname,
			record.endpoint,
			record.decision,
			record.status,
		]);
		const held = tally.get(key);
		if (held === undefined)
			tally.set(key, {
				method: record.method,
				pathname: record.pathname,
				endpoint: record.endpoint,
				decision: record.decision,
				status: record.status,
				count: 1,
			});
		else held.count += 1;
	}
	return [...tally.values()].sort((left, right) =>
		canonicalize(left) < canonicalize(right) ? -1 : 1,
	);
}

async function executeRuns(lanes: Record<Lane, string>): Promise<{
	runs: WitnessAngularEshopWebspaRun[];
	ledger: EshopWebspaProjectionLedgerRecord[];
}> {
	const runs: WitnessAngularEshopWebspaRun[] = [];
	let ledger: EshopWebspaProjectionLedgerRecord[] | null = null;
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = (await executeAngularEshopWebspaWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			})) as unknown as WitnessAngularEshopWebspaRun;
			if (raw.semanticDigest !== witnessAngularEshopWebspaRawDigest(raw))
				throw new Error(`eShop WebSPA ${lane} pass ${String(pass)} raw digest differs`);
			ledger ??= angularEshopWebspaProjectionLedger();
			runs.push({ ...raw, behaviorDigest: witnessAngularEshopWebspaBehaviorDigest(raw) });
		}
	for (const lane of ['baseline', 'migrated'] as const) {
		const laneRuns = runs.filter((run) => run.lane === lane);
		if (new Set(laneRuns.map((run) => run.semanticDigest)).size !== 1)
			throw new Error(`eShop WebSPA ${lane} repeated pass differs`);
	}
	if (new Set(runs.map((run) => run.behaviorDigest)).size !== 1)
		throw new Error('eShop WebSPA baseline/migrated behavior parity differs');
	return { runs, ledger: ledger ?? [] };
}

/**
 * Byte mutation on the migrated lane: locate the pager's own interpolation
 * literal in the served module, overwrite it in place with an equal-length
 * filler so no offset and no file length moves, require the journey to go red,
 * restore the original bytes, and require the restored journey to reproduce the
 * parity behavior digest.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessAngularEshopWebspaMutation> {
	const expected = Buffer.from(WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('eShop WebSPA semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const target = candidates[0];
	if (candidates.length !== 1 || target === undefined || !target.path.endsWith('.js'))
		throw new Error('eShop WebSPA semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeAngularEshopWebspaWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('eShop WebSPA semantic mutation was not exact red and byte-restored');
	const restored = (await executeAngularEshopWebspaWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as unknown as WitnessAngularEshopWebspaRun;
	const restoredBehaviorDigest = witnessAngularEshopWebspaBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('eShop WebSPA restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: WITNESS_ANGULAR_ESHOP_WEBSPA_MUTATION_SEAM,
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

export async function runWitnessAngularEshopWebspa(): Promise<WitnessAngularEshopWebspaReceipt> {
	if (
		process.env['VERSIONLESS_NETWORK_MODE'] !== 'offline' ||
		process.env['NPM_CONFIG_OFFLINE'] !== 'true'
	)
		throw new Error('eShop WebSPA Witness requires dual offline controls');
	const seedSha256 = await bindProjection();
	const laneInventory = {
		baseline: await inventory(buildOutputs.baseline),
		migrated: await inventory(buildOutputs.migrated),
	};
	const lanes = await stageInputs();
	const { runs, ledger } = await executeRuns(lanes);
	const behaviorDigest = runs[0]!.behaviorDigest;
	const mutation = await semanticMutation(lanes.migrated, behaviorDigest);
	const journey = runs[0]!['applicationJourney'] as WitnessAngularEshopWebspaReceipt['journey'];
	const entries = ledgerEntries(ledger);
	const apiRecords = ledger.filter((record) => record.decision !== 'declined-non-api').length;
	const receipt: WitnessAngularEshopWebspaReceipt = {
		schemaVersion: WITNESS_ANGULAR_ESHOP_WEBSPA_SCHEMA,
		result: 'pass',
		unit: WITNESS_ANGULAR_ESHOP_WEBSPA_UNIT,
		fixture: WITNESS_ANGULAR_ESHOP_WEBSPA_FIXTURE,
		app: WITNESS_ANGULAR_ESHOP_WEBSPA_APP,
		source: WITNESS_ANGULAR_ESHOP_WEBSPA_SOURCE,
		adapterComposite: WITNESS_ANGULAR_ESHOP_WEBSPA_ADAPTER_COMPOSITE,
		lanes: {
			baseline: {
				output: '.versionless/work/angular-eshop-webspa/build-run1',
				files: laneInventory.baseline.files,
				sha256: laneInventory.baseline.sha256,
			},
			migrated: {
				output: '.versionless/work/angular-eshop-webspa/target/app/wwwroot',
				files: laneInventory.migrated.files,
				sha256: laneInventory.migrated.sha256,
			},
		},
		projection: {
			state: 'frozen-synthetic-loopback-projection',
			label: WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_LABEL,
			pinnedCommit: ESHOP_WEBSPA_PINNED_COMMIT,
			behaviorDigest: WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
			seedSha256,
			seedFixture: WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE,
			transport: 'same-origin-bounded-loopback-api',
			identicalAcrossLanes: true,
			ledger: {
				state: 'measured-projection-ledger',
				records: ledger.length,
				apiRecords,
				served: ledger.filter((record) => record.decision === 'served').length,
				refusedUnknown: ledger.filter((record) => record.decision === 'refused-unknown')
					.length,
				refusedUnprojected: ledger.filter(
					(record) => record.decision === 'refused-unprojected',
				).length,
				declinedNonApi: ledger.filter((record) => record.decision === 'declined-non-api')
					.length,
				entries,
			},
		},
		journey,
		runs,
		parity: {
			state: 'measured-two-lane-normalized-behavior-parity',
			behaviorDigest,
			lanes: 2,
			passesPerLane: 2,
			semanticDigestsPerLane: {
				baseline: runs.find((run) => run.lane === 'baseline')!.semanticDigest,
				migrated: runs.find((run) => run.lane === 'migrated')!.semanticDigest,
			},
		},
		mutation,
		locality: { mode: 'offline', successfulNonLoopback: 0, osWideIsolation: false },
		nonclaims: [
			'This is one Angular holdout under direct Witness. It does not establish generic Angular support, a designated pilot, or readiness beyond this exact lineage cell, and it is not counted in any lineage numerator.',
			"The API this journey talks to is a frozen synthetic same-origin loopback projection authored for this fixture, NOT the eShopOnContainers .NET microservices. No captured production payload, no real catalogue, no real account and no real user data are involved, and nothing here is evidence about those services.",
			'The synthetic catalogue deliberately does not reproduce the upstream seed data, so nothing here should be read as evidence about the real catalog service or its contents.',
			'Identity is out of surface. No IdentityServer is projected, Login is never exercised, and every surface behind it — basket, orders, campaigns, the SignalR hub — is unproven rather than proven absent.',
			'Text entry and drag are not tested, because the anonymous catalog surface offers neither.',
			"The application's own test suites were not run; this is a browser proof of the journeys named above, not a substitute for the upstream suite.",
			'Locality is process-scoped and does not establish operating-system-wide isolation.',
			'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
		],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularEshopWebspaDigest(receipt);
	parseWitnessAngularEshopWebspaReceipt(receipt);
	await mkdir(evidenceDirectory, { recursive: true });
	await writeFile(join(evidenceDirectory, 'witness-journeys.json'), `${canonicalize(runs)}\n`);
	await writeFile(join(evidenceDirectory, 'witness-mutation.json'), `${canonicalize(mutation)}\n`);
	await writeFile(
		join(evidenceDirectory, 'witness-projection-ledger.json'),
		`${canonicalize({
			label: ESHOP_WEBSPA_PROJECTION_LABEL,
			pinnedCommit: ESHOP_WEBSPA_PINNED_COMMIT,
			behaviorDigest: ESHOP_WEBSPA_PROJECTION_BEHAVIOR_DIGEST,
			seedSha256,
			seedFixture: WITNESS_ANGULAR_ESHOP_WEBSPA_PROJECTION_SEED_FIXTURE,
			lane: 'baseline',
			pass: 1,
			note: 'the ordered ledger the first run wrote; the receipt digests the same records tallied by identity, because the application fires several of its mount requests concurrently and the ORDER is a property of the event loop rather than of the application',
			surfaceLimits: WITNESS_ANGULAR_ESHOP_WEBSPA_SURFACE_LIMITS,
			records: ledger,
		})}\n`,
	);
	await writeFile(join(evidenceDirectory, 'receipt.json'), `${canonicalize(receipt)}\n`);
	await writeFile(
		join(evidenceDirectory, 'receipt.md'),
		renderWitnessAngularEshopWebspaReceipt(receipt),
	);
	return receipt;
}

export async function verifyWitnessAngularEshopWebspa(
	output = evidenceDirectory,
): Promise<WitnessAngularEshopWebspaReceipt> {
	const receipt = parseWitnessAngularEshopWebspaReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessAngularEshopWebspaReceipt(receipt)
	)
		throw new Error('eShop WebSPA human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env['USER'] ?? ''))
		throw new Error('eShop WebSPA receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice')) {
		const receipt = await runWitnessAngularEshopWebspa();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0) {
		const target = args[verifyIndex + 1];
		const receipt = await verifyWitnessAngularEshopWebspa(
			target === undefined ? evidenceDirectory : resolve(root, target),
		);
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error('eShop WebSPA Witness runner requires --run-twice or --verify <dir>');
}

if (basename(process.argv[1] ?? '') === 'angular-eshop-webspa-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
