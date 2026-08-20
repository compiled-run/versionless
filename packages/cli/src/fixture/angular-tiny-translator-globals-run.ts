/**
 * The runtime-globals round of the `angular-tiny-translator-v0-12-0` cell: the
 * boot failure u19d measured, answered by a capability.
 *
 * u19d put the migrated production build in a browser for the first time and
 * recorded that it throws `process is not defined` before Angular bootstraps.
 * The cause was named there: `util@0.12.5` is in this application's declared
 * closure — the browser implementation of the Node core module that
 * ngx-i18nsupport-lib's own published code requires — and it reads
 * `process.env.NODE_DEBUG` at its top level, where no browser binds anything.
 *
 * This driver reads the applied tree's own manifest for the node-core modules
 * it declares, reads each of those modules as installed, and hands both to
 * `@versionless/angular`. Nothing here decides which globals exist or what a
 * shim contains: the capability reads that out of the module's bytes and
 * refuses whatever the bytes do not prove. The driver decides only which tree
 * is being rewritten.
 */

import { builtinModules } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	declarePolyfillEntryPoint,
	supplyNodeCoreRuntimeGlobals,
	type InstalledFile,
	type NodeCoreModuleDeclaration,
	type NodeCoreRuntimeGlobals,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';

/** Where the capability's shim is written, relative to the application root. */
export const RUNTIME_GLOBALS_ENTRY_POINT = 'src/node-core-runtime-globals.ts';

const NODE_CORE_MODULES: ReadonlySet<string> = new Set(
	builtinModules.filter((name) => !name.startsWith('node:')),
);

type Manifest = Readonly<{ dependencies?: Readonly<Record<string, string>> }>;
type InstalledManifest = Readonly<{
	version?: string;
	main?: string;
	browser?: string | Readonly<Record<string, string>>;
}>;

/** Every node-core module name the application's own manifest declares. */
export function declaredNodeCoreModules(manifest: Manifest): readonly string[] {
	return Object.freeze(
		Object.keys(manifest.dependencies ?? {})
			.filter((name) => NODE_CORE_MODULES.has(name))
			.sort(),
	);
}

/** The relative specifiers one CommonJS module requires of its own package. */
function relativeRequires(source: string): readonly string[] {
	const found = new Set<string>();
	for (const match of source.matchAll(/require\(\s*(['"])(\.[^'"]*)\1\s*\)/g)) {
		const specifier = match[2];
		if (specifier !== undefined) found.add(specifier);
	}
	return Object.freeze([...found]);
}

function withExtension(file: string): string {
	return path.extname(file) === '' ? `${file}.js` : file;
}

/**
 * Read one installed node-core module's own shipped code: its entry file and
 * every file that entry reaches through a relative `require`, with the
 * package's `browser` map applied the way a browser bundler applies it.
 *
 * Transitive *packages* are deliberately not walked. Each of them is a separate
 * declared edge with its own reading, and a capability that pulled a whole
 * closure into one module's answer would be back to guessing which globals
 * matter.
 */
export async function readInstalledNodeCoreModule(
	tree: string,
	name: string,
	range: string,
): Promise<NodeCoreModuleDeclaration> {
	const directory = path.join(tree, 'node_modules', name);
	const manifest = JSON.parse(
		await readFile(path.join(directory, 'package.json'), 'utf8'),
	) as InstalledManifest;
	const browser = typeof manifest.browser === 'object' ? manifest.browser : {};
	const substitute = (relative: string): string => {
		const key = relative.startsWith('./') ? relative : `./${relative}`;
		const replacement = browser[key];
		return typeof replacement === 'string' ? replacement : key;
	};
	const entry =
		typeof manifest.browser === 'string' ? manifest.browser : (manifest.main ?? './index.js');
	const files: InstalledFile[] = [];
	const seen = new Set<string>();
	const queue = [withExtension(substitute(entry))];
	while (queue.length > 0) {
		const relative = queue.shift() as string;
		const normalized = path.normalize(relative);
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		const file = path.join(directory, normalized);
		const source = await readFile(file, 'utf8').catch(() => null);
		if (source === null) continue;
		files.push({ path: path.relative(tree, file), source });
		for (const specifier of relativeRequires(source))
			queue.push(
				withExtension(substitute(`./${path.join(path.dirname(normalized), specifier)}`)),
			);
	}
	return Object.freeze({
		module: name,
		version: manifest.version ?? 'unknown',
		range,
		files: Object.freeze(files.sort((left, right) => (left.path < right.path ? -1 : 1))),
	});
}

export type RuntimeGlobalsRound = Readonly<{
	declaredNodeCoreModules: readonly string[];
	readings: readonly NodeCoreRuntimeGlobals[];
	entryPoint: string | null;
	workspaceChanges: readonly { path: string; from: string | null; to: string | null }[];
	workspaceUnhandled: readonly string[];
	filesChanged: readonly string[];
}>;

/**
 * Apply the runtime-globals capability to the applied tree.
 *
 * One shim module is written for the whole application rather than one per
 * declared module, because the seam is a single ordered list of entry points
 * and a browser has one global object. The shim's content is still per-module:
 * each declared node-core module contributes exactly the assignments its own
 * reading proved, cited by file and line.
 */
export async function applyRuntimeGlobalsRound(): Promise<RuntimeGlobalsRound> {
	const manifestPath = path.join(APPLIED_TREE, 'package.json');
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
	const modules = declaredNodeCoreModules(manifest);
	const readings: NodeCoreRuntimeGlobals[] = [];
	for (const name of modules)
		readings.push(
			supplyNodeCoreRuntimeGlobals(
				await readInstalledNodeCoreModule(
					APPLIED_TREE,
					name,
					manifest.dependencies?.[name] ?? 'unknown',
				),
			),
		);
	const shims = readings.filter((reading) => reading.shim !== null);
	const filesChanged: string[] = [];
	if (shims.length === 0)
		return Object.freeze({
			declaredNodeCoreModules: modules,
			readings: Object.freeze(readings),
			entryPoint: null,
			workspaceChanges: Object.freeze([]),
			workspaceUnhandled: Object.freeze([]),
			filesChanged: Object.freeze([]),
		});
	await writeFile(
		path.join(APPLIED_TREE, RUNTIME_GLOBALS_ENTRY_POINT),
		shims.map((reading) => reading.shim ?? '').join('\n'),
	);
	filesChanged.push(RUNTIME_GLOBALS_ENTRY_POINT);
	const workspacePath = path.join(APPLIED_TREE, 'angular.json');
	const workspace = await readFile(workspacePath, 'utf8');
	const declaration = declarePolyfillEntryPoint(workspace, RUNTIME_GLOBALS_ENTRY_POINT);
	if (declaration.config !== workspace) {
		await writeFile(workspacePath, declaration.config);
		filesChanged.push('angular.json');
	}
	return Object.freeze({
		declaredNodeCoreModules: modules,
		readings: Object.freeze(readings),
		entryPoint: RUNTIME_GLOBALS_ENTRY_POINT,
		workspaceChanges: declaration.changes,
		workspaceUnhandled: declaration.unhandled,
		filesChanged: Object.freeze(filesChanged),
	});
}

/**
 * The record of what this round did and what the browser then said.
 *
 * Nothing in it is asserted: the build inventories are read off the emitted
 * trees, and the boot observation is the runner's own output. It deliberately
 * supersedes nothing. u17d's record is bound by the Witness schema and its
 * artifact still does not mount, so replacing it here would publish a green
 * lane whose bundle is red in a browser — the exact move u19d refused.
 */
export function buildRuntimeGlobalsRecord(input: {
	round: RuntimeGlobalsRound;
	builds: readonly { name: string; exitStatus: number; files: number }[];
	byteStable: boolean;
	inventorySha256: string;
	boot: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
	return {
		schemaVersion: 'versionless.angular-tiny-translator-runtime-globals.v1',
		unit: 'lrapr-t006/u19e-browser-globals-rebuild',
		consentId: 'VL-LEGACY-CORPUS-2026-08-10',
		result: 'node-core-globals-supplied-build-green-boot-still-red-on-a-new-cause',
		meaning:
			"u19d measured that the migrated production build throws `process is not defined` before Angular bootstraps, because `util@0.12.5` — declared for ngx-i18nsupport-lib — reads `process.env.NODE_DEBUG` at module evaluation. A capability now reads that requirement out of the installed module's own bytes and supplies exactly the object graph the reading spells, through the builder's own polyfills seam. The build is green and byte-stable over two runs, and the browser no longer throws that error. It does not boot: the same load now reports `$localize is not defined`, a second runtime global with a different cause, and this record says so rather than publishing a lane that mounts nothing.",
		capability: {
			name: 'node-core-runtime-globals',
			package: '@versionless/angular',
			answers:
				'the evaluation half of a declared node-core module: resolution was closed by declaring `util`, and nothing supplied the runtime surface its browser evaluation reads',
			mechanism:
				"Every unresolved reference of every file the installed module's own code reaches is classified. A reference inside a function body, or under `typeof`, is not evaluated when the module is evaluated and cannot throw, so it proves no need and the global is refused by name. A reference the module dereferences at load through non-computed members is proven, and the shim materialises exactly the objects that path walks through — leaves are left undefined, because that is what a browser honestly has. A global reached at load in a way an object graph cannot satisfy — called, constructed, assigned to, or through a computed key — is refused by name rather than half-supplied. The names ECMAScript, the web platform and the CommonJS wrapper already bind are never candidates. The shim is delivered as an ordinary polyfills entry point, first in the list, which is the builder's own seam for a module the document has to evaluate before `main`.",
			refusedHere: input.round.readings.flatMap((reading) => [...reading.unhandled]),
			declaredDifferences: input.round.readings.flatMap((reading) => [
				...reading.declaredDifferences,
			]),
			supplied: input.round.readings.flatMap((reading) => [...reading.changes]),
		},
		applied: {
			tree: '.versionless/stage/angular-tiny-translator-v0-12-0-u17b/app',
			declaredNodeCoreModules: input.round.declaredNodeCoreModules,
			filesChanged: input.round.filesChanged,
			workspaceChanges: input.round.workspaceChanges,
			workspaceUnhandled: input.round.workspaceUnhandled,
		},
		builds: input.builds,
		determinism: {
			claim: 'build-9 and build-10 ran the same command over the same bytes with no edit between them, each into a cleaned output directory, and emitted the same inventory.',
			runs: 2,
			identical: input.byteStable,
			inventorySha256: input.inventorySha256,
			command: 'npx ng build --configuration production',
		},
		boot: input.boot,
		notEstablished: [
			'This record supersedes nothing. u17d remains the bound migrated build record, and the digests the Witness schema pins to it are unchanged, because the artifact this round emitted does not mount either.',
			'Nothing here establishes that `$localize` is the last runtime global between this bundle and a boot. One throw was measured, and a bundle that throws during bootstrap hides everything after it.',
			'No journey ran. The four facts u19d left uncalibrated are still uncalibrated, and no Witness receipt was published.',
			'The era lane was not rebuilt, re-measured or touched by this round.',
		],
	};
}

export async function main(): Promise<void> {
	const round = await applyRuntimeGlobalsRound();
	await writeFile(
		path.join(STAGE_DIRECTORY, 'globals-round.json'),
		`${JSON.stringify(round, null, '\t')}\n`,
	);
	for (const reading of round.readings)
		process.stdout.write(
			`${reading.module}@${reading.version}: ${String(reading.globals.length)} globals proven, ` +
				`${String(reading.changes.length)} assignments, ${String(reading.unhandled.length)} refused\n`,
		);
	process.stdout.write(`files changed: ${round.filesChanged.join(', ') || 'none'}\n`);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-globals-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
