/**
 * TinyTranslator Witness calibration — the RED record.
 *
 * The u19d unit set out to calibrate four uncalibrated journey facts and then
 * publish the browser proof. The calibration pass answered a prior question
 * instead: neither lane behaves the way the Witness schema assumes, and the
 * migrated lane does not run in a browser at all. A break across the
 * eleven-major lift is evidence, and evidence is recorded before anything else
 * is attempted — so this driver measures the break rather than describing it,
 * and publishes what it measured.
 *
 * Everything below is measured in this process: the two browser passes are run
 * here, their page errors, console messages and requests are read back out of
 * the runner's own receipts, and the byte-level facts are read out of the two
 * pinned output roots. The only pinned inputs are the roots themselves and the
 * bound build record whose inventory digest is re-derived to prove that the
 * tree measured IS the tree that record published.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'pathe';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { canonical } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { executeAngularTinyTranslatorWitnessRun } from '../witness/real-app-run.ts';

const root = resolve(import.meta.dirname, '../../../..');
export const EVIDENCE_DIRECTORY = join(root, 'evidence/runs/angular-tiny-translator-v0-12-0');
export const WITNESS_RED_FILE = 'u19d-witness-calibration-red.json';
const BOUND_MIGRATED_RECORD = 'u17d-final-green-lane.json';
const stage = join(root, '.versionless/stage/witness-angular-tiny-translator-calibrate');
const laneRoots = {
	baseline: join(
		root,
		'.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app/dist/rebuild-1',
	),
	migrated: join(root, '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/dist-7'),
} as const;
/** The placeholder the ephemeral loopback origin is normalized to. */
const ORIGIN_PLACEHOLDER = '{production-static-origin}';
/**
 * The era build's registration argument, unsubstituted. The upstream project
 * replaces `%BASE_HREF%` in a separate `replace` npm script that `ng build
 * --prod` alone never runs, so the AOT factory carries the placeholder itself.
 */
const ERA_SERVICE_WORKER_SCRIPT = '%BASE_HREF%ngsw-worker.js';
/**
 * The statement that kills the migrated bundle. `util@0.12.5` — the browser
 * implementation of the Node core module, declared for `ngx-i18nsupport-lib` by
 * the u17c capability and recorded as a standing risk by the bound u17d record
 * — reads `process.env.NODE_DEBUG` at module evaluation time.
 */
const MIGRATED_PROCESS_STATEMENT = 'if(process.env';

type LaneName = 'baseline' | 'migrated';

type PageObservation = {
	/** The ephemeral loopback origin this pass ran on, normalized out of everything. */
	origin: string;
	booted: boolean;
	pageErrors: string[];
	consoleErrors: string[];
	requests: Array<{ status: number | null; url: string; failedReason: string | null }>;
};

async function files(directory: string): Promise<string[]> {
	const output: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) output.push(...(await files(path)));
		else if (entry.isFile()) output.push(path);
	}
	return output.sort();
}

/** The inventory the bound record addresses, recomputed rather than restated. */
async function inventoryDigestOf(rootDirectory: string): Promise<{
	files: number;
	digest: string;
}> {
	const inventory: Array<{ path: string; sha256: string; bytes: number }> = [];
	for (const file of await files(rootDirectory)) {
		const bytes = await readFile(file);
		inventory.push({
			path: relative(rootDirectory, file),
			sha256: sha256(bytes),
			bytes: bytes.length,
		});
	}
	return {
		files: inventory.length,
		digest: sha256(`${JSON.stringify(inventory, null, 2)}\n`),
	};
}

/** Every served module carrying a needle, with the offset it carries it at. */
async function needleSites(
	rootDirectory: string,
	needle: string,
): Promise<Array<{ path: string; sha256: string; bytes: number; offset: number; count: number }>> {
	const sites: Array<{
		path: string;
		sha256: string;
		bytes: number;
		offset: number;
		count: number;
	}> = [];
	const target = Buffer.from(needle);
	for (const file of await files(rootDirectory)) {
		const bytes = await readFile(file);
		const offset = bytes.indexOf(target);
		if (offset < 0) continue;
		let count = 0;
		for (let at = offset; at >= 0; at = bytes.indexOf(target, at + 1)) count += 1;
		sites.push({
			path: relative(rootDirectory, file),
			sha256: sha256(bytes),
			bytes: bytes.length,
			offset,
			count,
		});
	}
	return sites;
}

/** The runner's own receipt for a single attempted pass. */
async function readPassReceipt(receiptRoot: string, lane: LaneName): Promise<PageObservation> {
	const passDirectory = join(receiptRoot, 'angular-tiny-translator', lane, 'pass-1');
	const runs = (await readdir(passDirectory, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const runId = runs[runs.length - 1];
	if (runId === undefined) throw new Error(`TinyTranslator ${lane} pass wrote no receipt`);
	const receipt = JSON.parse(
		await readFile(join(passDirectory, runId, 'receipt.json'), 'utf8'),
	) as {
		boxes?: Array<{
			pages?: Array<{
				url?: string;
				pageErrors?: Array<{ message?: string }>;
				consoleMessages?: Array<{ level?: string; text?: string }>;
				networkRequests?: Array<{ status?: number; url?: string; failedReason?: string }>;
			}>;
		}>;
	};
	const page = receipt.boxes?.[0]?.pages?.[0];
	const requests = page?.networkRequests ?? [];
	const [scheme, , authority] = (page?.url ?? '').split('/');
	const origin = `${scheme ?? ''}//${authority ?? ''}`;
	const normalize = (value: string): string => value.split(origin).join(ORIGIN_PLACEHOLDER);
	return {
		origin,
		booted: (page?.pageErrors ?? []).length === 0,
		pageErrors: (page?.pageErrors ?? []).map((entry) => normalize(entry.message ?? '')),
		consoleErrors: (page?.consoleMessages ?? [])
			.filter((entry) => entry.level === 'error')
			.map((entry) => normalize(entry.text ?? '')),
		requests: requests.map((entry) => ({
			status: entry.status ?? null,
			url: normalize(entry.url ?? ''),
			failedReason: entry.failedReason ?? null,
		})),
	};
}

/** One calibration pass per lane, against a staged copy of the pinned root. */
async function measureLane(
	lane: LaneName,
): Promise<{ refusal: string; observation: Omit<PageObservation, 'origin'> }> {
	const laneRoot = join(stage, 'lanes', lane);
	const receiptRoot = join(stage, 'receipts', lane);
	await rm(laneRoot, { recursive: true, force: true });
	await rm(receiptRoot, { recursive: true, force: true });
	await mkdir(laneRoot, { recursive: true });
	await cp(laneRoots[lane], laneRoot, { recursive: true });
	let refusal = '';
	try {
		await executeAngularTinyTranslatorWitnessRun({ lane, pass: 1, laneRoot, receiptRoot });
	} catch (error) {
		refusal = (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '';
	}
	const { origin, ...observation } = await readPassReceipt(receiptRoot, lane);
	return {
		refusal: refusal.split(root).join('{repository-root}').split(origin).join(ORIGIN_PLACEHOLDER),
		observation,
	};
}

export async function buildWitnessRedRecord(): Promise<SealedRecord> {
	const baseline = await measureLane('baseline');
	const migrated = await measureLane('migrated');
	const boundBytes = await readFile(join(EVIDENCE_DIRECTORY, BOUND_MIGRATED_RECORD));
	const bound = JSON.parse(boundBytes.toString('utf8')) as {
		digest?: string;
		determinism?: { inventorySha256?: string };
	};
	const migratedInventory = await inventoryDigestOf(laneRoots.migrated);
	const baselineInventory = await inventoryDigestOf(laneRoots.baseline);
	const processSites = await needleSites(laneRoots.migrated, MIGRATED_PROCESS_STATEMENT);
	const registrationSites = await needleSites(laneRoots.baseline, ERA_SERVICE_WORKER_SCRIPT);
	const shippedWorkers = (await files(laneRoots.baseline))
		.map((file) => relative(laneRoots.baseline, file))
		.filter((path) => path.includes('ngsw'));
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-witness-red.v1',
		unit: 'u19d-tiny-translator-calibrate-publish',
		result: 'witness-calibration-red-migrated-lane-does-not-boot',
		meaning:
			'The calibration pass this unit opened with answered a question that comes before its four uncalibrated facts. The migrated production build — the exact tree the bound u17d record published — throws before Angular bootstraps and renders nothing at all, and the era build attempts a service-worker registration the Witness schema says neither build attempts. Neither lane can be published as a passing browser proof, so nothing was published. This record is the refusal, with the measurements it rests on.',
		measuredBy:
			'one Witness pass per lane, executed by the same runner the proof would have used, against staged copies of the two pinned output roots; page errors, console errors and requests read back out of the runner own per-pass receipts, with the ephemeral loopback origin normalized to a placeholder',
		pinnedRoots: {
			baseline: {
				root: 'evidence-bound era lane canonical root dist/rebuild-1',
				files: baselineInventory.files,
				inventorySha256: baselineInventory.digest,
			},
			migrated: {
				root: 'evidence-bound migrated lane canonical root dist-7',
				files: migratedInventory.files,
				inventorySha256: migratedInventory.digest,
				boundRecord: BOUND_MIGRATED_RECORD,
				boundRecordDigest: bound.digest ?? null,
				boundRecordSha256: sha256(boundBytes),
				boundInventorySha256: bound.determinism?.inventorySha256 ?? null,
				// The point of recomputing it: the tree that failed to boot is the
				// tree that record published, not a stale or re-run build.
				isTheBoundArtifact: migratedInventory.digest === bound.determinism?.inventorySha256,
			},
		},
		findings: [
			{
				id: 'migrated-lane-does-not-boot',
				lane: 'migrated',
				severity: 'red',
				kind: 'runtime-only migration regression, invisible to both build lanes',
				observed: {
					booted: migrated.observation.booted,
					pageErrors: migrated.observation.pageErrors,
					consoleErrors: migrated.observation.consoleErrors,
					requests: migrated.observation.requests,
					refusal: migrated.refusal,
				},
				byteEvidence: {
					needle: MIGRATED_PROCESS_STATEMENT,
					sites: processSites,
				},
				cause: 'ngx-i18nsupport-lib — the library that parses the translation files this application exists to edit — requires the Node core module `util`. The era webpack 3 build supplied both that module and a `process` shim automatically. The migrated lane declares `util@0.12.5` (the u17c node-core-module capability) but nothing supplies `process`, and `util` reads `process.env.NODE_DEBUG` at module evaluation time, so the main bundle throws before Angular bootstraps.',
				consequence:
					'The migrated lane renders nothing. No journey can pass on it truthfully, so the FileReader parity arbitration this vertical was built to perform cannot be attempted: the parse path is behind a bundle that never evaluates.',
				alreadyRecordedAsRisk:
					'The bound u17d record carries this exact dependency as a recorded risk — "`util@0.12.5`, the browser implementation of the Node core module, remains in the declared closure for ngx-i18nsupport-lib". This unit measures what that risk does in a browser.',
				notFixedHere:
					'The fix belongs to the migration capability that declares the shim, which is outside this unit file contract, and it invalidates the bound build record. Nothing was patched, masked or worked around here.',
			},
			{
				id: 'era-lane-registers-a-service-worker',
				lane: 'baseline',
				severity: 'red',
				kind: 'schema premise contradicted by measurement',
				observed: {
					booted: baseline.observation.booted,
					pageErrors: baseline.observation.pageErrors,
					consoleErrors: baseline.observation.consoleErrors,
					requests: baseline.observation.requests,
					refusal: baseline.refusal,
				},
				byteEvidence: {
					needle: ERA_SERVICE_WORKER_SCRIPT,
					sites: registrationSites,
					shippedServiceWorkerFiles: shippedWorkers,
				},
				cause: 'The era production build was emitted with the service worker enabled, and its AOT factory carries the registration argument `%BASE_HREF%ngsw-worker.js` with the placeholder unsubstituted: upstream substitutes it in a separate `replace` npm script that `ng build --prod` alone never runs. The build also ships no worker script at any path, so the registration could not have succeeded even with the placeholder resolved.',
				consequence:
					'Three published premises are contradicted at once: the zero-service-worker policy the runner executes this application under, the empty baseline console-error inventory, and the nonclaim that neither build registers a service worker and that the zero is the application own behavior. The application does attempt one, and it fails.',
				notFixedHere:
					'This finding is calibratable — the attempt, its failure and its two console errors could all be pinned exactly — but calibrating it would publish a lane pair whose other half does not boot. It is recorded and left uncalibrated.',
			},
		],
		uncalibratedFacts: [
			{
				fact: 'TINY_TRANSLATOR_JOURNEY_NAVIGATIONS',
				state: 'unmeasurable',
				why: 'the journey never reaches its clean-page assertion in either lane',
			},
			{
				fact: 'per-lane console-error inventories',
				state: 'partially-measured',
				why: 'the era lane measured two errors, both consequences of the failed service-worker registration; the migrated lane measured a page error and no console error, because nothing after the throw ran',
			},
			{
				fact: 'scroll absence',
				state: 'unmeasurable',
				why: 'no stage of the journey is reached in either lane',
			},
			{
				fact: 'Material 5-vs-16 selector viability',
				state: 'unmeasurable',
				why: 'the migrated lane renders no DOM to select against, and the era lane refuses before its first selector',
			},
		],
		notEstablished: [
			'Nothing here establishes that the migrated build is wrong in any other respect. Its build lanes are green and deterministic and that record stands unchanged; what is established is that the artifact those lanes emitted does not run in a browser.',
			'No claim is made about how many other failures lie behind the boot failure. One throw was measured, and a bundle that throws at evaluation hides everything after it.',
			'The era lane was refused at its first checkpoint, so nothing is established about the rest of its journey either.',
			'No Witness receipt was published for this vertical, and the readiness tallies are unchanged and uncounted.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildWitnessRedRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(join(EVIDENCE_DIRECTORY, WITNESS_RED_FILE), canonical(record));
	process.stdout.write(
		`witness calibration ${String(record['result'])}, digest ${String(record['digest']).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-witness-red-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
