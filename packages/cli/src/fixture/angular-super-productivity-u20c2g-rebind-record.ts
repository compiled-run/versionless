/**
 * The record that rebinds the migrated super-productivity lane from u23's
 * dist-23 to the clean dist-25 the u20c2e round assembled and rebuilt.
 *
 * u23 built the offline-faithful lane before the template-binding-reorder
 * existed. Its dist-23/dist-24 bytes are immutable and it stays the record of
 * the offline font seam. But the lane it bound throws the split regression once
 * per load — the `<split>` element binds `splitPos` before its two element
 * inputs, so under Ivy the position setter runs against undefined elements and
 * the work view throws `addClass` on undefined — a defect a green build cannot
 * report and u20c2e measured in a browser against these very roots. This record
 * binds dist-25 instead: the same offline, font-inliner-disabled lane, rebuilt
 * from a tree carrying the reorder, deterministic modulo the service-worker
 * clock across dist-25 and dist-26, with the fix landing in the booting bytes.
 *
 * Every number here is read at the moment the record is written: the two
 * emitted inventories u20c2e's rebuild produced (dist-25 and dist-26, still on
 * disk), the superseded dist-23 inventory u23 published, the two service-worker
 * manifests, the emitted document, and the compiled `<split>` property order in
 * the emitted application chunk. The regression-gone fact is not re-measured
 * here; it is carried by reference from the u20c2e behavior proof, bound by that
 * record's digest and the sha256 of its exact bytes. No witness work is done in
 * this round and none is claimed: the deliverable is the rebound build lane and
 * the record of it, and the browser proof for this vertical resumes against
 * these bytes.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	inventoryOf,
	sealRecord,
	verifySealedRecord,
	type DistEntry,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT, EVIDENCE_DIRECTORY } from './angular-super-productivity-lanes-run.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import {
	fontFaceRules,
	linkHrefs,
	logicalNameOf,
} from './angular-super-productivity-u23-font-record.ts';
import { readReorderInBundle } from './angular-super-productivity-u20c2e-rebuild-run.ts';

export const UNIT = 'lrapr-t006/u20c2g-rebind-dist25';
/** The clean lane the u20c2e round built; u23's dist-23/dist-24 stay untouched. */
export const CANONICAL_ROOT = 'dist-25';
export const REPEATED_ROOT = 'dist-26';
/** The lane this record supersedes as the bound migrated lane, kept on disk. */
export const SUPERSEDED_ROOT = 'dist-23';
export const SUPERSEDED_RECORD = 'u23-offline-font-lane.json';
/** The behavior proof this record carries the regression-gone fact from. */
export const BEHAVIOR_RECORD = 'u20c2e-assemble-rebuild-behavior.json';
export const REBIND_LANE_FILE = 'u20c2g-dist25-rebind-lane.json';

const SCHEMA_VERSION = 'versionless.angular-super-productivity-dist25-rebind-lane.v1';

/** An inventory as a path → digest map, for set comparisons. */
function digestsOf(inventory: readonly DistEntry[]): ReadonlyMap<string, string> {
	return new Map(inventory.map((entry) => [entry.path, entry.sha256]));
}

type BehaviorRecord = Readonly<{
	digest: string;
	applicationFilesChanged: Readonly<{
		scanned: number;
		changed: number;
		reorderFile: string;
		reorderChanges: readonly string[];
	}>;
	build: Readonly<{
		builds: readonly Readonly<{ name: string; outputRoot: string; exitStatus: number; egressAttempts: number }>[];
	}>;
	behavior: Readonly<{
		route: string;
		control: Readonly<{ root: string; status: string; pageErrors: number; splitConsoleErrors: number }>;
		migrated: Readonly<{ root: string; status: string; pageErrors: number; splitConsoleErrors: number }>;
		regression: Readonly<{ site: string; priorPageErrorsPerLoad: number; meaning: string }>;
	}>;
}>;

export async function buildRebindLaneRecord(): Promise<SealedRecord> {
	const first = await inventoryOf(path.join(STAGE_DIRECTORY, CANONICAL_ROOT));
	const second = await inventoryOf(path.join(STAGE_DIRECTORY, REPEATED_ROOT));
	const superseded = await inventoryOf(path.join(STAGE_DIRECTORY, SUPERSEDED_ROOT));
	const identical = canonical(first) === canonical(second);
	const firstDigests = digestsOf(first);
	const secondDigests = digestsOf(second);
	const supersededDigests = digestsOf(superseded);
	const differingAcrossRuns = first
		.filter((entry) => secondDigests.get(entry.path) !== entry.sha256)
		.map((entry) => entry.path);

	/**
	 * The two runs' service-worker manifests, compared key by key, because
	 * "deterministic modulo a clock field" is a claim about which key moved and
	 * has to be read rather than asserted.
	 */
	const manifestOf = async (root: string): Promise<Readonly<Record<string, unknown>>> =>
		JSON.parse(await readFile(path.join(STAGE_DIRECTORY, root, 'ngsw.json'), 'utf8')) as Readonly<
			Record<string, unknown>
		>;
	const firstManifest = await manifestOf(CANONICAL_ROOT);
	const secondManifest = await manifestOf(REPEATED_ROOT);
	const manifestKeysDiffering = [
		...new Set([...Object.keys(firstManifest), ...Object.keys(secondManifest)]),
	]
		.filter((key) => canonical(firstManifest[key]) !== canonical(secondManifest[key]))
		.sort();
	const manifestHashTableIdentical =
		canonical(firstManifest['hashTable']) === canonical(secondManifest['hashTable']);
	const deterministicModuloClock =
		differingAcrossRuns.length === 0 ||
		(canonical(differingAcrossRuns) === canonical(['ngsw.json']) &&
			canonical(manifestKeysDiffering) === canonical(['timestamp']));

	// Census against the lane this record supersedes.
	const namesUnchanged = [...firstDigests.keys()].filter((name) => supersededDigests.has(name));
	const changedAgainstSuperseded = namesUnchanged.filter(
		(name) => firstDigests.get(name) !== supersededDigests.get(name),
	);
	const logical = (inventory: readonly DistEntry[]): readonly string[] =>
		Object.freeze([...new Set(inventory.map((entry) => logicalNameOf(entry.path)))].sort());
	const logicalNow = logical(first);
	const logicalThen = logical(superseded);
	const censusHolds =
		first.length === superseded.length && canonical(logicalNow) === canonical(logicalThen);

	// The emitted document's font seam, re-measured on dist-25.
	const sourceIndex = await readFile(path.join(APPLIED_TREE, 'src/index.html'), 'utf8');
	const emittedIndex = await readFile(
		path.join(STAGE_DIRECTORY, CANONICAL_ROOT, 'index.html'),
		'utf8',
	);
	const isFontHost = (href: string): boolean => href.includes('fonts.googleapis.com');
	const emittedFontLinks = linkHrefs(emittedIndex).filter(isFontHost);
	const sourceFontLinks = linkHrefs(sourceIndex).filter(isFontHost);
	const unescaped = (href: string): string => href.split('&amp;').join('&');
	const emittedFontLinksMatchSource =
		canonical(emittedFontLinks.map(unescaped)) === canonical([...sourceFontLinks]);
	const eraFaithfulSeam =
		fontFaceRules(emittedIndex) === 0 && emittedFontLinksMatchSource && sourceFontLinks.length > 0;

	// The worker chunks, carried across from u23's own emission points.
	const supersededRecord = JSON.parse(
		await readFile(path.join(EVIDENCE_DIRECTORY, SUPERSEDED_RECORD), 'utf8'),
	) as Readonly<{ workerChunks: Readonly<{ emitted: readonly string[] }> }>;
	const workerPoints = new Set(supersededRecord.workerChunks.emitted.map(logicalNameOf));
	const workerChunks = first
		.filter((entry) => workerPoints.has(logicalNameOf(entry.path)))
		.map((entry) => entry.path);

	// The reorder fix, read out of the emitted application chunk.
	const reorder = await readReorderInBundle(CANONICAL_ROOT);

	// The regression-gone fact, carried by reference from the u20c2e behavior proof.
	const behaviorBytes = await readFile(path.join(EVIDENCE_DIRECTORY, BEHAVIOR_RECORD));
	const behavior = JSON.parse(behaviorBytes.toString('utf8')) as BehaviorRecord;
	const egressFree = behavior.build.builds.every((build) => build.egressAttempts === 0);
	const green = behavior.build.builds.every((build) => build.exitStatus === 0);

	// The lane this record supersedes, bound by the sha256 of its exact bytes.
	const supersededBytes = await readFile(path.join(EVIDENCE_DIRECTORY, SUPERSEDED_RECORD));
	const supersededParsed = JSON.parse(supersededBytes.toString('utf8')) as Readonly<{
		digest: string;
		unit: string;
	}>;

	return sealRecord({
		schemaVersion: SCHEMA_VERSION,
		unit: UNIT,
		consentId: CONSENT,
		result:
			green &&
			egressFree &&
			deterministicModuloClock &&
			eraFaithfulSeam &&
			censusHolds &&
			reorder.positionLast &&
			behavior.behavior.migrated.pageErrors === 0
				? 'migrated-lane-rebound-to-dist25-reorder-in-the-booting-bytes-regression-gone-offline-green-deterministic-modulo-the-clock'
				: 'migrated-lane-rebind-did-not-come-back-clean',
		meaning:
			'The migrated lane u23 bound (dist-23) is immutable and stays the record of the offline ' +
			'font seam, but it lacks the template-binding-reorder and throws the split regression once ' +
			'per load: the `<split>` element binds `splitPos` before its two element inputs, so under ' +
			'Ivy the position setter runs against undefined elements and the work view throws `addClass` ' +
			'on undefined — a defect a green build cannot report, measured in a browser by u20c2e against ' +
			'dist-23 and dist-25 on the same host and day. This record rebinds the migrated lane to ' +
			'dist-25: the u20c2e round assembled the migrated tree with the reorder in it, disabled the ' +
			'Angular 16 font inliner with u23\'s capability, and rebuilt twice under the offline egress ' +
			'guard into dist-25 and dist-26. The two builds make no egress attempt, are green, emit the ' +
			'same 62-artifact worker-complete census u23 measured, and agree with each other file for ' +
			'file except the one clock field in the generated service-worker manifest. The compiled ' +
			'`<split>` property order in the emitted application chunk sets both element inputs before ' +
			'the position input, so the fix survives the compiler into the booting bytes, and the emitted ' +
			'document links the same Roboto stylesheet with nothing inlined, exactly as the era build ' +
			'emitted it.',
		supersedes: {
			record: SUPERSEDED_RECORD,
			unit: supersededParsed.unit,
			by: 'reference',
			bytesSha256: sha256(supersededBytes),
			digest: supersededParsed.digest,
			canonicalRoot: SUPERSEDED_ROOT,
			why:
				"u23's dist-23/dist-24 bytes are unchanged and it stays the migrated lane's record of the " +
				'offline font seam: the font inliner off, the era `<link>` restored, and zero egress ' +
				'across two green builds under a process-scoped guard. What it could not see is that the ' +
				'lane it bound throws the split regression once per load, because the reorder fix did not ' +
				'exist when it built. This record replaces it as the bound migrated lane, because dist-25 ' +
				'is the lane whose bytes carry the fix and load clean.',
			carriesForward:
				'The font-inlining-disable capability, the era-faithful font seam, the offline egress ' +
				'guard and the 62-artifact worker-complete census are all carried forward — re-measured ' +
				'here against dist-25/dist-26 rather than asserted from u23. The manual-migration bill and ' +
				'the accommodation payload u18h recorded are untouched and un-re-measured by this round.',
		},
		regressionGone: {
			state: 'measured-in-a-browser-by-the-u20c2e-behavior-proof-carried-here-by-reference',
			boundTo: {
				record: `evidence/runs/angular-super-productivity-v2-13-15/${BEHAVIOR_RECORD}`,
				digest: behavior.digest,
				bytesSha256: sha256(behaviorBytes),
			},
			route: behavior.behavior.route,
			control: {
				root: behavior.behavior.control.root,
				pageErrors: behavior.behavior.control.pageErrors,
				splitConsoleErrors: behavior.behavior.control.splitConsoleErrors,
			},
			migrated: {
				root: behavior.behavior.migrated.root,
				pageErrors: behavior.behavior.migrated.pageErrors,
				splitConsoleErrors: behavior.behavior.migrated.splitConsoleErrors,
			},
			site: behavior.behavior.regression.site,
			reading:
				'The control lane (dist-23, no reorder) still throws the recorded addClass-on-undefined ' +
				'once per load; the bound lane rebuilt here (dist-25, reorder) loads with zero page errors ' +
				'and none of the split console errors. Same host, same day: a clean control would have ' +
				'meant the host measured nothing. This record does not re-run the browser; it carries the ' +
				'u20c2e proof by reference and binds it by digest and byte sha256.',
		},
		reorderInBundle: {
			state: reorder.positionLast
				? 'measured-position-input-bound-after-both-element-inputs'
				: 'measured-position-input-not-last',
			mainChunk: reorder.mainChunk,
			splitTopEl: reorder.splitTopEl,
			splitBottomEl: reorder.splitBottomEl,
			splitPos: reorder.splitPos,
			positionLast: reorder.positionLast,
			reading:
				'Read from the emitted application chunk: the compiled `<split>` property instructions set ' +
				'`splitTopEl` and `splitBottomEl` before `splitPos`, so under Ivy the position setter runs ' +
				'after both elements are populated. The fix is a template-order fact and it survives the ' +
				'compiler into the booting bytes.',
		},
		applicationFilesChanged: {
			scanned: behavior.applicationFilesChanged.scanned,
			changed: behavior.applicationFilesChanged.changed,
			reorderFile: behavior.applicationFilesChanged.reorderFile,
			reorderChanges: behavior.applicationFilesChanged.reorderChanges,
			note:
				'The template-binding-reorder is among the migrated application-source changes carried ' +
				'into this lane: the `<split>` element in work-view-page.component.html binds its two ' +
				'element inputs before the position input, which is the source form of the fix read out ' +
				'of the booting bytes above. The counts are u20c2e\'s scan of the assembled tree, carried ' +
				'by reference.',
		},
		builds: behavior.build.builds,
		egressFree,
		determinism: {
			claim:
				'build-25 and build-26 ran the same command over the same bytes with no edit between ' +
				'them, each into a cleaned output directory, under the same egress guard u23 used.',
			runs: 2,
			identical,
			files: first.length,
			differingAcrossRuns,
			inventorySha256: sha256(canonical(first)),
			deterministicModuloClock,
			verdict:
				differingAcrossRuns.length === 0
					? 'Byte-identical across both runs.'
					: `Deterministic modulo ${differingAcrossRuns.join(', ')}, ` +
						`which differs in ${manifestKeysDiffering.join(', ')} and nothing else.`,
			manifestKeysDiffering,
			manifestHashTableIdentical,
			ngswClockField:
				'ngsw.json is the file that differs, and it was compared key by key rather than by hash. ' +
				"The generated manifest stamps the build's wall clock into `timestamp`; that is the only " +
				'key whose value moved, and the hashTable — every emitted file with its digest, worker ' +
				'chunks included — is identical between the two runs.',
			sassRandomFiles:
				"None differed BETWEEN this lane's two runs, which is what u18i, u18j and u23 also saw " +
				'and is not a claim that the era Sass `random()` instability cannot appear. The main chunk ' +
				'this lane emits differs from the one u23 emitted for two reasons at once — the reorder ' +
				'moves the compiled `<split>` property calls and the unseeded confetti keyframe moves its ' +
				'box-shadow literals — so the content hash moved and the file is renamed, reported under ' +
				'`census` rather than hidden.',
		},
		artifactsEmitted: first.length,
		canonicalRoot: CANONICAL_ROOT,
		repeatedRoot: REPEATED_ROOT,
		inventory: first,
		census: {
			claim:
				'The 62-artifact census u23 published is re-verified in the rebound dist, by logical name ' +
				'and by count, and every file whose bytes moved is named.',
			method:
				"u18j's own elision: every `.<hex>` segment of at least eight digits removed from a file " +
				'name wherever it appears, so that a chunk and its map are both recognised across a moved ' +
				'content hash.',
			supersededRoot: SUPERSEDED_ROOT,
			supersededFiles: superseded.length,
			rebuiltFiles: first.length,
			logicalNames: logicalNow.length,
			logicalNamesMatchSuperseded: canonical(logicalNow) === canonical(logicalThen),
			censusHolds,
			byteIdenticalToSuperseded: namesUnchanged.length - changedAgainstSuperseded.length,
			changedAgainstSuperseded,
			renamedAgainstSuperseded: {
				gone: [...supersededDigests.keys()].filter((name) => !firstDigests.has(name)).sort(),
				new: [...firstDigests.keys()].filter((name) => !supersededDigests.has(name)).sort(),
			},
			reading:
				'62 files in dist-23, 62 files in dist-25, the same set of logical names. index.html and ' +
				'ngsw.json changed bytes under an unchanged name — the document names the moved main chunk ' +
				'and the manifest lists the digests of everything else — and the main chunk and its map are ' +
				'renamed under a moved content hash. Everything else is byte-identical to the lane u23 ' +
				'bound, worker chunks included.',
		},
		workerChunks: {
			claim:
				'Both web worker chunks survive the rebind, byte-identical to the ones u23 bound, still in ' +
				'the emitted inventory.',
			emitted: workerChunks,
			byteIdenticalToSuperseded: workerChunks.every(
				(file) => firstDigests.get(file) === supersededDigests.get(file),
			),
			supersededEmitted: supersededRecord.workerChunks.emitted,
		},
		document: {
			state: 'measured-era-faithful-font-seam',
			sourceIndex: 'src/index.html',
			sourceFontLinks,
			emittedIndex: `${CANONICAL_ROOT}/index.html`,
			emittedFontLinks,
			emittedFontLinksMatchSource,
			inlinedFontFaceRules: fontFaceRules(emittedIndex),
			preconnectEmitted: emittedIndex.includes('rel="preconnect"'),
			reading:
				"The emitted document links the same Roboto stylesheet the application's own source links, " +
				'and carries no `@font-face` rule and no preconnect the builder minted — the same era-' +
				'faithful seam u23 restored, re-measured here on dist-25.',
		},
		notEstablished: [
			'The regression-gone fact is not re-measured here. It is the u20c2e behavior proof, carried ' +
				'by reference and bound by that record\'s digest and byte sha256; nothing in this round ' +
				'loads a browser.',
			'No witness journey was run in this round by design. Whether the application runs, mounts or ' +
				'keeps what a user types is not established here — that is the bound browser proof this ' +
				'lane is the input to.',
			'The offline egress facts are u20c2e\'s, read from its build record. This round re-reads the ' +
				'emitted trees; it did not itself run the two builds under the guard.',
			'The era lane was not rebuilt, re-measured or touched by this round.',
		],
		recordedRisks: [
			'The service-worker manifest lists the digest of every emitted file, so any future round ' +
				'that changes one byte of one bundle changes ngsw.json too.',
			'`.angular/cache` was not cleared between the two builds of the u20c2e round. That the two ' +
				'runs agree is therefore consistent with both a deterministic pipeline and a warm cache, ' +
				'and the era Sass literals moving across the supersede boundary is the reason to say so.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildRebindLaneRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	const bytes = canonical(record);
	await writeFile(path.join(EVIDENCE_DIRECTORY, REBIND_LANE_FILE), bytes);
	process.stdout.write(
		`rebind lane ${String(record['result'])}\n` +
			`  digest ${record.digest}\n` +
			`  bytes-sha256 ${sha256(bytes)}\n` +
			`  inventorySha256 ${String((record['determinism'] as Record<string, unknown>)['inventorySha256'])}\n` +
			`  files ${String(record['artifactsEmitted'])} canonicalRoot ${String(record['canonicalRoot'])} repeatedRoot ${String(record['repeatedRoot'])}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u20c2g-rebind-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
