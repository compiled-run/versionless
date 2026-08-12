import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'pathe';
import { canonicalize, sha256 } from '../../../core/src/receipts/canonicalize.ts';
import {
	ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS,
	ANGULAR_TINY_TRANSLATOR_FIXTURE,
	ANGULAR_TINY_TRANSLATOR_SOURCE,
	parseWitnessAngularTinyTranslatorReceipt,
	renderWitnessAngularTinyTranslatorReceipt,
	WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA,
	WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES,
	WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES,
	witnessAngularTinyTranslatorBehaviorDigest,
	witnessAngularTinyTranslatorDigest,
	witnessAngularTinyTranslatorRawDigest,
	type WitnessAngularTinyTranslatorMutation,
	type WitnessAngularTinyTranslatorReceipt,
	type WitnessAngularTinyTranslatorRun,
} from '../../../core/src/receipts/witness-angular-tiny-translator.ts';
import {
	WITNESS_DOWNLOAD_CAPTURE_RULE,
	WITNESS_FILE_INPUT_LOAD_RULE,
} from '../../../core/src/receipts/witness-real-app.ts';
import {
	executeAngularTinyTranslatorWitnessRun,
	TINY_TRANSLATOR_MUTATION_SEAM,
	WITNESS_ANGULAR_TINY_TRANSLATOR_CONSOLE_ERRORS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FAILED_REQUESTS,
} from './real-app-run.ts';
import { verifyLinkedWitnessProvenance } from './provenance.ts';

const root = resolve(import.meta.dirname, '../../../..');
const fixtureEvidence = join(root, 'evidence/runs/angular-tiny-translator-v0-12-0');
const witnessEvidence = join(root, 'evidence/runs/witness-angular-tiny-translator-v0-12-0');
const stageRoot = join(root, '.versionless/stage/witness-angular-tiny-translator-v0-12-0');
/**
 * The migrated lane's build tree, and the output root the u17d record pins as
 * canonical. The tree is a working directory rather than committed bytes, so
 * this proof cannot assume it survived: {@link migratedLaneRoot} regenerates it
 * from the committed flow when it is absent and, either way, refuses to serve
 * it until it matches the inventory the record published.
 */
const migratedStage = join(root, '.versionless/stage/angular-tiny-translator-v0-12-0-u17b');
const sourceOutputs = {
	baseline: join(
		root,
		'.versionless/cache/angular-tiny-translator-v0-12-0-baseline/app/dist/rebuild-1',
	),
	migrated: join(migratedStage, 'dist-7'),
} as const;
/** The build the u17d record pins for the canonical output root. */
const MIGRATED_BUILD_COMMAND = 'npx ng build --configuration production' as const;
const laneFileCounts = { baseline: 524, migrated: 524 } as const;

type InventoryEntry = { path: string; sha256: string; bytes: number };

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

/** Every file of an emitted artifact, addressed exactly as the u17d record does. */
async function inventoryOf(rootDirectory: string): Promise<InventoryEntry[]> {
	const entries: InventoryEntry[] = [];
	for (const file of await files(rootDirectory)) {
		const bytes = await readFile(file);
		entries.push({
			path: relative(rootDirectory, file),
			sha256: sha256(bytes),
			bytes: bytes.length,
		});
	}
	return entries;
}

/** The pinned migrated build record, re-read rather than restated. */
async function migratedLaneRecord(): Promise<{
	inventory: InventoryEntry[];
	inventorySha256: string;
}> {
	const pinned = ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS.find(
		(receipt) => receipt.lane === 'migrated',
	);
	if (pinned === undefined) throw new Error('TinyTranslator migrated lane binding is absent');
	const bytes = await readFile(join(root, pinned.path));
	if (sha256(bytes) !== pinned.sha256)
		throw new Error(`TinyTranslator bound build receipt bytes drifted: ${pinned.path}`);
	const record = JSON.parse(bytes.toString('utf8')) as {
		inventory?: InventoryEntry[];
		determinism?: { inventorySha256?: string };
	};
	const inventory = record.inventory;
	const inventorySha256 = record.determinism?.inventorySha256;
	if (!Array.isArray(inventory) || typeof inventorySha256 !== 'string')
		throw new Error('TinyTranslator migrated lane record publishes no inventory to verify');
	return { inventory, inventorySha256 };
}

/**
 * The digest the u17d record computed over its own inventory: the pretty-printed
 * JSON array with a trailing newline, exactly as the recording flow wrote it.
 * Recomputing it here rather than accepting the record's own number is what
 * makes the comparison a check instead of a restatement.
 */
function inventoryDigest(inventory: readonly InventoryEntry[]): string {
	return sha256(`${JSON.stringify(inventory, null, 2)}\n`);
}

async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
	await new Promise<void>((settle, fail) => {
		const child = spawn(command, [...args], {
			cwd,
			stdio: 'ignore',
			env: {
				...process.env,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
			},
		});
		child.on('error', fail);
		child.on('close', (code) =>
			code === 0
				? settle()
				: fail(new Error(`TinyTranslator regeneration command failed: ${command} (${code})`)),
		);
	});
}

/**
 * The migrated lane's canonical output root, regenerated when it is missing and
 * verified either way.
 *
 * The regeneration is the same offline production build the u17d record pins,
 * run over the same staged application tree that record itemises; nothing is
 * re-migrated here, because the migration is already applied in that tree. The
 * verification is what the proof actually rests on: the emitted inventory has
 * to reproduce the record's own 524-file inventory, file for file and digest
 * for digest, and its digest has to reproduce the record's `inventorySha256`.
 * A tree that regenerated differently is refused rather than served.
 */
async function migratedLaneRoot(): Promise<string> {
	const record = await migratedLaneRecord();
	if (!(await exists(sourceOutputs.migrated))) {
		const application = join(migratedStage, 'app');
		if (!(await exists(application)))
			throw new Error(
				'TinyTranslator migrated lane cannot be regenerated: the staged application tree is absent',
			);
		const [command, ...args] = MIGRATED_BUILD_COMMAND.split(' ');
		await run(command!, [...args, '--output-path', sourceOutputs.migrated], application);
	}
	const emitted = await inventoryOf(sourceOutputs.migrated);
	const emittedDigest = inventoryDigest(emitted);
	if (canonicalize(emitted) !== canonicalize(record.inventory))
		throw new Error(
			`TinyTranslator migrated lane inventory differs from the pinned record: ${emittedDigest} against ${record.inventorySha256}`,
		);
	if (emittedDigest !== record.inventorySha256)
		throw new Error(
			`TinyTranslator migrated lane inventory digest differs: ${emittedDigest} against ${record.inventorySha256}`,
		);
	return sourceOutputs.migrated;
}

async function stageInputs(): Promise<Record<'baseline' | 'migrated', string>> {
	const migrated = await migratedLaneRoot();
	const lanes = join(stageRoot, 'lanes');
	await rm(lanes, { recursive: true, force: true });
	const staged = { baseline: join(lanes, 'baseline'), migrated: join(lanes, 'migrated') };
	const outputs = { baseline: sourceOutputs.baseline, migrated } as const;
	for (const lane of ['baseline', 'migrated'] as const) {
		if (!(await exists(outputs[lane])))
			throw new Error(`TinyTranslator ${lane} production output is absent`);
		await mkdir(dirname(staged[lane]), { recursive: true });
		await cp(outputs[lane], staged[lane], { recursive: true, force: false });
		const stagedFiles = await files(staged[lane]);
		if (stagedFiles.length !== laneFileCounts[lane])
			throw new Error(
				`TinyTranslator ${lane} lane file count differs: ${stagedFiles.length} against ${laneFileCounts[lane]}`,
			);
	}
	return staged;
}

async function executeRuns(
	lanes: Record<'baseline' | 'migrated', string>,
): Promise<WitnessAngularTinyTranslatorRun[]> {
	const runs: WitnessAngularTinyTranslatorRun[] = [];
	for (const lane of ['baseline', 'migrated'] as const)
		for (const pass of [1, 2] as const) {
			const raw = await executeAngularTinyTranslatorWitnessRun({
				lane,
				pass,
				laneRoot: lanes[lane],
				receiptRoot: join(stageRoot, 'receipts'),
			});
			const candidate = raw as WitnessAngularTinyTranslatorRun;
			if (candidate.semanticDigest !== witnessAngularTinyTranslatorRawDigest(candidate))
				throw new Error(`TinyTranslator ${lane} pass ${pass} raw digest differs`);
			runs.push({
				...candidate,
				behaviorDigest: witnessAngularTinyTranslatorBehaviorDigest(candidate),
			});
		}
	if (new Set(runs.map((entry) => entry.behaviorDigest)).size !== 1)
		throw new Error('TinyTranslator baseline/migrated behavior parity differs');
	return runs;
}

/**
 * Byte mutation on the migrated build.
 *
 * The seam is the visible label of the control that opens the file picker: a
 * string a reader sees, asserted exactly by the journey on the create-project
 * route, and the name of the very mechanism this vertical exists to exercise.
 * The uniqueness demanded here is the corpus discipline — exactly one served
 * module may carry it, exactly once — so overwriting it in place cannot be
 * absorbed by a second copy elsewhere in the bundle.
 */
async function semanticMutation(
	laneRoot: string,
	behaviorDigest: string,
): Promise<WitnessAngularTinyTranslatorMutation> {
	const expected = Buffer.from(TINY_TRANSLATOR_MUTATION_SEAM);
	const candidates: Array<{ path: string; offset: number }> = [];
	for (const path of await files(laneRoot)) {
		const bytes = await readFile(path);
		const offset = bytes.indexOf(expected);
		if (offset < 0) continue;
		if (bytes.lastIndexOf(expected) !== offset)
			throw new Error('TinyTranslator semantic seam is not unique within its file');
		candidates.push({ path, offset });
	}
	const target = candidates[0];
	if (candidates.length !== 1 || target === undefined || !target.path.endsWith('.js'))
		throw new Error('TinyTranslator semantic seam is not a single served module');
	const before = await readFile(target.path);
	const mutated = Buffer.from(before);
	Buffer.alloc(expected.length, 'X').copy(mutated, target.offset);
	const beforeSha256 = sha256(before);
	const mutatedSha256 = sha256(mutated);
	let intendedFailure = false;
	try {
		await writeFile(target.path, mutated);
		try {
			await executeAngularTinyTranslatorWitnessRun({
				lane: 'migrated',
				pass: 1,
				laneRoot,
				receiptRoot: join(stageRoot, 'mutation-receipt'),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			intendedFailure = message.includes(TINY_TRANSLATOR_MUTATION_SEAM);
		}
	} finally {
		await writeFile(target.path, before);
	}
	const afterRestoreSha256 = sha256(await readFile(target.path));
	if (!intendedFailure || afterRestoreSha256 !== beforeSha256)
		throw new Error('TinyTranslator semantic mutation was not exact red and byte-restored');
	const restored = (await executeAngularTinyTranslatorWitnessRun({
		lane: 'migrated',
		pass: 1,
		laneRoot,
		receiptRoot: join(stageRoot, 'restoration-receipt'),
	})) as WitnessAngularTinyTranslatorRun;
	const restoredBehaviorDigest = witnessAngularTinyTranslatorBehaviorDigest(restored);
	if (restoredBehaviorDigest !== behaviorDigest)
		throw new Error('TinyTranslator restored browser behavior differs');
	return {
		failure: 'witness-semantic-assertion',
		intendedFailure: true,
		lane: 'migrated',
		seam: TINY_TRANSLATOR_MUTATION_SEAM,
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

/**
 * The nonclaims this proof publishes. Each one names something a reader could
 * otherwise assume from the rest of the receipt and states plainly that it is
 * not established here.
 */
export const WITNESS_ANGULAR_TINY_TRANSLATOR_NONCLAIMS: readonly string[] = Object.freeze([
	'This is one Angular lineage under direct Witness and does not establish generic Angular, Angular CLI 1.5, `.angular-cli.json` workspaces, or `@angular-devkit/build-angular:browser` support.',
	'The Angular lineage readiness score is unchanged; this vertical is not counted before Judge audit.',
	'There is no backend and nothing was stubbed or seeded by the harness. The project the journey works on is created by the application itself, from a file this proof hands its own file input, and everything it keeps it keeps in browser local storage.',
	'The translation file handed to the page is synthetic and authored for this proof. It carries no upstream project’s strings and no third party’s translated content, and it is bound by name, length and digest so a journey cannot quietly load a different one.',
	'The file the page produced is read back by name, byte length and digest, and its content is asserted rather than published: a produced translation file is the application’s data, not this receipt’s.',
	'Neither lane ends up with the Material Icons glyphs, and the two lanes fail to get them differently. Both degradations are measured and recorded rather than masked, and neither is a regression of the migration: the font seam is answered inside the browser context so that nothing leaves the machine.',
	'Two of the four rendered-appearance probes are declared to differ across the eleven-major lift and are checked in both directions — a probe outside the declaration that differs fails the run, and a declared difference that stopped being real fails it too.',
	'Byte parity across the lanes is not claimed and is recorded separately by the bound build receipts; eleven majors of bundler produce different file names and different byte counts by construction.',
	'Neither build ships or registers a service worker. The browser context allowed registration and the application never attempted one, so the zero is the application’s own behavior rather than a policy imposed to produce it.',
	'Locality is process-scoped and does not establish operating-system-wide isolation.',
	'Receipts prove reproducibility and hash integrity, not certification, authenticity, signer identity, compliance, or an earned SLSA level.',
]);

async function bindCanonicalReceipts(): Promise<
	WitnessAngularTinyTranslatorReceipt['canonicalReceipts']
> {
	return await Promise.all(
		ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS.map(async (pinned) => {
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
					`TinyTranslator bound build receipt identity differs: ${pinned.path}`,
				);
			return { ...pinned };
		}),
	);
}

export async function runWitnessAngularTinyTranslator(): Promise<WitnessAngularTinyTranslatorReceipt> {
	if (
		process.env.VERSIONLESS_NETWORK_MODE !== 'offline' ||
		process.env.NPM_CONFIG_OFFLINE !== 'true'
	)
		throw new Error('TinyTranslator Witness requires dual offline controls');
	if (await exists(witnessEvidence))
		throw new Error('TinyTranslator Witness output collision');
	const provenance = await verifyLinkedWitnessProvenance(root);
	const canonicalReceipts = await bindCanonicalReceipts();
	const lanes = await stageInputs();
	const runs = await executeRuns(lanes);
	const mutation = await semanticMutation(lanes.migrated, runs[0]!.behaviorDigest);
	const baseline = runs.find((entry) => entry.lane === 'baseline')!;
	const migrated = runs.find((entry) => entry.lane === 'migrated')!;
	const artifacts = join(fixtureEvidence, 'witness-artifacts');
	await mkdir(artifacts, { recursive: true });
	await writeFile(join(artifacts, 'witness-journeys.json'), `${canonicalize(runs)}\n`, {
		flag: 'wx',
	});
	await writeFile(join(artifacts, 'witness-mutation.json'), `${canonicalize(mutation)}\n`, {
		flag: 'wx',
	});
	const receipt: WitnessAngularTinyTranslatorReceipt = {
		schemaVersion: WITNESS_ANGULAR_TINY_TRANSLATOR_SCHEMA,
		result: 'pass',
		fixture: ANGULAR_TINY_TRANSLATOR_FIXTURE,
		source: ANGULAR_TINY_TRANSLATOR_SOURCE,
		provenance,
		canonicalReceipts,
		runs,
		mutation,
		consoleErrors: {
			baseline: [...WITNESS_ANGULAR_TINY_TRANSLATOR_CONSOLE_ERRORS.baseline],
			migrated: [...WITNESS_ANGULAR_TINY_TRANSLATOR_CONSOLE_ERRORS.migrated],
		},
		failedRequests: {
			baseline: [...WITNESS_ANGULAR_TINY_TRANSLATOR_FAILED_REQUESTS.baseline],
			migrated: [...WITNESS_ANGULAR_TINY_TRANSLATOR_FAILED_REQUESTS.migrated],
		},
		mockedSeams: {
			baseline: [...baseline.mockedNonLoopbackSeams.category],
			migrated: [...migrated.mockedNonLoopbackSeams.category],
		},
		fontSeamDifference: WITNESS_ANGULAR_TINY_TRANSLATOR_FONT_SEAM_DIFFERENCE,
		matIconDegradations: {
			baseline: baseline.applicationJourney.matIcon,
			migrated: migrated.applicationJourney.matIcon,
		},
		renderedStyleParity: {
			state: 'measured-resolved-styles-with-declared-differences',
			probes: WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES.length,
			declaredDifferences: WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES,
			otherProbesAgree: true,
		},
		fileInput: {
			surfaces: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
			fixture: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE,
			rule: WITNESS_FILE_INPUT_LOAD_RULE,
		},
		downloads: {
			surface: WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE,
			rule: WITNESS_DOWNLOAD_CAPTURE_RULE,
			captured: runs.map((entry) => ({
				lane: entry.lane,
				pass: entry.pass,
				files: [...entry.downloadCaptures.captured],
			})),
		},
		persistence: {
			store: 'browser-local-storage',
			backend: 'none',
			stubbed: false,
			survivesOnlineReload: true,
		},
		routeShape: WITNESS_ANGULAR_TINY_TRANSLATOR_ROUTE_SHAPE,
		scrollAbsence: runs[0]!.scrollAbsence,
		accommodations: WITNESS_ANGULAR_TINY_TRANSLATOR_ACCOMMODATIONS,
		readiness: {
			angularLineage: { ready: 1, total: 4, counted: false },
			overall: { ready: 3, total: 12 },
		},
		locality: {
			mode: 'offline',
			successfulNonLoopback: 0,
			osWideIsolation: false,
			mockedNonLoopbackSeams: migrated.mockedNonLoopbackSeams.category.length,
		},
		nonclaims: [...WITNESS_ANGULAR_TINY_TRANSLATOR_NONCLAIMS],
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	receipt.integrity.canonicalDigest = witnessAngularTinyTranslatorDigest(receipt);
	parseWitnessAngularTinyTranslatorReceipt(receipt);
	await mkdir(witnessEvidence, { recursive: true });
	const canonical = canonicalize(receipt);
	/**
	 * The companion is rendered from the receipt as PUBLISHED rather than from
	 * the object in memory: canonicalization sorts keys, so a companion rendered
	 * from the in-memory object would disagree with the same companion rendered
	 * from the file, and `verify` — which only ever has the file — would be
	 * right to reject it.
	 */
	const published = parseWitnessAngularTinyTranslatorReceipt(JSON.parse(canonical));
	await writeFile(join(witnessEvidence, 'receipt.json'), `${canonical}\n`, { flag: 'wx' });
	await writeFile(
		join(witnessEvidence, 'receipt.md'),
		renderWitnessAngularTinyTranslatorReceipt(published),
		{ flag: 'wx' },
	);
	return published;
}

export async function verifyWitnessAngularTinyTranslator(
	output = witnessEvidence,
): Promise<WitnessAngularTinyTranslatorReceipt> {
	const expectedProvenance = await verifyLinkedWitnessProvenance(root);
	const receipt = parseWitnessAngularTinyTranslatorReceipt(
		JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
	);
	if (canonicalize(receipt.provenance) !== canonicalize(expectedProvenance))
		throw new Error('TinyTranslator linked Witness provenance differs');
	for (const bound of receipt.canonicalReceipts)
		if (sha256(await readFile(join(root, bound.path))) !== bound.sha256)
			throw new Error(`TinyTranslator bound build receipt bytes drifted: ${bound.path}`);
	if (
		(await readFile(join(output, 'receipt.md'), 'utf8')) !==
		renderWitnessAngularTinyTranslatorReceipt(receipt)
	)
		throw new Error('TinyTranslator human Witness receipt differs');
	const serialized = canonicalize(receipt);
	if (serialized.includes(root) || serialized.includes(process.env.USER ?? ''))
		throw new Error('TinyTranslator receipt leaks host identity');
	return receipt;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const publishIndex = args.indexOf('--publish');
	const verifyIndex = args.indexOf('--verify');
	if (args.includes('--run-twice') && publishIndex >= 0 && args[publishIndex + 1]) {
		const output = resolve(root, args[publishIndex + 1]!);
		if (output !== witnessEvidence) throw new Error('TinyTranslator publish path differs');
		const receipt = await runWitnessAngularTinyTranslator();
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	if (verifyIndex >= 0 && args[verifyIndex + 1]) {
		const receipt = await verifyWitnessAngularTinyTranslator(
			resolve(root, args[verifyIndex + 1]!),
		);
		process.stdout.write(
			`${canonicalize({ result: receipt.result, digest: receipt.integrity.canonicalDigest })}\n`,
		);
		return;
	}
	throw new Error(
		'TinyTranslator Witness runner requires --run-twice --publish <dir> or --verify <dir>',
	);
}

if (basename(process.argv[1] ?? '') === 'angular-tiny-translator-run.ts')
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
