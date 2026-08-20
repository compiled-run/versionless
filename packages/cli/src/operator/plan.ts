/**
 * The framework-neutral `plan` flow: compose a changeset for an application
 * tree and report it without writing anything into that tree.
 *
 * Composition is not implemented here. Every decision about *what to change*
 * comes from the frozen adapters — `migrateAngularCliEraWorkspace` for the
 * Angular lineage, the create-react-app and Vite-origin adapters for the React
 * lineage — and this module only reads the tree, hands the readings over, and
 * reports what came back. Given the same inputs it therefore produces the same
 * changeset the fixture-driven drivers produce, byte for byte; that identity is
 * proven in `packages/cli/test/operator-flows.test.ts` on one application per
 * lineage rather than asserted here.
 *
 * A reading the tree cannot supply is not invented. The Angular capabilities
 * that are gated on a compiler diagnostic or on an installed closure stand down
 * when no reading is supplied, and the plan says which readings were supplied
 * rather than leaving a reader to assume all of them were.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	ANGULAR_TARGET_CELLS,
	migrateAngularCliEraWorkspace,
	type AngularMigration,
	type AngularMigrationInput,
	type AngularTargetCell,
	type WorkspaceFile,
} from '../../../frameworks/angular/src/index.ts';
import {
	craEntryDocument,
	craWebpackNodeCoreShimSpecifiers,
	planViteOriginConfigSource,
	type CraEnvironment,
} from '../../../frameworks/react/src/index.ts';
import {
	analyzeApplication,
	angularSourceRoots,
	fileExists,
	readJsonFile,
	workspacePathsBelow,
	type ApplicationAnalysis,
} from './analyze.ts';
import { refuse } from './refusals.ts';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

export type PlannedFile = Readonly<{
	path: string;
	kind: 'application' | 'workspace';
	changed: boolean;
	sha256Before: string;
	sha256After: string;
	source: string;
	changes: readonly string[];
}>;

export type OperatorPlan = Readonly<{
	lineage: string;
	/** The frozen entry point that composed this changeset. */
	engine: string;
	/** The target cell, when the lineage publishes one. */
	cell: string | null;
	/** Which supply-gated readings this plan handed the engine. */
	inputsSupplied: readonly string[];
	/** Application files the engine read, whether or not it changed them. */
	applicationFilesScanned: number;
	files: readonly PlannedFile[];
	removedFiles: readonly string[];
	unhandled: readonly string[];
	declaredDifferences: readonly string[];
	notEstablished: readonly string[];
}>;

const PLAN_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A composed changeset is a set of edits, not a build. Nothing here establishes that the migrated tree installs, compiles, or emits anything.',
	'`applicationFilesScanned` counts files the engine read. A file it scanned and left alone is counted as scanned and not as changed.',
	'A capability gated on a reading this tree did not supply stood down. That is not evidence that the tree has nothing for it to do.',
]);

/**
 * Files below `directory` with the given extension, in the order a depth-first
 * walk that sorts each directory's own entries by name produces — the same
 * order the fixture-driven drivers collect in, so the composed changeset does
 * not depend on which caller assembled the input. Installed packages and Git
 * metadata are never walked.
 */
export async function filesBelow(
	directory: string,
	root: string,
	extension: string,
): Promise<WorkspaceFile[]> {
	const files: WorkspaceFile[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
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

export type AngularPlanOptions = Readonly<{
	appRoot: string;
	/** Directories whose `.ts` modules are the application's compilation unit. */
	sourceDirectories?: readonly string[];
	/** Directories whose `.html` files are component templates. */
	templateDirectories?: readonly string[];
	/** Directories whose `.css` files the application owns. */
	styleSheetDirectories?: readonly string[];
	/** Module suffixes excluded from the source modules. */
	excludedSuffixes?: readonly string[];
	/**
	 * Readings only a caller that has compiled or installed the tree can supply
	 * — compiler diagnostics, the installed closure, the era closure. They are
	 * merged over the readings this module derives from the tree, so an operator
	 * that has them gets exactly the changeset a driver that has them gets.
	 */
	readings?: Partial<AngularMigrationInput>;
	/**
	 * The target cell, already resolved. A caller that holds an
	 * `AngularTargetCell` — a fixture driver, or `planApplication` after it has
	 * resolved a declaration — passes it here, and it wins over `cellId`.
	 */
	cell?: AngularTargetCell;
	/**
	 * The cell an operator declared with `--cell`, as an identifier.
	 *
	 * It is resolved against the cells the frozen adapters publish, and an
	 * identifier none of them publishes is refused rather than resolved. Nothing
	 * declared leaves the default cell exactly where it was.
	 */
	cellId?: string | null;
}>;

/**
 * The cell a declared identifier names, or the default when nothing was
 * declared.
 *
 * The registry read is `ANGULAR_TARGET_CELLS` — the cells a frozen adapter
 * publishes as migration targets — and nothing here widens it. An identifier no
 * adapter publishes is a named refusal, not a fallback: silently planning
 * against Angular 16 for an operator who declared another cell would align a
 * manifest to a line nobody asked for and report it as the cell they named.
 *
 * `era-cell.ts` carries a second, larger vocabulary — the cells this repository
 * can *describe*, published or not — because that stage answers a different
 * question: which Node runtime a cell needs. Being describable is not being
 * plannable, and the two are deliberately not the same list.
 */
export function resolveAngularTargetCell(declaredId?: string | null): AngularTargetCell {
	if (declaredId === undefined || declaredId === null || declaredId === '')
		return ANGULAR_16_BROWSER_CELL;
	const published = ANGULAR_TARGET_CELLS.find((cell) => cell.id === declaredId);
	if (published === undefined)
		refuse({
			code: 'plan.angular.declared-cell-not-published',
			message: `Angular plan: --cell ${declaredId} names a cell no frozen adapter publishes as a migration target. The published target cells are ${ANGULAR_TARGET_CELLS.map((cell) => cell.id).join(', ')}. This flow refuses rather than planning against a cell nobody declared.`,
			stage: 'plan',
			origin: 'pipeline',
		});
	return published;
}

const DEFAULT_EXCLUDED_SUFFIXES: readonly string[] = Object.freeze(['.spec.ts']);

/**
 * Compose the Angular changeset for a tree, through the frozen adapter.
 *
 * The source directories default to the `sourceRoot` the workspace declares for
 * its own build target. A workspace that declares none is refused rather than
 * guessed at: scanning the wrong directory would report a clean changeset for a
 * tree nothing was read from.
 *
 * The target cell is resolved before the tree is read, so an operator who
 * declared a cell this repository cannot plan against is told that rather than
 * being told something about their workspace document first.
 */
export async function composeAngularPlan(
	options: AngularPlanOptions,
): Promise<{ migration: AngularMigration; inputsSupplied: readonly string[] }> {
	const cell = options.cell ?? resolveAngularTargetCell(options.cellId);
	const tree = options.appRoot;
	const workspaceConfigPath = (await fileExists(path.join(tree, 'angular.json')))
		? 'angular.json'
		: (await fileExists(path.join(tree, '.angular-cli.json')))
			? '.angular-cli.json'
			: null;
	if (workspaceConfigPath === null)
		refuse({
			code: 'plan.angular.no-workspace-document',
			message:
				'Angular plan: the application root carries neither angular.json nor .angular-cli.json, so there is no workspace document to migrate.',
			stage: 'plan',
			origin: 'pipeline',
		});
	const declaredRoots = angularSourceRoots(
		await readJsonFile(path.join(tree, workspaceConfigPath)),
	);
	const sourceDirectories = options.sourceDirectories ?? declaredRoots;
	if (sourceDirectories.length === 0)
		refuse({
			code: 'plan.angular.no-declared-source-root',
			message: `Angular plan: ${workspaceConfigPath} declares no sourceRoot for a build target, so the application source directories are unknown. Supply --source-dir <dir> (repeatable) rather than have this flow guess.`,
			stage: 'plan',
			origin: 'pipeline',
		});
	for (const directory of [
		...sourceDirectories,
		...(options.templateDirectories ?? []),
		...(options.styleSheetDirectories ?? []),
	])
		if (path.isAbsolute(directory) || directory.startsWith('..'))
			refuse({
				code: 'plan.angular.source-directory-escapes-the-application-root',
				message: `Angular plan: source directory escapes the application root: ${directory}`,
				stage: 'plan',
				origin: 'pipeline',
			});
	const excluded = options.excludedSuffixes ?? DEFAULT_EXCLUDED_SUFFIXES;
	const tsConfigPath = (await fileExists(path.join(tree, 'tsconfig.json')))
		? 'tsconfig.json'
		: null;
	if (tsConfigPath === null)
		refuse({
			code: 'plan.angular.no-tsconfig',
			message: 'Angular plan: the application root carries no tsconfig.json.',
			stage: 'plan',
			origin: 'pipeline',
		});
	const derived: AngularMigrationInput = {
		packageManifest: {
			path: 'package.json',
			source: await readFile(path.join(tree, 'package.json'), 'utf8'),
		},
		workspaceConfig: {
			path: workspaceConfigPath,
			source: await readFile(path.join(tree, workspaceConfigPath), 'utf8'),
		},
		tsConfig: {
			path: tsConfigPath,
			source: await readFile(path.join(tree, tsConfigPath), 'utf8'),
		},
		sourceModules: (await collect(tree, '.ts', sourceDirectories)).filter(
			(module) => !excluded.some((suffix) => module.path.endsWith(suffix)),
		),
		templates: await collect(tree, '.html', options.templateDirectories ?? sourceDirectories),
		styleSheets: await collect(
			tree,
			'.css',
			options.styleSheetDirectories ?? sourceDirectories,
		),
		workspaceFiles: await workspacePathsBelow(tree, tree),
	};
	const input: AngularMigrationInput = { ...derived, ...options.readings };
	return {
		migration: migrateAngularCliEraWorkspace(input, cell),
		inputsSupplied: Object.freeze(Object.keys(input).sort()),
	};
}

/**
 * create-react-app's environment prefix rule: of everything a `.env` declares,
 * only `REACT_APP_`-prefixed keys reach the browser bundle.
 */
export const CRA_ENVIRONMENT_PREFIX = 'REACT_APP_';

/** Parse the `KEY=value` subset of a dotenv document, prefixed keys only. */
export function craPrefixedEnvironment(document: string): Readonly<Record<string, string>> {
	const entries: [string, string][] = [];
	for (const line of document.split('\n')) {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith('#')) continue;
		const separator = trimmed.indexOf('=');
		if (separator <= 0) continue;
		const key = trimmed.slice(0, separator).trim();
		if (!key.startsWith(CRA_ENVIRONMENT_PREFIX)) continue;
		const raw = trimmed.slice(separator + 1).trim();
		const quoted =
			(raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) ||
			(raw.startsWith("'") && raw.endsWith("'") && raw.length > 1);
		entries.push([key, quoted ? raw.slice(1, -1) : raw]);
	}
	entries.sort(([left], [right]) => (left === right ? 0 : left < right ? -1 : 1));
	return Object.freeze(Object.fromEntries(entries));
}

/** The two keys create-react-app always defines for a production build. */
export const CRA_BUILD_ENVIRONMENT: CraEnvironment = Object.freeze({
	NODE_ENV: 'production',
	PUBLIC_URL: '',
});

/** The environment a create-react-app build inlines, for a tree at `root`. */
export async function craBuildEnvironment(root: string): Promise<CraEnvironment> {
	const file = path.join(root, '.env');
	const document = (await fileExists(file)) ? await readFile(file, 'utf8') : '';
	return Object.freeze({ ...CRA_BUILD_ENVIRONMENT, ...craPrefixedEnvironment(document) });
}

/** The create-react-app entry modules, in the order the adapter fixtures use. */
export const CRA_ENTRY_MODULES: readonly string[] = Object.freeze([
	'src/index.tsx',
	'src/index.jsx',
	'src/index.ts',
	'src/index.js',
]);

export type ReactPlanOptions = Readonly<{
	appRoot: string;
	environment?: CraEnvironment;
	entryModule?: string;
}>;

/**
 * Compose the React changeset for a tree, through the frozen adapters.
 *
 * The create-react-app hop rewrites exactly one file — the Vite entry document
 * the adapter derives from the application's own `public/index.html` — because
 * everything else the hop does is a build-time composition rather than an edit.
 * Saying so is the honest reading; reporting a large changeset for a hop that
 * writes one file would not be.
 */
export async function composeReactPlan(options: ReactPlanOptions): Promise<{
	files: readonly PlannedFile[];
	unhandled: readonly string[];
	declaredDifferences: readonly string[];
	engine: string;
}> {
	const tree = options.appRoot;
	const manifest = await readJsonFile(path.join(tree, 'package.json'));
	const dependencies = {
		...(manifest?.dependencies as Record<string, unknown> | undefined),
		...(manifest?.devDependencies as Record<string, unknown> | undefined),
	};
	if (Object.hasOwn(dependencies, 'react-scripts')) {
		const template = path.join(tree, 'public/index.html');
		if (!(await fileExists(template)))
			refuse({
				code: 'plan.react.no-entry-document-template',
				message:
					'React plan: this create-react-app tree carries no public/index.html, so the adapter has no entry-document template to derive from.',
				stage: 'plan',
				origin: 'frozen-adapter',
			});
		let entryModule = options.entryModule ?? null;
		if (entryModule === null)
			for (const candidate of CRA_ENTRY_MODULES)
				if (entryModule === null && (await fileExists(path.join(tree, candidate))))
					entryModule = `/${candidate}`;
		if (entryModule === null)
			refuse({
				code: 'plan.react.entry-module-unknown',
				message: `React plan: none of ${CRA_ENTRY_MODULES.join(', ')} exists, so the application entry module is unknown. Supply --entry <module> rather than have this flow guess.`,
				stage: 'plan',
				origin: 'pipeline',
			});
		const environment = options.environment ?? (await craBuildEnvironment(tree));
		const document = craEntryDocument({
			template: await readFile(template, 'utf8'),
			entryModule,
			environment,
		});
		const existing = (await fileExists(path.join(tree, 'index.html')))
			? await readFile(path.join(tree, 'index.html'), 'utf8')
			: '';
		return {
			engine: '@versionless/react craEntryDocument (create-react-app adapter)',
			files: Object.freeze([
				Object.freeze({
					path: 'index.html',
					kind: 'workspace' as const,
					changed: existing !== document,
					sha256Before: existing === '' ? '' : sha256(existing),
					sha256After: sha256(document),
					source: document,
					changes: Object.freeze([
						`entry document derived from public/index.html with entry module ${entryModule}`,
						`create-react-app template placeholders substituted for ${Object.keys(environment).sort().join(', ')}`,
					]),
				}),
			]),
			unhandled: Object.freeze([
				'The pinned source-level React transforms (connect-to-hooks, class-lifecycle-to-hooks) are gated on exact source digests and on a maintained package/lock pair supplied out of band. This flow supplies neither, so no application module is rewritten by it.',
				'Node core specifiers webpack resolved to an empty module are externalized by the adapter and reported by the build rather than shimmed. Which ones this application reaches is a reading of a build, and this flow performs no build.',
			]),
			declaredDifferences: Object.freeze([
				`The build is driven by the frozen create-react-app Vite adapter composition rather than by react-scripts. Node core specifiers the adapter's own shim table carries: ${Object.keys(craWebpackNodeCoreShimSpecifiers).sort().join(', ')}.`,
				'The generated entry document is written beside the application rather than replacing public/index.html: the template stays the application’s own file.',
			]),
		};
	}
	for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
		const file = path.join(tree, name);
		if (!(await fileExists(file))) continue;
		const plan = planViteOriginConfigSource(await readFile(file, 'utf8'), name);
		return {
			engine: '@versionless/react planViteOriginConfigSource (Vite-origin adapter)',
			files: Object.freeze([]),
			unhandled: Object.freeze([
				`The Vite-origin hop is a build-time configuration translation and rewrites no application file. ${String(plan.plugins.length)} plugin(s) and ${String(plan.options.length)} option(s) were read from ${name}.`,
			]),
			declaredDifferences: Object.freeze([
				...plan.options.map(
					(option) => `${option.option}: ${option.disposition} — ${option.note}`,
				),
				...plan.plugins.map(
					(entry) =>
						`${entry.package} -> ${entry.target ?? 'no successor'} — ${entry.role}`,
				),
				`build target: ${plan.buildTarget.join(', ')}`,
			]),
		};
	}
	/**
	 * The admission rule is the frozen adapter's, not this flow's: the
	 * create-react-app adapter keys on the `react-scripts` declaration and the
	 * Vite-origin adapter keys on a Vite configuration file. Widening it — to an
	 * ejected create-react-app tree carrying its own webpack configuration, for
	 * instance — is freeze motion, which is why the origin is recorded as
	 * `frozen-adapter` rather than as a decision this file could simply change.
	 */
	refuse({
		code: 'plan.react.no-frozen-adapter-claims-this-tree',
		message:
			'React plan: this tree declares neither react-scripts nor a Vite configuration, so no frozen React adapter claims it. This flow refuses rather than guessing an origin toolchain.',
		stage: 'plan',
		origin: 'frozen-adapter',
	});
}

export type PlanOptions = Readonly<{
	appRoot: string;
	angular?: Omit<AngularPlanOptions, 'appRoot'>;
	react?: Omit<ReactPlanOptions, 'appRoot'>;
}>;

/**
 * Compose the changeset for an application tree, whatever its lineage.
 *
 * The target cell is resolved first and the analyze reading is taken against
 * it, so the `cellReadings.cell` this returns names the cell the changeset was
 * actually composed against rather than the default. With nothing declared the
 * resolution yields the same default cell `analyzeApplication` already carried,
 * so the undeclared path is the path it was.
 */
export async function planApplication(
	options: PlanOptions,
): Promise<{ analysis: ApplicationAnalysis; plan: OperatorPlan }> {
	const cell = options.angular?.cell ?? resolveAngularTargetCell(options.angular?.cellId);
	const analysis = await analyzeApplication(options.appRoot, cell);
	if (analysis.lineage === 'angular') {
		const { migration, inputsSupplied } = await composeAngularPlan({
			appRoot: options.appRoot,
			...options.angular,
			cell,
		});
		return {
			analysis,
			plan: Object.freeze({
				lineage: 'angular',
				engine: '@versionless/angular migrateAngularCliEraWorkspace',
				cell: migration.cell,
				inputsSupplied,
				applicationFilesScanned: migration.applicationFilesScanned,
				files: Object.freeze(
					migration.files.map((entry) =>
						Object.freeze({
							path: entry.path,
							kind: entry.kind,
							changed: entry.changed,
							sha256Before: entry.sha256Before,
							sha256After: entry.sha256After,
							source: entry.source,
							changes: entry.changes,
						}),
					),
				),
				removedFiles: migration.removedFiles,
				unhandled: migration.unhandled,
				declaredDifferences: migration.declaredDifferences,
				notEstablished: PLAN_NOT_ESTABLISHED,
			}),
		};
	}
	if (analysis.lineage === 'react') {
		const composed = await composeReactPlan({
			appRoot: options.appRoot,
			...options.react,
		});
		return {
			analysis,
			plan: Object.freeze({
				lineage: 'react',
				engine: composed.engine,
				cell: null,
				inputsSupplied: Object.freeze(['packageManifest', 'entryTemplate', 'environment']),
				applicationFilesScanned: composed.files.length,
				files: composed.files,
				removedFiles: Object.freeze([]),
				unhandled: composed.unhandled,
				declaredDifferences: composed.declaredDifferences,
				notEstablished: PLAN_NOT_ESTABLISHED,
			}),
		};
	}
	refuse({
		code: 'plan.lineage-no-frozen-adapter-claims',
		message: `Plan: no frozen adapter claims the ${analysis.lineage} lineage detected at this root. React (create-react-app or Vite origin) and Angular are the lineages this repository publishes a migration engine for.`,
		stage: 'plan',
		origin: 'frozen-adapter',
	});
}
