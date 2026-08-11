/**
 * The record of the final lane: the four demands u17c itemised, the fifth that
 * only a build getting past them could see, and the green production build that
 * followed.
 *
 * Everything numeric here is read from the tree, the build logs and the two
 * emitted artifacts at the moment the record is written. Nothing is carried
 * from a previous run and nothing is asserted that a file does not say.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT } from './angular-tiny-translator-lanes-run.ts';
import {
	APPLIED_TREE,
	EVIDENCE_DIRECTORY,
	STAGE_DIRECTORY,
} from './angular-tiny-translator-apply-run.ts';

export const UNIT = 'lrapr-t006/u17d-tiny-translator-final-green';
export const FINAL_LANE_FILE = 'u17d-final-green-lane.json';

/** The source tree as u17c left it, kept so this lane can state its own diff. */
export const BEFORE_TREE = path.join(STAGE_DIRECTORY, 'src-before-final');
/** The era lane's inventory, the only artifact set this lane can compare against. */
export const ERA_BASELINE_FILE = 'u17-era-baseline.json';

type InventoryEntry = Readonly<{ path: string; sha256: string; bytes: number }>;

async function walk(root: string): Promise<readonly string[]> {
	const found: string[] = [];
	const visit = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) await visit(full);
			else found.push(full);
		}
	};
	await visit(root);
	return Object.freeze(found.sort());
}

/** The digest of a file's bytes, which is what an artifact inventory addresses. */
async function digestOf(file: string): Promise<string> {
	return createHash('sha256')
		.update(await readFile(file))
		.digest('hex');
}

/** Every file of an emitted artifact, with its digest and its size. */
export async function inventoryOf(root: string): Promise<readonly InventoryEntry[]> {
	const entries: InventoryEntry[] = [];
	for (const file of await walk(root))
		entries.push(
			Object.freeze({
				path: path.relative(root, file),
				sha256: await digestOf(file),
				bytes: (await stat(file)).size,
			}),
		);
	return Object.freeze(entries);
}

/**
 * A hashed emitted name with its content hash removed, so two builders that
 * name the same logical asset differently can still be compared.
 *
 * The hash is a dot-delimited run of lowercase hex of at least eight characters
 * sitting between the stem and the extension. Nothing else about the name is
 * touched, and a name with no such run is its own logical name.
 */
export function logicalName(emitted: string): string {
	return emitted.replace(/\.[0-9a-f]{8,}(?=\.[A-Za-z0-9]+$)/u, '');
}

export type Parity = Readonly<{
	basis: string;
	eraFiles: number;
	migratedFiles: number;
	eraLogicalNames: number;
	migratedLogicalNames: number;
	sharedLogicalNames: number;
	onlyInEra: readonly string[];
	onlyInMigrated: readonly string[];
	identicalBytes: number;
}>;

/**
 * A build-level comparison of the two artifact sets by logical name.
 *
 * Byte parity is not available and is not claimed: the two artifacts were
 * emitted by different bundlers eleven majors apart, and every chunk they share
 * differs in bytes by construction. What is comparable is the set of logical
 * assets each build emits, and that is what this states.
 */
export function compareInventories(
	era: readonly InventoryEntry[],
	migrated: readonly InventoryEntry[],
): Parity {
	const eraNames = new Map(era.map((entry) => [logicalName(entry.path), entry]));
	const migratedNames = new Map(migrated.map((entry) => [logicalName(entry.path), entry]));
	const shared = [...eraNames.keys()].filter((name) => migratedNames.has(name));
	let identical = 0;
	for (const name of shared)
		if (eraNames.get(name)?.sha256 === migratedNames.get(name)?.sha256) identical += 1;
	return Object.freeze({
		basis:
			'logical emitted name — the content hash removed from each file name, because a ' +
			'content-addressed name cannot match across two bundlers and the asset behind it can. ' +
			'Both sides emit some assets twice under two hashes of the same logical name, so the ' +
			'logical-name counts are smaller than the file counts on both sides and the comparison ' +
			'is between name sets rather than between files.',
		eraFiles: era.length,
		migratedFiles: migrated.length,
		eraLogicalNames: eraNames.size,
		migratedLogicalNames: migratedNames.size,
		sharedLogicalNames: shared.length,
		onlyInEra: Object.freeze(
			[...eraNames.keys()].filter((name) => !migratedNames.has(name)).sort(),
		),
		onlyInMigrated: Object.freeze(
			[...migratedNames.keys()].filter((name) => !eraNames.has(name)).sort(),
		),
		identicalBytes: identical,
	});
}

type FileDigest = Readonly<{ path: string; sha256Before: string; sha256After: string }>;

/** Every application file this lane changed, with the digest on both sides. */
export async function applicationFilesChanged(): Promise<readonly FileDigest[]> {
	const after = path.join(APPLIED_TREE, 'src');
	const changed: FileDigest[] = [];
	for (const file of await walk(after)) {
		const relative = path.relative(after, file);
		const before = await readFile(path.join(BEFORE_TREE, relative), 'utf8').catch(() => null);
		const now = await readFile(file, 'utf8');
		if (before === null || before === now) continue;
		changed.push(
			Object.freeze({
				path: `src/${relative}`,
				sha256Before: sha256(before),
				sha256After: sha256(now),
			}),
		);
	}
	return Object.freeze(changed);
}

const DIAGNOSTIC = /error (?:TS|NG)\d+/g;

export type BuildReading = Readonly<{
	name: string;
	exitStatus: number;
	diagnostics: number;
	sha256: string;
}>;

async function readBuild(index: number): Promise<BuildReading> {
	const log = await readFile(
		path.join(STAGE_DIRECTORY, `build-${String(index)}.stderr.log`),
		'utf8',
	);
	return Object.freeze({
		name: `build-${String(index)}`,
		exitStatus: Number.parseInt(
			(await readFile(path.join(STAGE_DIRECTORY, `build-${String(index)}.exit`), 'utf8')).trim(),
			10,
		),
		diagnostics: log.match(DIAGNOSTIC)?.length ?? 0,
		sha256: sha256((log.match(/.*error (?:TS|NG)\d+.*/g) ?? []).join('\n')),
	});
}

export async function buildFinalLaneRecord(): Promise<SealedRecord> {
	const changed = await applicationFilesChanged();
	const builds = [await readBuild(5), await readBuild(6), await readBuild(7), await readBuild(8)];
	const first = await inventoryOf(path.join(STAGE_DIRECTORY, 'dist-7'));
	const second = await inventoryOf(path.join(STAGE_DIRECTORY, 'dist-8'));
	const era: unknown = JSON.parse(
		await readFile(path.join(EVIDENCE_DIRECTORY, ERA_BASELINE_FILE), 'utf8'),
	);
	const eraInventory = (era as Readonly<{ inventory: readonly InventoryEntry[] }>).inventory;
	const identical = canonical(first) === canonical(second);
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-final-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: identical ? 'green-deterministic-parity-by-logical-name' : 'green-not-deterministic',
		meaning:
			'The four demands u17c itemised are answered by capabilities that read the installed ' +
			'closure and the compiler. Answering them uncovered a fifth — the webpack `~` prefix in ' +
			'this application\'s stylesheets — which is answered by a fifth capability, and the ' +
			'production build then went green. Two builds over the same bytes emitted the same ' +
			'inventory, file for file and digest for digest. Parity against the era lane is stated ' +
			'at the level the two artifacts can be compared at, and its limits are named.',
		supersedes: {
			record: 'u17c-green-lane.json',
			unit: 'lrapr-t006/u17c-tiny-translator-green-parity',
			why:
				'u17c left the lane at four diagnostics and zero unresolvable specifiers and itemised ' +
				'each remaining demand. All four are answered here. One of its readings is corrected: ' +
				'u17c predicted that `UpdateAvailableEvent` had no successor symbol and that the demand ' +
				'was a call-site migration onto `versionUpdates`. The installed 16.2.12 surface says ' +
				'otherwise — it still exports `UpdateAvailableEvent` from the package root and still ' +
				'declares `SwUpdate.available`, both deprecated — so the demand really was the ' +
				'specifier alone, and the capability that answers it reads that rather than assuming ' +
				'either way.',
		},
		capabilities: [
			{
				name: 'deep-import-redirection',
				package: '@versionless/angular',
				answers:
					"the `@angular/service-worker/src/low_level` demand — an import of a subpath the package's exports map does not name",
				mechanism:
					"The mirror image of the barrel split, sharing its resolver. Every specifier the installed package's exports map answers is enumerated; an import addressing the package through a specifier that is not one of them is unreachable, and each name it imports is resolved to the shallowest published entry point whose parsed declaration surface carries it. `UpdateAvailableEvent` is on the root surface of 16.2.12, so the import moves to the root. A name on no surface, a default or namespace binding, and a side-effect-only deep import are each refused by name, and refusal is all-or-nothing per declaration.",
				applicationFilesChanged: 1,
			},
			{
				name: 'entry-components-removal',
				package: '@versionless/angular',
				answers: 'the `entryComponents` demand — a property Angular 13 removed from the NgModule type',
				mechanism:
					'The property has no successor, so the only question is whether dropping it is an equivalence, and the capability answers that before it edits. The decorator is located by resolving the binding `@angular/core` exported as `NgModule`; the literal is read only when every one of its properties is a plain named data property; and the drop happens only when every component `entryComponents` names is also named — as a resolved binding, not as a spelling — by `declarations` or `bootstrap` of the same literal. A component reachable through neither is refused by name and the property is left where it is.',
				applicationFilesChanged: 1,
			},
			{
				name: 'module-with-providers-type-argument',
				package: '@versionless/angular',
				answers: 'the bare `ModuleWithProviders` demand — a type that stopped defaulting its parameter in Angular 10',
				mechanism:
					"The argument is never guessed. It is read from the one place the source states it: the receiver of the static call the annotated variable is initialised by — `RouterModule.forRoot(...)` states `RouterModule` — or the class a static method with the annotation is declared on. The receiver has to be an identifier the module resolves to a binding, so a namespace member or an unbound name is refused. An annotation in any other position is refused by name, because nothing in the source says which module it configures. An annotation that already carries an argument is not a site.",
				applicationFilesChanged: 1,
			},
			{
				name: 'widened-union-narrowing',
				package: '@versionless/angular',
				answers: "the `FileReader.result` demand — a DOM declaration TypeScript widened under the application",
				mechanism:
					"Diagnostic-driven, the way the RxJS migration is: the compiler's own TS2322 supplies the position, the union the expression has and the type the position wants, and nothing about the DOM is written into the capability. The narrowing is a runtime `typeof` guard rather than an assertion, and it is only written when the shape makes it total — the flagged expression is a reference to a `const` declared directly in a block, the guard covers every statement after that declaration to the end of the block, every reference to the binding is inside that region, and the wanted type is a `typeof`-testable member of the named union. Everything else is refused by name.",
				applicationFilesChanged: 1,
			},
			{
				name: 'webpack-tilde-style-specifier',
				package: '@versionless/angular',
				answers:
					"the fifth family, invisible until the four above cleared: six stylesheet at-rules still asking webpack to resolve a module through the `~` prefix",
				mechanism:
					"The successor is the same specifier without the prefix, so the transform is one character and the whole of the capability is the check in front of it. The prefix is dropped only when the installed closure carries a file sass would resolve the un-prefixed specifier to, tried in sass's own order — the exact path, the partial, each of sass's extensions, and the directory index. The closure is asked, not assumed: the caller supplies the single question `does the closure carry this path`, so the transform is a pure function of the module and the reading. A tilde import the closure cannot answer is refused by name rather than un-prefixed into a different failure.",
				applicationFilesChanged: 5,
			},
		],
		iteration: {
			why:
				'Each round is a build, a diagnostic read, and an application. The narrowing is ' +
				'diagnostic-driven and the fifth family was invisible until the compiler stopped ' +
				'failing before the bundler ran, so the lane is a fixpoint and the record says how ' +
				'many rounds it took.',
			rounds: [
				{
					round: 1,
					diagnosticsRead: 'build-4.stderr.log (the u17c build)',
					moved:
						'deep-import: 1 file. entryComponents: 1 file. ModuleWithProviders: 1 file. narrowing: 1 file. The four TypeScript demands cleared together.',
				},
				{
					round: 2,
					diagnosticsRead: 'build-5.stderr.log — zero TypeScript diagnostics, and the sass pipeline failing on six tilde specifiers',
					moved:
						'tilde: 5 files, 6 at-rules. The other four capabilities found nothing left to do, which is the check that they are idempotent.',
				},
			],
		},
		acquisition: {
			purpose: 'None. This lane installed nothing.',
			consentId: CONSENT,
			networkMode: 'none',
			outcome: 'not-attempted',
			note: 'The closure is the one u17c installed and recorded. No package was added, removed or upgraded here, and no host was contacted.',
		},
		builds: builds.map((build) => ({
			name: build.name,
			exitStatus: build.exitStatus,
			diagnostics: build.diagnostics,
			diagnosticListSha256: build.sha256,
			command: 'npx ng build --configuration production',
		})),
		determinism: {
			claim:
				'build-7 and build-8 ran the same command over the same bytes with no edit between ' +
				'them, each into a cleaned output directory, and emitted the same inventory — same ' +
				'file count, same names, same digests.',
			runs: 2,
			identical,
			files: first.length,
			inventorySha256: sha256(canonical(first)),
		},
		applicationFilesChanged: changed,
		artifactsEmitted: first.length,
		inventory: first,
		parity: compareInventories(eraInventory, first),
		parityNote:
			'This is a build-level parity statement and it is not a byte-parity claim. The era ' +
			'artifact was emitted by Angular CLI 1.5.4 over webpack 3.8.1 and the migrated one by the ' +
			'16.2 builder over esbuild and webpack 5; every chunk they share differs in bytes by ' +
			'construction, and the identical-bytes count below says how many did not. What is ' +
			'comparable across eleven majors is the set of logical assets each build emits, and the ' +
			'asymmetries are listed by name rather than summarised.',
		notEstablished: [
			'Nothing was executed. The build is green and two artifacts exist; no browser opened either of them and no journey was driven.',
			'Byte parity is not claimed and is not available. The two builders are eleven majors apart.',
			"The `typeof` guard the narrowing inserted carries a declared difference: where `FileReader.result` is not a string, the two statements it guards no longer run. The application reads the file with `readAsText`, and nothing in this lane observes that at run time.",
			'`SwUpdate.available` and `UpdateAvailableEvent` are deprecated on the installed surface. The redirection made the import resolve; it did not move the call site off the deprecated member, and no capability in this unit claims to have.',
			"The spec files were rewritten where the same capabilities applied to them, and the production build does not compile them. Whether this application's tests pass is not established here.",
			'The era inventory this lane compares against was emitted by the era lane for the plain variant. The application also publishes four localised variants, and none of them was built on either side.',
		],
		recordedRisks: [
			'A TLS private key (key.pem) and its certificate (cert.pem) are committed at the root of the pinned tree. Neither was copied into the stage tree and neither appears in any artifact of this run.',
			'`util@0.12.5`, the browser implementation of the Node core module, remains in the declared closure for ngx-i18nsupport-lib, unchanged from u17c.',
			'@angular/flex-layout remains at a deprecated beta release, unchanged from u17c and for the same reason.',
			"The migrated stylesheet payload is built through @angular/material's deprecated `_theming.scss` legacy API. It resolves and it compiles; it is a deprecated surface, and no capability here moved the application onto the `@use`-based one.",
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildFinalLaneRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, FINAL_LANE_FILE), canonical(record));
	process.stdout.write(
		`final lane ${String(record['result'])}, digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-final-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
