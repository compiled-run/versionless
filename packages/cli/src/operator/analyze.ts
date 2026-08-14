/**
 * Framework-neutral detection for the operator flows.
 *
 * This module reads an application tree and states what it found. It composes
 * the frozen adapters' own published readings — the Angular target cell's
 * ecosystem registry is the only per-package verdict surface either lineage
 * publishes — and it never fills a gap with a plausible value: a package the
 * cell has no reading for is reported `unknown`, a runtime the tree does not
 * declare is reported `unknown`, and a lineage that publishes no cell registry
 * is reported as having none rather than as having an empty one.
 *
 * Nothing here decides *what to change*. That lives in the frozen adapters.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	ecosystemDispositionOf,
	type AngularTargetCell,
} from '../../../frameworks/angular/src/index.ts';

export type Lineage = 'angular' | 'react' | 'nextjs' | 'unknown';

/** The reading this module writes when the tree does not state the fact. */
export const UNKNOWN = 'unknown' as const;

export type PackageManagerReading = Readonly<{
	/** `npm`, `yarn`, `pnpm`, `ambiguous` when several lockfiles are present, or `unknown`. */
	manager: string;
	/** The lockfiles actually found, by workspace-relative path. */
	lockfiles: readonly string[];
	/** The `packageManager` field the manifest declares, or `unknown`. */
	declared: string;
}>;

export type NodeEraReading = Readonly<{
	/** The Node line the tree declares for itself, or `unknown`. */
	declared: string;
	/** Which file declared it, or `unknown`. */
	source: string;
}>;

export type CellVerdict = Readonly<{
	package: string;
	declaredRange: string;
	/** `aligned`, `no-successor`, `successor-fork`, or `unknown` when the cell has no reading. */
	verdict: string;
	/** The cell's own words for the reading, or `unknown`. */
	fact: string;
	/** The range the cell writes for an aligned package, otherwise `unknown`. */
	alignedRange: string;
}>;

export type CellReadings = Readonly<{
	/** The cell identifier, or `null` when the lineage publishes no cell registry. */
	cell: string | null;
	/** Why there is no cell, when there is none. */
	reason: string | null;
	verdicts: readonly CellVerdict[];
	counts: Readonly<Record<string, number>>;
}>;

export type ApplicationAnalysis = Readonly<{
	lineage: Lineage;
	/** The framework version range the manifest declares, or `unknown`. */
	frameworkVersionDeclared: string;
	/** The package the lineage was detected from, or `unknown`. */
	detectedFrom: string;
	/** The build tool the tree declares, or `unknown`. */
	builder: string;
	/** Where the builder reading came from, or `unknown`. */
	builderSource: string;
	nodeEra: NodeEraReading;
	packageManager: PackageManagerReading;
	cellReadings: CellReadings;
	notEstablished: readonly string[];
}>;

const NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'Detection reads declarations. Nothing here establishes that this application installs, compiles, builds, or behaves as it did on its era toolchain.',
	'A cell verdict is a reading of a published registry, not an installation: a range written here has not been resolved against any lockfile by this record.',
	'A dependency the cell has no reading for is reported `unknown`. `unknown` is not `supported` and it is not `unsupported`.',
]);

export async function fileExists(file: string): Promise<boolean> {
	try {
		return (await stat(file)).isFile();
	} catch {
		return false;
	}
}

export async function directoryExists(directory: string): Promise<boolean> {
	try {
		return (await stat(directory)).isDirectory();
	} catch {
		return false;
	}
}

export async function readJsonFile(file: string): Promise<Record<string, unknown> | null> {
	try {
		const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown;
		return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

function stringsOf(value: unknown): Readonly<Record<string, string>> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
	const entries: [string, string][] = [];
	for (const [key, item] of Object.entries(value as Record<string, unknown>))
		if (typeof item === 'string') entries.push([key, item]);
	return Object.fromEntries(entries);
}

/** Every declared dependency of a manifest, runtime and development alike. */
export function declaredDependencies(
	manifest: Record<string, unknown> | null,
): Readonly<Record<string, string>> {
	if (manifest === null) return {};
	return Object.freeze({
		...stringsOf(manifest.dependencies),
		...stringsOf(manifest.devDependencies),
	});
}

/**
 * The Angular workspace build target, read from the workspace document rather
 * than assumed. A workspace that declares none is reported `unknown`.
 */
export function angularBuilderOf(workspace: Record<string, unknown> | null): string {
	if (workspace === null) return UNKNOWN;
	const projects = workspace.projects;
	if (projects === null || typeof projects !== 'object') return UNKNOWN;
	for (const project of Object.values(projects as Record<string, unknown>)) {
		if (project === null || typeof project !== 'object') continue;
		const record = project as Record<string, unknown>;
		const targets = (record.architect ?? record.targets) as Record<string, unknown> | undefined;
		if (targets === undefined || targets === null) continue;
		const build = targets.build as Record<string, unknown> | undefined;
		if (build === undefined || build === null) continue;
		const builder = build.builder ?? build.executor;
		if (typeof builder === 'string' && builder.length > 0) return builder;
	}
	return UNKNOWN;
}

/**
 * The Angular `sourceRoot` declarations the workspace carries, in project
 * order. A workspace that declares none yields none, which is what makes the
 * operator ask for `--source-dir` instead of guessing `src`.
 */
export function angularSourceRoots(workspace: Record<string, unknown> | null): readonly string[] {
	if (workspace === null) return Object.freeze([]);
	const projects = workspace.projects;
	if (projects === null || typeof projects !== 'object') return Object.freeze([]);
	const roots: string[] = [];
	for (const project of Object.values(projects as Record<string, unknown>)) {
		if (project === null || typeof project !== 'object') continue;
		const record = project as Record<string, unknown>;
		const targets = (record.architect ?? record.targets) as Record<string, unknown> | undefined;
		const hasBuild =
			targets !== undefined && targets !== null && Object.hasOwn(targets, 'build');
		if (!hasBuild) continue;
		if (typeof record.sourceRoot === 'string' && record.sourceRoot.length > 0)
			roots.push(record.sourceRoot);
	}
	return Object.freeze(roots);
}

async function readNodeEra(root: string): Promise<NodeEraReading> {
	for (const name of ['.nvmrc', '.node-version']) {
		const file = path.join(root, name);
		if (!(await fileExists(file))) continue;
		const declared = (await readFile(file, 'utf8')).trim();
		if (declared.length > 0) return Object.freeze({ declared, source: name });
	}
	const manifest = await readJsonFile(path.join(root, 'package.json'));
	const engines = stringsOf(manifest?.engines);
	if (typeof engines.node === 'string' && engines.node.length > 0)
		return Object.freeze({ declared: engines.node, source: 'package.json#engines.node' });
	return Object.freeze({ declared: UNKNOWN, source: UNKNOWN });
}

const LOCKFILES: Readonly<Record<string, string>> = Object.freeze({
	'package-lock.json': 'npm',
	'npm-shrinkwrap.json': 'npm',
	'yarn.lock': 'yarn',
	'pnpm-lock.yaml': 'pnpm',
});

async function readPackageManager(
	root: string,
	manifest: Record<string, unknown> | null,
): Promise<PackageManagerReading> {
	const found: string[] = [];
	const managers = new Set<string>();
	for (const name of Object.keys(LOCKFILES).sort())
		if (await fileExists(path.join(root, name))) {
			found.push(name);
			managers.add(LOCKFILES[name] as string);
		}
	const declared =
		typeof manifest?.packageManager === 'string' && manifest.packageManager.length > 0
			? manifest.packageManager
			: UNKNOWN;
	const manager =
		managers.size === 1
			? ([...managers][0] as string)
			: managers.size > 1
				? 'ambiguous'
				: UNKNOWN;
	return Object.freeze({ manager, lockfiles: Object.freeze(found), declared });
}

/**
 * The cell's verdict on every package the application declares.
 *
 * Only the Angular target cell publishes a per-package registry, so a React or
 * Next.js tree is reported as having no cell rather than as having a cell that
 * read nothing. A declared package the registry does not carry is `unknown`.
 */
export function readCellVerdicts(
	lineage: Lineage,
	dependencies: Readonly<Record<string, string>>,
	cell: AngularTargetCell = ANGULAR_16_BROWSER_CELL,
): CellReadings {
	if (lineage !== 'angular')
		return Object.freeze({
			cell: null,
			reason: 'The frozen React and Next.js adapters publish no target-cell package registry, so no per-package verdict exists for this lineage. Every declared dependency is unknown to the engine rather than accepted by it.',
			verdicts: Object.freeze([]),
			counts: Object.freeze({ unknown: Object.keys(dependencies).length }),
		});
	const verdicts: CellVerdict[] = [];
	const counts: Record<string, number> = {
		aligned: 0,
		'no-successor': 0,
		'successor-fork': 0,
		unknown: 0,
	};
	for (const name of Object.keys(dependencies).sort()) {
		const disposition = ecosystemDispositionOf(name, cell);
		const verdict = disposition === null ? UNKNOWN : disposition.kind;
		counts[verdict] = (counts[verdict] ?? 0) + 1;
		verdicts.push({
			package: name,
			declaredRange: dependencies[name] as string,
			verdict,
			fact: disposition === null ? UNKNOWN : disposition.fact,
			alignedRange:
				disposition !== null && disposition.kind === 'aligned'
					? disposition.range
					: UNKNOWN,
		});
	}
	return Object.freeze({
		cell: cell.id,
		reason: null,
		verdicts: Object.freeze(verdicts),
		counts: Object.freeze(counts),
	});
}

/** Refuse an application root that is not a directory carrying a manifest. */
export async function assertApplicationRoot(root: string): Promise<void> {
	if (!(await directoryExists(root)))
		throw new Error(`Application root is not a directory: ${root}`);
	if (!(await fileExists(path.join(root, 'package.json'))))
		throw new Error(`Application root carries no package.json: ${root}`);
}

export async function analyzeApplication(
	root: string,
	cell: AngularTargetCell = ANGULAR_16_BROWSER_CELL,
): Promise<ApplicationAnalysis> {
	await assertApplicationRoot(root);
	const manifest = await readJsonFile(path.join(root, 'package.json'));
	const dependencies = declaredDependencies(manifest);
	const workspace = await readJsonFile(path.join(root, 'angular.json'));
	const legacyWorkspace =
		workspace === null ? await readJsonFile(path.join(root, '.angular-cli.json')) : null;
	const lineage: Lineage = Object.hasOwn(dependencies, '@angular/core')
		? 'angular'
		: Object.hasOwn(dependencies, 'next')
			? 'nextjs'
			: Object.hasOwn(dependencies, 'react')
				? 'react'
				: 'unknown';
	const detectedFrom =
		lineage === 'angular'
			? '@angular/core'
			: lineage === 'nextjs'
				? 'next'
				: lineage === 'react'
					? 'react'
					: UNKNOWN;
	const viteConfigs: string[] = [];
	for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'])
		if (await fileExists(path.join(root, name))) viteConfigs.push(name);
	const angularBuilder = angularBuilderOf(workspace);
	const builder =
		lineage === 'angular'
			? angularBuilder === UNKNOWN && legacyWorkspace !== null
				? 'angular-cli-1.x (.angular-cli.json, no builder field)'
				: angularBuilder
			: Object.hasOwn(dependencies, 'react-scripts')
				? 'react-scripts'
				: viteConfigs.length > 0
					? 'vite'
					: Object.hasOwn(dependencies, 'next')
						? 'next'
						: UNKNOWN;
	const builderSource =
		lineage === 'angular'
			? workspace !== null
				? 'angular.json'
				: legacyWorkspace !== null
					? '.angular-cli.json'
					: UNKNOWN
			: builder === 'react-scripts' || builder === 'next'
				? 'package.json'
				: builder === 'vite'
					? (viteConfigs[0] as string)
					: UNKNOWN;
	return Object.freeze({
		lineage,
		frameworkVersionDeclared:
			detectedFrom === UNKNOWN ? UNKNOWN : (dependencies[detectedFrom] ?? UNKNOWN),
		detectedFrom,
		builder,
		builderSource,
		nodeEra: await readNodeEra(root),
		packageManager: await readPackageManager(root, manifest),
		cellReadings: readCellVerdicts(lineage, dependencies, cell),
		notEstablished: NOT_ESTABLISHED,
	});
}

/**
 * Every workspace-relative path below `directory`, in the order a depth-first
 * walk that sorts each directory's own entries by name produces. Installed
 * packages and Git metadata are never walked.
 */
export async function workspacePathsBelow(directory: string, root: string): Promise<string[]> {
	const paths: string[] = [];
	for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
		left.name < right.name ? -1 : 1,
	)) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			paths.push(...(await workspacePathsBelow(item, root)));
			continue;
		}
		if (entry.isFile()) paths.push(path.relative(root, item));
	}
	return paths;
}
