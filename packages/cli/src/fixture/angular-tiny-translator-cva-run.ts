/**
 * The CVA round of the `angular-tiny-translator-v0-12-0` cell: the era
 * call-site semantics of `ControlValueAccessor.setDisabledState`, restored.
 *
 * u19h measured a silent typed-data loss on the migrated lane and u19i
 * attributed it: Angular 16's `setUpControl` calls `setDisabledState` on every
 * accessor as it attaches, this application's accessor rebuilds the very
 * `FormGroup` its own debounced subscription is watching, and the edit the user
 * types therefore reaches nothing. Angular 5 called the method only for a
 * control that was already disabled, so on the era cell the body never ran.
 *
 * The repair is the vendor's own switch, provided rather than written:
 * `CALL_SET_DISABLED_STATE` as `'whenDisabledForLegacyCode'`. This driver reads
 * the applied tree's own TypeScript modules and hands them to
 * `@versionless/angular`. It decides which tree is rewritten and nothing else —
 * whether an accessor is one the era guard was hiding is read out of the
 * application's own `setDisabledState` bodies, and where the provider goes is
 * read out of the module that bootstraps.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import {
	ANGULAR_16_BROWSER_CELL,
	declareLegacyCallSetDisabledState,
	type AngularModuleSource,
	type LegacyCallSetDisabledStateDeclaration,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';

/** Every TypeScript module under one tree's `src`, in a stable order. */
export async function readModules(root: string): Promise<readonly AngularModuleSource[]> {
	const modules: AngularModuleSource[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
				continue;
			}
			if (path.extname(entry.name) !== '.ts') continue;
			if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.spec.ts')) continue;
			modules.push({ path: path.relative(root, full), source: await readFile(full, 'utf8') });
		}
	};
	await walk(path.join(root, 'src'));
	return Object.freeze(modules.sort((left, right) => (left.path < right.path ? -1 : 1)));
}

export type CvaRound = Readonly<{
	declaration: LegacyCallSetDisabledStateDeclaration;
	modulesRead: number;
	filesChanged: readonly string[];
}>;

/**
 * Apply the forms legacy disabled-state capability to the applied tree.
 *
 * One file can change and no others: the module that bootstraps, which gains an
 * import and one provider. No application logic is touched, and in particular
 * the accessor whose `setDisabledState` is defective is left exactly as its
 * authors wrote it — the migration's job is to stop the framework calling it at
 * a moment the era framework never did, not to repair somebody else's bug.
 */
export async function applyCvaRound(): Promise<CvaRound> {
	const modules = await readModules(APPLIED_TREE);
	const declaration = declareLegacyCallSetDisabledState({
		modules,
		cell: ANGULAR_16_BROWSER_CELL,
	});
	const filesChanged: string[] = [];
	if (declaration.declared && declaration.rootModule !== null) {
		const target = path.join(APPLIED_TREE, declaration.rootModule.path);
		if ((await readFile(target, 'utf8')) !== declaration.rootModule.source) {
			await writeFile(target, declaration.rootModule.source);
			filesChanged.push(declaration.rootModule.path);
		}
	}
	return Object.freeze({
		declaration,
		modulesRead: modules.length,
		filesChanged: Object.freeze(filesChanged),
	});
}

export async function main(): Promise<void> {
	const round = await applyCvaRound();
	await writeFile(
		path.join(STAGE_DIRECTORY, 'cva-round.json'),
		`${JSON.stringify(round, null, '\t')}\n`,
	);
	const legacy = round.declaration.accessors.filter((reading) => reading.legacy);
	process.stdout.write(
		`${String(round.declaration.accessors.length)} custom value accessors in ` +
			`${String(round.modulesRead)} modules; ${String(legacy.length)} legacy\n`,
	);
	process.stdout.write(`declared: ${String(round.declaration.declared)}\n`);
	process.stdout.write(`files changed: ${round.filesChanged.join(', ') || 'none'}\n`);
	for (const refusal of round.declaration.unhandled) process.stdout.write(`refused: ${refusal}\n`);
}

if (process.argv[1]?.endsWith('angular-tiny-translator-cva-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
