/**
 * The u21 corpus-integrity corrections.
 *
 * Two findings from the u20/u20a reconnaissance are executed here, both of them
 * defects the audit machinery found in its own harness rather than in an
 * application.
 *
 * **The latin1 digest defect.** The shared build-lane inventory walker digested
 * `bytes.toString('binary')` — a latin1 decode that Node re-encoded as UTF-8
 * before hashing — so every emitted file carrying a byte at or above 0x80 was
 * published under sha256(UTF-8(latin1(bytes))) instead of sha256(bytes). Four
 * published records carry those values. The defect is fixed at its one shared
 * source; the four records are *not* edited, because a published record is
 * immutable. Each is superseded by reference: a correction record that names
 * the original by path and by digest, publishes the raw-correct values
 * recomputed from the retained tree, and inventories exactly which values moved.
 *
 * **The undeclared build-time font fetch.** Angular 16's browser builder inlines
 * Google Fonts and Adobe Fonts stylesheets during an optimized build, which
 * means the build itself reaches a third-party host — a fetch no cell declared,
 * on a corpus that builds under `alternateHostsAllowed: false`. That is fixed in
 * the Angular target cell, generically. What this driver contributes is the
 * *locality* question the fix raises: which Angular 16 lanes the fetch actually
 * touched, read off the emitted documents rather than assumed, so the rebuild
 * list is evidence and not a guess.
 *
 * Nothing here rebuilds anything and nothing here re-publishes a witness
 * receipt. Recomputation is a read of a retained tree; the probe is a read of an
 * emitted document. Both are offline.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { inventoryOf, sealRecord, type DistEntry, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'lrapr-t006/u21-corpus-integrity-corrections';
export const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';

/**
 * The defect, stated once and carried verbatim into every correction record so
 * a reader who opens one record does not have to find the others.
 */
export const DIGEST_DEFECT =
	"The build-lane inventory walker read each emitted file as bytes and then digested `bytes.toString('binary')`. " +
	"Node's `binary` encoding is latin1, so the bytes were decoded to one code point per byte and the resulting " +
	'string was re-encoded as UTF-8 before hashing. For a file made only of bytes below 0x80 that round trip is the ' +
	'identity and the published digest is correct by coincidence; for any file carrying a byte at or above 0x80 every ' +
	'such byte was widened to two, and the published value is sha256(UTF-8(latin1(bytes))) rather than sha256(bytes). ' +
	'The walker is shared by every Angular build-lane record, which is why the fix is one line in one function rather ' +
	'than a repair applied per record.';

/**
 * Why the comparisons those records drew are still sound, stated as an argument
 * rather than as reassurance.
 *
 * This matters because the affected records are not digest catalogues for their
 * own sake — they are the basis for byte-stability, ingest-reproduction and
 * era-versus-migrated parity conclusions, all of which are digest *equalities*.
 */
export const INJECTIVITY_BASIS =
	'latin1 decoding is a bijection between the 256 byte values and the first 256 Unicode code points, and UTF-8 ' +
	'encoding is injective on code-point sequences, so the composition byte-string -> latin1 -> UTF-8 is injective. ' +
	'Two files therefore hashed to the same wrong digest exactly when their bytes were identical, and to different ' +
	'wrong digests exactly when their bytes differed. Every equality and inequality the affected records assert — ' +
	'byte stability across rebuilds, reproduction of the ingest build, and which emission points carry identical ' +
	'payloads across the two lanes — is preserved unchanged by the correction. What was wrong is the published ' +
	'values, not the conclusions drawn from comparing them.';

export const NOT_REPUBLISHED =
	'This correction does not re-publish the record it corrects, and does not re-publish any witness receipt that ' +
	'binds it. The original stays exactly as it was written, byte for byte, and is superseded by reference: a reader ' +
	'following the original reaches this record through the supersede chain, and a reader following a witness ' +
	'receipt still finds the bytes that receipt bound.';

/** One published digest that moved, or was confirmed already correct. */
export type CorrectedValue = Readonly<{
	path: string;
	bytes: number;
	published: string;
	corrected: string;
	/** True when the file carries a byte at or above 0x80, which is why it moved. */
	carriesHighBytes: boolean;
}>;

export type ValueCorrection = Readonly<{
	/** JSON pointer-ish location of the digest list inside the original record. */
	at: string;
	/** The retained tree the corrected digests were recomputed from. */
	recomputedFrom: string;
	basis: 'recomputed-from-retained-tree' | 'derivational';
	valuesTotal: number;
	valuesCorrected: number;
	valuesAlreadyCorrect: number;
	corrected: readonly CorrectedValue[];
	alreadyCorrect: readonly string[];
}>;

/**
 * Recompute one published inventory against the tree it was taken from.
 *
 * Every published entry has to be matched by path *and* by byte length before
 * its digest is touched. A path present in the record and absent from the tree,
 * or present at a different length, is not silently corrected — it means the
 * tree is not the one the record was taken from, and the function refuses
 * rather than publishing a digest for a file nobody verified.
 */
export function correctInventory(
	published: readonly DistEntry[],
	tree: readonly DistEntry[],
	treePath: string,
	at: string,
	highByteFiles: ReadonlySet<string>,
): ValueCorrection {
	const byPath = new Map(tree.map((entry) => [entry.path, entry]));
	const corrected: CorrectedValue[] = [];
	const alreadyCorrect: string[] = [];
	for (const entry of published) {
		const found = byPath.get(entry.path);
		if (found === undefined)
			throw new Error(
				`${at}: ${entry.path} is published but absent from the retained tree ${treePath}; ` +
					'the tree is not the one this record was taken from and no digest was corrected',
			);
		if (found.bytes !== entry.bytes)
			throw new Error(
				`${at}: ${entry.path} is published at ${String(entry.bytes)} bytes and the retained ` +
					`tree ${treePath} holds ${String(found.bytes)}; no digest was corrected`,
			);
		if (found.sha256 === entry.sha256) {
			alreadyCorrect.push(entry.path);
			continue;
		}
		corrected.push({
			path: entry.path,
			bytes: entry.bytes,
			published: entry.sha256,
			corrected: found.sha256,
			carriesHighBytes: highByteFiles.has(entry.path),
		});
	}
	return Object.freeze({
		at,
		recomputedFrom: treePath,
		basis: 'recomputed-from-retained-tree',
		valuesTotal: published.length,
		valuesCorrected: corrected.length,
		valuesAlreadyCorrect: alreadyCorrect.length,
		corrected: Object.freeze(corrected),
		alreadyCorrect: Object.freeze(alreadyCorrect),
	});
}

/**
 * Every value in a correction that moved did so because the file carries a high
 * byte, and every value that did not move is a file that does not.
 *
 * Asserted rather than assumed: if a digest moved for a file made entirely of
 * bytes below 0x80, the cause is something other than the latin1 defect and this
 * correction is not the right explanation for it.
 */
export function defectExplainsEveryMove(correction: ValueCorrection): boolean {
	return correction.corrected.every((value) => value.carriesHighBytes);
}

/** The paths below a tree whose bytes include one at or above 0x80. */
export async function highByteFilesOf(directory: string): Promise<ReadonlySet<string>> {
	const found = new Set<string>();
	const walk = async (current: string): Promise<void> => {
		for (const item of await readdir(current, { withFileTypes: true })) {
			const full = path.join(current, item.name);
			if (item.isDirectory()) {
				await walk(full);
				continue;
			}
			if (!item.isFile()) continue;
			const bytes = await readFile(full);
			if (bytes.some((byte) => byte >= 0x80))
				found.add(path.relative(directory, full).split(path.sep).join('/'));
		}
	};
	await walk(directory);
	return found;
}

/** The original a correction supersedes, bound the way a witness receipt binds. */
export type SupersededOriginal = Readonly<{
	path: string;
	schemaVersion: string;
	/** The seal the original computed over its own body. Unchanged by this unit. */
	digest: string;
	/** The sha256 of the original file's bytes, so the binding is checkable. */
	sha256: string;
}>;

export async function bindOriginal(relativePath: string): Promise<SupersededOriginal> {
	const bytes = await readFile(path.join(repositoryRoot, relativePath));
	const record = JSON.parse(bytes.toString('utf8')) as Record<string, unknown>;
	return Object.freeze({
		path: relativePath,
		schemaVersion: String(record['schemaVersion']),
		digest: String(record['digest']),
		sha256: sha256(bytes),
	});
}

/** One Angular 16 lane, read for the build-time font fetch. */
export type FontLocality = Readonly<{
	lane: string;
	/** The emitted document that was read. */
	emitted: string;
	/** The application's own source index.html, and what it links. */
	sourceLinks: readonly string[];
	/** Font-host URLs the *emitted* document carries. */
	emittedHosts: readonly string[];
	inlinedFontFaceRules: number;
	fetchedAtBuildTime: boolean;
	finding: string;
}>;

/**
 * Read one emitted document for the signature of the build-time inliner.
 *
 * The signature is not "the document mentions a font host" — the era document
 * mentions one too, in the application's own link element, and that is the
 * faithful behaviour. The signature is an `@font-face` rule in the emitted
 * document that is present in no source file: the CSS body of a stylesheet the
 * builder went and fetched. A document that carries the link and no inlined
 * rule was not touched by the inliner.
 */
export function readFontLocality(emittedHtml: string): Readonly<{
	hosts: readonly string[];
	inlinedFontFaceRules: number;
	inlined: boolean;
}> {
	const hosts = [
		...new Set(
			['fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'p.typekit.net'].filter(
				(host) => emittedHtml.includes(host),
			),
		),
	].sort();
	let rules = 0;
	let index = emittedHtml.indexOf('@font-face');
	while (index !== -1) {
		rules += 1;
		index = emittedHtml.indexOf('@font-face', index + 1);
	}
	return Object.freeze({ hosts: Object.freeze(hosts), inlinedFontFaceRules: rules, inlined: rules > 0 });
}

async function readTextOrNull(file: string): Promise<string | null> {
	try {
		return await readFile(file, 'utf8');
	} catch {
		return null;
	}
}

/** Font-host URLs a source document links, verbatim. */
export function sourceFontLinks(html: string): readonly string[] {
	const links: string[] = [];
	for (const host of ['fonts.googleapis.com', 'use.typekit.net']) {
		let index = html.indexOf(`https://${host}`);
		while (index !== -1) {
			let end = index;
			while (end < html.length && !['"', "'", ' ', '>', ')'].includes(html[end] ?? '')) end += 1;
			links.push(html.slice(index, end));
			index = html.indexOf(`https://${host}`, end);
		}
	}
	return Object.freeze([...new Set(links)].sort());
}

type LaneProbe = Readonly<{
	lane: string;
	evidenceDirectory: string;
	sourceIndex: string;
	emitted: string;
	published: string;
}>;

const LANE_PROBES: readonly LaneProbe[] = Object.freeze([
	{
		lane: 'angular-tiny-translator-v0-12-0',
		evidenceDirectory: 'evidence/runs/angular-tiny-translator-v0-12-0',
		sourceIndex:
			'.versionless/cache/angular-tiny-translator-v0-12-0-source/verify/extracted/tiny-translator-08dcacf6a41d5a6f6dfbc71d858adcdc4c85691a/src/index.html',
		emitted: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/dist-13/index.html',
		published:
			'the u17d final green lane and the u19k CVA lane, and the witness receipt that binds them',
	},
	{
		lane: 'angular-super-productivity-v2-13-15',
		evidenceDirectory: 'evidence/runs/angular-super-productivity-v2-13-15',
		sourceIndex:
			'.versionless/cache/angular-super-productivity-v2-13-15-source/verify/extracted/super-productivity-2943c5c4f13c3ce4dece0abf4f9c39739dde4192/src/index.html',
		emitted: '.versionless/stage/angular-super-productivity-v2-13-15-u18b/app/dist/index.html',
		published: 'the u18b migrated lane and the u18j worker-chunks parity record',
	},
	{
		lane: 'angular-factoriolab',
		evidenceDirectory: 'evidence/runs/angular-factoriolab',
		sourceIndex: '.versionless/cache/angular-factoriolab-source/verify/extracted/src/index.html',
		emitted: '.versionless/stage/angular-factoriolab-m2/dist-a/index.html',
		published: 'the m2 migrated build and parity records, and the witness receipt that binds them',
	},
	{
		lane: 'angular-jira-clone',
		evidenceDirectory: 'evidence/runs/angular-jira-clone',
		sourceIndex:
			'.versionless/cache/angular-jira-clone-source/verify/extracted/jira-clone-angular-059455b9933a236456524925065bce2c295e2d9a/src/index.html',
		emitted: '.versionless/stage/angular-jira-clone-mj2/dist-a/index.html',
		published: 'the mj2 migrated closure and mj3c build-parity records',
	},
]);

export async function probeLane(probe: LaneProbe): Promise<FontLocality> {
	const source = await readTextOrNull(path.join(repositoryRoot, probe.sourceIndex));
	const emitted = await readTextOrNull(path.join(repositoryRoot, probe.emitted));
	if (source === null)
		throw new Error(`${probe.lane}: the source index.html ${probe.sourceIndex} was not found`);
	if (emitted === null)
		throw new Error(`${probe.lane}: the emitted index.html ${probe.emitted} was not found`);
	const links = sourceFontLinks(source);
	const read = readFontLocality(emitted);
	const fetched = read.inlined && links.length > 0;
	return Object.freeze({
		lane: probe.lane,
		emitted: probe.emitted,
		sourceLinks: links,
		emittedHosts: read.hosts,
		inlinedFontFaceRules: read.inlinedFontFaceRules,
		fetchedAtBuildTime: fetched,
		finding: fetched
			? `The application links ${String(links.length)} font stylesheet(s) of its own, and the emitted ` +
				`document carries ${String(read.inlinedFontFaceRules)} @font-face rule(s) that appear in no ` +
				'source file. Those rules are the body of a stylesheet the builder fetched from the font host ' +
				'during the build. The build made an undeclared third-party request, and the emitted bytes ' +
				'depend on what that host served on the build day. This lane must be rebuilt with ' +
				'`optimization.fonts.inline: false` and its records superseded.'
			: links.length === 0
				? "The application's own index.html links no external font stylesheet, so the inliner had " +
					'nothing to fetch and made no request. The emitted document carries no inlined @font-face ' +
					'rule, which is consistent. This lane is unaffected and needs no rebuild for this finding.'
				: 'The application links a font stylesheet but the emitted document carries no inlined ' +
					'@font-face rule, so the inliner did not run or did not reach the host. Recorded as-is.',
	});
}

const AFFECTED: readonly Readonly<{
	original: string;
	evidenceDirectory: string;
	correctionFile: string;
	schemaVersion: string;
	inventoryAt: string;
	tree: string;
	/** How the record's own conclusions rest on these digests. */
	conclusionsResting: readonly string[];
	/** Set on every record a published witness receipt binds. */
	boundByWitnessReceipt: boolean;
}>[] = Object.freeze([
	{
		original: 'evidence/runs/angular-super-productivity-v2-13-15/u18-era-baseline.json',
		evidenceDirectory: 'evidence/runs/angular-super-productivity-v2-13-15',
		correctionFile: 'u21-era-baseline-digest-correction.json',
		schemaVersion: 'versionless.angular-super-productivity-era-baseline-digest-correction.v1',
		inventoryAt: 'inventory[].sha256',
		tree: '.versionless/cache/angular-super-productivity-v2-13-15-baseline/dist-run2',
		conclusionsResting: [
			'`byteStable: false` and the six-path `differingPaths` list are digest comparisons between rebuild 2 and rebuild 3. Both sides were hashed the same wrong way, so both survive the correction unchanged — and the lane was already recorded as not byte-stable, which is the harder direction to reach by accident.',
			'The `instability` findings name a Sass `random()` call as the cause of the moving main chunk. That was chased to a source line, not inferred from a digest, and is untouched by this correction.',
		],
		boundByWitnessReceipt: false,
	},
	{
		original: 'evidence/runs/angular-factoriolab/m2-era-baseline.json',
		evidenceDirectory: 'evidence/runs/angular-factoriolab',
		correctionFile: 'u21-m2-era-baseline-digest-correction.json',
		schemaVersion: 'versionless.angular-factoriolab-era-baseline-digest-correction.v1',
		inventoryAt: 'inventory[].sha256',
		tree: '.versionless/cache/angular-factoriolab-baseline/rebuild/dist-1',
		conclusionsResting: [
			'`byteStable: true` compares this inventory against rebuild 2, both hashed the same wrong way. Preserved by injectivity.',
			'`reproducesIngestBuild: true` compares this inventory against the a1 ingest build, both hashed the same wrong way. Preserved by injectivity.',
		],
		boundByWitnessReceipt: true,
	},
	{
		original: 'evidence/runs/angular-factoriolab/m2-migrated-build.json',
		evidenceDirectory: 'evidence/runs/angular-factoriolab',
		correctionFile: 'u21-m2-migrated-build-digest-correction.json',
		schemaVersion: 'versionless.angular-factoriolab-migrated-build-digest-correction.v1',
		inventoryAt: 'inventory[].sha256',
		tree: '.versionless/stage/angular-factoriolab-m2/dist-a',
		conclusionsResting: [
			'`byteStable: true` compares this inventory against the second migrated build, both hashed the same wrong way. Preserved by injectivity.',
			'`acquisition.lockfileSha256` is not affected. It is taken over a UTF-8 read of package-lock.json rather than through the inventory walker, and it recomputes identically from the retained lockfile.',
		],
		boundByWitnessReceipt: true,
	},
]);

/** The build-parity record, whose digests sit in a different shape. */
const PARITY = Object.freeze({
	original: 'evidence/runs/angular-factoriolab/m2-build-parity.json',
	evidenceDirectory: 'evidence/runs/angular-factoriolab',
	correctionFile: 'u21-m2-build-parity-digest-correction.json',
	schemaVersion: 'versionless.angular-factoriolab-build-parity-digest-correction.v1',
	eraTree: '.versionless/cache/angular-factoriolab-baseline/rebuild/dist-1',
	migratedTree: '.versionless/stage/angular-factoriolab-m2/dist-a',
});

type ParityEntry = Readonly<{
	emissionPoint: string;
	era: readonly DistEntry[];
	migrated: readonly DistEntry[];
	bytesIdentical: boolean;
	byteDelta: number;
}>;

export async function main(): Promise<void> {
	const written: string[] = [];
	const write = async (directory: string, file: string, record: SealedRecord): Promise<void> => {
		const relative = `${directory}/${file}`;
		await writeFile(path.join(repositoryRoot, relative), canonical(record));
		written.push(relative);
	};

	const localities: FontLocality[] = [];
	for (const probe of LANE_PROBES) localities.push(await probeLane(probe));

	// ---- the four digest corrections -------------------------------------
	for (const affected of AFFECTED) {
		const original = await bindOriginal(affected.original);
		const record = JSON.parse(
			await readFile(path.join(repositoryRoot, affected.original), 'utf8'),
		) as Record<string, unknown>;
		const treePath = path.join(repositoryRoot, affected.tree);
		const tree = await inventoryOf(treePath);
		const highBytes = await highByteFilesOf(treePath);
		const correction = correctInventory(
			record['inventory'] as readonly DistEntry[],
			tree,
			affected.tree,
			affected.inventoryAt,
			highBytes,
		);
		if (!defectExplainsEveryMove(correction))
			throw new Error(
				`${affected.original}: a digest moved for a file with no byte at or above 0x80, so the ` +
					'latin1 defect does not explain it and this correction was not written',
			);
		await write(
			affected.evidenceDirectory,
			affected.correctionFile,
			sealRecord({
				schemaVersion: affected.schemaVersion,
				unit: UNIT,
				consentId: CONSENT,
				result: 'digest-values-corrected-original-superseded-by-reference',
				supersedes: original,
				defect: DIGEST_DEFECT,
				basis: INJECTIVITY_BASIS,
				immutability: NOT_REPUBLISHED,
				conclusionsResting: affected.conclusionsResting,
				corrections: [correction],
				fixedAt: FIXED_AT,
				notEstablished: NOT_ESTABLISHED,
				...(affected.boundByWitnessReceipt ? { witnessBinding: WITNESS_BINDING } : {}),
			}),
		);
	}

	// ---- the parity record, whose digests sit per emission point ---------
	const parityOriginal = await bindOriginal(PARITY.original);
	const parityRecord = JSON.parse(
		await readFile(path.join(repositoryRoot, PARITY.original), 'utf8'),
	) as Record<string, unknown>;
	const eraTreePath = path.join(repositoryRoot, PARITY.eraTree);
	const migratedTreePath = path.join(repositoryRoot, PARITY.migratedTree);
	const eraTree = await inventoryOf(eraTreePath);
	const migratedTree = await inventoryOf(migratedTreePath);
	const eraHigh = await highByteFilesOf(eraTreePath);
	const migratedHigh = await highByteFilesOf(migratedTreePath);
	const entries = parityRecord['entries'] as readonly ParityEntry[];
	const eraSide = entries.flatMap((entry) => [...entry.era]);
	const migratedSide = entries.flatMap((entry) => [...entry.migrated]);
	const eraCorrection = correctInventory(
		eraSide,
		eraTree,
		PARITY.eraTree,
		'entries[].era[].sha256',
		eraHigh,
	);
	const migratedCorrection = correctInventory(
		migratedSide,
		migratedTree,
		PARITY.migratedTree,
		'entries[].migrated[].sha256',
		migratedHigh,
	);
	for (const correction of [eraCorrection, migratedCorrection])
		if (!defectExplainsEveryMove(correction))
			throw new Error(
				`${PARITY.original}: a digest moved for a file with no byte at or above 0x80; ` +
					'no correction was written',
			);
	/**
	 * The parity record's whole output is an equality: which emission points
	 * carry identical payloads across the two lanes. Recomputed here from the
	 * corrected digests and checked against what the record published, so the
	 * claim that the conclusions survive is verified rather than asserted.
	 */
	const eraByPath = new Map(eraTree.map((entry) => [entry.path, entry.sha256]));
	const migratedByPath = new Map(migratedTree.map((entry) => [entry.path, entry.sha256]));
	const recomputedIdentical = entries
		.filter((entry) => {
			const left = entry.era.map((item) => eraByPath.get(item.path) ?? '').sort();
			const right = entry.migrated.map((item) => migratedByPath.get(item.path) ?? '').sort();
			return left.length === right.length && left.every((value, index) => value === right[index]);
		})
		.map((entry) => entry.emissionPoint);
	const publishedIdentical = [...(parityRecord['identicalPayloads'] as readonly string[])];
	const conclusionHolds =
		canonical([...recomputedIdentical].sort()) === canonical([...publishedIdentical].sort());
	if (!conclusionHolds)
		throw new Error(
			`${PARITY.original}: recomputing identicalPayloads from the corrected digests does not ` +
				'reproduce the published list, so the correction is not value-only and was not written',
		);
	await write(
		PARITY.evidenceDirectory,
		PARITY.correctionFile,
		sealRecord({
			schemaVersion: PARITY.schemaVersion,
			unit: UNIT,
			consentId: CONSENT,
			result: 'digest-values-corrected-original-superseded-by-reference',
			supersedes: parityOriginal,
			defect: DIGEST_DEFECT,
			basis: INJECTIVITY_BASIS,
			immutability: NOT_REPUBLISHED,
			conclusionsResting: [
				"The parity record's output is the `identicalPayloads` list: the emission points whose bytes agree across the two lanes. That list was recomputed here from the raw-correct digests of both retained trees and compared against the list the record published. The two agree exactly, which verifies the injectivity argument on this record rather than only asserting it.",
				'`onlyInEra` and `onlyInMigrated` are set differences over emission-point names and carry no digest at all.',
				'`byteDelta` is arithmetic over file sizes, which the defect never touched.',
			],
			conclusionRecheck: {
				method:
					'identicalPayloads recomputed from sha256(bytes) of both retained trees, grouped by the same emission point as the original',
				publishedCount: publishedIdentical.length,
				recomputedCount: recomputedIdentical.length,
				agrees: conclusionHolds,
			},
			corrections: [eraCorrection, migratedCorrection],
			fixedAt: FIXED_AT,
			notEstablished: NOT_ESTABLISHED,
			witnessBinding: WITNESS_BINDING,
		}),
	);

	// ---- the locality findings, one record per lane ----------------------
	for (const probe of LANE_PROBES) {
		const locality = localities.find((item) => item.lane === probe.lane);
		if (locality === undefined) throw new Error(`${probe.lane}: no locality reading was taken`);
		await write(
			probe.evidenceDirectory,
			'u21-font-inline-locality.json',
			sealRecord({
				schemaVersion: 'versionless.angular-font-inline-locality.v1',
				unit: UNIT,
				consentId: CONSENT,
				result: locality.fetchedAtBuildTime
					? 'undeclared-build-time-fetch-present'
					: 'undeclared-build-time-fetch-absent',
				lane: locality.lane,
				defect: FONT_DEFECT,
				method: FONT_METHOD,
				reading: {
					sourceIndex: probe.sourceIndex,
					sourceFontLinks: locality.sourceLinks,
					emittedDocument: locality.emitted,
					emittedFontHosts: locality.emittedHosts,
					inlinedFontFaceRules: locality.inlinedFontFaceRules,
				},
				fetchedAtBuildTime: locality.fetchedAtBuildTime,
				finding: locality.finding,
				publishedRecordsAffected: locality.fetchedAtBuildTime ? probe.published : 'none',
				rebuildRequired: locality.fetchedAtBuildTime,
				fixedAt: FONT_FIXED_AT,
				notEstablished: FONT_NOT_ESTABLISHED,
			}),
		);
	}

	process.stdout.write(
		`u21: wrote ${String(written.length)} records\n${written.map((file) => `  ${file}\n`).join('')}`,
	);
}

export const FIXED_AT =
	'packages/cli/src/fixture/angular-factoriolab-build-lanes-run.ts, in `inventoryOf`: the digest is now taken ' +
	'over the file bytes. The shared hasher in angular-factoriolab-migration-run.ts accepts a byte array so that ' +
	"passing bytes is the natural call and passing a decoded string is the odd one. `packages/cli/test/" +
	'digest-byte-fidelity.test.ts` pins the walker against a fixture whose bytes make the three candidate answers ' +
	'three different digests, so a regression to latin1 — or to a lossy UTF-8 read — fails rather than publishing ' +
	'a wrong number that still compares equal to itself.';

export const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Nothing was rebuilt. The corrected digests are a re-read of the retained tree the original record was taken from, at the byte lengths the original published; they are not a new build and establish nothing about reproducibility that the original did not already establish.',
	'This correction changes published digest values and nothing else. No result, no conclusion and no non-claim of the original record is amended, withdrawn or strengthened here.',
	'The correction does not audit the original record for any other defect. It addresses the latin1 digest defect and says nothing about the rest of the record.',
]);

export const WITNESS_BINDING =
	'The published factoriolab witness receipt (packages/core/src/receipts/witness-angular-factoriolab.ts) binds ' +
	'all three build-lane records, each by the seal digest the record computed over its own body and by the sha256 ' +
	'of the record file\'s exact bytes. It does *not* bind any artifact digest from inside those records. Both ' +
	'bindings still verify against the originals, which this unit left untouched, so the receipt is not broken and ' +
	'is deliberately not re-published here. What the Judge should see plainly is the transitive consequence: the ' +
	'receipt binds bytes that contain affected values, so a reader who follows the chain from the witness proof ' +
	'into the build receipts reaches latin1 digests unless they also follow the supersede chain to this record. ' +
	'That is a gap in navigability, not in the binding — and it is why these corrections exist as records the ' +
	'originals point to rather than as edits.';

export const FONT_DEFECT =
	"Angular 16's browser builder inlines external font stylesheets during an optimized build: `optimization` " +
	'defaults to on, `optimization.fonts` defaults to on inside it, and the inliner then fetches every Google ' +
	'Fonts and Adobe Fonts stylesheet the application links and pastes the CSS into the emitted index.html. The ' +
	"devkit's own schema says the option requires internet access. The era builders had no such capability, so " +
	'this is a migration-introduced build-time request against a corpus that declares `alternateHostsAllowed: ' +
	'false`, and it makes the emitted bytes depend on what a third-party host served on the build day.';

export const FONT_METHOD =
	"The reading is taken from two documents: the application's own src/index.html, for what it links, and the " +
	'emitted index.html, for what the build put there. The signature of the inliner is not a font host appearing ' +
	'in the emitted document — the era build emitted the link element too, and the browser fetching it at runtime ' +
	'is the faithful behaviour. The signature is an @font-face rule in the emitted document that appears in no ' +
	'source file, because that rule is the body of a stylesheet the builder went and fetched.';

export const FONT_FIXED_AT =
	'packages/frameworks/angular/src/font-inlining-disable.ts, applied generically by the workspace migration and ' +
	'by the CLI 1.x workspace synthesis. Every browser-family target in a migrated workspace carries ' +
	'`optimization.fonts.inline: false`, written into the base options as well as into every configuration that ' +
	'declares the option, because the builder default is on and an absent option is therefore not a safe one. A ' +
	'configuration that declares `optimization: false` is left alone, so the fix never switches optimisation on. ' +
	'Each site is recorded as a declared difference of the cell: the migrated lane ships the same link element the ' +
	'era build shipped and the browser fetches the stylesheet at runtime, which is both the behaviour-faithful and ' +
	'the offline-faithful answer.';

export const FONT_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This is a reading of an emitted document, not an observation of the build. No build was run and no network traffic was captured here; what is established is that the emitted document carries CSS that exists in no input, which is only explicable as a fetch.',
	'Nothing is rebuilt by this record. The rebuild list is its output, and the rebuilds themselves — and the supersede chains for the records they replace — belong to the units that run them.',
	'A lane recorded as unaffected is unaffected *for this defect*. It says nothing about any other undeclared request a build might make.',
]);

if (process.argv[1]?.endsWith('angular-u21-corpus-integrity-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
