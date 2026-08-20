/**
 * The localize round of the `angular-tiny-translator-v0-12-0` cell: the second
 * boot-blocking runtime global, answered by a capability.
 *
 * u19e supplied the node-core runtime globals the declared `util` needs and the
 * bundle stopped throwing `process is not defined`. It still did not mount: the
 * same load reported `$localize is not defined` at bootstrap, thrown out of the
 * root component's own generated `consts`. The cause is a compiler change the
 * migration crossed rather than anything the application did. TinyTranslator's
 * templates are i18n-marked — that is what the application is for — and the era
 * compiler substituted translations into the factories it emitted, while the
 * Angular 16 compiler emits `$localize` tagged templates that the bundle
 * evaluates at run time. Nothing in the framework's runtime packages binds that
 * global; `@angular/localize` publishes it.
 *
 * This driver reads the applied tree's own templates and manifest and hands
 * both to `@versionless/angular`. It decides which tree is rewritten and
 * nothing else: whether a runtime is owed at all is read out of the templates,
 * and the version it is declared at is the target cell's own range.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	declarePolyfillEntryPoint,
	declareTemplateI18nRuntime,
	type AngularTemplateSource,
	type TemplateI18nRuntimeDeclaration,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';

/** Every template file under one directory, in a stable order. */
export async function readTemplates(root: string): Promise<readonly AngularTemplateSource[]> {
	const templates: AngularTemplateSource[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
				continue;
			}
			if (path.extname(entry.name) !== '.html') continue;
			templates.push({
				path: path.relative(root, full),
				source: await readFile(full, 'utf8'),
			});
		}
	};
	await walk(path.join(root, 'src'));
	return Object.freeze(templates.sort((left, right) => (left.path < right.path ? -1 : 1)));
}

export type LocalizeRound = Readonly<{
	declaration: TemplateI18nRuntimeDeclaration;
	entryPoint: string | null;
	workspaceChanges: readonly { path: string; from: string | null; to: string | null }[];
	workspaceUnhandled: readonly string[];
	filesChanged: readonly string[];
}>;

/**
 * Apply the template-i18n runtime capability to the applied tree.
 *
 * Two files can change and no others: the manifest, which declares the package
 * the runtime is published in, and the workspace, which declares the entry
 * point the builder evaluates before `main`. No application source is touched,
 * because none of it asked for anything — the templates already carried the
 * markers, and the compiler changed underneath them.
 */
export async function applyLocalizeRound(): Promise<LocalizeRound> {
	const manifestPath = path.join(APPLIED_TREE, 'package.json');
	const manifest = await readFile(manifestPath, 'utf8');
	const templates = await readTemplates(APPLIED_TREE);
	const declaration = declareTemplateI18nRuntime({
		manifest,
		templates,
		cell: ANGULAR_16_BROWSER_CELL,
	});
	const filesChanged: string[] = [];
	if (!declaration.declared || declaration.entryPoint === null)
		return Object.freeze({
			declaration,
			entryPoint: null,
			workspaceChanges: Object.freeze([]),
			workspaceUnhandled: Object.freeze([]),
			filesChanged: Object.freeze([]),
		});
	if (declaration.manifest !== manifest) {
		await writeFile(manifestPath, declaration.manifest);
		filesChanged.push('package.json');
	}
	const workspacePath = path.join(APPLIED_TREE, 'angular.json');
	const workspace = await readFile(workspacePath, 'utf8');
	const entry = declarePolyfillEntryPoint(workspace, declaration.entryPoint);
	if (entry.config !== workspace) {
		await writeFile(workspacePath, entry.config);
		filesChanged.push('angular.json');
	}
	return Object.freeze({
		declaration,
		entryPoint: declaration.entryPoint,
		workspaceChanges: entry.changes,
		workspaceUnhandled: entry.unhandled,
		filesChanged: Object.freeze(filesChanged),
	});
}

export async function main(): Promise<void> {
	const round = await applyLocalizeRound();
	await writeFile(
		path.join(STAGE_DIRECTORY, 'localize-round.json'),
		`${JSON.stringify(round, null, '\t')}\n`,
	);
	const reading = round.declaration.reading;
	process.stdout.write(
		`${String(reading.markers.length)} i18n markers in ` +
			`${String(reading.markedTemplates.length)} of ${String(reading.templatesRead)} templates\n`,
	);
	process.stdout.write(
		`declared: ${String(round.declaration.declared)}; entry point: ${round.entryPoint ?? 'none'}\n`,
	);
	process.stdout.write(`files changed: ${round.filesChanged.join(', ') || 'none'}\n`);
	for (const refusal of [...round.declaration.unhandled, ...round.workspaceUnhandled])
		process.stdout.write(`refused: ${refusal}\n`);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-localize-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
