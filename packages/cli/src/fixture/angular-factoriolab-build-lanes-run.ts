/**
 * Record the two build lanes of the `angular-factoriolab` migration cell.
 *
 * Lane one is the era baseline: the pinned tree on its own cell — Rosetta x64
 * Node 12.14.1, the era dependency closure, `ng build --prod` — rebuilt twice
 * to see whether the restored cache still produces the same bytes.
 *
 * Lane two is the migrated tree: the adapter's composed changeset applied to
 * the same pinned tree, the declared Angular 16.2 closure installed, and the
 * official `@angular-devkit/build-angular:browser` builder run twice under
 * native Node 16.20.2.
 *
 * What this driver records is build-level only: which files each lane emitted,
 * their digests and sizes, and where the two inventories agree and differ. It
 * observes no browser and asserts no behavioural equivalence; a difference
 * found here is recorded as a difference, never as a defect and never as a
 * pass.
 *
 * The driver is fixture-scoped — it knows where this fixture's lanes were
 * materialised — while every decision about *what to change* lives in
 * `@versionless/angular`, which knows nothing about this application.
 */

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const evidenceDirectory = path.join(repositoryRoot, 'evidence/runs/angular-factoriolab');

export const ERA_REBUILD_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/cache/angular-factoriolab-baseline/rebuild',
);
export const MIGRATED_STAGE_DIRECTORY = path.join(
	repositoryRoot,
	'.versionless/stage/angular-factoriolab-m2',
);

export type DistEntry = Readonly<{ path: string; sha256: string; bytes: number }>;

/** Every file below `directory`, digested, ordered by path. */
export async function inventoryOf(directory: string): Promise<DistEntry[]> {
	const entries: DistEntry[] = [];
	const walk = async (current: string): Promise<void> => {
		for (const item of await readdir(current, { withFileTypes: true })) {
			const full = path.join(current, item.name);
			if (item.isDirectory()) {
				await walk(full);
				continue;
			}
			if (!item.isFile()) continue;
			const bytes = await readFile(full);
			entries.push({
				path: path.relative(directory, full).split(path.sep).join('/'),
				sha256: sha256(bytes.toString('binary')),
				bytes: bytes.byteLength,
			});
		}
	};
	await walk(directory);
	return entries.sort((left, right) => (left.path < right.path ? -1 : 1));
}

/**
 * Strip the content hash the Angular CLI stamps into an emitted file name, so
 * `main-es2015.eea9ba8e….js` and `main.67d430ec….js` can be recognised as the
 * same emission point across two builders that hash differently. The era line's
 * differential-loading suffix is stripped with it, and reported separately by
 * {@link compareInventories} so that removing it is never silent.
 */
export function emissionPointOf(file: string): string {
	const directory = file.includes('/') ? `${file.slice(0, file.lastIndexOf('/'))}/` : '';
	const name = file.slice(directory.length);
	const withoutHash = name.replace(/\.[0-9a-f]{16,32}(?=\.[^.]+$)/, '');
	return `${directory}${withoutHash.replace(/-es(5|2015)(?=\.[^.]+$)/, '')}`;
}

export type ParityEntry = Readonly<{
	emissionPoint: string;
	era: readonly DistEntry[];
	migrated: readonly DistEntry[];
	/** Identical bytes in both lanes, whatever the file was named. */
	bytesIdentical: boolean;
	/** Total migrated bytes minus total era bytes at this emission point. */
	byteDelta: number;
}>;

export type Parity = Readonly<{
	eraFileCount: number;
	migratedFileCount: number;
	entries: readonly ParityEntry[];
	onlyInEra: readonly string[];
	onlyInMigrated: readonly string[];
	identicalPayloads: readonly string[];
}>;

/**
 * Line the two inventories up by emission point.
 *
 * Matching on the emission point rather than the file name is the only way to
 * compare across the hop at all: both builders hash their output into the file
 * name, so every emitted bundle is named differently in the two lanes even when
 * its content is byte-identical. An emission point present in one lane and not
 * the other is reported by name rather than folded into a total.
 */
export function compareInventories(era: readonly DistEntry[], migrated: readonly DistEntry[]): Parity {
	const group = (entries: readonly DistEntry[]): Map<string, DistEntry[]> => {
		const grouped = new Map<string, DistEntry[]>();
		for (const entry of entries) {
			const key = emissionPointOf(entry.path);
			grouped.set(key, [...(grouped.get(key) ?? []), entry]);
		}
		return grouped;
	};
	const eraGroups = group(era);
	const migratedGroups = group(migrated);
	const points = [...new Set([...eraGroups.keys(), ...migratedGroups.keys()])].sort();
	const entries: ParityEntry[] = [];
	const identicalPayloads: string[] = [];
	const onlyInEra: string[] = [];
	const onlyInMigrated: string[] = [];
	for (const point of points) {
		const left = eraGroups.get(point) ?? [];
		const right = migratedGroups.get(point) ?? [];
		if (right.length === 0) onlyInEra.push(point);
		if (left.length === 0) onlyInMigrated.push(point);
		const leftDigests = new Set(left.map((entry) => entry.sha256));
		const bytesIdentical =
			left.length > 0 && right.length > 0 && right.every((entry) => leftDigests.has(entry.sha256));
		if (bytesIdentical) identicalPayloads.push(point);
		const total = (group: readonly DistEntry[]): number =>
			group.reduce((sum, entry) => sum + entry.bytes, 0);
		entries.push({
			emissionPoint: point,
			era: Object.freeze(left),
			migrated: Object.freeze(right),
			bytesIdentical,
			byteDelta: total(right) - total(left),
		});
	}
	return Object.freeze({
		eraFileCount: era.length,
		migratedFileCount: migrated.length,
		entries: Object.freeze(entries),
		onlyInEra: Object.freeze(onlyInEra),
		onlyInMigrated: Object.freeze(onlyInMigrated),
		identicalPayloads: Object.freeze(identicalPayloads),
	});
}

export type SealedRecord = Readonly<Record<string, unknown>> & Readonly<{ digest: string }>;

/** Seal a record body with a digest recomputable from its own canonical form. */
export function sealRecord(body: Readonly<Record<string, unknown>>): SealedRecord {
	return Object.freeze({ ...body, digest: sha256(canonical(body)) });
}

/** Recompute a sealed record's digest; a record that does not seal is rejected. */
export function verifySealedRecord(record: SealedRecord): SealedRecord {
	const { digest, ...body } = record;
	const recomputed = sha256(canonical(body));
	if (recomputed !== digest)
		throw new Error(
			`Angular factoriolab build-lane record digest differs: recorded ${digest}, recomputed ${recomputed}`,
		);
	return record;
}

/**
 * Two inventories of the same lane, taken from two consecutive builds. Equal
 * inventories are the only evidence of determinism this driver accepts; a
 * single build proves nothing about repeatability and is never reported as if
 * it did.
 */
export function isByteStable(first: readonly DistEntry[], second: readonly DistEntry[]): boolean {
	return canonical(first) === canonical(second);
}

const UNIT = 'lrapr-t005/m2-factoriolab-build-lanes';
const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';

async function readText(file: string): Promise<string> {
	return await readFile(file, 'utf8');
}

export async function main(): Promise<void> {
	const eraFirst = await inventoryOf(path.join(ERA_REBUILD_DIRECTORY, 'dist-1'));
	const eraSecond = await inventoryOf(path.join(ERA_REBUILD_DIRECTORY, 'dist-2'));
	const eraIngest = await inventoryOf(
		path.join(
			repositoryRoot,
			'.versionless/cache/angular-factoriolab-baseline/app/dist-a1',
		),
	);
	const migratedFirst = await inventoryOf(path.join(MIGRATED_STAGE_DIRECTORY, 'dist-a'));
	const migratedSecond = await inventoryOf(path.join(MIGRATED_STAGE_DIRECTORY, 'dist-b'));
	const lock: unknown = JSON.parse(
		await readText(path.join(MIGRATED_STAGE_DIRECTORY, 'migrated/package-lock.json')),
	);
	const packages = Object.entries(
		(lock as { packages: Record<string, { resolved?: string; integrity?: string }> }).packages,
	).filter(([name]) => name !== '');
	const hosts = [
		...new Set(
			packages
				.map(([, entry]) => entry.resolved)
				.filter((url): url is string => typeof url === 'string')
				.map((url) => new URL(url).host),
		),
	].sort();
	await mkdir(evidenceDirectory, { recursive: true });

	const era = sealRecord({
		schemaVersion: 'versionless.angular-factoriolab-era-baseline.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: eraFirst.length > 0 && isByteStable(eraFirst, eraSecond) ? 'byte-stable' : 'unstable',
		cell: {
			node: 'v12.14.1',
			architecture: 'darwin-x64 under Rosetta 2 on an arm64 host (arch -x86_64)',
			npm: '6.13.4',
			command: 'npm run build -- --prod',
			builder: '@angular-devkit/build-angular:browser (Angular CLI 10.1.x)',
		},
		source: {
			cache: '.versionless/cache/angular-factoriolab-baseline',
			provenance:
				'Restored by the PM from the a1 ingest worktree: the installed era closure and the 26 oid-verified Git LFS payloads the pinned tree carries as pointer stubs.',
			deviation:
				'The pinned tree cannot build unmodified: src/data/** is Git LFS, and its 26 pointer stubs fail the production build on TS1136. The labelled deviation a1 recorded — materialise the 26 payloads, each verified against the pointer oid — is carried into this lane unchanged.',
		},
		builds: [
			{ run: 1, status: 0, files: eraFirst.length },
			{ run: 2, status: 0, files: eraSecond.length },
		],
		byteStable: isByteStable(eraFirst, eraSecond),
		reproducesIngestBuild: isByteStable(eraFirst, eraIngest),
		inventory: eraFirst,
		notEstablished: [
			'Byte stability across two consecutive builds on one host is repeatability, not reproducibility: nothing here establishes that another host, another day or another clock would emit the same bytes.',
			'No browser opened these bundles. Nothing about their behaviour is observed.',
		],
	});

	const migrated = sealRecord({
		schemaVersion: 'versionless.angular-factoriolab-migrated-build.v1',
		unit: UNIT,
		consentId: CONSENT,
		result:
			migratedFirst.length > 0 && isByteStable(migratedFirst, migratedSecond)
				? 'byte-stable'
				: 'unstable',
		cell: {
			node: 'v16.20.2',
			architecture: 'darwin-arm64, native',
			npm: '8.19.4',
			command: 'ng build --configuration production',
			builder: '@angular-devkit/build-angular:browser (Angular 16.2)',
		},
		acquisition: {
			purpose:
				'Install the declared Angular 16.2 dependency closure the migrated manifest asks for. One acquisition, one host, no credentials.',
			method: 'npm install (no lockfile carried over; the era lockfileVersion 1 pins the Angular 10 closure)',
			hosts,
			packagesLocked: packages.length,
			packagesWithResolvedUrl: packages.filter((entry) => entry[1].resolved !== undefined).length,
			packagesWithIntegrityDigest: packages.filter((entry) => entry[1].integrity !== undefined)
				.length,
			integrityAlgorithm: 'sha512, on every locked package',
			lockfileVersion: 2,
			lockfileSha256: sha256(
				await readText(path.join(MIGRATED_STAGE_DIRECTORY, 'migrated/package-lock.json')),
			),
			recordNote:
				'Every acquired URL and its digest is recorded in the generated package-lock.json, whose own digest is pinned above. Network was used for this step only; both builds ran with no further acquisition.',
		},
		firstAttempt: {
			outcome: 'failed',
			reason:
				'The dependency closure would not resolve at all: the era jasmine-core ~3.5.0 sits below the >=3.8 peer that karma-jasmine-html-reporter ^1.5.0 now floats to. The era test toolchain blocks the install the build cell needs, which is why the target cell now declares one.',
		},
		secondAttempt: {
			outcome: 'failed',
			reason:
				"With the closure installed, the production build stopped on @ngrx/effects: TS2305, Module '@ngrx/effects' has no exported member 'Effect'. NgRx removed the decorator in 15. This is the shape m1's source-level count could not see.",
		},
		builds: [
			{ run: 1, status: 0, files: migratedFirst.length },
			{ run: 2, status: 0, files: migratedSecond.length },
		],
		byteStable: isByteStable(migratedFirst, migratedSecond),
		inventory: migratedFirst,
		notEstablished: [
			'A green production build establishes that the migrated tree compiles and emits. It establishes nothing about whether the emitted application runs, renders, or behaves as the era build did.',
			'No test was run on either lane. The karma/jasmine toolchain was aligned so the closure could resolve, and nothing was executed with it.',
			'Two consecutive builds on one host is repeatability, not reproducibility.',
		],
	});

	const parity = compareInventories(eraFirst, migratedFirst);
	const parityRecord = sealRecord({
		schemaVersion: 'versionless.angular-factoriolab-build-parity.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'build-level-parity-recorded',
		meaning:
			'Both lanes built. This record lines their emitted files up by emission point — the file name with the builder’s content hash and the era line’s differential-loading suffix removed — and states where the bytes agree, where they differ, and by how much.',
		eraFileCount: parity.eraFileCount,
		migratedFileCount: parity.migratedFileCount,
		identicalPayloads: parity.identicalPayloads,
		onlyInEra: parity.onlyInEra,
		onlyInMigrated: parity.onlyInMigrated,
		entries: parity.entries.map((entry) => ({
			emissionPoint: entry.emissionPoint,
			era: entry.era.map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256 })),
			migrated: entry.migrated.map((file) => ({
				path: file.path,
				bytes: file.bytes,
				sha256: file.sha256,
			})),
			bytesIdentical: entry.bytesIdentical,
			byteDelta: entry.byteDelta,
		})),
		knownDifferences: KNOWN_DIFFERENCES,
		nonclaims: PARITY_NONCLAIMS,
	});

	for (const [name, record] of [
		['m2-era-baseline.json', era],
		['m2-migrated-build.json', migrated],
		['m2-build-parity.json', parityRecord],
	] as const)
		await writeFile(path.join(evidenceDirectory, name), canonical(verifySealedRecord(record)));
	process.stdout.write(
		`era byte-stable: ${String(era['byteStable'])}; migrated byte-stable: ${String(
			migrated['byteStable'],
		)}; era files ${String(parity.eraFileCount)}; migrated files ${String(
			parity.migratedFileCount,
		)}\n`,
	);
}

/**
 * Differences observed between the two lanes' output, recorded as differences.
 *
 * None of these is a defect and none is a pass. Each one is a thing that is
 * true of the emitted files, with the reason it is true where the reason is
 * known from the builder's own behaviour rather than inferred.
 */
export const KNOWN_DIFFERENCES: readonly string[] = Object.freeze([
	'The era lane emits both an ES2015 and an ES5 copy of every JavaScript entry point (differential loading, six files); the migrated lane emits one copy of each (three files). Angular removed ES5 output support, and the migrated build said so: it named kaios 2.5 and op_mini all as browsers in the project’s own browserslist that it would ignore. The migrated output therefore does not serve those browsers, and no claim is made that they were unimportant.',
	'The migrated index.html inlines critical CSS into a <style> element and loads the stylesheet with media="print" onload, with a <noscript> fallback beside it. That is the modern builder’s critical-CSS inlining, on by default in a production configuration; the era builder emitted a plain stylesheet link. The <html> element gains a data-critters-container attribute from it.',
	'The migrated index.html is minified — attribute quoting and whitespace differ throughout — where the era builder passed the source document through nearly verbatim.',
	'Every non-JavaScript payload is byte-identical across the lanes: the four Material Icons font files, the three assets, the favicon, and all 25 files under data/. Only their content-hashed file names differ, because the two builders hash differently.',
	'The application’s own Google Analytics tag survives both lanes verbatim in index.html. It is recorded as present, not exercised: no lane loaded a browser and no request to googletagmanager.com was made or observed.',
	'3rdpartylicenses.txt differs in both size and content, which follows from the dependency closure being a different one.',
]);

export const PARITY_NONCLAIMS: readonly string[] = Object.freeze([
	'This is build-level parity only. Nothing here establishes runtime equivalence, visual equivalence, or that either build works in a browser; witnessing is a separate step that has not run.',
	'A byte-identical payload means the two builders emitted the same file. It does not mean the two applications load it the same way.',
	'Nothing here is a production-readiness, pilot, certification or general Angular support claim.',
]);

if (process.argv[1]?.endsWith('angular-factoriolab-build-lanes-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
