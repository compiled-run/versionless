/**
 * The u18e round of the `angular-super-productivity-v2-13-15` cell: two more
 * closure readings written against the tree u18d left red, and the production
 * build attempted again on the result.
 *
 * u18d cleared six diagnostic families and left 57 diagnostics in ten itemised
 * demands. The largest of them is one edit. Two components extend
 * `@ngx-formly/material`'s `FieldType`, which acquired a type parameter with no
 * default; the compiler reports the bare `extends` clause twice as TS2314 and
 * then reports the whole inherited surface missing from both subclasses — ten
 * TS2339, two TS2740 and three TS2322 standing behind two characters of type
 * position. This driver does not know that. It reads the installed declaration
 * of the class each subclass extends, reads the companion type the same tree
 * publishes for it, and hands both readings to the adapter, which writes the
 * argument only if the companion extends the parameter's own constraint.
 *
 * The second reading is a member surface. `adapter.addAll(…)` is TS2339 with no
 * successor in it, because the checker does not connect `addAll` to `setAll`.
 * The successor is a written-down claim, and this driver measures the installed
 * `EntityAdapter` before the adapter acts on it: `setAll` declared, `addAll`
 * not, following the interfaces it extends and refusing if one of them could not
 * be followed.
 *
 * Nothing here decides what a symbol maps to. It decides which tree is read and
 * which tree is written, and hands both readings to `@versionless/angular`.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'pathe';
import {
	parameteriseBaseClasses,
	readMissingMembers,
	readUnparameterisedBaseClasses,
	renameDeclaredTypeMembers,
	DOCUMENTED_MEMBER_RENAMES,
	type GenericBaseClassReading,
	type BaseTypeParameterReading,
	type CompanionTypeReading,
	type MissingMemberDiagnostic,
	type TypeMemberSurfaceReading,
	type UnparameterisedBaseClassDiagnostic,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import { applyRound, type CapabilityOutcome } from './angular-super-productivity-u18c-run.ts';

/** Every `.d.ts` beneath a directory, skipping the bundled ESM re-emissions. */
async function declarationsBelow(root: string): Promise<readonly string[]> {
	const found: string[] = [];
	const walk = async (directory: string): Promise<void> => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			if (
				entry.name === 'esm2022' ||
				entry.name === 'fesm2022' ||
				entry.name === 'node_modules'
			)
				continue;
			const full = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.endsWith('.d.ts')) found.push(full);
		}
	};
	await walk(root);
	return Object.freeze(found.sort());
}

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

/**
 * The span of a bracketed run starting at `open`, respecting nesting.
 * Returns the index just past the closing bracket, or -1 when it is unbalanced.
 */
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

/** Split a bracketed list on its top-level commas. */
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
	return Object.freeze(parts.map((part) => part.trim()).filter((part) => part !== ''));
}

/** The head of a printed type reference: `A` of `A<B<C>>`. */
function headOf(text: string): string {
	const open = text.indexOf('<');
	return (open === -1 ? text : text.slice(0, open)).trim();
}

/** One declaration's `<…>` parameter list, decomposed as the tree declares it. */
function readTypeParameters(declaration: string): readonly BaseTypeParameterReading[] {
	const open = declaration.indexOf('<');
	if (open === -1) return Object.freeze([]);
	const close = spanOf(declaration, open, '<', '>');
	if (close === -1) return Object.freeze([]);
	return Object.freeze(
		splitTopLevel(declaration.slice(open + 1, close - 1)).map((text) => {
			const equals = text.indexOf('=');
			const beforeDefault = equals === -1 ? text : text.slice(0, equals);
			const extendsAt = beforeDefault.indexOf(' extends ');
			return Object.freeze({
				name: (extendsAt === -1 ? beforeDefault : beforeDefault.slice(0, extendsAt)).trim(),
				constraint:
					extendsAt === -1
						? null
						: headOf(beforeDefault.slice(extendsAt + ' extends '.length)),
				hasDefault: equals !== -1,
			});
		}),
	);
}

/** The specifier a declaration file imports `name` from, when it imports it. */
function specifierOfImport(source: string, name: string): string | null {
	for (const line of source.split('\n')) {
		if (!line.startsWith('import ')) continue;
		const open = line.indexOf('{');
		const close = line.indexOf('}');
		if (open === -1 || close === -1) continue;
		const names = splitTopLevel(line.slice(open + 1, close)).map((entry) =>
			(entry.split(' as ')[0] ?? entry).trim(),
		);
		if (!names.includes(name)) continue;
		const quote = line.indexOf("'", close);
		if (quote === -1) continue;
		const end = line.indexOf("'", quote + 1);
		if (end === -1) continue;
		return line.slice(quote + 1, end);
	}
	return null;
}

/**
 * The member names an interface body declares, at its own brace depth.
 *
 * Only braces are counted. A declaration's angle brackets and parentheses close
 * on the line that opens them, and `=>` in a function-typed property would make
 * an angle-bracket counter go negative on a line that nests nothing.
 */
function readMembers(body: string): readonly string[] {
	const names: string[] = [];
	let depth = 0;
	for (const raw of body.split('\n')) {
		const line = raw.trim();
		const before = depth;
		for (const character of line) {
			if (character === '{') depth += 1;
			else if (character === '}') depth -= 1;
		}
		if (before !== 0) continue;
		const member = /^(?:readonly\s+)?(?<name>[A-Za-z_$][\w$]*)\s*[<(?:]/u.exec(line)?.groups?.[
			'name'
		];
		if (member !== undefined) names.push(member);
	}
	return Object.freeze([...new Set(names)].sort());
}

/**
 * The declaration of one generic base class an application extends, and the
 * companion type the same tree publishes for it.
 *
 * The companion is looked for by the pairing the declaration itself establishes:
 * a class `X` whose parameter is constrained to `C` is paired with the interface
 * `XConfig` that extends `C`, in the package `C` comes from. The pairing is a
 * shape to look for, not a fact to assume — the interface has to be there, it
 * has to extend the constraint, and it has to declare members of its own, or the
 * reading returns no companion and the adapter refuses.
 */
export async function readGenericBaseClass(
	tree: string,
	name: string,
	specifier: string,
): Promise<GenericBaseClassReading> {
	const modules = path.join(tree, 'node_modules');
	const empty = Object.freeze({
		name,
		specifier,
		declaration: 'not found',
		parameters: Object.freeze([]),
		companion: null,
	});
	const packageName = specifier.startsWith('@')
		? specifier.split('/').slice(0, 2).join('/')
		: (specifier.split('/')[0] as string);
	const root = path.join(modules, packageName);
	if (!existsSync(root)) return empty;
	const pattern = new RegExp(String.raw`declare (?:abstract )?class ${name}\s*<`, 'u');
	for (const file of await declarationsBelow(root)) {
		const source = await readFile(file, 'utf8');
		const match = pattern.exec(source);
		if (match === null) continue;
		const open = source.indexOf('<', match.index);
		const close = spanOf(source, open, '<', '>');
		if (close === -1) continue;
		const parameters = readTypeParameters(source.slice(open, close));
		const constraint = parameters[0]?.constraint ?? null;
		const companion =
			constraint === null
				? null
				: await readCompanionType(
						modules,
						`${name}Config`,
						specifierOfImport(source, constraint) ?? packageName,
					);
		return Object.freeze({
			name,
			specifier,
			declaration: path.relative(modules, file),
			parameters,
			companion,
		});
	}
	return empty;
}

/** The companion interface, if the package that publishes the constraint has one. */
async function readCompanionType(
	modules: string,
	name: string,
	specifier: string,
): Promise<CompanionTypeReading | null> {
	const packageName = specifier.startsWith('@')
		? specifier.split('/').slice(0, 2).join('/')
		: (specifier.split('/')[0] as string);
	const root = path.join(modules, packageName);
	if (!existsSync(root)) return null;
	const pattern = new RegExp(String.raw`export interface ${name}\s*[<{]`, 'u');
	for (const file of await declarationsBelow(root)) {
		const source = await readFile(file, 'utf8');
		const match = pattern.exec(source);
		if (match === null) continue;
		const brace = source.indexOf('{', match.index);
		const head = source.slice(match.index, brace);
		const extendsAt = head.indexOf(' extends ');
		const close = spanOf(source, brace, '{', '}');
		if (close === -1) continue;
		return Object.freeze({
			name,
			specifier: packageName,
			extendsConstraint:
				extendsAt === -1 ? null : headOf(head.slice(extendsAt + ' extends '.length)),
			members: readMembers(source.slice(brace + 1, close - 1)),
		});
	}
	return null;
}

/**
 * Every member one installed type declares, following the interfaces it extends
 * within the same package. An extends clause that could not be followed makes
 * the reading incomplete, and an incomplete reading proves no name absent.
 */
export async function readTypeMemberSurface(
	tree: string,
	packageName: string,
	type: string,
): Promise<TypeMemberSurfaceReading> {
	const root = path.join(tree, 'node_modules', packageName);
	const version = await versionOf(tree, packageName);
	const absent = Object.freeze({
		package: packageName,
		version,
		type,
		members: Object.freeze([]),
		complete: false,
	});
	if (!existsSync(root)) return absent;
	const files = await declarationsBelow(root);
	const sources = new Map<string, string>();
	for (const file of files) sources.set(file, await readFile(file, 'utf8'));
	const members = new Set<string>();
	const seen = new Set<string>();
	let complete = true;
	const visit = (interfaceName: string): void => {
		if (seen.has(interfaceName)) return;
		seen.add(interfaceName);
		const pattern = new RegExp(String.raw`(?:export )?interface ${interfaceName}\s*[<{]`, 'u');
		let matched = false;
		for (const [, source] of sources) {
			const match = pattern.exec(source);
			if (match === null) continue;
			matched = true;
			const brace = source.indexOf('{', match.index);
			const head = source.slice(match.index, brace);
			const close = spanOf(source, brace, '{', '}');
			if (close === -1) {
				complete = false;
				break;
			}
			for (const member of readMembers(source.slice(brace + 1, close - 1)))
				members.add(member);
			const extendsAt = head.indexOf(' extends ');
			if (extendsAt !== -1)
				for (const parent of splitTopLevel(head.slice(extendsAt + ' extends '.length)))
					visit(headOf(parent));
			break;
		}
		if (!matched) complete = false;
	};
	visit(type);
	return Object.freeze({
		package: packageName,
		version,
		type,
		members: Object.freeze([...members].sort()),
		complete,
	});
}

/** The base-class round, driven by the compiler's own TS2314 lines. */
export async function baseClassRound(
	log: string,
	tree: string = APPLIED_TREE,
): Promise<CapabilityOutcome> {
	const byFile = readUnparameterisedBaseClasses(log);
	const wanted = new Map<string, string>();
	for (const [file, diagnostics] of byFile) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute)) continue;
		const source = await readFile(absolute, 'utf8');
		for (const diagnostic of diagnostics) {
			for (const line of source.split('\n')) {
				if (!line.startsWith('import ')) continue;
				if (!new RegExp(String.raw`\b${diagnostic.base}\b`, 'u').test(line)) continue;
				const quote = line.indexOf("'");
				const end = line.indexOf("'", quote + 1);
				if (quote !== -1 && end !== -1)
					wanted.set(diagnostic.base, line.slice(quote + 1, end));
			}
		}
	}
	const readings: GenericBaseClassReading[] = [];
	for (const [name, specifier] of [...wanted].sort())
		readings.push(await readGenericBaseClass(tree, name, specifier));
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const [file, diagnostics] of byFile) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute)) {
			unhandled.push(`${file}: the diagnostic names a file the applied tree does not carry`);
			continue;
		}
		const source = await readFile(absolute, 'utf8');
		const migration = parameteriseBaseClasses(
			file,
			source,
			diagnostics as readonly UnparameterisedBaseClassDiagnostic[],
			readings,
		);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes)
			changes.push(
				`${file} line ${String(change.line)}: ${change.base} → ${change.base}<${change.argument}> ` +
					`from '${change.specifier}' (import added: ${String(change.importAdded)})`,
			);
	}
	return Object.freeze({
		capability:
			'unparameterised-base-class, against ' +
			readings
				.map(
					(reading) =>
						`${reading.name} in ${reading.declaration} (${String(reading.parameters.length)} ` +
						`parameter(s), companion: ${reading.companion?.name ?? 'none'})`,
				)
				.join(', '),
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}

/** The member-rename round, driven by TS2339 lines that name a declared type. */
export async function memberRenameRound(
	log: string,
	tree: string = APPLIED_TREE,
): Promise<CapabilityOutcome> {
	const byFile = readMissingMembers(log);
	const surfaces: TypeMemberSurfaceReading[] = [];
	for (const rename of DOCUMENTED_MEMBER_RENAMES)
		surfaces.push(await readTypeMemberSurface(tree, rename.package, rename.type));
	const changed: string[] = [];
	const changes: string[] = [];
	const unhandled: string[] = [];
	for (const [file, diagnostics] of byFile) {
		const absolute = path.join(tree, file);
		if (!existsSync(absolute)) continue;
		if (!file.endsWith('.ts')) {
			unhandled.push(
				`${file}: the compiler raises this TS2339 against a template, whose receiver is the ` +
					'component class rather than a type an installed package declares',
			);
			continue;
		}
		const source = await readFile(absolute, 'utf8');
		const migration = renameDeclaredTypeMembers(
			file,
			source,
			diagnostics as readonly MissingMemberDiagnostic[],
			DOCUMENTED_MEMBER_RENAMES,
			surfaces,
		);
		unhandled.push(...migration.unhandled);
		if (!migration.changed) continue;
		await writeFile(absolute, migration.source);
		changed.push(file);
		for (const change of migration.changes)
			changes.push(
				`${file} line ${String(change.line)}: ${change.declaredType}.${change.from} → ` +
					`${change.to}`,
			);
	}
	return Object.freeze({
		capability:
			'declared-type-member-rename, against ' +
			surfaces
				.map(
					(surface) =>
						`${surface.package}@${surface.version} ${surface.type} ` +
						`(${String(surface.members.length)} members, complete: ${String(surface.complete)})`,
				)
				.join(', '),
		filesChanged: Object.freeze(changed),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}

export async function main(): Promise<void> {
	const log = await readFile(
		path.join(STAGE_DIRECTORY, process.argv[2] ?? 'build-3.log'),
		'utf8',
	);
	const outcomes: CapabilityOutcome[] = [...(await applyRound())];
	outcomes.push(await baseClassRound(log));
	outcomes.push(await memberRenameRound(log));
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u18e-round.json'),
		`${JSON.stringify(outcomes, null, '\t')}\n`,
	);
	for (const outcome of outcomes)
		process.stdout.write(
			`${outcome.capability}: ${String(outcome.filesChanged.length)} files changed, ` +
				`${String(outcome.changes.length)} changes, ${String(outcome.unhandled.length)} refused\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u18e-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
