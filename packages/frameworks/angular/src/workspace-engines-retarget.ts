/**
 * Retargeting a workspace manifest's `engines.node` when the migration moves the
 * workspace onto a different target cell.
 *
 * A manifest's `engines` block is the workspace's own declaration of the runtime
 * it expects. An era workspace wrote one for its era runtime, and a migration
 * that changes every dependency range and leaves that declaration alone produces
 * a manifest which asks a package manager to install a modern closure *and*
 * declares a runtime the closure's own target cell does not satisfy. npm reports
 * it on every command as `EBADENGINE`, naming the workspace itself:
 *
 *     npm WARN EBADENGINE Unsupported engine {
 *     npm WARN EBADENGINE   package: 'pigallery2@1.7.0',
 *     npm WARN EBADENGINE   required: { node: '>= 6.9 <11.0' },
 *     npm WARN EBADENGINE   current: { node: 'v16.20.2' } }
 *
 * The declaration is not decoration: `engines-strict` turns the same reading
 * into a refusal, and a CI runner or a container base image chosen from
 * `engines.node` picks the era runtime for the migrated tree.
 *
 * ## What this capability will and will not do
 *
 * It rewrites one field, to one value, under one condition, and every part of
 * that sentence is a boundary rather than a simplification.
 *
 * - **One field.** `engines.node` and nothing else. A sibling `engines.npm`,
 *   `engines.yarn` or `engines.pnpm` is a declaration about a package manager,
 *   and the target cell states nothing about package managers, so a sibling is
 *   left exactly as the workspace wrote it and reported by name.
 * - **One value.** The range written is derived from the cell — the caret range
 *   on {@link AngularTargetCell.nodeLine}, which is the Node line the cell was
 *   declared against. No version appears in this module. A cell declaring a
 *   different Node line writes a different range without a line changing here.
 * - **One condition.** The rewrite happens only when the declaration the
 *   workspace made *excludes* the cell's Node line. A workspace that declares no
 *   `engines` at all is left with none, because adding one is a constraint the
 *   workspace never made; a workspace whose declaration already admits the cell
 *   is left exactly as it is, because narrowing a range its author chose is not
 *   a migration demand; and a declaration this module cannot read is left alone
 *   and reported, because rewriting an unread declaration is the overreach the
 *   condition exists to prevent.
 *
 * The reading of the era range is deliberately narrow. It understands the
 * comparator forms that appear in `engines.node` declarations — `>=`, `>`,
 * `<=`, `<`, `=`, `^`, `~`, a bare version, `*`, and alternatives joined by
 * `||` — and refuses everything else, including hyphen ranges, `x`-ranges and
 * prerelease tags. Refusing is safe: it stands the capability down. Guessing
 * would not be.
 */

import { compareStrings, type AngularTargetCell } from './angular-target-cell.ts';

/** A parsed dotted version, with absent parts read as zero. */
export type NodeVersion = Readonly<{ major: number; minor: number; patch: number }>;

/**
 * What a declared range says about one version.
 *
 * `unreadable` is a third answer and not a variant of `excludes`: it says the
 * declaration was never evaluated, so nothing may be concluded from it.
 */
export type NodeRangeReading = 'admits' | 'excludes' | 'unreadable';

export type EngineRetarget = Readonly<{
	field: 'engines.node';
	from: string;
	to: string;
	/** The Node line of the cell the range was derived from. */
	nodeLine: string;
	reason: string;
}>;

export type WorkspaceEngineRetargeting = Readonly<{
	manifest: Readonly<Record<string, unknown>>;
	/** The rewrite, or null when the capability stood down. */
	retarget: EngineRetarget | null;
	declaredDifferences: readonly string[];
	unhandled: readonly string[];
}>;

const NUMERALS = '0123456789';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A dotted version with one, two or three numeric parts, or null.
 *
 * Absent parts read as zero, which is what a comparator means by them: `>= 6.9`
 * admits 6.9.0 and `< 11.0` excludes it. A part that is not wholly numeric —
 * an `x`, a `*`, a prerelease tag, a build suffix — makes the whole version
 * unreadable, because each of those changes the comparison rather than
 * decorating it.
 */
export function parseNodeVersion(version: string): NodeVersion | null {
	const trimmed = version.trim();
	if (trimmed === '') return null;
	const parts = trimmed.split('.');
	if (parts.length > 3) return null;
	const numbers: number[] = [];
	for (const part of parts) {
		if (part === '') return null;
		for (const character of part) if (!NUMERALS.includes(character)) return null;
		numbers.push(Number.parseInt(part, 10));
	}
	return Object.freeze({
		major: numbers[0] as number,
		minor: numbers[1] ?? 0,
		patch: numbers[2] ?? 0,
	});
}

/** The number of dotted parts the declaration actually wrote. */
function writtenParts(version: string): number {
	return version.trim().split('.').length;
}

export function compareNodeVersions(left: NodeVersion, right: NodeVersion): number {
	if (left.major !== right.major) return left.major < right.major ? -1 : 1;
	if (left.minor !== right.minor) return left.minor < right.minor ? -1 : 1;
	if (left.patch !== right.patch) return left.patch < right.patch ? -1 : 1;
	return 0;
}

type Comparator = Readonly<{ operator: string; version: string }>;

const OPERATOR_CHARACTERS = '<>=^~';
const SEPARATORS = ' \t\n\r,';

/**
 * The comparators one alternative is written as.
 *
 * The scan is hand-written rather than a split, because a comparator may be
 * spelled with or without a space between its operator and its version — `>=6.9`
 * and `>= 6.9` are the same declaration — so splitting on whitespace would tear
 * half of them in two. Each comparator is an optional run of operator
 * characters, then optional space, then the version text up to the next
 * separator or operator.
 */
function comparatorsOf(alternative: string): readonly Comparator[] {
	const comparators: Comparator[] = [];
	let index = 0;
	while (index < alternative.length) {
		while (index < alternative.length && SEPARATORS.includes(alternative[index] as string))
			index += 1;
		if (index >= alternative.length) break;
		const operatorStart = index;
		while (index < alternative.length && OPERATOR_CHARACTERS.includes(alternative[index] as string))
			index += 1;
		const operator = alternative.slice(operatorStart, index);
		while (index < alternative.length && SEPARATORS.includes(alternative[index] as string))
			index += 1;
		const versionStart = index;
		while (
			index < alternative.length &&
			!SEPARATORS.includes(alternative[index] as string) &&
			!OPERATOR_CHARACTERS.includes(alternative[index] as string)
		)
			index += 1;
		comparators.push(
			Object.freeze({ operator, version: alternative.slice(versionStart, index) }),
		);
	}
	return Object.freeze(comparators);
}

/**
 * Does one comparator admit `version`, or is the comparator unreadable.
 *
 * The caret and tilde are expanded to the half-open interval each names, using
 * the number of parts the declaration wrote: `~16.14` bounds at 16.15.0 where
 * `~16` bounds at 17.0.0, and they are different declarations.
 */
function comparatorAdmits(comparator: Comparator, version: NodeVersion): boolean | null {
	const { operator } = comparator;
	const text = comparator.version;
	if (operator === '' && (text === '*' || text === '')) return true;
	const bound = parseNodeVersion(text);
	if (bound === null) return null;
	const order = compareNodeVersions(version, bound);
	if (operator === '>=') return order >= 0;
	if (operator === '>') return order > 0;
	if (operator === '<=') return order <= 0;
	if (operator === '<') return order < 0;
	if (operator === '=' || operator === '') return order === 0;
	if (operator === '^') {
		if (order < 0) return false;
		if (bound.major > 0) return version.major === bound.major;
		if (bound.minor > 0) return version.major === 0 && version.minor === bound.minor;
		return version.major === 0 && version.minor === 0 && version.patch === bound.patch;
	}
	if (operator === '~') {
		if (order < 0) return false;
		if (writtenParts(text) === 1) return version.major === bound.major;
		return version.major === bound.major && version.minor === bound.minor;
	}
	return null;
}

/**
 * What a declared `engines.node` range says about one Node version.
 *
 * Alternatives joined by `||` are read as a union: one alternative admitting is
 * enough. Comparators inside an alternative are read as an intersection: all of
 * them have to admit. A single unreadable comparator anywhere makes the whole
 * range unreadable, because an alternative that cannot be evaluated could have
 * admitted the version and a union cannot be decided without it.
 */
export function nodeRangeReading(range: string, version: string): NodeRangeReading {
	const subject = parseNodeVersion(version);
	if (subject === null) return 'unreadable';
	const trimmed = range.trim();
	if (trimmed === '') return 'admits';
	if (trimmed.includes(' - ')) return 'unreadable';
	let admitted = false;
	for (const alternative of trimmed.split('||')) {
		const comparators = comparatorsOf(alternative);
		if (comparators.length === 0) return 'unreadable';
		let all = true;
		for (const comparator of comparators) {
			const verdict = comparatorAdmits(comparator, subject);
			if (verdict === null) return 'unreadable';
			if (!verdict) all = false;
		}
		if (all) admitted = true;
	}
	return admitted ? 'admits' : 'excludes';
}

/**
 * The `engines.node` range a cell declares, derived from its Node line.
 *
 * The rule is the caret on the cell's own line: the migrated workspace declares
 * the Node line its target cell was declared against, and nothing above that
 * line. A wider range would declare runtimes the cell says nothing about, and a
 * migration record is not the place to acquire a claim by writing a `>=`.
 */
export function cellNodeEngineRange(cell: AngularTargetCell): string {
	return `^${cell.nodeLine}`;
}

/**
 * Retarget a manifest's `engines.node` onto the cell, or stand down and say why.
 *
 * The manifest handed in is whatever the dependency alignment produced; nothing
 * here reads a dependency, an application name or a source file.
 */
export function retargetWorkspaceEngines(
	manifest: Readonly<Record<string, unknown>>,
	cell: AngularTargetCell,
): WorkspaceEngineRetargeting {
	const standDown = (unhandled: readonly string[]): WorkspaceEngineRetargeting =>
		Object.freeze({
			manifest,
			retarget: null,
			declaredDifferences: Object.freeze([]),
			unhandled: Object.freeze([...unhandled]),
		});
	const engines = manifest['engines'];
	if (engines === undefined) return standDown([]);
	if (!isRecord(engines))
		return standDown([
			`the manifest declares "engines" as something other than an object, so ${cell.id} left it ` +
				'exactly as written rather than replacing a shape it could not read',
		]);
	const declared = engines['node'];
	if (declared === undefined) return standDown([]);
	if (typeof declared !== 'string')
		return standDown([
			`the manifest declares "engines.node" as something other than a string, so ${cell.id} left ` +
				'it exactly as written',
		]);
	const reading = nodeRangeReading(declared, cell.nodeLine);
	if (reading === 'unreadable')
		return standDown([
			`the manifest declares engines.node "${declared}", a range shape this capability does not ` +
				`read, so it was left as written; whether it admits the Node ${cell.nodeLine} that ` +
				`${cell.id} declares is unestablished here`,
		]);
	if (reading === 'admits') return standDown([]);
	const to = cellNodeEngineRange(cell);
	const unhandled: string[] = [];
	for (const sibling of Object.keys(engines).sort(compareStrings)) {
		if (sibling === 'node') continue;
		unhandled.push(
			`engines.${sibling} was left at its era declaration ${JSON.stringify(engines[sibling])}: ` +
				`${cell.id} declares a Node line and states nothing about ${sibling}, so retargeting it ` +
				'would be a decision rather than a reading',
		);
	}
	const reason =
		`the era workspace declared engines.node "${declared}", which excludes the Node ` +
		`${cell.nodeLine} that ${cell.id} is declared against, so the migrated manifest would have ` +
		`asked for this cell's closure while declaring a runtime the cell does not run on`;
	const next: Record<string, unknown> = { ...manifest };
	const nextEngines: Record<string, unknown> = { ...engines };
	nextEngines['node'] = to;
	const ordered: Record<string, unknown> = {};
	for (const key of Object.keys(nextEngines).sort(compareStrings))
		ordered[key] = nextEngines[key];
	next['engines'] = Object.freeze(ordered);
	return Object.freeze({
		manifest: Object.freeze(next),
		retarget: Object.freeze({
			field: 'engines.node',
			from: declared,
			to,
			nodeLine: cell.nodeLine,
			reason,
		}),
		declaredDifferences: Object.freeze([
			`engines.node was retargeted from "${declared}" to "${to}": ${reason}. The range written is ` +
				`the caret on the cell's own Node line, so the migrated workspace declares the runtime ` +
				`${cell.id} was declared against and nothing above it. This is a retarget of the ` +
				`workspace's own declaration, not a claim that the application runs on that line.`,
		]),
		unhandled: Object.freeze(unhandled),
	});
}
