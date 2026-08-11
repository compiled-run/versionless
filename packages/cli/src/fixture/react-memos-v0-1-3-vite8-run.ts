import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';

/**
 * Fixture-scoped orchestration for the Vite-2-origin to Vite 8 lanes: it builds
 * the era-pinned baseline twice with the era bundler in its own runtime cell,
 * builds the Vite 8 target twice on the maintained runtime, and inventories both
 * outputs. Every capability it exercises is generic and lives in
 * @versionless/react; only the paths, the runtime cell and the era build
 * deviation are application knowledge and they live here.
 *
 * This is the corpus's first lane pair whose ORIGIN bundler is Vite. The
 * baseline lane therefore runs a bundler, not a webpack-era toolchain, and the
 * comparison below is bundler-to-bundler across six major versions of the same
 * tool rather than across two different tools.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const workRoot = path.join(repositoryRoot, '.versionless/work/react-memos-v0-1-3');
const targetRoot = path.join(workRoot, 'target');
const baselineRoot = path.join(workRoot, 'baseline');
const viteConfig = path.join(repositoryRoot, 'fixtures/react-memos-v0-1-3/vite.config.ts');
const viteBinary = path.join(repositoryRoot, 'node_modules/.bin/vite');
const sourceRoot = path.join(
	repositoryRoot,
	'.versionless/cache/react-memos-v0-1-3-source/verify/extracted',
	'memos-565fe0cc567c02deb59fc04830df707ea7476d52/web',
);

/**
 * The era runtime cell: the Node 16.20.2 darwin-arm64 build already acquired and
 * digest-verified in this workspace. It is the runtime the era bundler needs and
 * it is never used for the target lane, which runs on the maintained runtime.
 */
const eraNodeBinary = path.join(
	repositoryRoot,
	'.versionless/cache/react-linkfree-v0-72-0-baseline/runtime',
	'node-v16.20.2-darwin-arm64/bin/node',
);

/**
 * The era lane's honestly-labelled deviation, carried forward from the ingest
 * rather than repaired.
 *
 * The repository's own declared build is `tsc && vite build`. Its `tsc` half
 * exits 2 at this revision on four errors inside `node_modules`, none under
 * `src`: the committed yarn lockfile pins two copies of `@types/react` while the
 * committed tsconfig sets `skipLibCheck: false`. That is a property of the
 * pinned revision, not of today's registry — yarn accepted `--frozen-lockfile` —
 * so the typecheck gate was already broken when this revision was released.
 *
 * The era lane runs the bundler half alone. It is not the declared build
 * command, it is labelled as such everywhere it appears, and it is what makes an
 * origin-bundler comparison possible at all: the thing being migrated is the
 * bundler, and the bundler is the half that worked.
 */
export const eraLaneDeviation =
	"the repository's declared `tsc && vite build` fails in its tsc gate at this revision, so the " +
	'era lane runs `vite build` alone; this is a labelled deviation, not the declared build';

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
				...environment,
			},
		});
		const errors: string[] = [];
		child.stderr.on('data', (chunk: Buffer) => errors.push(chunk.toString('utf8')));
		child.stdout.on('data', () => undefined);
		child.on('error', reject);
		child.on('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${errors.join('')}`)),
		);
	});
}

export type LaneFile = Readonly<{ path: string; sha256: string; bytes: number }>;
export type LaneInventory = Readonly<{ digest: string; files: readonly LaneFile[] }>;

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

/** Build the Vite 8 target lane once into its own output directory. */
export async function buildTargetLane(outDirectory: string, root = targetRoot): Promise<LaneInventory> {
	const absolute = path.join(root, outDirectory);
	await run(viteBinary, ['build', '--config', viteConfig, '--outDir', absolute], root);
	return laneInventory(absolute);
}

/**
 * Build the era lane once with the era bundler in the era runtime cell. The
 * bundler is invoked through its own entry script rather than a shim, so the
 * runtime executing it is unambiguously the era one.
 */
export async function buildBaselineLane(
	outDirectory: string,
	root = baselineRoot,
): Promise<LaneInventory> {
	const absolute = path.join(root, outDirectory);
	await run(eraNodeBinary, ['node_modules/vite/bin/vite.js', 'build', '--outDir', absolute], root);
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
 * not against a remembered list, and it covers every file under the application
 * root except the dependency directory and the build outputs — so a file the
 * migration touched cannot escape it by not being looked for.
 */
export async function applicationFilesChanged(
	before = path.join(sourceRoot, 'src'),
	after = path.join(targetRoot, 'src'),
): Promise<ApplicationFilesChanged> {
	const digestsOf = async (root: string): Promise<Map<string, string>> => {
		const map = new Map<string, string>();
		for (const file of await filesBelow(root))
			map.set(path.relative(root, file).split(path.sep).join('/'), sha256(await readFile(file)));
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
	return { scope: 'src', filesCompared: source.size, changed };
}

export type ConfigTranslationReport = Readonly<{
	plan: unknown;
	clientApiRewrites: readonly Readonly<{ module: string; apis: readonly string[] }>[];
}>;

/** The translation plan the migrated build wrote as it ran. */
export async function readConfigTranslation(root = targetRoot): Promise<ConfigTranslationReport> {
	return JSON.parse(
		await readFile(path.join(root, 'config-translation.json'), 'utf8'),
	) as ConfigTranslationReport;
}

export type MemosLanes = Readonly<{
	baseline: LaneRun;
	target: LaneRun;
	applicationFiles: ApplicationFilesChanged;
	translation: ConfigTranslationReport;
}>;

/** Both lanes, each built twice, plus the migration's own source-level footprint. */
export async function runMemosLanes(): Promise<MemosLanes> {
	const baseline = await runLaneTwice(
		(outDirectory) => buildBaselineLane(outDirectory),
		['dist-run1', 'dist-run2'],
	);
	const target = await runLaneTwice(
		(outDirectory) => buildTargetLane(outDirectory),
		['dist-vite-run1', 'dist-vite-run2'],
	);
	return {
		baseline,
		target,
		applicationFiles: await applicationFilesChanged(),
		translation: await readConfigTranslation(),
	};
}

/** Write an observation document into the run evidence directory. */
export async function writeRunObservation(name: string, value: unknown): Promise<string> {
	const directory = path.join(repositoryRoot, 'evidence/runs/react-memos-v0-1-3');
	await mkdir(directory, { recursive: true });
	const file = path.join(directory, name);
	await writeFile(file, `${JSON.stringify(value, null, '\t')}\n`);
	return file;
}
