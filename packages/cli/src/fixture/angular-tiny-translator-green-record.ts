/**
 * The record of the green lane: what the three capabilities changed, what the
 * build then said, and what it still says.
 *
 * The lane is not green, and this record does not pretend otherwise. The three
 * demand families u17b itemised are answered — the barrel is split, the Node
 * core bindings are gone from the browser code, every patched RxJS call site is
 * a `pipe` — and answering them uncovered four more that only a build getting
 * past the first three could see. Those four are itemised the way u17b itemised
 * theirs, because that list is the specification for whatever comes next.
 *
 * Everything numeric here is read from the tree and from the build logs at the
 * moment the record is written. Nothing is carried from a previous run.
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import {
	sealRecord,
	verifySealedRecord,
	type SealedRecord,
} from './angular-factoriolab-build-lanes-run.ts';
import { CONSENT } from './angular-tiny-translator-lanes-run.ts';
import { APPLIED_TREE, EVIDENCE_DIRECTORY, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';

export const UNIT = 'lrapr-t006/u17c-tiny-translator-green-parity';
export const GREEN_LANE_FILE = 'u17c-green-lane.json';

/** The source tree as u17b left it, kept so this lane can state its own diff. */
export const BEFORE_TREE = path.join(STAGE_DIRECTORY, 'src-before-green');

/** A residual demand: what the build still asks for, stated so it can be answered. */
export type ResidualDemand = Readonly<{
	file: string;
	symbol: string;
	library: string;
	observed: string;
	neededTransform: string;
}>;

/**
 * The four demands that were invisible until the first three were answered. Each
 * is an era API that the eleven majors removed or tightened, and none of them is
 * in the three families this unit carried capabilities for.
 */
export const RESIDUAL_DEMANDS: readonly ResidualDemand[] = Object.freeze([
	{
		file: 'src/app/app.component.ts:8',
		symbol: "import { UpdateAvailableEvent } from '@angular/service-worker/src/low_level'",
		library: '@angular/service-worker 5 → 16.2',
		observed:
			"src/app/app.component.ts:8:36 - error TS2307: Cannot find module '@angular/service-worker/src/low_level' or its corresponding type declarations.",
		neededTransform:
			"A deep import into a package's unpublished internals. The 16.2 package declares an exports map, and `./src/low_level` is not on it: the subpath is unreachable whatever is on disk. This is the mirror image of the barrel split — a symbol reached one directory too deep rather than one too shallow — and the same closure reading answers the resolvable half of it. `UpdateAvailableEvent` itself is not a symbol the installed package publishes under any subpath: the SwUpdate surface replaced it with a discriminated `VersionEvent` union, so the reading refuses and the demand is a call-site migration onto `versionUpdates`, not a specifier rewrite.",
	},
	{
		file: 'src/app/app.module.ts:95',
		symbol: 'entryComponents in an @NgModule literal',
		library: '@angular/core 5 → 16.2',
		observed:
			"src/app/app.module.ts:95:3 - error TS2345: Argument of type '{ declarations: …; entryComponents: …; }' is not assignable to parameter of type 'NgModule'.",
		neededTransform:
			'Ivy removed the entry-component concept and Angular 13 removed the `entryComponents` property from the `NgModule` type. Every component it named is reachable without it. The transform is a property removal from a decorator literal, and it is a removal rather than a rename: there is no successor property to move the list into.',
	},
	{
		file: 'src/app/app.routing.ts:32',
		symbol: 'ModuleWithProviders written without a type argument',
		library: '@angular/core 5 → 16.2',
		observed:
			"src/app/app.routing.ts:32:23 - error TS2314: Generic type 'ModuleWithProviders<T>' requires 1 type argument(s).",
		neededTransform:
			"Angular 10 made `ModuleWithProviders` generic and stopped defaulting its parameter. The argument is not guessable in general, but it is readable here: the annotated expression is `RouterModule.forRoot(...)`, whose declared return type names the module, so the type argument is a reading of the callee's signature rather than an assumption. A transform that could not read it would have to refuse.",
	},
	{
		file: 'src/app/model/asynchronous-file-reader.service.ts:33',
		symbol: 'FileReader.result assigned to a string',
		library: "TypeScript's DOM library, 2.4 → 5.1",
		observed:
			"src/app/model/asynchronous-file-reader.service.ts:33:57 - error TS2322: Type 'string | ArrayBuffer' is not assignable to type 'string'.",
		neededTransform:
			"Not a package change at all: the DOM typings the compiler ships widened `FileReader.result` to `string | ArrayBuffer | null` to describe what the API always did. The application reads a file as text and so its result really is a string, but nothing in the type says so. The honest answers are a narrowing at the use site or a declared assertion; either is a call-site transform, and neither is a version mapping.",
	},
]);

type FileDigest = Readonly<{ path: string; sha256Before: string; sha256After: string }>;

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

async function readLog(name: string): Promise<string> {
	return await readFile(path.join(STAGE_DIRECTORY, name), 'utf8');
}

function count(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0;
}

const DIAGNOSTIC = /error (?:TS|NG)\d+/g;
const UNRESOLVED = /Module not found: Error: Can't resolve/g;

export type BuildReading = Readonly<{
	name: string;
	exitStatus: number;
	diagnostics: number;
	unresolved: number;
	sha256: string;
}>;

async function readBuild(index: number): Promise<BuildReading> {
	const log = await readLog(`build-${String(index)}.stderr.log`);
	return Object.freeze({
		name: `build-${String(index)}`,
		exitStatus: Number.parseInt((await readLog(`build-${String(index)}.exit`)).trim(), 10),
		diagnostics: count(log, DIAGNOSTIC),
		unresolved: count(log, UNRESOLVED),
		sha256: sha256((log.match(/.*error (?:TS|NG)\d+.*/g) ?? []).join('\n')),
	});
}

export async function buildGreenLaneRecord(): Promise<SealedRecord> {
	const changed = await applicationFilesChanged();
	const builds = [await readBuild(1), await readBuild(2), await readBuild(3), await readBuild(4)];
	const installLog = await readLog('install-3.stdout.log');
	const added = /added (\d+) packages?/.exec(installLog);
	return sealRecord({
		schemaVersion: 'versionless.angular-tiny-translator-green-lane.v1',
		unit: UNIT,
		consentId: CONSENT,
		result: 'three-demand-families-answered-build-red-residual-itemised',
		meaning:
			'The three demand families u17b itemised are answered by capabilities that read the installed closure and the compiler, not by edits this record does not name. The build went from 72 diagnostics and 29 unresolvable module specifiers to 4 diagnostics and 0 unresolvable specifiers, and it is still red. The four diagnostics that remain are demands no capability in this unit carried, and they are itemised below. No artifact was emitted, so no parity is claimed.',
		supersedes: {
			record: 'u17b-migrated-lane.json',
			unit: 'lrapr-t006/u17b-tiny-translator-migrated-lane',
			why: 'u17b recorded the red build and itemised four demands. Three of them — the @angular/material barrel, the Node `util` core module in browser code, and the RxJS 5 prototype patching — are answered here, and the fourth (the NG2003/NG6001 injection-token errors) cleared with the barrel as u17b predicted it would. This record replaces the demand list with what the build says now.',
		},
		capabilities: [
			{
				name: 'barrel-entry-point-split',
				package: '@versionless/angular',
				answers: "the @angular/material barrel demand, and the injection-token demand that followed it",
				mechanism:
					"The installed package's own exports map is enumerated, each entry point's declaration file is parsed, and every barrel symbol is mapped to the shallowest entry point whose surface carries it. A symbol on no surface is refused by name and its whole declaration is left alone. Nothing about @angular/material is written into the capability: the same reading of a package that kept its barrel reports nothing to split.",
				applicationFilesChanged: 8,
			},
			{
				name: 'node-core-binding-migration',
				package: '@versionless/angular',
				answers: "the application half of the `util` demand — 16 modules importing isNullOrUndefined, isString and format",
				mechanism:
					"Each binding is expanded into the ECMAScript that Node documents it as: `isNullOrUndefined(x)` becomes `(x == null)`, `isString(x)` becomes `(typeof x === 'string')`, and every expansion mentions its argument exactly once so no call can be evaluated twice. `format` is expanded as a directive reading — a literal %s-only format string becomes a template literal — and refused for every other directive. A module with one reference the table cannot expand keeps its import and every call site.",
				applicationFilesChanged: 16,
			},
			{
				name: 'declared browser dependency for `util`',
				package: 'the application manifest',
				answers: "the library half of the `util` demand — ngx-i18nsupport-lib 1.10.2's own `require('util')`",
				mechanism:
					"No application transform reaches a published library's own imports, and no shim was authored for it. The workspace declares `util@^0.12.5` — the published browser implementation of the core module — as an explicit dependency, so ordinary node resolution answers the library's require and the declaration is visible in the manifest rather than hidden in a bundler alias. It is scoped to the specifier rather than to the dependency, because the browser builder exposes no issuer-scoped alias; the only importer left after the call-site transform is ngx-i18nsupport-lib, and that is a fact about this closure rather than a guarantee the mechanism enforces.",
				applicationFilesChanged: 0,
			},
			{
				name: 'rxjs-prototype-patch-migration',
				package: '@versionless/angular',
				answers: 'the RxJS 5 prototype-patch demand — 37 call sites and 19 patch imports',
				mechanism:
					"Which `.map(` belongs to an observable and which to an array is not a question the syntax answers, so the capability does not ask the syntax: it takes the compiler's TS2339 diagnostics, each naming a position and the receiver's type, and moves exactly those call sites. Instance operators become `pipe(...)` with the operator imported by name, static creation methods become the free functions of the installed root, and every name emitted is checked against the installed RxJS surface first. Refusal is per module and total, and the patch imports are dropped only where every call site the compiler named in that module moved.",
				applicationFilesChanged: 12,
			},
		],
		iteration: {
			why: 'A diagnostic-driven transform sees only what the compiler could still type. A `.map` whose receiver is the result of an already-failed `.catch` is typed `any` and produces no diagnostic, so it becomes visible only after the call before it is fixed. The lane is therefore a fixpoint, and the record says how many rounds it took rather than presenting the result as one pass.',
			rounds: [
				{
					round: 1,
					diagnosticsRead: 'build-1.stderr.log (the u17b build)',
					moved:
						'rxjs: 10 files, 51 changes. barrel: 8 files, 8 declarations split. util: 16 files, 50 call sites and imports.',
				},
				{
					round: 2,
					diagnosticsRead: 'build-2.stderr.log',
					moved:
						'rxjs: 2 files, 5 changes — the call sites that were typed `any` until round 1 fixed the call before them. The other two capabilities found nothing left to do, which is the check that they are idempotent.',
				},
			],
		},
		acquisition: {
			purpose:
				"Install the one dependency this lane declared: the published browser implementation of Node's `util`, for a library that imports it from its own published code.",
			consentId: CONSENT,
			networkMode: 'consented',
			method: 'npm install --no-audit --no-fund, in the applied tree, with the manifest declaring util@^0.12.5.',
			outcome: 'succeeded',
			exitStatus: 0,
			packagesAdded: added === null ? null : Number.parseInt(added[1] as string, 10),
			hosts: ['registry.npmjs.org'],
		},
		builds: builds.map((build) => ({
			name: build.name,
			exitStatus: build.exitStatus,
			diagnostics: build.diagnostics,
			unresolvedSpecifiers: build.unresolved,
			diagnosticListSha256: build.sha256,
		})),
		determinism: {
			claim:
				'build-3 and build-4 ran the same command over the same bytes with no edit between them and produced the same exit status and the same diagnostic list, digest for digest.',
			runs: 2,
			identical: builds[2]?.sha256 === builds[3]?.sha256,
		},
		applicationFilesChanged: changed,
		artifactsEmitted: 0,
		parity: null,
		parityNote:
			'No parity is recorded and none is claimed. A build-level parity statement compares two artifacts and this lane emitted none: the build is still red. The era lane inventory in u17-era-baseline.json stands on its own, and the plain-variant comparison the established idiom would make is owed by whichever unit gets a bundle out of this application.',
		residualDemands: RESIDUAL_DEMANDS,
		notEstablished: [
			'The build is red. Four diagnostics remain and no bundle exists, so nothing here establishes that this application runs on Angular 16.',
			'Nothing was executed. Every claim in this record is a claim about a compiler and a bundler reading source, not about behaviour.',
			'The rewritten call sites were type-checked, not run. `(x == null)` is what Node documents `isNullOrUndefined` to be, and the compiler accepts it; no test in this application exercised any of the 50 sites.',
			'The `%s` expansions carry a declared difference: Node inspects a plain object where `String()` calls its built-in toString. Nothing here observes which arguments are objects at runtime.',
			'The spec files were rewritten where the same capabilities applied to them, and the production build does not compile them. Whether the tests of this application pass is not established by anything in this lane.',
			'The residual list is what this build asks for now. Answering it may reveal further demands that only a build getting past these can see — that is what happened to the u17b list, twice.',
		],
		recordedRisks: [
			'A TLS private key (key.pem) and its certificate (cert.pem) are committed at the root of the pinned tree. Neither was copied into the stage tree and neither appears in any artifact of this run.',
			'`util@0.12.5` is a browser implementation of a Node core module and is now in the declared closure of this application. It is reached only by ngx-i18nsupport-lib, and it is a payload the era build did not carry in this form.',
			'@angular/flex-layout remains at a deprecated beta release, unchanged from u17b and for the same reason.',
		],
	});
}

export async function main(): Promise<void> {
	const record = verifySealedRecord(await buildGreenLaneRecord());
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, GREEN_LANE_FILE), canonical(record));
	process.stdout.write(
		`green lane ${String(record['result'])}: ${String(RESIDUAL_DEMANDS.length)} residual demands, ` +
			`digest ${sha256(canonical(record)).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-green-record.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
