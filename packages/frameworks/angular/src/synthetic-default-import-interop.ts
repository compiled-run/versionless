/**
 * A default import of a package that publishes an `export =` declaration, in a
 * workspace whose TypeScript configuration allows neither of the two flags that
 * make such an import legal.
 *
 * `TS1259: Module '…/clipboard/src/clipboard' can only be default-imported using
 * the 'allowSyntheticDefaultImports' flag` is not a source defect and it is not a
 * rename. The application's line is the line it always was; what changed is that
 * the package started shipping typings. A CommonJS package with no declaration
 * file is an untyped import and the compiler says nothing about how it is bound;
 * the same package one release later, publishing `export = ClipboardJS`, is a
 * module with no ES default export, and the default import the application wrote
 * years ago becomes an error without a character of it moving.
 *
 * So the edit is a configuration edit, and the whole of the question is *which*
 * flag. TypeScript offers two and they are not interchangeable.
 * `esModuleInterop` changes emit: it rewrites namespace imports into calls to a
 * helper and, with it on, `import * as ns` is no longer callable even when the
 * module it names is a function. `allowSyntheticDefaultImports` changes type
 * checking only — TypeScript documents it as having no emit effect at all — and
 * says exactly the one thing the diagnostic asks for: a module with no default
 * export may still be default-imported, on the understanding that whatever runs
 * the output supplies the interop. An Angular application's output is bundled,
 * and the bundler supplies it.
 *
 * This capability therefore writes the type-only flag and refuses the
 * emit-changing one *by measurement* rather than by preference: it counts the
 * namespace imports in the tree that are used as callees, and every one of them
 * is a call site `esModuleInterop` would break. Writing that down is the point.
 * A configuration change is the widest edit an adapter can make — it applies to
 * every file in the program at once — so it is made only where a reading proves
 * a demand for it, and the demand is proved twice: the application really has to
 * default-import the package, and the installed package really has to publish a
 * declaration whose export is an assignment rather than an ES default.
 */

import { compareStrings } from './angular-target-cell.ts';
import { lineOf, parseModule, forEachNode, type AstNode } from './semantic-module.ts';
import { packageOfSpecifier } from './suggested-export-rename.ts';
import { objectAt, parseStrictJson, serializeJson } from './angular-workspace-migration.ts';

const CAPABILITY = 'Synthetic default import interop';

/** One `import X from '…'` in one module. */
export type DefaultImportSite = Readonly<{
	path: string;
	line: number;
	specifier: string;
	local: string;
}>;

/**
 * One `import * as ns from '…'` whose binding is used as the callee of a call.
 *
 * These are not this capability's demand — they are its refusal of the other
 * flag. `esModuleInterop` would make each of them a TS2349, so a tree carrying
 * any of them is a tree where the emit-changing flag is not the answer.
 */
export type CallableNamespaceImportSite = Readonly<{
	path: string;
	line: number;
	specifier: string;
	local: string;
}>;

export type ModuleInteropReading = Readonly<{
	path: string;
	defaultImports: readonly DefaultImportSite[];
	calledNamespaceImports: readonly CallableNamespaceImportSite[];
}>;

/**
 * What the installed package's declaration entry answers.
 *
 * `exportAssignment` is the fact that makes a default import illegal without the
 * flag; `esDefaultExport` is the fact that makes it legal without one. A reading
 * that establishes neither proves nothing and is refused.
 */
export type ExportAssignmentReading = Readonly<{
	package: string;
	version: string;
	/** The declaration entry the package points `types`/`typings`/`exports` at. */
	declarationFile: string | null;
	exportAssignment: boolean;
	esDefaultExport: boolean;
	/** False when the reading could not be taken; an incomplete reading proves nothing. */
	complete: boolean;
}>;

export type InteropChange = Readonly<{
	kind: 'synthetic-default-import-interop';
	path: 'compilerOptions.allowSyntheticDefaultImports';
	from: string | null;
	to: 'true';
	/** The sites that demanded the flag, one line each, for the record. */
	requiredBy: readonly string[];
}>;

export type InteropMigration = Readonly<{
	config: string;
	changed: boolean;
	changes: readonly InteropChange[];
	unhandled: readonly string[];
}>;

/**
 * The bare package name a module specifier reaches into, or null when the
 * specifier is the application's own file rather than a package.
 */
function barePackageOf(specifier: string): string | null {
	if (specifier === '' || specifier.startsWith('.') || specifier.startsWith('/')) return null;
	const name = packageOfSpecifier(specifier);
	return name === '' ? null : name;
}

/** Every identifier node in a module that resolves to `local`. */
function referencesTo(module: ReturnType<typeof parseModule>, local: unknown): readonly AstNode[] {
	const found: AstNode[] = [];
	forEachNode(module.ast, (node) => {
		if (node.type !== 'Identifier') return;
		if (module.symbolOf(node) !== local) return;
		found.push(node);
	});
	return Object.freeze(found);
}

/**
 * Read one module's default imports, and the namespace imports it calls.
 *
 * Both are bare-specifier only. A relative default import is the application's
 * own module and the flag has nothing to say about it.
 */
export function readModuleInterop(path: string, source: string): ModuleInteropReading {
	const module = parseModule(CAPABILITY, path, source);
	const defaults: DefaultImportSite[] = [];
	const called: CallableNamespaceImportSite[] = [];
	for (const record of module.imports) {
		const local = record.local;
		if (local === null) continue;
		if (barePackageOf(record.specifier) === null) continue;
		const line = lineOf(source, record.node.start);
		const name = typeof local.name === 'string' ? local.name : '';
		if (record.isNamespace) {
			const uses = referencesTo(module, local);
			const callee = uses.some((use) => {
				const parent = module.parentOf(use);
				return (
					parent !== null &&
					(parent.type === 'CallExpression' || parent.type === 'NewExpression') &&
					parent.callee === use
				);
			});
			if (callee) called.push({ path, line, specifier: record.specifier, local: name });
			continue;
		}
		if (record.name !== 'default') continue;
		defaults.push({ path, line, specifier: record.specifier, local: name });
	}
	return Object.freeze({
		path,
		defaultImports: Object.freeze(defaults),
		calledNamespaceImports: Object.freeze(called),
	});
}

/**
 * Turn on `allowSyntheticDefaultImports` in a workspace tsconfig, where the tree
 * proves both that something default-imports an `export =` package and that the
 * configuration does not already allow it.
 */
export function enableSyntheticDefaultImports(
	source: string,
	modules: readonly ModuleInteropReading[],
	packages: readonly ExportAssignmentReading[],
): InteropMigration {
	const config = parseStrictJson(source, 'synthetic default import interop');
	const unhandled: string[] = [];
	const unchanged = (): InteropMigration =>
		Object.freeze({
			config: source,
			changed: false,
			changes: Object.freeze([]),
			unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
		});

	const called = modules.flatMap((entry) => entry.calledNamespaceImports);
	if (called.length > 0)
		unhandled.push(
			`esModuleInterop was not considered as the answer: ${String(called.length)} namespace ` +
				'import(s) in this tree are used as the callee of a call ' +
				`(${[...new Set(called.map((site) => site.specifier))].sort(compareStrings).join(', ')}), ` +
				'and that flag makes a namespace object uncallable. It changes emit; ' +
				'allowSyntheticDefaultImports does not.',
		);

	const compilerOptions = objectAt(config['compilerOptions']);
	if (compilerOptions === null) {
		unhandled.push(
			'the tsconfig declares no compilerOptions, so there is no options object to write the ' +
				'flag into and synthesising one would be writing a configuration rather than migrating it',
		);
		return unchanged();
	}
	const declared = compilerOptions['allowSyntheticDefaultImports'];
	if (declared === true) {
		unhandled.push(
			'compilerOptions.allowSyntheticDefaultImports is already true, so the diagnostic this ' +
				'capability answers cannot be the one this tree reports',
		);
		return unchanged();
	}
	if (declared !== undefined) {
		unhandled.push(
			`compilerOptions.allowSyntheticDefaultImports is declared as ${JSON.stringify(declared)}. ` +
				'That is an explicit decision by the workspace and this capability does not overturn one; ' +
				'it only fills a gap.',
		);
		return unchanged();
	}
	if (compilerOptions['esModuleInterop'] === true) {
		unhandled.push(
			'compilerOptions.esModuleInterop is true, which implies allowSyntheticDefaultImports, so ' +
				'the flag is already in force and the diagnostic means something else',
		);
		return unchanged();
	}

	const requiredBy: string[] = [];
	const seen = new Set<string>();
	for (const module of modules)
		for (const site of module.defaultImports) {
			const name = barePackageOf(site.specifier);
			if (name === null) continue;
			const at = `${site.path} line ${String(site.line)}: default import of '${site.specifier}'`;
			const reading = packages.find((entry) => entry.package === name);
			if (reading === undefined) {
				if (!seen.has(name)) {
					seen.add(name);
					unhandled.push(
						`${at} — no declaration surface was read for '${name}', so nothing establishes ` +
							'whether its typings publish a default export',
					);
				}
				continue;
			}
			if (!reading.complete) {
				unhandled.push(
					`${at} — the declaration surface of '${name}'@${reading.version} could not be read, ` +
						'and an unread declaration proves neither export shape',
				);
				continue;
			}
			if (reading.declarationFile === null) {
				unhandled.push(
					`${at} — '${name}'@${reading.version} publishes no typings, so the import is untyped ` +
						'and the compiler has no export shape to object to',
				);
				continue;
			}
			if (reading.esDefaultExport) {
				unhandled.push(
					`${at} — '${name}'@${reading.version} declares an ES default export in ` +
						`${reading.declarationFile}, so the default import is already legal`,
				);
				continue;
			}
			if (!reading.exportAssignment) {
				unhandled.push(
					`${at} — '${name}'@${reading.version} declares neither an export assignment nor an ` +
						`ES default export in ${reading.declarationFile}, so the shape the flag answers ` +
						'is not the shape this package has',
				);
				continue;
			}
			requiredBy.push(
				`${at} — '${name}'@${reading.version} declares \`export =\` in ${reading.declarationFile}`,
			);
		}

	if (requiredBy.length === 0) {
		unhandled.push(
			'no default import in the tree reaches a package whose installed declaration is an export ' +
				'assignment, so nothing demands the flag and turning it on would widen every module in ' +
				'the program for no reading',
		);
		return unchanged();
	}

	const migrated = { ...compilerOptions, allowSyntheticDefaultImports: true };
	const next = { ...config, compilerOptions: migrated };
	return Object.freeze({
		config: serializeJson(next),
		changed: true,
		changes: Object.freeze([
			Object.freeze({
				kind: 'synthetic-default-import-interop' as const,
				path: 'compilerOptions.allowSyntheticDefaultImports' as const,
				from: null,
				to: 'true' as const,
				requiredBy: Object.freeze([...requiredBy].sort(compareStrings)),
			}),
		]),
		unhandled: Object.freeze([...new Set(unhandled)].sort(compareStrings)),
	});
}
