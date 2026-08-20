/**
 * The u18f round of the `angular-super-productivity-v2-13-15` cell: the two
 * demands u18e read and refused, read again with the readings each one actually
 * needed, and the production build attempted on the result.
 *
 * u18e refused `mat-chip-list` because the installed chips entry point publishes
 * three successors and the package does not say which one a given list became.
 * That is still true, and this driver does not decide it. What it does is read
 * more of the same tree: every chips component's element selectors, its declared
 * base classes, its template-facing inputs and outputs and the component its
 * content query is typed to — and the text-input directive's host binding
 * together with the component *that* binding is declared to accept. The last of
 * those is the whole of the input-bearing proof. `set chipGrid(value:
 * MatChipGrid)` is the installed package saying which container a `matChipInput`
 * belongs to, and the adapter reads it rather than being told.
 *
 * The second is `rxjs/internal-compatibility`, which is a written-down successor
 * and is recorded as one. This driver measures what the tree can still refuse it
 * with: whether the specifier resolves at all, and every name the installed root
 * publishes.
 *
 * Nothing here decides what a symbol or an element maps to. It decides which tree
 * is read and which tree is written.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import {
	DOCUMENTED_ELEMENT_SPLITS,
	DOCUMENTED_SYMBOL_SUCCESSORS,
	readUnknownElements,
	resolveSplitElementSuccessors,
	succeedRemovedEntryPointSymbols,
	type ComponentSurfaceReading,
	type DocumentedElementSplit,
	type ElementSplitReading,
	type RootSurfaceReading,
	type TextInputDirectiveReading,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { applyRound, type CapabilityOutcome } from './angular-super-productivity-u18c-run.ts';

/** The installed version a package declares, or `unknown`. */
async function versionOf(tree: string, name: string): Promise<string> {
	try {
		const manifest = JSON.parse(
			await readFile(path.join(tree, 'node_modules', name, 'package.json'), 'utf8'),
		) as Readonly<{ version?: unknown }>;
		return typeof manifest.version === 'string' ? manifest.version : 'unknown';
	} catch {
		return 'unknown';
	}
}

/** The span of a bracketed run starting at `open`, respecting nesting. */
function spanOf(text: string, open: number, opener: string, closer: string): number {
	let depth = 0;
	for (let index = open; index < text.length; index += 1) {
		const character = text[index];
		if (character === opener) depth += 1;
		else if (character === closer) {
			depth -= 1;
			if (depth === 0) return index + 1;
		}
	}
	return -1;
}

/**
 * The element-form selectors of a component selector string.
 *
 * `mat-basic-chip, [mat-basic-chip], mat-chip, [mat-chip]` names two elements and
 * two attributes; only the elements can be written as a tag.
 */
function elementSelectorsOf(selector: string): readonly string[] {
	return Object.freeze(
		selector
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry !== '' && !entry.startsWith('[') && !entry.includes('['))
			.sort(),
	);
}

/** The template-facing names of an Ivy input or output map literal. */
function aliasesOf(literal: string): readonly string[] {
	const names = new Set<string>();
	for (const match of literal.matchAll(/"alias":\s*"(?<alias>[^"]+)"/gu)) {
		const alias = match.groups?.['alias'];
		if (alias !== undefined) names.add(alias);
	}
	if (names.size === 0)
		for (const match of literal.matchAll(/"(?<key>[^"]+)":\s*"(?<value>[^"]+)"/gu)) {
			const value = match.groups?.['value'];
			if (value !== undefined) names.add(value);
		}
	return Object.freeze([...names].sort());
}

/** The comma-separated top-level slices of a generic argument list. */
function splitTopLevel(text: string): readonly string[] {
	const parts: string[] = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (character === '<' || character === '(' || character === '{' || character === '[')
			depth += 1;
		else if (character === '>' || character === ')' || character === '}' || character === ']')
			depth -= 1;
		else if (character === ',' && depth === 0) {
			parts.push(text.slice(start, index));
			start = index + 1;
		}
	}
	parts.push(text.slice(start));
	return Object.freeze(parts.map((part) => part.trim()));
}

/**
 * One class's own body, so that a member read off it is that class's member.
 *
 * A content query named `_chips` is declared by three of the chips containers
 * and typed differently by each; a search of the whole file would answer every
 * one of them with the first.
 */
function classBodyOf(source: string, component: string): string {
	const match = new RegExp(String.raw`declare (?:abstract )?class ${component}\b`, 'u').exec(
		source,
	);
	if (match === null) return '';
	const brace = source.indexOf('{', match.index);
	if (brace === -1) return '';
	const close = spanOf(source, brace, '{', '}');
	return close === -1 ? '' : source.slice(brace + 1, close - 1);
}

/**
 * The declared base classes of a class, nearest first, within one declaration
 * file.
 *
 * A mixin-applied base is written as a const whose type ends in `typeof Base`,
 * and the extends clause names the const rather than the class. The const is
 * followed through to the class it aliases and is not itself recorded: it is a
 * value the emitter wrote, not a component anything can extend by name.
 */
function extendsChainOf(source: string, component: string): readonly string[] {
	const chain: string[] = [];
	let current = component;
	for (let step = 0; step < 32; step += 1) {
		const match = new RegExp(
			String.raw`declare (?:abstract )?class ${current}\b[^{]*?\bextends\s+(?<base>[A-Za-z_$][\w$]*)`,
			'u',
		).exec(source);
		let base = match?.groups?.['base'];
		if (base === undefined) break;
		const alias = new RegExp(
			String.raw`declare const ${base}\s*:[^;]*?\btypeof\s+(?<aliased>[A-Za-z_$][\w$]*)`,
			'u',
		).exec(source)?.groups?.['aliased'];
		if (alias !== undefined) base = alias;
		if (chain.includes(base)) break;
		chain.push(base);
		current = base;
	}
	return Object.freeze(chain);
}

/**
 * One entry point's components, as the template compiler would see them.
 *
 * Every fact comes from the emitted `ɵcmp` type — the selector, the input and
 * output alias maps and the content-query names — or from the `declare class`
 * heads around it. The content-query *type* is the one fact the `ɵcmp` does not
 * carry, so it is read from the queried member's own declaration:
 * `_chips: QueryList<MatChipRow>`.
 */
export async function readComponentSurfaces(
	tree: string,
	packageName: string,
	entryPoint: string,
): Promise<readonly ComponentSurfaceReading[]> {
	const file = path.join(tree, 'node_modules', packageName, entryPoint, 'index.d.ts');
	if (!existsSync(file)) return Object.freeze([]);
	const source = await readFile(file, 'utf8');
	const found: ComponentSurfaceReading[] = [];
	for (const match of source.matchAll(
		/ɵɵComponentDeclaration<(?<component>[A-Za-z_$][\w$]*),\s*"(?<selector>[^"]*)"/gu,
	)) {
		const component = match.groups?.['component'];
		const selector = match.groups?.['selector'];
		if (component === undefined || selector === undefined) continue;
		const open = source.indexOf('<', match.index);
		const close = spanOf(source, open, '<', '>');
		const parts = close === -1 ? [] : splitTopLevel(source.slice(open + 1, close - 1));
		const inputs = aliasesOf(parts[3] ?? '');
		const outputs = aliasesOf(parts[4] ?? '');
		const queries = (parts[5] ?? '')
			.replace('[', '')
			.replace(']', '')
			.split(',')
			.map((entry) => entry.trim().replaceAll('"', ''))
			.filter((entry) => entry !== '' && entry !== 'never');
		const body = classBodyOf(source, component);
		let contentChildComponent: string | null = null;
		for (const query of queries) {
			const declared = new RegExp(
				String.raw`\b${query}\s*:\s*QueryList<(?<child>[A-Za-z_$][\w$]*)>`,
				'u',
			).exec(body)?.groups?.['child'];
			if (declared !== undefined) contentChildComponent = declared;
		}
		found.push(
			Object.freeze({
				component,
				elements: elementSelectorsOf(selector),
				extendsChain: extendsChainOf(source, component),
				inputs,
				outputs,
				contentChildComponent,
			}),
		);
	}
	return Object.freeze(
		found.sort((left, right) => left.component.localeCompare(right.component)),
	);
}

/**
 * The text-input directive of an entry point and the component its host binding
 * is typed to. Both come from the declaration file: the directive's `ɵdir` gives
 * the selector and the alias, and the class body gives the setter's parameter
 * type.
 */
export async function readTextInputDirective(
	tree: string,
	packageName: string,
	entryPoint: string,
	directive: string,
): Promise<TextInputDirectiveReading | null> {
	const file = path.join(tree, 'node_modules', packageName, entryPoint, 'index.d.ts');
	if (!existsSync(file)) return null;
	const source = await readFile(file, 'utf8');
	const declaration = new RegExp(
		String.raw`ɵɵDirectiveDeclaration<${directive},\s*"(?<selector>[^"]*)"`,
		'u',
	).exec(source)?.groups?.['selector'];
	if (declaration === undefined) return null;
	const element = declaration.split(',')[0]?.trim().split('[')[0]?.trim() ?? '';
	const attribute = /\[(?<attribute>[^\]]+)\]/u.exec(declaration)?.groups?.['attribute'];
	if (element === '' || attribute === undefined) return null;
	const property = new RegExp(
		String.raw`"(?<property>[\w$]+)":\s*\{\s*"alias":\s*"${attribute}"`,
		'u',
	).exec(source)?.groups?.['property'];
	if (property === undefined) return null;
	const hostComponent = new RegExp(
		String.raw`set ${property}\(value:\s*(?<component>[A-Za-z_$][\w$]*)\)`,
		'u',
	).exec(source)?.groups?.['component'];
	if (hostComponent === undefined) return null;
	return Object.freeze({ directive, element, hostBinding: attribute, hostComponent });
}

/** The whole split reading for one documented split, against the installed tree. */
export async function readElementSplit(
	tree: string,
	split: DocumentedElementSplit,
	entryPoint: string,
	directive: string,
): Promise<ElementSplitReading> {
	const components = await readComponentSurfaces(tree, split.package, entryPoint);
	const textInput = await readTextInputDirective(tree, split.package, entryPoint, directive);
	return Object.freeze({
		package: split.package,
		version: await versionOf(tree, split.package),
		replaced: split.replaced,
		replacedStillDeclared: components.some((entry) => entry.elements.includes(split.replaced)),
		components,
		textInput,
		complete: components.length > 0 && textInput !== null,
	});
}

/**
 * The root surface of a package, and whether the removed specifier still
 * resolves. Reachability is asked of the exports map when there is one and of the
 * file system when there is not, because a package with no map answers whatever
 * is on disk.
 */
export async function readRootSurface(
	tree: string,
	packageName: string,
	specifier: string,
): Promise<RootSurfaceReading> {
	const root = path.join(tree, 'node_modules', packageName);
	const version = await versionOf(tree, packageName);
	const absent = Object.freeze({
		package: packageName,
		version,
		specifier,
		specifierResolves: false,
		rootExports: Object.freeze([]),
		complete: false,
	});
	if (!existsSync(root)) return absent;
	const manifest = JSON.parse(
		await readFile(path.join(root, 'package.json'), 'utf8'),
	) as Readonly<{
		exports?: unknown;
		types?: unknown;
		typings?: unknown;
	}>;
	const subpath = specifier.slice(packageName.length + 1);
	const map = manifest.exports;
	const resolves =
		typeof map === 'object' && map !== null
			? Object.keys(map as Record<string, unknown>).includes(`./${subpath}`)
			: existsSync(path.join(root, subpath)) ||
				existsSync(path.join(root, `${subpath}.js`)) ||
				existsSync(path.join(root, `${subpath}.d.ts`));
	const declared =
		typeof map === 'object' && map !== null
			? typesOf((map as Record<string, unknown>)['.'])
			: typeof manifest.types === 'string'
				? manifest.types
				: typeof manifest.typings === 'string'
					? manifest.typings
					: null;
	if (declared === null) return Object.freeze({ ...absent, specifierResolves: resolves });
	const entry = path.join(root, declared);
	if (!existsSync(entry)) return Object.freeze({ ...absent, specifierResolves: resolves });
	const names = new Set<string>();
	const seen = new Set<string>();
	const visit = async (file: string): Promise<void> => {
		if (seen.has(file)) return;
		seen.add(file);
		const source = await readFile(file, 'utf8');
		for (const match of source.matchAll(/^export\s*\{(?<names>[^}]*)\}/gmu))
			for (const raw of splitTopLevel(match.groups?.['names'] ?? '')) {
				const name = (raw.split(' as ').at(-1) ?? raw).trim();
				if (name !== '') names.add(name);
			}
		for (const match of source.matchAll(
			/^export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|const|function|enum)\s+(?<name>[A-Za-z_$][\w$]*)/gmu,
		)) {
			const name = match.groups?.['name'];
			if (name !== undefined) names.add(name);
		}
	};
	await visit(entry);
	return Object.freeze({
		package: packageName,
		version,
		specifier,
		specifierResolves: resolves,
		rootExports: Object.freeze([...names].sort()),
		complete: names.size > 0,
	});
}

/** The `types` condition of an exports entry, however it is nested. */
function typesOf(value: unknown): string | null {
	if (typeof value === 'string') return value;
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	for (const key of ['types', 'typings', 'default', 'import', 'require', 'node']) {
		const found = typesOf(record[key]);
		if (found !== null && found.endsWith('.d.ts')) return found;
	}
	return null;
}

/** The chip-list round, driven by the compiler's own NG8001 lines. */
export async function splitElementRound(
	log: string,
	tree: string = APPLIED_TREE,
): Promise<CapabilityOutcome> {
	const byFile = readUnknownElements(log);
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	const described: string[] = [];
	for (const split of DOCUMENTED_ELEMENT_SPLITS) {
		const reading = await readElementSplit(tree, split, 'chips', 'MatChipInput');
		described.push(
			`${split.package}@${reading.version} <${split.replaced}> ` +
				`(${String(reading.components.length)} components, text input: ` +
				`${reading.textInput?.hostBinding ?? 'none'} → ${reading.textInput?.hostComponent ?? 'none'}, ` +
				`still declared: ${String(reading.replacedStillDeclared)})`,
		);
		for (const [file, elements] of byFile) {
			if (!elements.includes(split.replaced)) continue;
			const absolute = path.join(tree, file);
			if (!existsSync(absolute)) {
				unhandled.push(
					`${file}: the diagnostic names a file the applied tree does not carry`,
				);
				continue;
			}
			const source = await readFile(absolute, 'utf8');
			const migration = resolveSplitElementSuccessors(file, source, split, reading);
			unhandled.push(...migration.unhandled);
			if (!migration.changed) continue;
			await writeFile(absolute, migration.source);
			changed.push(file);
			for (const change of migration.changes)
				changes.push(
					`${file} line ${String(change.line)}: <${change.from}> → <${change.to}> ` +
						`(${change.shape}, ${change.component})` +
						(change.children.length > 0
							? `, children ${change.children.join(', ')}`
							: ''),
				);
		}
	}
	return Object.freeze({
		capability: `split-element-successor, against ${described.join(', ')}`,
		filesChanged: Object.freeze(changed.sort()),
		changes: Object.freeze(changes.sort()),
		unhandled: Object.freeze(unhandled.sort()),
	});
}

/** The removed-entry-point round, driven by the compiler's own TS2307 lines. */
export async function symbolSuccessorRound(
	log: string,
	tree: string = APPLIED_TREE,
): Promise<CapabilityOutcome> {
	const readings: RootSurfaceReading[] = [];
	for (const claim of DOCUMENTED_SYMBOL_SUCCESSORS)
		readings.push(await readRootSurface(tree, claim.package, claim.specifier));
	const wanted = new Set<string>();
	for (const raw of log.split('\n')) {
		const line = raw.trim();
		if (!line.includes(' - error TS2307: ')) continue;
		const head = line.split(' - error TS2307: ')[0] ?? '';
		const parts = head.split(':');
		if (parts.length < 3) continue;
		wanted.add(parts.slice(0, -2).join(':').replace('Error: ', ''));
	}
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const file of [...wanted].sort()) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute) || !file.endsWith('.ts')) continue;
		const source = await readFile(absolute, 'utf8');
		const migration = succeedRemovedEntryPointSymbols(
			file,
			source,
			DOCUMENTED_SYMBOL_SUCCESSORS,
			readings,
		);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes)
			changes.push(
				`${file} line ${String(change.line)}: ${change.from} from '${change.specifier}' → ` +
					`${change.to} from '${change.root}' (${String(change.callSites)} call site(s))`,
			);
	}
	return Object.freeze({
		capability:
			'removed-entry-point-symbol-successor, against ' +
			readings
				.map(
					(reading) =>
						`'${reading.package}'@${reading.version} (${String(reading.rootExports.length)} root ` +
						`exports, ${reading.specifier} resolves: ${String(reading.specifierResolves)})`,
				)
				.join(', '),
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort()),
	});
}

export async function main(): Promise<void> {
	const log = await readFile(
		path.join(STAGE_DIRECTORY, process.argv[2] ?? 'build-4.log'),
		'utf8',
	);
	const outcomes: CapabilityOutcome[] = [...(await applyRound())];
	outcomes.push(await splitElementRound(log));
	outcomes.push(await symbolSuccessorRound(log));
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18f-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18f-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
