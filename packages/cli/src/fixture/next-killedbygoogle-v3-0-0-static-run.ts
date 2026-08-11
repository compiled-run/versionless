import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	liftNextStaticModule,
	nextStaticEntryDocument,
	nextStaticEntryModuleSource,
} from '../../../frameworks/react/src/index.ts';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped orchestration for the LEGACY-NEXT static-export lane pair.
 *
 * The era lane runs the application's own toolchain in its own runtime cell —
 * `next build` followed by `next export`, through Babel, on Node 16 — and the
 * migrated lane runs the workspace's Vite 8 over the same tree with the
 * framework surface lifted out of it. Every capability the migrated lane
 * exercises is generic and lives in @versionless/react; only the paths, the
 * runtime cell, and this application's module layout are application knowledge
 * and they live here.
 *
 * This is the portfolio's first migration whose ORIGIN is a framework rather
 * than a bundler. The distinction matters for what the comparison can mean: a
 * bundler swap changes how modules are assembled, while a framework lift also
 * changes who renders the document. The era lane emits a document with the
 * application's markup already in it; the migrated lane emits a document that
 * builds that markup when it loads. That is a difference in kind, it is
 * recorded as one, and no amount of inventory agreement would erase it.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const workRoot = path.join(repositoryRoot, '.versionless/work/next-killedbygoogle-v3-0-0');

/** The migrated tree: the pinned source, lifted, with the era closure linked in. */
export const targetRoot = path.join(workRoot, 'target');

/** The era lane's root: the cache the baseline unit installed and built in. */
export const baselineRoot = path.join(
	repositoryRoot,
	'.versionless/cache/next-killedbygoogle-v3-0-0-baseline/app',
);

/** The reconciled source tree at the pin, which the migrated tree is diffed against. */
export const sourceRoot = path.join(
	repositoryRoot,
	'.versionless/cache/next-killedbygoogle-v3-0-0-source/verify/extracted',
	'killedbygoogle-56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
);

const viteConfig = path.join(repositoryRoot, 'fixtures/next-killedbygoogle-v3-0-0/vite.config.ts');
const viteBinary = path.join(repositoryRoot, 'node_modules/.bin/vite');

/**
 * The era runtime cell: the Node 16.20.2 darwin-arm64 build already acquired and
 * digest-verified in this workspace. It is the runtime the framework's own
 * toolchain needs and it is never used for the migrated lane, which runs on the
 * maintained runtime.
 */
const eraNodeBinary = path.join(
	repositoryRoot,
	'.versionless/cache/angular-jira-clone-runtime',
	'node-v16.20.2-darwin-arm64/bin/node',
);

/** This application's module layout, which is the only application knowledge the lift needs. */
export const applicationLayout = Object.freeze({
	appModule: './pages/_app.tsx',
	pageModule: './pages/index.tsx',
	entryModule: 'versionless-entry.js',
	entryDocument: 'index.html',
});

/** The digest scheme every lane inventory in this fixture uses. */
export const laneDigestScheme = 'sha256(canonicalize(files))';

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

async function run(
	command: string,
	args: readonly string[],
	cwd: string,
	environment: Readonly<Record<string, string>> = {},
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				npm_config_offline: 'true',
				VERSIONLESS_NETWORK_MODE: 'offline',
				NEXT_TELEMETRY_DISABLED: '1',
				CI: '1',
				...environment,
			},
		});
		const errors: string[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.stdout.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${command} exited ${code}: ${errors.join('').slice(-4000)}`)),
		);
	});
}

async function filesBelow(directory: string): Promise<string[]> {
	const found: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) found.push(...(await filesBelow(item)));
		else if (entry.isFile()) found.push(item);
	}
	return found;
}

const byPath = (left: Readonly<{ path: string }>, right: Readonly<{ path: string }>): number =>
	left.path === right.path ? 0 : left.path < right.path ? -1 : 1;

const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

/* -------------------------------------------------------------------------- */
/* Preparing and lifting the migrated tree                                     */
/* -------------------------------------------------------------------------- */

/** The application source extensions the framework lift is applied to. */
const liftedExtensions: ReadonlySet<string> = new Set(['.ts', '.tsx', '.js', '.jsx']);

/** Directories that are neither application source nor comparable output. */
const excludedDirectories: ReadonlySet<string> = new Set([
	'node_modules',
	'.next',
	'.git',
	'out',
	'out-run1',
	'out-run2',
	'dist-vite-run1',
	'dist-vite-run2',
]);

function isExcluded(relative: string): boolean {
	return relative.split('/').some((segment) => excludedDirectories.has(segment));
}

async function comparableFiles(root: string): Promise<string[]> {
	return (await filesBelow(root))
		.map((file) => path.relative(root, file).split(path.sep).join('/'))
		.filter((file) => !isExcluded(file))
		.sort(compareUtf16CodeUnits);
}

/**
 * Build the migrated tree from the pinned source, with the era dependency
 * closure linked rather than reinstalled.
 *
 * The link is the honest recording of a fact rather than a shortcut: this lift
 * needed no target closure at all. The framework is removed from the build, and
 * everything the application actually renders with — React 17, Emotion,
 * react-select, date-fns — is already pinned by the committed lockfile and is
 * used unchanged. The consented network allowance for a target closure install
 * therefore went unused, exactly as it did in the Vite-origin cell.
 */
export async function prepareTargetTree(): Promise<void> {
	await rm(targetRoot, { recursive: true, force: true });
	await mkdir(path.dirname(targetRoot), { recursive: true });
	await cp(sourceRoot, targetRoot, { recursive: true });
	await symlink(path.join(baselineRoot, 'node_modules'), path.join(targetRoot, 'node_modules'));
}

export type LiftedModule = Readonly<{ path: string; before: string; after: string }>;

/**
 * Apply the framework lift to the migrated tree on disk.
 *
 * Doing it on disk rather than only in the bundler is deliberate. The lift moves
 * import specifiers in first-party source, and a migration that changes an
 * application's source ought to be readable as a diff of that source rather than
 * as a claim about what a plugin did in memory. The same lift also runs inside
 * the build as a guard: an already-lifted module is a no-op for it, and any
 * module still naming an unlifted framework surface refuses the build.
 */
export async function applyNextStaticLift(root = targetRoot): Promise<readonly LiftedModule[]> {
	const lifted: LiftedModule[] = [];
	for (const relative of await comparableFiles(root)) {
		if (!liftedExtensions.has(path.extname(relative))) continue;
		const file = path.join(root, relative);
		const before = await readFile(file, 'utf8');
		const after = liftNextStaticModule(before, relative);
		if (after === before) continue;
		await writeFile(file, after);
		lifted.push({ path: relative, before: sha256(before), after: sha256(after) });
	}
	lifted.sort(byPath);
	await writeFile(
		path.join(root, applicationLayout.entryModule),
		nextStaticEntryModuleSource({
			appModule: applicationLayout.appModule,
			pageModule: applicationLayout.pageModule,
			hasStaticProps: true,
			mountApi: 'legacy',
		}),
	);
	await writeFile(
		path.join(root, applicationLayout.entryDocument),
		nextStaticEntryDocument({ entryModule: `/${applicationLayout.entryModule}` }),
	);
	return Object.freeze(lifted);
}

/* -------------------------------------------------------------------------- */
/* Lane inventories                                                            */
/* -------------------------------------------------------------------------- */

export type LaneFile = Readonly<{ path: string; sha256: string; bytes: number }>;
export type LaneInventory = Readonly<{ digest: string; files: readonly LaneFile[] }>;

/**
 * The lane inventory and its digest: sha256 over the canonicalized file list, so
 * any reader can recompute the digest from the record alone. The canonicalizer
 * is the one the receipt layer signs with, imported rather than re-implemented.
 */
export async function laneInventory(directory: string): Promise<LaneInventory> {
	const files: LaneFile[] = [];
	for (const file of await filesBelow(directory)) {
		const bytes = await readFile(file);
		files.push({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(bytes),
			bytes: bytes.byteLength,
		});
	}
	files.sort(byPath);
	return { digest: sha256(canonicalize(files)), files };
}

/**
 * The same inventory with the framework's per-build identifier replaced by a
 * placeholder, in paths and in file contents alike.
 *
 * The framework mints a fresh random build identifier for every `next build`
 * and threads it through the emitted asset paths and the serialised page data.
 * Two builds of identical source therefore differ, and no configuration in the
 * pinned repository pins it. That is a genuine property of the era toolchain,
 * not a defect of this measurement, so it is reported rather than engineered
 * away: the raw comparison is published as it falls, and this normalised
 * comparison answers the separate question of whether anything *else* moved.
 */
export function normalizeBuildIdentifier(
	inventory: LaneInventory,
	buildIdentifier: string,
	placeholder = '<build-id>',
): LaneInventory {
	const files = inventory.files
		.map((file) => ({ ...file, path: file.path.split(buildIdentifier).join(placeholder) }))
		.sort(byPath);
	return { digest: sha256(canonicalize(files)), files };
}

/**
 * The digest of a directory's contents with every occurrence of the build
 * identifier replaced inside the bytes as well, which is where the framework
 * writes it into the emitted documents and manifests.
 */
export async function normalizedContentDigest(
	directory: string,
	buildIdentifier: string,
	placeholder = '<build-id>',
): Promise<string> {
	const files: LaneFile[] = [];
	for (const file of await filesBelow(directory)) {
		const raw = await readFile(file, 'utf8');
		const normalized = raw.split(buildIdentifier).join(placeholder);
		files.push({
			path: path
				.relative(directory, file)
				.split(path.sep)
				.join('/')
				.split(buildIdentifier)
				.join(placeholder),
			sha256: sha256(normalized),
			bytes: Buffer.byteLength(normalized),
		});
	}
	files.sort(byPath);
	return sha256(canonicalize(files));
}

/* -------------------------------------------------------------------------- */
/* The lanes                                                                   */
/* -------------------------------------------------------------------------- */

export type EraBuild = Readonly<{
	inventory: LaneInventory;
	buildIdentifier: string;
	normalizedContent: string;
}>;

/**
 * Build the era lane once with the application's own toolchain in the era
 * runtime cell: `next build` and then `next export` into a lane-specific
 * directory. Both halves are invoked through their own entry scripts rather
 * than through a package-manager shim, so the runtime executing them is
 * unambiguously the era one.
 */
export async function buildEraLane(outDirectory: string, root = baselineRoot): Promise<EraBuild> {
	const absolute = path.join(root, outDirectory);
	await rm(absolute, { recursive: true, force: true });
	await run(eraNodeBinary, ['node_modules/next/dist/bin/next', 'build'], root);
	await run(eraNodeBinary, ['node_modules/next/dist/bin/next', 'export', '-o', absolute], root);
	const buildIdentifier = (await readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim();
	return {
		inventory: await laneInventory(absolute),
		buildIdentifier,
		normalizedContent: await normalizedContentDigest(absolute, buildIdentifier),
	};
}

/** Build the Vite 8 target lane once into its own output directory. */
export async function buildTargetLane(
	outDirectory: string,
	root = targetRoot,
): Promise<LaneInventory> {
	const absolute = path.join(root, outDirectory);
	await run(viteBinary, ['build', '--config', viteConfig, '--outDir', absolute], root);
	return laneInventory(absolute);
}

export type LaneRun = Readonly<{
	first: LaneInventory;
	second: LaneInventory;
	deterministic: boolean;
}>;

/** Build one lane twice and report whether the two outputs are identical. */
export async function runLaneTwice(
	build: (outDirectory: string) => Promise<LaneInventory>,
	names: readonly [string, string],
): Promise<LaneRun> {
	const first = await build(names[0]);
	const second = await build(names[1]);
	return { first, second, deterministic: first.digest === second.digest };
}

export type EraLaneRun = Readonly<{
	first: EraBuild;
	second: EraBuild;
	deterministic: boolean;
	deterministicModuloBuildIdentifier: boolean;
}>;

/**
 * Build the era lane twice. Two determinism answers are reported because there
 * are two questions: whether the toolchain is byte-stable at all (it is not, by
 * its own design) and whether anything other than its build identifier moved.
 */
export async function runEraLaneTwice(
	names: readonly [string, string] = ['out-run1', 'out-run2'],
): Promise<EraLaneRun> {
	const first = await buildEraLane(names[0]);
	const second = await buildEraLane(names[1]);
	return {
		first,
		second,
		deterministic: first.inventory.digest === second.inventory.digest,
		deterministicModuloBuildIdentifier: first.normalizedContent === second.normalizedContent,
	};
}

/* -------------------------------------------------------------------------- */
/* The migration's own source footprint                                        */
/* -------------------------------------------------------------------------- */

export type ApplicationFileChange = Readonly<{
	path: string;
	before: string | null;
	after: string | null;
}>;

export type ApplicationFilesChanged = Readonly<{
	scope: string;
	filesCompared: number;
	changed: readonly ApplicationFileChange[];
}>;

/**
 * The application source files the migration changed, by digest before and
 * after.
 *
 * The comparison is against the reconciled source tree at the pinned revision,
 * not against a remembered list, and it covers every file in the application
 * except the dependency directory and the build outputs — so a file the
 * migration touched cannot escape it by not being looked for.
 */
export async function applicationFilesChanged(
	before = sourceRoot,
	after = targetRoot,
): Promise<ApplicationFilesChanged> {
	const digestsOf = async (root: string): Promise<Map<string, string>> => {
		const map = new Map<string, string>();
		for (const relative of await comparableFiles(root))
			map.set(relative, sha256(await readFile(path.join(root, relative))));
		return map;
	};
	const source = await digestsOf(before);
	const target = await digestsOf(after);
	const changed: ApplicationFileChange[] = [];
	for (const [file, digest] of source)
		if (target.get(file) !== digest)
			changed.push({ path: file, before: digest, after: target.get(file) ?? null });
	for (const [file, digest] of target)
		if (!source.has(file)) changed.push({ path: file, before: null, after: digest });
	changed.sort(byPath);
	return { scope: 'application root, excluding the dependency directory and build outputs', filesCompared: source.size, changed };
}

export type FrameworkLiftReport = Readonly<{
	babel: unknown;
	modules: readonly Readonly<{
		module: string;
		imports: readonly Readonly<{
			specifier: string;
			kind: string;
			bindings: readonly string[];
		}>[];
		dataFetchingExports: readonly string[];
	}>[];
}>;

/** The lift report the migrated build wrote as it ran. */
export async function readFrameworkLiftReport(root = targetRoot): Promise<FrameworkLiftReport> {
	return JSON.parse(
		await readFile(path.join(root, 'framework-lift.json'), 'utf8'),
	) as FrameworkLiftReport;
}

/* -------------------------------------------------------------------------- */
/* Build-level parity                                                          */
/* -------------------------------------------------------------------------- */

export type DocumentInventory = Readonly<{
	documents: readonly string[];
	publicAssets: readonly string[];
	bundledAssets: readonly string[];
}>;

/** The framework's own emitted-asset directory in a static export. */
const frameworkAssetDirectory = '_next/';

/** The bundler's emitted-asset directory in the migrated lane. */
const bundlerAssetDirectory = 'assets/';

/**
 * Classify one lane's output into the three groups a build-level comparison can
 * actually speak about: the HTML documents, the copied public assets, and the
 * bundler-emitted assets whose names are hashes and are not comparable across
 * two different bundlers by construction.
 */
export function classifyLaneOutput(inventory: LaneInventory): DocumentInventory {
	const documents: string[] = [];
	const publicAssets: string[] = [];
	const bundledAssets: string[] = [];
	for (const file of inventory.files) {
		if (file.path.endsWith('.html')) documents.push(file.path);
		else if (
			file.path.startsWith(frameworkAssetDirectory) ||
			file.path.startsWith(bundlerAssetDirectory)
		)
			bundledAssets.push(file.path);
		else publicAssets.push(file.path);
	}
	return Object.freeze({
		documents: documents.sort(compareUtf16CodeUnits),
		publicAssets: publicAssets.sort(compareUtf16CodeUnits),
		bundledAssets: bundledAssets.sort(compareUtf16CodeUnits),
	});
}

export type PublicAssetParity = Readonly<{
	shared: readonly string[];
	onlyInEra: readonly string[];
	onlyInTarget: readonly string[];
	identicalBytes: readonly string[];
	differingBytes: readonly string[];
}>;

/**
 * Public-asset parity between the two lanes: which copied files both emitted,
 * which only one did, and — for the shared ones — whether the bytes agree.
 *
 * This is the one part of two different bundlers' output that is legitimately
 * comparable byte for byte, because neither bundler is supposed to be
 * transforming it. A difference here would be a real regression rather than a
 * naming convention.
 */
export function publicAssetParity(era: LaneInventory, target: LaneInventory): PublicAssetParity {
	const eraFiles = new Map(
		classifyLaneOutput(era).publicAssets.map((file) => [
			file,
			era.files.find((entry) => entry.path === file)?.sha256 ?? '',
		]),
	);
	const targetFiles = new Map(
		classifyLaneOutput(target).publicAssets.map((file) => [
			file,
			target.files.find((entry) => entry.path === file)?.sha256 ?? '',
		]),
	);
	const shared: string[] = [];
	const identicalBytes: string[] = [];
	const differingBytes: string[] = [];
	for (const [file, digest] of eraFiles) {
		const other = targetFiles.get(file);
		if (other === undefined) continue;
		shared.push(file);
		if (other === digest) identicalBytes.push(file);
		else differingBytes.push(file);
	}
	return Object.freeze({
		shared: shared.sort(compareUtf16CodeUnits),
		onlyInEra: [...eraFiles.keys()]
			.filter((file) => !targetFiles.has(file))
			.sort(compareUtf16CodeUnits),
		onlyInTarget: [...targetFiles.keys()]
			.filter((file) => !eraFiles.has(file))
			.sort(compareUtf16CodeUnits),
		identicalBytes: identicalBytes.sort(compareUtf16CodeUnits),
		differingBytes: differingBytes.sort(compareUtf16CodeUnits),
	});
}

/* -------------------------------------------------------------------------- */
/* The whole run                                                               */
/* -------------------------------------------------------------------------- */

export type KilledByGoogleLanes = Readonly<{
	era: EraLaneRun;
	target: LaneRun;
	lifted: readonly LiftedModule[];
	applicationFiles: ApplicationFilesChanged;
	liftReport: FrameworkLiftReport;
	parity: PublicAssetParity;
}>;

/** Both lanes, each built twice, plus the migration's own source-level footprint. */
export async function runKilledByGoogleLanes(): Promise<KilledByGoogleLanes> {
	const era = await runEraLaneTwice();
	await prepareTargetTree();
	const lifted = await applyNextStaticLift();
	const target = await runLaneTwice(
		(outDirectory) => buildTargetLane(outDirectory),
		['dist-vite-run1', 'dist-vite-run2'],
	);
	return {
		era,
		target,
		lifted,
		applicationFiles: await applicationFilesChanged(),
		liftReport: await readFrameworkLiftReport(),
		parity: publicAssetParity(era.first.inventory, target.first),
	};
}

/**
 * The recorded differences between the two lanes.
 *
 * These are not caveats appended to a green result. They are the result: a
 * framework lift moves work between build time and load time, and every entry
 * below is one place where that move is observable in the emitted bytes. A
 * reader who only reads this list has read the honest part of the migration.
 */
export const recordedDifferences: readonly Readonly<{ difference: string; detail: string }>[] =
	Object.freeze([
		Object.freeze({
			difference: 'the delivered document carries the application markup in one lane and not the other',
			detail:
				'The era lane statically renders the whole page — every list row, every style rule — ' +
				'into index.html. The migrated lane delivers a mount element and a module script, and ' +
				'the same markup is produced when that script evaluates. Anything that reads the ' +
				'document without running scripts therefore sees two different pages. This is the ' +
				'central difference of the whole lift and it is not repaired anywhere below.',
		}),
		Object.freeze({
			difference: 'the head elements are pre-rendered in one lane and installed on mount in the other',
			detail:
				'Every element the page passes to next/head appears inside <head> in the era ' +
				'document, counted by the framework in a next-head-count meta tag. After the lift ' +
				'they are applied to the live document head by a React portal when the application ' +
				'mounts. Title, description and social-card metadata are therefore absent from the ' +
				'migrated document as delivered.',
		}),
		Object.freeze({
			difference: 'the second document the era lane emits has no counterpart',
			detail:
				'The era export writes 404.html from the framework built-in error page. The pinned ' +
				'tree authors no 404 page of its own, so that document is framework-supplied ' +
				'markup rather than application markup, and this adapter emits no framework pages. ' +
				'The migrated lane emits one document.',
		}),
		Object.freeze({
			difference: 'the serialised page data has no counterpart',
			detail:
				'The era export writes _next/data/<build-id>/index.json, the serialised result of ' +
				'getStaticProps, for the client router to fetch on navigation. The migrated lane ' +
				'calls the application\'s own getStaticProps as it starts instead, so the data exists ' +
				'only in memory and no such file is emitted.',
		}),
		Object.freeze({
			difference: 'the production third-party script tag moves out of the document',
			detail:
				'The page renders a script element for card.codyogden.com under a production ' +
				'NODE_ENV branch, outside next/head. The era document contains that tag as markup. ' +
				'After the lift the same branch produces the same element when the page renders, so ' +
				'the tag exists at runtime and not in the delivered bytes. The analytics script ' +
				'guarded by a typeof window check is absent from the era document for the ' +
				'complementary reason — there is no window during static generation — and is ' +
				'produced on the client in both lanes.',
		}),
		Object.freeze({
			difference: 'the carbon ad slot is a runtime insertion in both lanes and is comparable in neither',
			detail:
				'components/Carbon.tsx appends a cdn.carbonads.com script element in an effect. No ' +
				'lane emits it as build output; the only carbonads text in the era document is a ' +
				'CSS selector inside the pre-rendered style block. Nothing about the ad slot, its ' +
				'fallback, or its egress is established by either build.',
		}),
		Object.freeze({
			difference: 'emitted stylesheet contents are not comparable between the lanes',
			detail:
				'The era lane pre-renders the Emotion styles into the document and emits only the ' +
				'imported global stylesheet as CSS. The migrated lane emits the same global ' +
				'stylesheet and produces every Emotion rule at runtime. The @emotion/babel-plugin ' +
				'the legacy build ran is not reproduced, which affects generated class names; since ' +
				'the migrated lane emits no Emotion CSS at build time, that effect is unobservable ' +
				'in these artifacts and is left as an open question for a witness unit.',
		}),
		Object.freeze({
			difference: 'client-side route navigation is not reproduced',
			detail:
				'next/link asks the framework router to navigate without a document load. The lift ' +
				'decorates the same child anchor and leaves navigation to the browser. In this ' +
				'application every link is either external or points at the single authored route, ' +
				'so the visible outcome coincides; across several routes it would not, which is why ' +
				'multi-route applications are refused rather than attempted.',
		}),
	]);

export type BuildLanesObservation = Readonly<Record<string, unknown>>;

/**
 * Compose the published observation from a completed run. Every number in it
 * comes from the run rather than from a memory of one.
 */
export function buildLanesObservation(lanes: KilledByGoogleLanes): BuildLanesObservation {
	const eraOutput = classifyLaneOutput(lanes.era.first.inventory);
	const targetOutput = classifyLaneOutput(lanes.target.first);
	const documentBytes = (inventory: LaneInventory, file: string): number =>
		inventory.files.find((entry) => entry.path === file)?.bytes ?? -1;
	return {
		schemaVersion: 'versionless.legacy-build-parity.v1',
		slug: 'next-killedbygoogle-v3-0-0',
		unit: 'lrapr-t006/u7-kbg-migration-lanes',
		consentId: 'VL-LEGACY-CORPUS-2026-08-10',
		migrationClass: 'LEGACY-NEXT',
		migrationClassNote:
			"The portfolio's first migration whose ORIGIN is a framework rather than a bundler. " +
			'Every React migration recorded before this one replaced a build tool. This one also ' +
			'replaces the thing that renders the document: a Next 12 pages/ application whose ' +
			'entire route set is one statically exported page is lifted to a Vite 8 client build. ' +
			'The lift is only defensible because the application is single-route, zero-API and ' +
			'server-free, and nothing here generalises past that.',
		laneDigestScheme,
		revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
		frontendRoot: '.',
		eraLane: {
			label: 'era-pinned baseline',
			framework: 'next 12.0.10',
			bundler: 'webpack 5, vendored inside next 12.0.10 and not selectable independently',
			compiler:
				"Babel. The repository's committed .babelrc disables the framework's Rust compiler, " +
				'so babel-loader is what compiled this lane.',
			runtime: { node: '16.20.2', platform: 'darwin-arm64' },
			runtimeDeviation:
				'in-lane, NOT repository-pinned: package.json declares no engines block and there ' +
				"is no .nvmrc. 16.20.2 is the final 16.x release and sits inside the repository's " +
				'own CI lane, which pins actions/setup-node to 16.x. Carried forward from the ingest.',
			closure:
				"the repository's own committed yarn.lock, installed by the ingest unit with " +
				'--frozen-lockfile holding, 713 package directories placed',
			commandRun: 'next build, then next export -o <lane directory>',
			rebuilds: 2,
			deterministic: lanes.era.deterministic,
			determinismNote:
				'The framework mints a fresh random build identifier for every build and threads ' +
				'it through emitted asset paths and the serialised page data. No configuration in ' +
				'the pinned repository pins it, so two builds of identical source cannot agree ' +
				'byte for byte. The raw answer is published as it falls.',
			buildIdentifiers: [lanes.era.first.buildIdentifier, lanes.era.second.buildIdentifier],
			deterministicModuloBuildIdentifier: lanes.era.deterministicModuloBuildIdentifier,
			normalizedDigestScheme:
				'sha256(canonicalize(files)) after replacing every occurrence of the build ' +
				'identifier with the literal <build-id>, in paths and in file contents alike',
			normalizedDigest: lanes.era.first.normalizedContent,
			secondNormalizedDigest: lanes.era.second.normalizedContent,
			digest: lanes.era.first.inventory.digest,
			secondDigest: lanes.era.second.inventory.digest,
			documents: eraOutput.documents,
			indexDocumentBytes: documentBytes(lanes.era.first.inventory, 'index.html'),
			inventory: lanes.era.first.inventory.files,
		},
		targetLane: {
			label: 'migrated target',
			framework: 'none — the framework is removed from the build',
			bundler: 'vite 8.0.16 (rolldown 1.0.3)',
			compiler: "oxc, with the JSX contract translated from the application's own .babelrc",
			runtime: { node: '24.15.0', platform: 'darwin-arm64' },
			closure:
				'unchanged. The migrated tree links the era closure the baseline installed, so ' +
				'React 17.0.2, Emotion, react-select 5.2.2 and date-fns are the lockfile-pinned ' +
				'copies. Nothing was resolved against the 2026 registry for this lane and no ' +
				'network request was made by it.',
			closureNote:
				'This is a recorded consequence, not an engineered one: removing the framework ' +
				'from the build removed the only dependency the target could not have reused, so ' +
				'the consented allowance for a target closure install went unused. ' +
				'VERSIONLESS_NETWORK_MODE was offline for every build in this unit.',
			commandRun: 'vite build --config fixtures/next-killedbygoogle-v3-0-0/vite.config.ts',
			rebuilds: 2,
			deterministic: lanes.target.deterministic,
			digest: lanes.target.first.digest,
			secondDigest: lanes.target.second.digest,
			documents: targetOutput.documents,
			indexDocumentBytes: documentBytes(lanes.target.first, 'index.html'),
			inventory: lanes.target.first.files,
		},
		frameworkLift: {
			adapter: 'packages/frameworks/react/src/react-next-static-adapter.ts',
			buildTimeGuardReport: lanes.liftReport,
			buildTimeGuardNote:
				'This is what the lift saw when it ran again inside the migrated build, after the ' +
				'same lift had already been applied to disk. It reports no framework imports ' +
				'because there are none left to find, which is the guard passing rather than the ' +
				'surface being empty. What the lift actually moved is modulesLiftedOnDisk below, ' +
				'and the Babel translation it carries is read at build time either way.',
			modulesLiftedOnDisk: lanes.lifted,
			liftedSurface:
				'next/head and next/link were rewritten to lifted components; the type-only ' +
				'imports of next and next/app were erased after the analyzer proved every binding ' +
				'they introduce is referenced from type positions alone; getStaticProps was carried ' +
				"unchanged and is called by the synthesised entry from the application's own module.",
			notLifted:
				'No other framework module appears in the pinned tree, and the adapter refuses ' +
				'every one it has not been taught rather than passing it through.',
		},
		applicationFilesChanged: lanes.applicationFiles,
		buildLevelParity: {
			eraDocuments: eraOutput.documents,
			targetDocuments: targetOutput.documents,
			eraBundledAssets: eraOutput.bundledAssets.length,
			targetBundledAssets: targetOutput.bundledAssets.length,
			bundledAssetNote:
				'Bundler-emitted asset names are content hashes produced by two different ' +
				'bundlers. They are counted, never compared.',
			publicAssets: lanes.parity,
			publicAssetNote:
				'Copied public files are the one part of two bundlers\' output that is legitimately ' +
				'comparable byte for byte, because neither is supposed to transform them.',
		},
		recordedDifferences,
		nonclaims: [
			'No page was loaded in a browser by this unit. Nothing here establishes that either ' +
				'lane renders correctly, that the two lanes render the same thing, or that any ' +
				'upstream journey passes. A witness unit would have to establish that separately, ' +
				'and the recorded differences above are where it should look first.',
			'The single-route limitation is a property of this fixture and a published non-claim ' +
				'of the adapter. Nothing here generalises to Next applications with several routes, ' +
				'API routes, middleware, server rendering, next/image, next/dynamic or next/router.',
			'A deterministic migrated build is a statement about the bundler, not about the ' +
				'application. It says two runs of the same input agree; it says nothing about ' +
				'whether the input is right.',
			'The era lane is not byte-stable and is not claimed to be. What is claimed is the ' +
				'normalised comparison, which is a weaker statement and is labelled as one wherever ' +
				'it appears.',
			'No artifact from either lane is published, merged, or offered as a reproducible build ' +
				'product. Both live in the git-ignored cache.',
		],
	};
}

/** Write an observation document into the run evidence directory. */
export async function writeRunObservation(name: string, value: unknown): Promise<string> {
	const directory = path.join(repositoryRoot, 'evidence/runs/next-killedbygoogle-v3-0-0');
	await mkdir(directory, { recursive: true });
	const file = path.join(directory, name);
	await writeFile(file, `${JSON.stringify(value, null, '\t')}\n`);
	return file;
}
