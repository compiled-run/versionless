import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import {
	anyOf,
	charIn,
	charNotIn,
	createRegExp,
	digit,
	exactly,
	oneOrMore,
	whitespace,
} from 'magic-regexp';
import * as path from 'pathe';
import { canonicalize } from '../../../core/src/receipts/canonicalize.ts';
import { craEntryDocument } from '../../../frameworks/react/src/react-cra-vite-adapter.ts';

/**
 * Fixture-scoped orchestration for the cypress-realworld-app HOLDOUT lanes.
 *
 * This application is the falsification-run holdout for the frozen React
 * adapters. Nothing here may influence product code: the adapter composition is
 * applied exactly as `fixtures/react-cypress-rwa/vite.config.ts` states it, and
 * a build that fails is recorded as it failed rather than worked around. Only
 * paths, the runtime cell and the environment are application knowledge, and
 * they live here.
 */

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');
const workRoot = path.join(repositoryRoot, '.versionless/work/react-cypress-rwa');
const targetRoot = path.join(workRoot, 'target');
const baselineRoot = path.join(workRoot, 'baseline');
const viteConfig = path.join(repositoryRoot, 'fixtures/react-cypress-rwa/vite.config.ts');
const viteBinary = path.join(repositoryRoot, 'node_modules/.bin/vite');

/**
 * The era runtime cell the repository names for itself in both `.nvmrc` and
 * `.node-version`: Node 14.16.1 darwin-x64 under Rosetta 2, acquired and
 * digest-verified by the ingest. It is the baseline toolchain's runtime and is
 * never used for the target lane.
 */
const eraRuntimeRoot = path.join(
	repositoryRoot,
	'.versionless/cache/react-cypress-rwa-runtime/node-v14.16.1-darwin-x64',
);
const eraYarnRoot = path.join(
	repositoryRoot,
	'.versionless/cache/react-cypress-rwa-baseline/npm-global',
);

/**
 * yarn 1 walks every ancestor directory looking for a `packageManager` field
 * and refuses to run when it finds one naming another package manager. The work
 * area sits inside this repository, whose root manifest declares pnpm, so the
 * check fires on a fact about the harness rather than about the application.
 * Skipping it restores the application's own install, and nothing else.
 */
const skipYarnCorepackCheck = 'SKIP_YARN_COREPACK_CHECK';

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

/**
 * The digest scheme every lane inventory in this fixture uses, stated so a
 * reader can recompute it from the recorded file list alone.
 */
export const laneDigestScheme = 'sha256(canonicalize(files))';

export const compareUtf16CodeUnits = (left: string, right: string): number =>
	left === right ? 0 : left < right ? -1 : 1;

export type CommandOutcome = Readonly<{
	exitCode: number;
	stdout: string;
	stderr: string;
}>;

/**
 * Run a command and return how it went instead of throwing. A holdout lane that
 * fails is the measurement, so the failure has to survive as data.
 */
export async function runCommand(
	command: string,
	args: readonly string[],
	cwd: string,
	environment: Readonly<Record<string, string>> = {},
): Promise<CommandOutcome> {
	return new Promise<CommandOutcome>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
			env: { ...process.env, VERSIONLESS_NETWORK_MODE: 'offline', ...environment },
		});
		const out: string[] = [];
		const err: string[] = [];
		child.stdout.on('data', (chunk: Buffer) => out.push(chunk.toString('utf8')));
		child.stderr.on('data', (chunk: Buffer) => err.push(chunk.toString('utf8')));
		child.on('error', reject);
		child.on('close', (code) =>
			resolve({ exitCode: code ?? -1, stdout: out.join(''), stderr: err.join('') }),
		);
	});
}

/** The escape character that opens every SGR control sequence in a build log. */
const escapeCharacter = '\u001B';

const ansiEscape = createRegExp(
	exactly(escapeCharacter)
		.and(exactly('['))
		.and(oneOrMore(charIn('0123456789;')))
		.and(exactly('m')),
	['g'],
);

/** Strip the SGR colour codes a terminal build log carries, so text compares. */
export function stripAnsi(text: string): string {
	return text.replace(ansiEscape, '');
}

export type LaneFile = Readonly<{ path: string; sha256: string }>;
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

/**
 * The lane inventory and its digest, under the reproducible scheme this corpus
 * uses elsewhere: sha256 over the canonicalized file list, so any reader can
 * recompute the digest from the record alone. The canonicalizer is the one the
 * receipt layer signs with, imported rather than re-implemented.
 */
export async function laneInventory(directory: string): Promise<LaneInventory> {
	const files: LaneFile[] = [];
	for (const file of await filesBelow(directory))
		files.push({
			path: path.relative(directory, file).split(path.sep).join('/'),
			sha256: sha256(await readFile(file)),
		});
	files.sort((left, right) => compareUtf16CodeUnits(left.path, right.path));
	return { digest: sha256(canonicalize(files)), files };
}

/** Recompute a recorded lane digest from the file list recorded beside it. */
export function laneDigestIsReproducible(lane: LaneInventory): boolean {
	return sha256(canonicalize([...lane.files])) === lane.digest;
}

/** Inventory an already-built lane, for a lane built outside this orchestration. */
export async function readBuiltLane(directory: string): Promise<LaneInventory> {
	return laneInventory(directory);
}

/**
 * Regenerate the Vite entry document from the immutable create-react-app
 * template. The application declares no service worker and registers none, so
 * no bootstrap module is injected.
 */
export async function writeCypressRwaEntryDocument(
	environment: Readonly<Record<string, string>>,
	root = targetRoot,
): Promise<string> {
	const template = await readFile(path.join(root, 'public/index.html'), 'utf8');
	const document = craEntryDocument({
		template,
		entryModule: '/src/index.tsx',
		environment,
	});
	await writeFile(path.join(root, 'index.html'), document);
	return document;
}

/**
 * The application's own `prebuild:ci` step, which copies the committed
 * AWS Cognito mock into place. Both lanes run it, because the application's
 * `src/containers/AppCognito.tsx` imports `../aws-exports` and the repository
 * ships that file only as a script-generated mock. It is the application
 * generating its own file from its own committed source, in both lanes alike.
 */
export async function generateApplicationMocks(root: string): Promise<CommandOutcome> {
	return runCommand(path.join(eraYarnRoot, 'bin/yarn'), ['predev:cognito:ci'], root, {
		PATH: `${path.join(eraRuntimeRoot, 'bin')}:${process.env.PATH ?? ''}`,
		[skipYarnCorepackCheck]: '1',
	});
}

export type LaneBuild = Readonly<{
	result: 'built' | 'failed';
	exitCode: number;
	log: string;
	inventory: LaneInventory | null;
}>;

/**
 * Build the era-pinned baseline once with its own toolchain, on the app's own
 * declared CI build path (`yarn build:ci`, which is what every one of the
 * repository's three CI definitions invokes). `react-scripts build` always
 * writes to `build/`, so the output is moved into the run's own directory
 * afterwards. `CI` is forced empty rather than inherited, because create-react-app
 * promotes warnings to errors when it is set and the lane must not depend on
 * the host's shell.
 */
export async function buildBaselineLane(
	outDirectory: string,
	root = baselineRoot,
): Promise<LaneBuild> {
	const staging = path.join(root, 'build');
	const absolute = path.join(root, outDirectory);
	await rm(staging, { recursive: true, force: true });
	await rm(absolute, { recursive: true, force: true });
	const outcome = await runCommand(path.join(eraYarnRoot, 'bin/yarn'), ['build:ci'], root, {
		CI: '',
		PATH: `${path.join(eraRuntimeRoot, 'bin')}:${process.env.PATH ?? ''}`,
		[skipYarnCorepackCheck]: '1',
	});
	const log = stripAnsi(`${outcome.stdout}${outcome.stderr}`);
	if (outcome.exitCode !== 0)
		return { result: 'failed', exitCode: outcome.exitCode, log, inventory: null };
	await rename(staging, absolute);
	return { result: 'built', exitCode: 0, log, inventory: await laneInventory(absolute) };
}

/**
 * Build the migrated lane once through the frozen create-react-app adapter
 * composition. Nothing about the invocation is holdout-specific: it is the same
 * `vite build --config <fixture config>` the proven fixtures use.
 */
export async function buildTargetLane(outDirectory: string, root = targetRoot): Promise<LaneBuild> {
	const absolute = path.join(root, outDirectory);
	await rm(absolute, { recursive: true, force: true });
	const outcome = await runCommand(
		viteBinary,
		['build', '--config', viteConfig, '--outDir', absolute],
		root,
	);
	const log = stripAnsi(`${outcome.stdout}${outcome.stderr}`);
	if (outcome.exitCode !== 0)
		return { result: 'failed', exitCode: outcome.exitCode, log, inventory: null };
	return { result: 'built', exitCode: 0, log, inventory: await laneInventory(absolute) };
}

export type BuildDemand = Readonly<{
	code: string;
	module: string;
	importer: string;
	line: number;
	column: number;
	detail: string;
}>;

const demandHeading = createRegExp(
	exactly('[')
		.and(oneOrMore(charIn('ABCDEFGHIJKLMNOPQRSTUVWXYZ_')).as('code'))
		.and(exactly('] '))
		.and(exactly('Could not load '))
		.and(oneOrMore(charNotIn('\n')).as('module')),
	['g'],
);

const demandOrigin = createRegExp(
	exactly('╭')
		.and(exactly('─['))
		.and(whitespace)
		.and(oneOrMore(charNotIn(':\n')).as('importer'))
		.and(exactly(':'))
		.and(oneOrMore(digit).as('line'))
		.and(exactly(':'))
		.and(oneOrMore(digit).as('column')),
);

const demandDetail = createRegExp(
	exactly('╰')
		.and(oneOrMore(anyOf(exactly('─'), whitespace)))
		.and(oneOrMore(charNotIn('\n')).as('detail')),
);

/**
 * Itemize the loader demands a failed rolldown build reported, as the compiler
 * stated them. Each demand names the module the bundler could not take, the
 * module that asked for it, and the reason the bundler gave — the three facts a
 * finding about a missing capability has to carry.
 */
export function parseBuildDemands(log: string): readonly BuildDemand[] {
	const plain = stripAnsi(log);
	const demands: BuildDemand[] = [];
	for (const heading of plain.matchAll(demandHeading)) {
		const rest = plain.slice((heading.index ?? 0) + (heading[0]?.length ?? 0));
		const origin = demandOrigin.exec(rest);
		const detail = demandDetail.exec(rest);
		demands.push({
			code: heading.groups?.code ?? '',
			module: (heading.groups?.module ?? '').trim(),
			importer: (origin?.groups?.importer ?? '').trim(),
			line: Number(origin?.groups?.line ?? 0),
			column: Number(origin?.groups?.column ?? 0),
			detail: (detail?.groups?.detail ?? '').trim(),
		});
	}
	return demands;
}

const externalizedModule = createRegExp(
	exactly('Module "')
		.and(oneOrMore(charNotIn('"')).as('module'))
		.and(exactly('" has been externalized for browser compatibility, imported by "'))
		.and(oneOrMore(charNotIn('"')).as('importer')),
	['g'],
);

export type ExternalizedModule = Readonly<{ module: string; importer: string }>;

/**
 * The Node core specifiers Vite externalized for the browser rather than
 * shimming. The adapter's shim table deliberately omits the specifiers webpack
 * emitted an empty module for, so these are reported, not resolved.
 */
export function parseExternalizedModules(log: string, root: string): readonly ExternalizedModule[] {
	const seen = new Map<string, ExternalizedModule>();
	for (const match of stripAnsi(log).matchAll(externalizedModule)) {
		const importer = match.groups?.importer ?? '';
		const record = {
			module: match.groups?.module ?? '',
			importer: path.relative(root, importer).split(path.sep).join('/'),
		};
		seen.set(`${record.module} ${record.importer}`, record);
	}
	return [...seen.values()].sort((left, right) =>
		compareUtf16CodeUnits(
			`${left.module} ${left.importer}`,
			`${right.module} ${right.importer}`,
		),
	);
}

const modulesTransformed = createRegExp(
	oneOrMore(digit).as('count').and(exactly(' modules transformed')),
);

/** How far the migrated build got before it stopped, as the bundler counted it. */
export function parseModulesTransformed(log: string): number | null {
	const match = modulesTransformed.exec(stripAnsi(log));
	return match ? Number(match.groups?.count) : null;
}

export type LaneRun = Readonly<{
	first: LaneBuild;
	second: LaneBuild;
	deterministic: boolean;
	stable: boolean;
}>;

/**
 * Two builds of one lane and what they jointly prove. A green lane is
 * `deterministic` when both outputs carry the same digest. A red lane is
 * `stable` when both attempts failed the same way — the property that makes a
 * red result evidence rather than noise.
 */
export function summarizeLane(first: LaneBuild, second: LaneBuild): LaneRun {
	const built = first.result === 'built' && second.result === 'built';
	return {
		first,
		second,
		deterministic:
			built &&
			first.inventory !== null &&
			first.inventory.digest === second.inventory?.digest,
		stable:
			first.result === second.result &&
			first.exitCode === second.exitCode &&
			canonicalize(parseBuildDemands(first.log)) ===
				canonicalize(parseBuildDemands(second.log)),
	};
}

/** Build the era-pinned baseline lane twice in its own runtime cell. */
export async function runBaselineLane(root = baselineRoot): Promise<LaneRun> {
	await generateApplicationMocks(root);
	return summarizeLane(
		await buildBaselineLane('build-run1', root),
		await buildBaselineLane('build-run2', root),
	);
}

export type TargetLaneRun = LaneRun &
	Readonly<{
		entryDocumentSha256: string;
		modulesTransformed: number | null;
		demands: readonly BuildDemand[];
		externalized: readonly ExternalizedModule[];
	}>;

/**
 * Regenerate the entry document and build the migrated lane twice through the
 * frozen adapter composition, recording what the bundler demanded either way.
 */
export async function runTargetLane(
	environment: Readonly<Record<string, string>>,
	root = targetRoot,
): Promise<TargetLaneRun> {
	await generateApplicationMocks(root);
	const document = await writeCypressRwaEntryDocument(environment, root);
	const first = await buildTargetLane('build-vite-run1', root);
	const second = await buildTargetLane('build-vite-run2', root);
	return {
		...summarizeLane(first, second),
		entryDocumentSha256: sha256(document),
		modulesTransformed: parseModulesTransformed(first.log),
		demands: parseBuildDemands(first.log),
		externalized: parseExternalizedModules(first.log, root),
	};
}

/** Write an observation document into the holdout's run evidence directory. */
export async function writeRunObservation(name: string, value: unknown): Promise<string> {
	const directory = path.join(repositoryRoot, 'evidence/runs/react-cypress-rwa');
	await mkdir(directory, { recursive: true });
	const file = path.join(directory, name);
	await writeFile(file, `${JSON.stringify(value, null, '\t')}\n`);
	return file;
}

export const cypressRwaWorkArea = Object.freeze({
	root: workRoot,
	baseline: baselineRoot,
	target: targetRoot,
	viteConfig,
});
