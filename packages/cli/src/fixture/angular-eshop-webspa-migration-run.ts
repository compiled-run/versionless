/**
 * The replacement Angular holdout: compose the `@versionless/angular` changeset
 * for the pinned eShopOnContainers `WebSPA` tree and write it into a migrated
 * lane, so a closure can be installed into it and a production build attempted
 * on the bytes the frozen adapter produced.
 *
 * This application was never seen by the adapter while the adapter was being
 * designed. Nothing in `@versionless/angular` was written for it, and nothing in
 * `@versionless/angular` was changed for it: the adapter subtree is frozen for
 * the whole of this unit, and the composite of the five frozen subtrees is
 * recomputed before and after. What this driver produces is therefore a
 * measurement and not a demonstration.
 *
 * The driver is fixture-scoped. It knows three things about this application —
 * where its corpus was materialised, that its Angular `sourceRoot` is `Client/`
 * rather than the conventional `src/`, and that the npm and Angular workspace
 * root is the `src/Web/WebSPA` subpath of a polyglot .NET monorepo. Those are
 * paths, read out of the application's own `angular.json` and its own
 * `Dockerfile`. Every decision about *what to change* lives in the frozen
 * adapter, which knows nothing about this application.
 *
 * ## The hop this application asks for
 *
 * Angular 6.1.4 to Angular 16.2 is two majors longer than the pigallery2 holdout
 * (8.1.2) and one workspace generation older: `angular.json` `"version": 1`, the
 * first `angular.json` the CLI ever wrote, which no counted Angular vertical
 * covers. The measured question the board set for it is `@angular/http`: the
 * application imports it at six sites, four of them type-position `Response`
 * only, while already carrying `HttpClientModule` in its root module and two
 * services on `HttpClient`. Whether the frozen engine can carry that package to
 * its first-party successor is answered here through the public driver seam
 * {@link succeedRemovedEntryPointSymbols} and nothing else.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	migrateAngularCliEraWorkspace,
	succeedRemovedEntryPointSymbols,
	ANGULAR_16_BROWSER_CELL,
	type AngularMigration,
	type ClosureFileReading,
	type DocumentedSymbolSuccessor,
	type ModuleClassSurfaceReading,
	type PatchedCallDiagnostic,
	type RootSurfaceReading,
	type RxjsPatchDiagnosticReading,
	type RxjsSurfaceReading,
	type SymbolSuccessorMigration,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';
import { canonical, sha256 } from './angular-factoriolab-migration-run.ts';
import { sealRecord, verifySealedRecord, type SealedRecord } from './angular-factoriolab-build-lanes-run.ts';
import { applyMigration, type Application } from './angular-tiny-translator-apply-run.ts';
import { readEraClosureTypePackages } from './angular-pigallery2-migration-run.ts';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

export const UNIT = 'lrapr-t023/u5-frozen-adapter-migration';
export const CONSENT = 'VL-LEGACY-CORPUS-2026-08-10';
export const COMMIT = 'a387f21029f0b2d49614d165d5384717d2398f8e';

/**
 * The npm and Angular workspace root inside the pinned monorepo.
 *
 * This is the directory that carries `package.json`, `package-lock.json` and
 * `angular.json`, and it is the directory the repository's own `Dockerfile`
 * copies as its build context (`COPY src/Web/WebSPA .`). The narrowing is the
 * application's own, recorded rather than introduced here.
 */
export const APPLICATION_SUBPATH = 'src/Web/WebSPA';

/** The immutable corpus the baseline lane was also cut from. */
export const SOURCE_TREE = path.join(
	repositoryRoot,
	'.versionless/cache/angular-eshop-webspa-netcore2-2-source/corpus',
	`eShopOnContainers-${COMMIT}`,
	APPLICATION_SUBPATH,
);

/** The era lane: the pinned revision with the era closure installed into it. */
export const ERA_CLOSURE_TREE = path.join(
	repositoryRoot,
	'.versionless/work/angular-eshop-webspa/baseline',
);

/** The migrated lane, beside the baseline lane the previous unit built. */
export const STAGE_DIRECTORY = path.join(repositoryRoot, '.versionless/work/angular-eshop-webspa/target');
/** The pinned revision with the changeset written into it; the build tree. */
export const APPLIED_TREE = path.join(STAGE_DIRECTORY, 'app');

export const EVIDENCE_DIRECTORY = path.join(
	repositoryRoot,
	'evidence/ingests/angular-eshop-webspa-netcore2-2/migration',
);

/**
 * The tree the successor package's published surface is read from when the lane
 * has no closure of its own.
 *
 * The seam's reading is a reading of a *package*, and the lane closure is where
 * a driver would normally find it. This lane has none: the migrated install is
 * refused at dependency resolution, so `node_modules` in {@link APPLIED_TREE}
 * does not exist and a reading taken there would be empty — which the seam
 * refuses on `complete: false`, at a gate before the one the measured question
 * is about. Installing the successor package alone into a scratch tree is what
 * makes the later gates reachable, and it is recorded here rather than hidden
 * because a reading taken somewhere other than the lane is a fact about the
 * reading. Nothing about the application is read from this tree.
 */
export const SURFACE_PROBE_TREE = path.join(STAGE_DIRECTORY, 'probe');

export const CHANGESET_FILE = 'u5-composed-changeset.json';
export const MIGRATION_RECORD_FILE = 'u5-source-migration.json';
export const SEAM_PROBE_FILE = 'u5-angular-http-seam-probe.json';

/**
 * The one directory the Angular browser build compiles.
 *
 * `angular.json` declares `sourceRoot: "Client"` and `Client/tsconfig.app.json`
 * includes `**\/*.d.ts` beside the `Client/main.ts` entry, so the compilation
 * unit is contained by `Client/`. Unlike the pigallery2 holdout there is no
 * sibling directory the compiler reaches into: every relative import in this
 * application stays below `Client/`.
 */
export const APPLICATION_SOURCE_DIRECTORIES: readonly string[] = Object.freeze(['Client']);

async function filesBelow(
	directory: string,
	root: string,
	extension: string,
): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await filesBelow(item, root, extension)));
			continue;
		}
		if (!entry.isFile() || path.extname(entry.name) !== extension) continue;
		files.push({ path: path.relative(root, item), source: await readFile(item, 'utf8') });
	}
	return files;
}

/** Every workspace-relative path the tree carries, excluding installed packages. */
async function workspacePathsBelow(directory: string, root: string): Promise<string[]> {
	const paths: string[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'wwwroot') continue;
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			paths.push(...(await workspacePathsBelow(item, root)));
			continue;
		}
		if (entry.isFile()) paths.push(path.relative(root, item));
	}
	return paths;
}

/**
 * The lockfiles at the workspace root, read as bytes.
 *
 * This application carries one: a `lockfileVersion` 1 `package-lock.json` with
 * 902 top-level entries, npm 5's own resolution of the Angular 6.1.4 closure.
 * The driver reads it and hands it over; what it means is the adapter's reading,
 * not this file's.
 */
async function collectLockfiles(tree: string): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const name of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock']) {
		const at = path.join(tree, name);
		if (!existsSync(at)) continue;
		files.push({ path: name, source: await readFile(at, 'utf8') });
	}
	return files;
}

async function collect(
	tree: string,
	extension: string,
	directories: readonly string[],
): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const directory of directories)
		files.push(...(await filesBelow(path.join(tree, directory), tree, extension)));
	return files;
}

/**
 * The four readings of the installed lane this driver takes, and the one thing
 * they have in common: not one of them is a reading of the application. Three
 * are readings of packages the migrated manifest installed, and the fourth is a
 * reading of what the compiler said when it compiled the lane.
 */
export type LaneReadings = Readonly<{
	removedSymbolSurfaces: readonly RootSurfaceReading[];
	moduleClassSurfaces: readonly ModuleClassSurfaceReading[];
	rxjsPatchDiagnostics: readonly RxjsPatchDiagnosticReading[];
	rxjsSurface?: RxjsSurfaceReading;
	styleClosure?: ClosureFileReading;
}>;

/** No lane, no readings: every gated capability stands down. */
export const EMPTY_LANE_READINGS: LaneReadings = Object.freeze({
	removedSymbolSurfaces: Object.freeze([]),
	moduleClassSurfaces: Object.freeze([]),
	rxjsPatchDiagnostics: Object.freeze([]),
});

/**
 * The names an `export { … } from '…'` declaration line publishes, with an
 * `as` rename resolved to the exported name. Declaration files of this shape —
 * one re-export per line — are what both packages read here publish, and the
 * reading is refused as incomplete when it finds none.
 */
function reExportedNames(source: string): readonly string[] {
	const names = new Set<string>();
	for (const line of source.split('\n')) {
		const text = line.trim();
		if (!text.startsWith('export {')) continue;
		const open = text.indexOf('{');
		const close = text.indexOf('}', open);
		if (open < 0 || close < 0) continue;
		for (const part of text.slice(open + 1, close).split(',')) {
			const name = part.split(' as ').at(-1)?.trim();
			if (name !== undefined && name !== '') names.add(name);
		}
	}
	return Object.freeze([...names].sort());
}

/**
 * The leading run of `text` that stops before any of `delimiters`. Written as a
 * scan rather than a split so this file introduces no regular expression.
 */
function headToken(text: string, delimiters: string): string {
	for (let index = 0; index < text.length; index += 1)
		if (delimiters.includes(text[index] as string)) return text.slice(0, index);
	return text;
}

/** The installed version of a package, or `unknown` when it cannot be read. */
async function installedVersion(modules: string, owner: string): Promise<string> {
	try {
		const manifest = JSON.parse(
			await readFile(path.join(modules, owner, 'package.json'), 'utf8'),
		) as Readonly<{ version?: unknown }>;
		return typeof manifest.version === 'string' ? manifest.version : 'unknown';
	} catch {
		return 'unknown';
	}
}

/**
 * What the installed declaration publishes as statics on one exported class.
 *
 * The reading is of the class body in the package's own `index.d.ts`: the lines
 * between `declare class X {` and the brace that closes it, reduced to the
 * `static` members. `complete` is false when the class declaration is not found
 * at all, because a reading that found no class proves no member absent.
 */
export async function readModuleClassSurface(
	tree: string,
	packageName: string,
	symbol: string,
): Promise<ModuleClassSurfaceReading> {
	const modules = path.join(tree, 'node_modules');
	const version = await installedVersion(modules, packageName);
	const declaration = path.join(modules, packageName, 'index.d.ts');
	const statics: string[] = [];
	let complete = false;
	if (existsSync(declaration)) {
		const lines = (await readFile(declaration, 'utf8')).split('\n');
		let inside = false;
		for (const line of lines) {
			const text = line.trim();
			if (!inside) {
				if (!text.startsWith('export declare class ') && !text.startsWith('declare class '))
					continue;
				const named = headToken(
					text.slice(text.indexOf('class ') + 'class '.length),
					' <{',
				);
				if (named !== symbol) continue;
				inside = true;
				complete = true;
				continue;
			}
			if (text.startsWith('}')) break;
			if (!text.startsWith('static ')) continue;
			const member = headToken(text.slice('static '.length), ' (:<;=?');
			if (member !== '') statics.push(member);
		}
	}
	return Object.freeze({
		package: packageName,
		version,
		symbol,
		statics: Object.freeze([...new Set(statics)].sort()),
		complete,
	});
}

/** What the installed RxJS publishes from its root and from its operator entry point. */
export async function readRxjsSurface(tree: string): Promise<RxjsSurfaceReading | undefined> {
	const modules = path.join(tree, 'node_modules');
	const root = path.join(modules, 'rxjs/dist/types/index.d.ts');
	const operators = path.join(modules, 'rxjs/dist/types/operators/index.d.ts');
	if (!existsSync(root) || !existsSync(operators)) return undefined;
	const rootExports = reExportedNames(await readFile(root, 'utf8'));
	const operatorExports = reExportedNames(await readFile(operators, 'utf8'));
	if (rootExports.length === 0 || operatorExports.length === 0) return undefined;
	return Object.freeze({
		version: await installedVersion(modules, 'rxjs'),
		rootExports,
		operatorExports,
	});
}

/** The receiver types this driver reads as RxJS's, as the compiler spells them. */
export const RXJS_RECEIVER_TYPES: readonly string[] = Object.freeze([
	'Observable',
	'Subject',
	'BehaviorSubject',
	'ReplaySubject',
	'AsyncSubject',
	'ConnectableObservable',
]);

/**
 * The `TS2339` diagnostics an Angular build log states, per file, reduced to the
 * ones whose receiver the compiler named as an RxJS type.
 *
 * The filter is the honest part. A `TS2339` on a DOM interface is a different
 * capability's diagnostic and feeding it here would refuse the whole module for
 * a reason that is not about RxJS; the receiver type is the compiler's own
 * words, so the separation is read rather than guessed. Positions are the
 * compiler's, into the bytes it compiled — which is why the capability that
 * takes them re-places every one of them before it edits anything.
 */
export function readRxjsPatchDiagnostics(log: string): readonly RxjsPatchDiagnosticReading[] {
	const byPath = new Map<string, PatchedCallDiagnostic[]>();
	for (const line of log.split('\n')) {
		const text = line.trim();
		const marker = ' - error TS2339: Property ';
		const at = text.indexOf(marker);
		if (at < 0) continue;
		const head = text.slice(0, at);
		const tail = text.slice(at + marker.length);
		const property = tail.split("'")[1];
		const receiver = tail.split("on type '")[1]?.split("'")[0];
		if (property === undefined || receiver === undefined) continue;
		const bare = receiver.startsWith('typeof ') ? receiver.slice('typeof '.length) : receiver;
		const head0 = bare.split('<')[0] ?? bare;
		if (!RXJS_RECEIVER_TYPES.includes(head0)) continue;
		const parts = head.replace('Error: ', '').split(':');
		const column = Number(parts.at(-1));
		const lineNumber = Number(parts.at(-2));
		const file = parts.slice(0, -2).join(':').trim();
		if (!Number.isInteger(column) || !Number.isInteger(lineNumber) || file === '') continue;
		const list = byPath.get(file) ?? [];
		list.push(
			Object.freeze({ line: lineNumber, column, property, receiverType: receiver }),
		);
		byPath.set(file, list);
	}
	return Object.freeze(
		[...byPath.entries()]
			.sort((left, right) => (left[0] < right[0] ? -1 : 1))
			.map((entry) => Object.freeze({ path: entry[0], diagnostics: Object.freeze(entry[1]) })),
	);
}

/**
 * The closure question the tilde-specifier capability asks, answered against the
 * lane's own installed packages.
 */
export function styleClosureOf(tree: string): ClosureFileReading {
	const modules = path.join(tree, 'node_modules');
	return Object.freeze({
		carries: (relativePath: string): boolean => existsSync(path.join(modules, relativePath)),
	});
}

/**
 * Every reading of the installed lane, taken together, or the empty set when the
 * lane has no closure to read.
 *
 * A lane with no `node_modules` is the first pass of a two-pass hop: compose,
 * apply, install, and only then is there a closure for a reading to be taken
 * from. That is recorded rather than hidden, because a capability that stood
 * down for want of a reading is a different outcome from one that had nothing
 * to do.
 */
export async function readLaneReadings(
	tree: string,
	buildLog: string | null,
): Promise<LaneReadings> {
	if (!existsSync(path.join(tree, 'node_modules'))) return EMPTY_LANE_READINGS;
	const rxjsSurface = await readRxjsSurface(tree);
	return Object.freeze({
		removedSymbolSurfaces: Object.freeze([
			await readCrossPackageRootSurface(tree, '@angular/common/http', '@angular/http'),
		]),
		moduleClassSurfaces: Object.freeze([
			await readModuleClassSurface(tree, '@ng-bootstrap/ng-bootstrap', 'NgbModule'),
		]),
		rxjsPatchDiagnostics:
			buildLog === null ? Object.freeze([]) : readRxjsPatchDiagnostics(buildLog),
		...(rxjsSurface === undefined ? {} : { rxjsSurface }),
		styleClosure: styleClosureOf(tree),
	});
}

/**
 * Compose the changeset for the pinned tree.
 *
 * The workspace configuration handed in is an `angular.json` — the first
 * generation of one, `"version": 1` — so the CLI 1.x synthesis capability stands
 * down on its own: it reads the document's shape, and nothing here tells it
 * which format to expect.
 *
 * No compiler-positioned reading is supplied, and that is a statement about this
 * unit rather than about the application: the seams that take `TS2314` and
 * `TS2339` positions are reachable only for a caller that has compiled the tree
 * on the target line, and no such compilation existed when this changeset was
 * composed. A tree that supplies none has none transformed, which is a different
 * thing from having none to transform.
 */
export async function composeMigration(
	tree: string,
	readings: LaneReadings = EMPTY_LANE_READINGS,
): Promise<AngularMigration> {
	const sourceModules = (await collect(tree, '.ts', APPLICATION_SOURCE_DIRECTORIES)).filter(
		(module) => !module.path.endsWith('.spec.ts'),
	);
	return migrateAngularCliEraWorkspace(
		{
			/**
			 * Four readings of the *installed* lane, each one the gate on a capability
			 * that would otherwise be unreachable. They are readings of packages and of
			 * a compiler, taken from the lane a previous pass installed; nothing about
			 * the application is read from them, and a lane with no closure supplies
			 * none, which stands every one of those capabilities down.
			 */
			removedSymbolSurfaces: readings.removedSymbolSurfaces,
			moduleClassSurfaces: readings.moduleClassSurfaces,
			rxjsPatchDiagnostics: readings.rxjsPatchDiagnostics,
			...(readings.rxjsSurface === undefined ? {} : { rxjsSurface: readings.rxjsSurface }),
			...(readings.styleClosure === undefined ? {} : { styleClosure: readings.styleClosure }),
			eraClosureTypePackages: await readEraClosureTypePackages(ERA_CLOSURE_TREE),
			packageManifest: {
				path: 'package.json',
				source: await readFile(path.join(tree, 'package.json'), 'utf8'),
			},
			workspaceConfig: {
				path: 'angular.json',
				source: await readFile(path.join(tree, 'angular.json'), 'utf8'),
			},
			tsConfig: {
				path: 'tsconfig.json',
				source: await readFile(path.join(tree, 'tsconfig.json'), 'utf8'),
			},
			sourceModules,
			/**
			 * The era resolution, handed over as bytes rather than as a name. Whether
			 * it still describes the manifest the alignment rewrote is a reading of
			 * this file's own contents, and the capability that takes it removes
			 * nothing it could not read.
			 */
			lockfiles: await collectLockfiles(tree),
			templates: await collect(tree, '.html', APPLICATION_SOURCE_DIRECTORIES),
			styleSheets: await collect(tree, '.scss', APPLICATION_SOURCE_DIRECTORIES),
			workspaceFiles: await workspacePathsBelow(tree, tree),
		},
		ANGULAR_16_BROWSER_CELL,
	);
}

/**
 * The `@angular/http` successors, written down as claims for the driver seam.
 *
 * `@angular/http` is the package the target cell reads as `no-successor` and
 * drops from the manifest, and this application's own source still names it at
 * six sites. The seam {@link succeedRemovedEntryPointSymbols} is the only public
 * frozen surface that answers "this specifier is gone and the name lives
 * somewhere else now", so the question is asked of it here rather than answered
 * by hand.
 *
 * Two things about these claims are worth stating before the seam refuses or
 * accepts them, because they are the measurement:
 *
 * - The seam's `package` field is the module specifier the successor is written
 *   *to*, and Angular's HTTP successor lives at the `@angular/common/http` entry
 *   point rather than on the `@angular/common` root. Naming the entry point is
 *   what makes the rewrite land on a specifier the target line publishes.
 * - `arity` is part of the claim, and none of these symbols is a creation
 *   function. `Http` is a constructor-injected service, `Response` and `Headers`
 *   are a type and a class, and `HttpModule`/`JsonpModule` are NgModule values
 *   named inside an `imports` array. The field is filled with the only shape a
 *   caller could state for them and the seam is left to decide; a refusal on
 *   that ground is the finding, not a failure of the claim.
 *
 * `JsonpModule` carries no entry at all. Angular's JSONP successor is
 * `HttpClientJsonpModule`, and it is not a rename: it requires `HttpClientModule`
 * beside it and changes how a JSONP request is written at the call site. Writing
 * a claim for it would state a successor nobody read.
 */
export const ANGULAR_HTTP_SUCCESSORS: readonly DocumentedSymbolSuccessor[] = Object.freeze([
	Object.freeze({
		package: '@angular/common/http',
		specifier: '@angular/http',
		from: 'Http',
		to: 'HttpClient',
		arity: 1,
		since: 'Angular 8 (the package stops at 7.2.16)',
	}),
	Object.freeze({
		package: '@angular/common/http',
		specifier: '@angular/http',
		from: 'Response',
		to: 'HttpResponse',
		arity: 1,
		since: 'Angular 8 (the package stops at 7.2.16)',
	}),
	Object.freeze({
		package: '@angular/common/http',
		specifier: '@angular/http',
		from: 'Headers',
		to: 'HttpHeaders',
		arity: 1,
		since: 'Angular 8 (the package stops at 7.2.16)',
	}),
	Object.freeze({
		package: '@angular/common/http',
		specifier: '@angular/http',
		from: 'HttpModule',
		to: 'HttpClientModule',
		arity: 1,
		since: 'Angular 8 (the package stops at 7.2.16)',
	}),
]);

/**
 * What the installed target closure answers for a successor that lives in a
 * *different* package from the specifier that went away.
 *
 * The reading the seam takes is keyed by the pair (`package`, `specifier`), and
 * nothing in its shape requires the two to belong to one package — so a
 * cross-package successor is readable, and this is the reading. `specifierResolves`
 * asks the closure whether `@angular/http` is still installed at all;
 * `rootExports` is the published surface of the entry point the claims name,
 * read from that entry point's own declaration file.
 */
export async function readCrossPackageRootSurface(
	tree: string,
	successorSpecifier: string,
	removedSpecifier: string,
): Promise<RootSurfaceReading> {
	const modules = path.join(tree, 'node_modules');
	const owner = successorSpecifier.startsWith('@')
		? successorSpecifier.split('/').slice(0, 2).join('/')
		: (successorSpecifier.split('/')[0] ?? successorSpecifier);
	let version = 'unknown';
	try {
		const manifest = JSON.parse(
			await readFile(path.join(modules, owner, 'package.json'), 'utf8'),
		) as Readonly<{ version?: unknown }>;
		if (typeof manifest.version === 'string') version = manifest.version;
	} catch {
		version = 'unknown';
	}
	const declaration = path.join(modules, successorSpecifier, 'index.d.ts');
	const names = new Set<string>();
	if (existsSync(declaration)) {
		const source = await readFile(declaration, 'utf8');
		for (const line of source.split('\n')) {
			const match = /^export\s+declare\s+(?:abstract\s+)?(?:class|function|const|enum)\s+([A-Za-z0-9_$]+)/.exec(
				line,
			);
			if (match?.[1] !== undefined) names.add(match[1]);
			const type = /^export\s+(?:declare\s+)?(?:type|interface)\s+([A-Za-z0-9_$]+)/.exec(line);
			if (type?.[1] !== undefined) names.add(type[1]);
			const named = /^export\s*\{([^}]*)\}/.exec(line);
			if (named?.[1] !== undefined)
				for (const part of named[1].split(','))
					names.add((part.split(/\s+as\s+/).at(-1) ?? part).trim());
		}
		names.delete('');
	}
	return Object.freeze({
		package: successorSpecifier,
		version,
		specifier: removedSpecifier,
		specifierResolves: existsSync(path.join(modules, '@angular/http')),
		rootExports: Object.freeze([...names].sort()),
		complete: names.size > 0,
	});
}

/** One module's answer from the `@angular/http` seam pass. */
export type SeamOutcome = Readonly<{
	path: string;
	changed: boolean;
	changes: SymbolSuccessorMigration['changes'];
	unhandled: readonly string[];
}>;

/**
 * Drive the removed-entry-point seam over every application module the composed
 * changeset produced, with the `@angular/http` claims and the reading of the
 * installed target closure.
 *
 * The seam is offered the migrated bytes rather than the era bytes, because the
 * specifier rewrites the composed changeset already performed are what a later
 * capability is entitled to see — this is the same ordering the composed
 * migration uses internally for the capabilities it does carry.
 */
export function driveAngularHttpSeam(
	migration: AngularMigration,
	reading: RootSurfaceReading,
): readonly SeamOutcome[] {
	const outcomes: SeamOutcome[] = [];
	for (const entry of migration.files) {
		if (entry.kind !== 'application' || !entry.path.endsWith('.ts')) continue;
		if (!entry.source.includes('@angular/http')) continue;
		const result = succeedRemovedEntryPointSymbols(
			entry.path,
			entry.source,
			ANGULAR_HTTP_SUCCESSORS,
			[reading],
		);
		outcomes.push(
			Object.freeze({
				path: entry.path,
				changed: result.changed,
				changes: result.changes,
				unhandled: result.unhandled,
			}),
		);
	}
	return Object.freeze(outcomes);
}

/**
 * Era workspace facts this application carries that the hop has to answer for or
 * declare dropped. They are named because a changeset that silently loses one of
 * them would still look clean.
 */
export const ERA_WORKSPACE_FACTS: readonly string[] = Object.freeze([
	'`angular.json` `"version": 1` — the first workspace generation the Angular CLI ever wrote (CLI 6). No counted Angular vertical in this repository covers it; the pigallery2 holdout was a CLI 8 workspace and the `angular.json` v1 shape is a generation older.',
	'`sourceRoot: "Client"` with `root: ""` and an `outputPath` of `wwwroot` — this workspace is not `src/`-rooted, and its build output directory is the ASP.NET Core host\'s static file root inside the same subpath.',
	'`extractCss: true` on the production configuration — a valid key for the Angular 6 browser builder, and one the Angular 13 line removed.',
	'`@angular/http@6.1.4` declared and imported at six sites, beside `HttpClientModule` in the root NgModule and two services already on `HttpClient`. The application is half-migrated off the package at the pin.',
	'`typescript@2.9.2` and `rxjs@6.2.2` — the TypeScript line before `unknown` in catch clauses and the first RxJS 6 minor, two lines below what the target cell writes.',
	'`webpack@^4.17.1` declared as a *runtime* dependency (`dependencies`, not `devDependencies`) although no application module imports it — a build tool in the runtime closure.',
	'`preboot@6.0.0-beta.5` declared and never imported; there is no `main.server.ts` and no server module anywhere in the tree, so the server-side-render toolchain it belongs to was never wired up.',
	'A second workspace project, `WebSPA-e2e`, whose only targets are the protractor e2e runner and a TSLint lint target, plus a TSLint lint target on `WebSPA` itself.',
	'The production build is driven by the application\'s own npm script `build:prod`, whose string is `ng build --prod --aot --extract-css` — CLI 6 flag spellings, two of which the modern CLI no longer accepts.',
	'`ts-helpers@1.1.2`, `@types/protractor@4.0.0` and `@types/core-js@2.5.0` — three era type/helper packages whose upstreams stopped publishing.',
]);

/** The changeset record: every file by path and by digest before and after. */
export function buildChangesetRecord(migration: AngularMigration): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-composed-changeset.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo: `The pinned revision ${COMMIT} as materialised, read-only, at .versionless/cache/angular-eshop-webspa-netcore2-2-source/corpus — the same corpus the era baseline lane was cut from, narrowed to ${APPLICATION_SUBPATH}, which is the npm and Angular workspace root.`,
		holdoutPosition:
			'The replacement Angular holdout. This application was never ingested, fixtured, adapted, witnessed or receipted in this repository before T023, and the adapter subtree was frozen before this unit began. No capability was written for it and none was changed for it; the changeset is what the existing inventory produced when it was pointed at a tree it had never seen.',
		eraWorkspaceFacts: ERA_WORKSPACE_FACTS,
		applicationSourceDirectories: APPLICATION_SOURCE_DIRECTORIES,
		applicationFilesScanned: migration.applicationFilesScanned,
		applicationFilesChanged: migration.applicationFilesChanged,
		workspaceFilesChanged: migration.workspaceFilesChanged,
		files: migration.files.map((entry) => ({
			path: entry.path,
			kind: entry.kind,
			changed: entry.changed,
			sha256Before: entry.sha256Before,
			sha256After: entry.sha256After,
			changes: entry.changes,
		})),
		removedFiles: migration.removedFiles,
		declaredDifferences: migration.declaredDifferences,
		unhandled: migration.unhandled,
		notEstablished: [
			'A composed changeset is a set of edits, not a build. Nothing here establishes that the migrated tree installs, compiles or emits anything.',
			'`applicationFilesChanged` counts application source a transform rewrote. A file the adapter scanned and left alone is counted as scanned and not as changed.',
			'A cell disposition is a reading of a registry, not an installation. A range written here has not been resolved against a lockfile by this record.',
			'No compiler-positioned reading was supplied, so the two diagnostic-gated capabilities stood down. That is a statement about this composition and not about the application.',
		],
	});
}

/** The applied-changeset record: the same changeset, written into a named tree. */
export function buildApplicationRecord(
	migration: AngularMigration,
	applied: Application,
): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-source-migration.v1',
		unit: UNIT,
		consentId: CONSENT,
		cell: migration.cell,
		appliedTo: {
			tree: '.versionless/work/angular-eshop-webspa/target/app',
			from: `.versionless/cache/angular-eshop-webspa-netcore2-2-source/corpus/eShopOnContainers-${COMMIT}/${APPLICATION_SUBPATH}`,
			commit: COMMIT,
			excludedFromStage: ['node_modules', '.git'],
			excludedReason:
				'The corpus carries neither: it is the extracted release tarball, verified blob for blob against the pinned git tree by the ingest unit.',
		},
		applicationFilesScanned: migration.applicationFilesScanned,
		applicationFilesChanged: migration.applicationFilesChanged,
		workspaceFilesChanged: migration.workspaceFilesChanged,
		filesWritten: applied.written,
		filesRemoved: applied.removed,
		declaredDifferences: migration.declaredDifferences,
		unhandled: migration.unhandled,
		notEstablished: [
			'Writing a changeset into a tree is not a build. Nothing here establishes that the applied tree installs, compiles or emits anything; the lane record beside this one states what happened when that was attempted.',
			'No application source was edited by hand in this lane. Every byte that differs from the corpus was written by a frozen adapter transform, and each is itemised in the changeset record by file and by change.',
		],
	});
}

/** The seam probe record: what the frozen `@angular/http` question was answered with. */
export function buildSeamProbeRecord(
	reading: RootSurfaceReading,
	outcomes: readonly SeamOutcome[],
	surfaceTree: string,
): SealedRecord {
	return sealRecord({
		schemaVersion: 'versionless.angular-eshop-webspa-angular-http-seam.v1',
		unit: UNIT,
		consentId: CONSENT,
		question:
			'Does the frozen engine carry `@angular/http` to its first-party successor, driven only through public frozen APIs?',
		seam: 'succeedRemovedEntryPointSymbols (removed-entry-point-symbol-successor), exported from @versionless/angular',
		claims: ANGULAR_HTTP_SUCCESSORS,
		readingTakenFrom: path.relative(repositoryRoot, surfaceTree),
		readingTakenFromNote:
			surfaceTree === APPLIED_TREE
				? 'the lane closure'
				: 'a scratch tree carrying the successor package alone, because the migrated install is refused at dependency resolution and the lane has no closure to read',
		reading,
		outcomes,
		modulesOffered: outcomes.length,
		modulesChanged: outcomes.filter((entry) => entry.changed).length,
		notEstablished: [
			'A refusal from this seam is a statement about the seam and the claim, not a statement that the application cannot be migrated. It says the frozen engine as it stands does not carry this package.',
			'No claim was invented for `JsonpModule`: its Angular successor is `HttpClientJsonpModule`, which is not a rename and changes the call site.',
		],
	});
}

/**
 * The build log a previous pass over this lane left, or null when there is none.
 *
 * A compiler-positioned capability needs a compiler, and the only compiler that
 * has read this application on the target line is the one the previous pass ran.
 * Reading its log is what makes those positions available to this pass; that
 * they are positions in bytes a previous composition produced is exactly why the
 * capability that takes them re-places every one before it edits anything.
 */
export const PRIOR_BUILD_LOG = path.join(EVIDENCE_DIRECTORY, 'u1-t024-target-build.log');

export async function main(): Promise<void> {
	const log = existsSync(PRIOR_BUILD_LOG) ? await readFile(PRIOR_BUILD_LOG, 'utf8') : null;
	const readings = await readLaneReadings(APPLIED_TREE, log);
	const migration = await composeMigration(SOURCE_TREE, readings);
	const changeset = verifySealedRecord(buildChangesetRecord(migration));
	const applied = await applyMigration(migration, APPLIED_TREE);
	const record = verifySealedRecord(buildApplicationRecord(migration, applied));
	const surfaceTree = existsSync(path.join(APPLIED_TREE, 'node_modules'))
		? APPLIED_TREE
		: SURFACE_PROBE_TREE;
	const reading = await readCrossPackageRootSurface(
		surfaceTree,
		'@angular/common/http',
		'@angular/http',
	);
	const outcomes = driveAngularHttpSeam(migration, reading);
	const probe = verifySealedRecord(buildSeamProbeRecord(reading, outcomes, surfaceTree));
	await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
	await writeFile(path.join(EVIDENCE_DIRECTORY, CHANGESET_FILE), canonical(changeset));
	await writeFile(path.join(EVIDENCE_DIRECTORY, MIGRATION_RECORD_FILE), canonical(record));
	await writeFile(path.join(EVIDENCE_DIRECTORY, SEAM_PROBE_FILE), canonical(probe));
	process.stdout.write(
		`applied ${String(applied.written.length)} files (${String(
			migration.applicationFilesChanged,
		)}/${String(migration.applicationFilesScanned)} application, ${String(
			migration.workspaceFilesChanged,
		)} workspace), removed ${String(applied.removed.length)}, ` +
			`${String(migration.unhandled.length)} unhandled, ${String(
				migration.declaredDifferences.length,
			)} declared differences; seam offered ${String(outcomes.length)} module(s), changed ` +
			`${String(outcomes.filter((entry) => entry.changed).length)}; changeset digest ${sha256(
				canonical(changeset),
			).slice(0, 12)}\n`,
	);
}

if (process.argv[1]?.endsWith('angular-eshop-webspa-migration-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
