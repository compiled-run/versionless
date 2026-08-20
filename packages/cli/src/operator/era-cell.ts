/**
 * The `era-cell` stage: which toolchain era the application is installed and
 * built inside, and whether this host can provide it.
 *
 * Spike C measured this one and named it the wall rather than a cost: "The era
 * cell, not the migration, is what stopped the baseline"
 * (`evidence/spikes/thin-wrapper-cost/verdict.json`, finding C2). The host it
 * measured carries exactly one Node era cell, `v24.15.0`, on `darwin-arm64`;
 * webpack 4's md4 hashing fails there, and node-sass 4.12.0 refuses the host
 * outright with `Unsupported architecture (arm64)`. Nothing in this repository
 * read that requirement before an install was attempted, so the requirement
 * arrived as a wall of package-manager output for an operator to interpret.
 *
 * This stage reads it first. The required cell is determined the way the other
 * admission parameters are determined — the tree's own declarations, the target
 * cell the frozen adapter publishes, and a declaration flag for what neither
 * states — and a cell this host cannot provide is a named refusal carrying exit
 * 2 rather than a failed install carrying exit 1.
 *
 * The cell vocabulary is the one that already exists. `analyze.ts` reports a
 * `cell` per application, read from the registry the frozen Angular adapter
 * publishes, and an `AngularTargetCell` already declares its own `nodeLine`.
 * This stage reads that Node line rather than writing a second one, and the one
 * cell described here that no adapter publishes — the ngcc-bearing Angular 13
 * cell — is described from the spike that measured it, marked as described
 * rather than published, and declared with `--cell` rather than defaulted to.
 *
 * What "provisioned" means here is deliberately narrow: a Node runtime of the
 * required major and architecture is on this host, at a location this stage
 * read. Nothing is fetched — a runtime this host does not already carry is
 * refused, because a stage that reaches a network to acquire a toolchain is a
 * different stage with a different consent. Installing the framework toolchain
 * a cell names is not done here either, and the record says so in its own
 * words rather than leaving a reader to infer it from the word "cell".
 */

import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import * as path from 'pathe';
import {
	ANGULAR_TARGET_CELLS,
	type AngularTargetCell,
} from '../../../frameworks/angular/src/index.ts';
import {
	analyzeApplication,
	declaredDependencies,
	directoryExists,
	fileExists,
	readJsonFile,
	UNKNOWN,
	type ApplicationAnalysis,
	type Lineage,
} from './analyze.ts';
import { refuse, type PipelineRefusal } from './refusals.ts';

export const ERA_CELL_RECORD_SCHEMA = 'versionless.era-cell.v1';

/** The npm lockfiles this stage reads a closure out of, in preference order. */
export const ERA_CELL_LOCKFILES: readonly string[] = Object.freeze([
	'package-lock.json',
	'npm-shrinkwrap.json',
]);

/** The architectures this stage reads and declares. */
export const ARCHITECTURES: readonly string[] = Object.freeze(['arm64', 'x64']);

/**
 * A toolchain cell this stage can name, with the Node line it declares.
 *
 * Every entry either restates a cell a frozen adapter publishes — the `id` and
 * the `nodeLine` are read from the adapter's own declaration, never retyped —
 * or is described from a measurement in `evidence/`, and says which.
 */
export type DescribedCell = Readonly<{
	id: string;
	lineage: Lineage;
	/** The Node line the cell declares, verbatim. */
	nodeLine: string;
	nodeMajor: number;
	/** Where this description comes from. */
	describedBy: string;
	/** Whether an adapter in this repository publishes the cell as a target. */
	published: boolean;
	/** What establishing this cell provides here, and what it does not. */
	provides: string;
}>;

/** The leading major of a version or range, or `null` when it reads as none. */
export function leadingMajor(value: string): number | null {
	let digits = '';
	let started = false;
	for (const character of value.trim()) {
		const code = character.charCodeAt(0);
		const isDigit = code >= 48 && code <= 57;
		if (isDigit) {
			started = true;
			digits += character;
			continue;
		}
		if (started) break;
		if (character === '^' || character === '~' || character === 'v' || character === '=')
			continue;
		if (character === '>' || character === '<' || character === ' ') continue;
		return null;
	}
	return digits === '' ? null : Number.parseInt(digits, 10);
}

function cellOfAdapterCell(cell: AngularTargetCell): DescribedCell | null {
	const major = leadingMajor(cell.nodeLine);
	if (major === null) return null;
	return Object.freeze({
		id: cell.id,
		lineage: 'angular' as const,
		nodeLine: cell.nodeLine,
		nodeMajor: major,
		describedBy: `published by the frozen Angular adapter as an AngularTargetCell; the Node line is the cell's own nodeLine declaration.`,
		published: true,
		provides:
			'the Node runtime the cell declares. The Angular packages the cell aligns a manifest to are written by the plan stage and resolved by the install stage, not by this one.',
	});
}

/**
 * Every cell this stage can name.
 *
 * The list is derived from the adapter registry and nothing else, so a cell is
 * describable here exactly when an adapter publishes it. It used to carry one
 * hand-written entry beside the derived ones — the ngcc-bearing Angular 13
 * cell, described from `evidence/spikes/ngcc-1213-feasibility/verdict.json`
 * while no adapter published it. The frozen Angular adapter now publishes
 * `angular-13.4.0` as an `AngularTargetCell`, so that entry is gone rather than
 * flipped: keeping both would put two entries with one id in this list, which
 * `describedCell()` would resolve by order rather than by truth. What the
 * hand-written entry said about the cell — that it is ngcc-bearing, that
 * holding ngcc means holding rxjs at 6.x, and that nothing here installs the
 * Angular 13 toolchain — is said by the published cell’s own rationale and
 * nonclaims, which is where a claim about a cell belongs.
 */
export const DESCRIBED_CELLS: readonly DescribedCell[] = Object.freeze([
	...ANGULAR_TARGET_CELLS.map(cellOfAdapterCell).filter(
		(cell): cell is DescribedCell => cell !== null,
	),
]);

export function describedCell(id: string): DescribedCell | null {
	return DESCRIBED_CELLS.find((cell) => cell.id === id) ?? null;
}

/**
 * Packages this repository measured as publishing no binding for an
 * architecture, with the reading verbatim from the measurement.
 *
 * This is a list rather than a name so the reading is of the closure, not of
 * one package: the lockfile and the manifest are read for every entry. A native
 * dependency nobody here measured is not in this table and is not counted,
 * which the record states rather than implying the closure was cleared.
 */
export type ArchitectureBinding = Readonly<{
	package: string;
	/** The highest major with no binding for the host architecture named below. */
	throughMajor: number;
	/** The architecture a closure carrying this package requires instead. */
	requiresArchitecture: string;
	/** The architecture the package publishes no binding for. */
	noBindingFor: string;
	fact: string;
}>;

export const ARCHITECTURE_BINDINGS: readonly ArchitectureBinding[] = Object.freeze([
	Object.freeze({
		package: 'node-sass',
		throughMajor: 4,
		requiresArchitecture: 'x64',
		noBindingFor: 'arm64',
		fact: 'node-sass 4.12.0 refuses the host outright: OS X Unsupported architecture (arm64) with Unsupported runtime (137). node-sass 4.x publishes no arm64 binding for a modern Node ABI (evidence/spikes/thin-wrapper-cost/verdict.json, finding C2).',
	}),
]);

export type ArchitectureRequirement = Readonly<{
	package: string;
	/** The version or range that was read, verbatim. */
	version: string;
	/** Where the version was read: a lockfile, or the manifest's declaration. */
	readFrom: string;
	requiresArchitecture: string;
	noBindingFor: string;
	fact: string;
}>;

/** A clause quoted into a longer message, ended once rather than twice. */
const sentence = (value: string): string => (value.endsWith('.') ? value : `${value}.`);

/** Whether a binding entry bites at the version that was read. */
function bindingApplies(binding: ArchitectureBinding, version: string): boolean {
	const major = leadingMajor(version);
	/**
	 * A version this stage cannot read is treated as bitten. The refusing
	 * direction is the honest one: the alternative is proceeding into the wall
	 * the spike already measured and calling it an unread version.
	 */
	return major === null || major <= binding.throughMajor;
}

function collectLockfilePackages(
	document: Record<string, unknown>,
	into: Map<string, string>,
): void {
	const packages = document.packages as Record<string, unknown> | undefined;
	if (packages !== undefined && packages !== null)
		for (const key of Object.keys(packages).sort()) {
			const entry = packages[key] as Record<string, unknown> | undefined;
			if (entry === undefined || entry === null) continue;
			const marker = 'node_modules/';
			const index = key.lastIndexOf(marker);
			if (index < 0) continue;
			const name = key.slice(index + marker.length);
			const version = typeof entry.version === 'string' ? entry.version : UNKNOWN;
			if (!into.has(name)) into.set(name, version);
		}
	const walk = (tree: Record<string, unknown> | undefined): void => {
		if (tree === undefined || tree === null) return;
		for (const name of Object.keys(tree).sort()) {
			const entry = tree[name] as Record<string, unknown> | undefined;
			if (entry === undefined || entry === null) continue;
			const version = typeof entry.version === 'string' ? entry.version : UNKNOWN;
			if (!into.has(name)) into.set(name, version);
			walk(entry.dependencies as Record<string, unknown> | undefined);
		}
	};
	walk(document.dependencies as Record<string, unknown> | undefined);
}

/**
 * The architecture requirements the application's own closure carries.
 *
 * The lockfile is read first, because it states resolved versions; the
 * manifest's declared range is read for a tree that pins no closure. Both
 * readings are recorded with the file they came from, so a reader can tell a
 * resolved version from a declared range.
 */
export async function readArchitectureRequirements(
	frontendDirectory: string,
): Promise<readonly ArchitectureRequirement[]> {
	const locked = new Map<string, string>();
	let lockfileRead: string | null = null;
	for (const name of ERA_CELL_LOCKFILES) {
		if (lockfileRead !== null) continue;
		const file = path.join(frontendDirectory, name);
		if (!(await fileExists(file))) continue;
		const document = await readJsonFile(file);
		if (document === null) continue;
		lockfileRead = name;
		collectLockfilePackages(document, locked);
	}
	const declared = declaredDependencies(
		await readJsonFile(path.join(frontendDirectory, 'package.json')),
	);
	const requirements: ArchitectureRequirement[] = [];
	for (const binding of ARCHITECTURE_BINDINGS) {
		const lockedVersion = locked.get(binding.package);
		const declaredRange = declared[binding.package];
		const version = lockedVersion ?? declaredRange;
		if (version === undefined) continue;
		if (!bindingApplies(binding, version)) continue;
		requirements.push(
			Object.freeze({
				package: binding.package,
				version,
				readFrom:
					lockedVersion === undefined
						? 'package.json'
						: (lockfileRead ?? (ERA_CELL_LOCKFILES[0] as string)),
				requiresArchitecture: binding.requiresArchitecture,
				noBindingFor: binding.noBindingFor,
				fact: binding.fact,
			}),
		);
	}
	return Object.freeze(
		requirements.sort((left, right) => (left.package < right.package ? -1 : 1)),
	);
}

type Clause = Readonly<{ operator: string; major: number; minorIsZeroOrAbsent: boolean }>;

const CLAUSE_PATTERN =
	/(>=|<=|>|<|\^|~|=)?\s*v?(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:[-+][0-9A-Za-z.-]+)?/g;

const withoutSeparators = (value: string): string =>
	[...value]
		.filter((character) => character !== ' ' && character !== '\t' && character !== ',')
		.join('');

function clausesOf(alternative: string): readonly Clause[] | null {
	const matches = [...alternative.matchAll(CLAUSE_PATTERN)];
	if (matches.length === 0) return null;
	/**
	 * Everything in the alternative has to be a clause this reading consumed. A
	 * declaration carrying a word — `lts/gallium`, `current` — leaves residue
	 * here and is reported as unreadable rather than having its digits mined
	 * out of it.
	 */
	if (
		withoutSeparators(matches.map((match) => match[0]).join('')) !==
		withoutSeparators(alternative)
	)
		return null;
	const clauses: Clause[] = [];
	for (const match of matches) {
		const major = Number.parseInt(match[2] as string, 10);
		const minor = match[3];
		clauses.push({
			operator: match[1] ?? '',
			major,
			minorIsZeroOrAbsent: minor === undefined || minor === '0',
		});
	}
	return Object.freeze(clauses);
}

/**
 * The Node majors a declaration names, or `null` when it names none this stage
 * reads.
 *
 * An open-ended lower bound (`>=16.10.0`) names every major from 16 upwards and
 * is not a reading; a two-sided range names the majors between its bounds; a
 * pinned, caret or tilde clause names one. A declaration naming more than one
 * major is a declaration this stage will not pick from.
 */
export function nodeMajorsOfDeclaration(declared: string): readonly number[] | null {
	const trimmed = declared.trim();
	if (trimmed === '' || trimmed === UNKNOWN) return null;
	const majors = new Set<number>();
	for (const alternative of trimmed.split('||')) {
		const clauses = clausesOf(alternative);
		if (clauses === null) return null;
		const pins: number[] = [];
		let low: number | null = null;
		let high: number | null = null;
		for (const clause of clauses) {
			if (clause.operator === '>=' || clause.operator === '>')
				low = low === null ? clause.major : Math.max(low, clause.major);
			else if (clause.operator === '<') {
				const bound = clause.minorIsZeroOrAbsent ? clause.major - 1 : clause.major;
				high = high === null ? bound : Math.min(high, bound);
			} else if (clause.operator === '<=')
				high = high === null ? clause.major : Math.min(high, clause.major);
			else pins.push(clause.major);
		}
		if (pins.length > 0) for (const pin of pins) majors.add(pin);
		else if (low !== null && high !== null) {
			if (high < low) return null;
			for (let major = low; major <= high; major += 1) majors.add(major);
		} else return null;
	}
	return Object.freeze([...majors].sort((left, right) => left - right));
}

/**
 * One place a tree states which Node line it was built on, read verbatim.
 *
 * `majors` is `null` when the text carries no numeric major line this stage
 * reads — `latest`, `lts`, `current`, `lts/gallium`, `latest-browsers`, a CI
 * expression — which is residue rather than a cell. More than one major is a
 * source this stage will not pick from. Every source consulted is recorded,
 * winner or not, because which readings were available and what each said is
 * the part a reader cannot reconstruct from the answer.
 */
export type NodeMajorSourceReading = Readonly<{
	/** The file and key the reading came out of. */
	source: string;
	/** What that file literally says there, or `null` when the source is absent. */
	text: string | null;
	majors: readonly number[] | null;
	/**
	 * Whether the source exists in this tree at all.
	 *
	 * An absent source is reported rather than omitted. Returning only what
	 * exists makes "this tree declares nothing" indistinguishable from "this
	 * stage did not look", and the difference is the whole content of an era
	 * recorded as not-read.
	 */
	present: boolean;
}>;

/**
 * Every place this stage looks for a Node line, whether or not it is there.
 *
 * The list is the one the `cell-not-declared-for-framework` refusal names in
 * prose. Once the stage proceeds there is no refusal string to carry it, so it
 * lives here and in the record.
 */
export const NODE_MAJOR_SOURCE_SLOTS: readonly string[] = Object.freeze([
	'.nvmrc',
	'.node-version',
	'package.json#volta.node',
	'.tool-versions#nodejs',
	'Dockerfile*#FROM a node image',
	'.github/workflows/*#node-version',
	'package.json#engines.node',
]);

/** The slot an absent source is reported under. */
const absentSource = (slot: string): NodeMajorSourceReading =>
	Object.freeze({ source: slot, text: null, majors: null, present: false });

/** A source that is there, with what it literally says. */
const presentSource = (
	source: string,
	text: string,
	majors: readonly number[] | null,
): NodeMajorSourceReading => Object.freeze({ source, text, majors, present: true });

/** The workflow keys a CI file names its Node line under. */
const WORKFLOW_NODE_KEYS: readonly string[] = Object.freeze(['node-version', 'node_version']);

const stripComment = (value: string): string => {
	const hash = value.indexOf(' #');
	return (hash < 0 ? value : value.slice(0, hash)).trim();
};

const unquoted = (value: string): string => {
	const trimmed = value.trim();
	if (trimmed.length >= 2 && (trimmed.startsWith("'") || trimmed.startsWith('"')))
		return trimmed.slice(1, -1);
	return trimmed;
};

/**
 * The majors a list of declarations names between them, or `null`.
 *
 * A list carrying an element this stage cannot read is unreadable as a whole:
 * reading the rest of it would be reading part of a declaration and calling it
 * the declaration.
 */
function majorsOfList(values: readonly string[]): readonly number[] | null {
	const majors = new Set<number>();
	for (const value of values) {
		const read = nodeMajorsOfDeclaration(value);
		if (read === null) return null;
		for (const major of read) majors.add(major);
	}
	return majors.size === 0
		? null
		: Object.freeze([...majors].sort((left, right) => left - right));
}

/** `[12.x, 14.x]` read as its elements, or the value as a single element. */
function declarationElements(value: string): readonly string[] {
	const trimmed = stripComment(value);
	if (trimmed.startsWith('[') && trimmed.endsWith(']'))
		return Object.freeze(
			trimmed
				.slice(1, -1)
				.split(',')
				.map((element) => unquoted(element))
				.filter((element) => element !== ''),
		);
	const single = unquoted(trimmed);
	return single === '' ? Object.freeze([]) : Object.freeze([single]);
}

async function readWorkflowNodeSources(root: string): Promise<NodeMajorSourceReading[]> {
	const directory = path.join(root, '.github', 'workflows');
	if (!(await directoryExists(directory))) return [];
	const readings: NodeMajorSourceReading[] = [];
	for (const name of await entriesOfAnyKind(directory)) {
		if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
		const file = path.join(directory, name);
		if (!(await fileExists(file))) continue;
		const lines = (await readFile(file, 'utf8')).split('\n');
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index] as string;
			const match = /^(\s*)(?:-\s+)?(node[-_]version)\s*:(.*)$/.exec(line);
			if (match === null) continue;
			const key = match[2] as string;
			if (!WORKFLOW_NODE_KEYS.includes(key)) continue;
			let text = stripComment(match[3] as string);
			let elements = declarationElements(match[3] as string);
			if (elements.length === 0) {
				/** A block sequence: the values are the `- item` lines below it. */
				const items: string[] = [];
				for (let ahead = index + 1; ahead < lines.length; ahead += 1) {
					const item = /^\s*-\s+(.*)$/.exec(lines[ahead] as string);
					if (item === null) break;
					items.push(unquoted(stripComment(item[1] as string)));
				}
				if (items.length === 0) continue;
				elements = Object.freeze(items);
				text = `[${items.join(', ')}]`;
			}
			readings.push(
				presentSource(`.github/workflows/${name}#${key}`, text, majorsOfList(elements)),
			);
		}
	}
	return readings;
}

async function entriesOfAnyKind(directory: string): Promise<readonly string[]> {
	try {
		return (await readdir(directory, { withFileTypes: true }))
			.map((entry) => entry.name)
			.sort();
	} catch {
		return Object.freeze([]);
	}
}

async function readDockerfileNodeSources(root: string): Promise<NodeMajorSourceReading[]> {
	const readings: NodeMajorSourceReading[] = [];
	for (const name of await entriesOfAnyKind(root)) {
		if (!name.startsWith('Dockerfile')) continue;
		const file = path.join(root, name);
		if (!(await fileExists(file))) continue;
		const lines = (await readFile(file, 'utf8')).split('\n');
		for (let index = 0; index < lines.length; index += 1) {
			const match = /^\s*FROM\s+(\S+)/i.exec(lines[index] as string);
			if (match === null) continue;
			const image = match[1] as string;
			const colon = image.lastIndexOf(':');
			if (colon < 0) continue;
			const repository = image.slice(0, colon);
			const slash = repository.lastIndexOf('/');
			if (repository.slice(slash + 1) !== 'node') continue;
			readings.push(
				presentSource(
					`${name}#FROM line ${String(index + 1)}`,
					image,
					nodeMajorsOfDeclaration(image.slice(colon + 1)),
				),
			);
		}
	}
	return readings;
}

/**
 * Every place this tree states a Node line, in the precedence the honesty
 * ruling fixed: the tree's own version-manager files, then the toolchain
 * pins, then the images and workflows its authors actually ran, and the
 * manifest's `engines` range last because it is a compatibility bound rather
 * than a statement of what was run.
 *
 * Nothing here picks. Every source is returned with what it literally says.
 */
export async function readNodeMajorSources(
	root: string,
): Promise<readonly NodeMajorSourceReading[]> {
	const found = new Map<string, NodeMajorSourceReading[]>();
	const record = (slot: string, reading: NodeMajorSourceReading): void => {
		const existing = found.get(slot);
		if (existing === undefined) found.set(slot, [reading]);
		else existing.push(reading);
	};
	for (const name of ['.nvmrc', '.node-version']) {
		const file = path.join(root, name);
		if (!(await fileExists(file))) continue;
		const text = (await readFile(file, 'utf8')).trim();
		if (text === '') continue;
		record(name, presentSource(name, text, nodeMajorsOfDeclaration(text)));
	}
	const manifest = await readJsonFile(path.join(root, 'package.json'));
	const volta = manifest?.volta as Record<string, unknown> | undefined;
	if (volta !== undefined && volta !== null && typeof volta.node === 'string') {
		const text = volta.node.trim();
		if (text !== '')
			record(
				'package.json#volta.node',
				presentSource('package.json#volta.node', text, nodeMajorsOfDeclaration(text)),
			);
	}
	const toolVersions = path.join(root, '.tool-versions');
	if (await fileExists(toolVersions))
		for (const line of (await readFile(toolVersions, 'utf8')).split('\n')) {
			const match = /^nodejs\s+(\S+)/.exec(line.trim());
			if (match === null) continue;
			const text = match[1] as string;
			record(
				'.tool-versions#nodejs',
				presentSource('.tool-versions#nodejs', text, nodeMajorsOfDeclaration(text)),
			);
		}
	for (const reading of await readDockerfileNodeSources(root))
		record('Dockerfile*#FROM a node image', reading);
	for (const reading of await readWorkflowNodeSources(root))
		record('.github/workflows/*#node-version', reading);
	const engines = manifest?.engines as Record<string, unknown> | undefined;
	if (engines !== undefined && engines !== null && typeof engines.node === 'string') {
		const text = engines.node.trim();
		if (text !== '')
			record(
				'package.json#engines.node',
				presentSource('package.json#engines.node', text, nodeMajorsOfDeclaration(text)),
			);
	}
	/**
	 * Every slot, in the fixed precedence, whether or not it is there. A slot
	 * with nothing in it is reported as absent rather than dropped: the absence
	 * is what an era recorded as not-read is a statement about.
	 */
	const readings: NodeMajorSourceReading[] = [];
	for (const slot of NODE_MAJOR_SOURCE_SLOTS)
		readings.push(...(found.get(slot) ?? [absentSource(slot)]));
	return Object.freeze(readings);
}

/**
 * Whether a declared range admits a Node major, or `null` when it does not read.
 *
 * This is the satisfaction check T027 §2 ruled a *reading*: it answers "does
 * the compatibility range this application declares include the runtime the
 * lane will run in", it returns a boolean, and it takes no number out of the
 * range. `nodeMajorsOfDeclaration` is untouched and stays the era reading;
 * nothing here feeds an era field.
 *
 * A major is admitted by an alternative when some version carrying that major
 * satisfies every clause in it — so `>10.0.0` admits 10, because 10.1.0 does.
 */
export function declaredRangeAdmitsMajor(declared: string, major: number): boolean | null {
	const trimmed = declared.trim();
	if (trimmed === '' || trimmed === UNKNOWN) return null;
	let readable = false;
	let admitted = false;
	for (const alternative of trimmed.split('||')) {
		const clauses = clausesOf(alternative);
		if (clauses === null) return null;
		readable = true;
		let satisfies = true;
		for (const clause of clauses) {
			if (clause.operator === '>=' || clause.operator === '>') {
				if (major < clause.major) satisfies = false;
			} else if (clause.operator === '<') {
				const bound = clause.minorIsZeroOrAbsent ? clause.major - 1 : clause.major;
				if (major > bound) satisfies = false;
			} else if (clause.operator === '<=') {
				if (major > clause.major) satisfies = false;
			} else if (major !== clause.major) satisfies = false;
		}
		if (satisfies) admitted = true;
	}
	return readable ? admitted : null;
}

/**
 * The lane this pipeline composes for a lineage, and how it is described.
 *
 * A lineage in this table is one the plan and apply stages write a lane for, so
 * there is a runtime to read off the pipeline itself. A lineage absent from it
 * has neither a published cell nor a lane, which is where the two
 * era-cell refusals that survive T027 still fire.
 */
const COMPOSED_LANES: Readonly<Record<string, Readonly<{ cell: string; writes: string }>>> =
	Object.freeze({
		react: Object.freeze({ cell: 'react-vite-lane', writes: 'a Vite lane' }),
		nextjs: Object.freeze({ cell: 'nextjs-vite-lane', writes: 'a Vite lane' }),
		angular: Object.freeze({
			cell: 'angular-cli-era-lane',
			writes: 'an Angular CLI era lane',
		}),
	});

/**
 * `lane-install-build.json`, quoted: the precedent that the runtime a lane is
 * installed and built in is the one this process is running in.
 */
export const LANE_RUNTIME_BASIS =
	'evidence/runs/operator-flows/lane-install-build.json records a lane of this composition installing 428 packages and building 11 outputs at node v24.15.0 on darwin-arm64.';

export const LANE_RUNTIME_READ_FROM =
	'the process this stage is running in — the runtime the install and build stages will run the lane in';

export const LANE_RUNTIME_CLAIM = 'the migrated lane will be installed and built in this runtime';

export const LANE_RUNTIME_CLAIM_WITH_RANGE =
	'the compatibility range this application declares admits the runtime the lane will run in. The range names no era and no major was read from it.';

export const ERA_NOT_READ_CLAIM =
	'nothing in this tree names the toolchain era its authors used, and this stage read none';

/** One consulted source as a refusal states it: where, what it says, what it names. */
export function renderNodeMajorSource(reading: NodeMajorSourceReading): string {
	if (!reading.present) return `${reading.source} is not present in this tree`;
	const text = reading.text ?? '';
	if (reading.majors === null)
		return `${reading.source} reads ${text}, which names no numeric Node major this stage reads`;
	if (reading.majors.length === 1)
		return `${reading.source} reads ${text}, naming Node ${String(reading.majors[0] as number)}`;
	return `${reading.source} reads ${text}, naming ${String(reading.majors.length)} major lines (${reading.majors.join(', ')})`;
}

/** A Node runtime discoverable on this host, and where it was discovered. */
export type InstalledRuntime = Readonly<{
	/** `v16.20.2`, as the runtime names itself. */
	version: string;
	major: number;
	platform: string;
	architecture: string;
	/** Which source carries it: the running process, the workspace cache, or a version manager. */
	supplier: string;
	/**
	 * Where it sits, relative to the supplier's own root. A record is evidence
	 * and evidence carries no absolute host paths.
	 */
	location: string;
}>;

export type HostCellReading = Readonly<{
	platform: string;
	architecture: string;
	runningNodeVersion: string;
	runningNodeMajor: number;
	/** The suppliers that exist on this host, whether or not they carry a match. */
	suppliers: readonly string[];
	installed: readonly InstalledRuntime[];
}>;

/** Where the workspace's own materialised runtimes are cached. */
export const WORKSPACE_RUNTIME_CACHE = '.versionless/cache';

/** The supplier name for the process this stage is running in. */
export const RUNNING_PROCESS = 'running-process';

/**
 * How the running process spells its own location.
 *
 * It is a sentence about itself rather than a path, and that is load-bearing
 * downstream: `planLaneRuntime` asks a provision whether its location names a
 * runtime tree carrying `bin/node` in this checkout, and this one deliberately
 * does not, so the running process resolves to the inherited `PATH` instead of
 * to a directory nobody read.
 */
export const RUNNING_PROCESS_LOCATION = 'the process this stage is running in';

/** The supplier name for runtimes the workspace already materialised. */
export const WORKSPACE_RUNTIME_SUPPLIER = 'workspace-runtime-cache';

type VersionManager = Readonly<{
	supplier: string;
	/** Environment variable naming the manager's root, when it has one. */
	environmentVariable: string;
	/** Home-relative roots to try when the environment names none. */
	homeRoots: readonly string[];
	/** Root-relative directory whose entries are installed versions. */
	versions: string;
	/** Version-relative path to the runtime's own bin directory. */
	bin: string;
}>;

const VERSION_MANAGERS: readonly VersionManager[] = Object.freeze([
	Object.freeze({
		supplier: 'fnm',
		environmentVariable: 'FNM_DIR',
		homeRoots: Object.freeze(['.local/share/fnm', 'Library/Application Support/fnm', '.fnm']),
		versions: 'node-versions',
		bin: 'installation/bin',
	}),
	Object.freeze({
		supplier: 'nvm',
		environmentVariable: 'NVM_DIR',
		homeRoots: Object.freeze(['.nvm']),
		versions: 'versions/node',
		bin: 'bin',
	}),
	Object.freeze({
		supplier: 'volta',
		environmentVariable: 'VOLTA_HOME',
		homeRoots: Object.freeze(['.volta']),
		versions: 'tools/image/node',
		bin: 'bin',
	}),
]);

/** `node-v16.20.2-darwin-arm64` read as its three parts, or `null`. */
export function runtimeDirectoryName(
	name: string,
): Readonly<{ version: string; platform: string; architecture: string }> | null {
	if (!name.startsWith('node-v')) return null;
	const parts = name.slice('node-'.length).split('-');
	if (parts.length !== 3) return null;
	const [version, platform, architecture] = parts as [string, string, string];
	if (leadingMajor(version) === null) return null;
	return Object.freeze({ version, platform, architecture });
}

const normalizedVersion = (name: string): string => (name.startsWith('v') ? name : `v${name}`);

async function entriesOf(directory: string): Promise<readonly string[]> {
	try {
		return (await readdir(directory, { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
			.map((entry) => entry.name)
			.sort();
	} catch {
		return Object.freeze([]);
	}
}

async function readWorkspaceRuntimes(workspaceRoot: string): Promise<InstalledRuntime[]> {
	const cache = path.join(workspaceRoot, WORKSPACE_RUNTIME_CACHE);
	if (!(await directoryExists(cache))) return [];
	const runtimes: InstalledRuntime[] = [];
	for (const entry of await entriesOf(cache))
		for (const candidate of await entriesOf(path.join(cache, entry))) {
			const read = runtimeDirectoryName(candidate);
			if (read === null) continue;
			if (!(await fileExists(path.join(cache, entry, candidate, 'bin', 'node')))) continue;
			const major = leadingMajor(read.version);
			if (major === null) continue;
			runtimes.push(
				Object.freeze({
					version: normalizedVersion(read.version),
					major,
					platform: read.platform,
					architecture: read.architecture,
					supplier: WORKSPACE_RUNTIME_SUPPLIER,
					location: `${WORKSPACE_RUNTIME_CACHE}/${entry}/${candidate}`,
				}),
			);
		}
	return runtimes;
}

async function readVersionManagerRuntimes(
	manager: VersionManager,
	environment: NodeJS.ProcessEnv,
	home: string,
	platform: string,
	architecture: string,
): Promise<{ present: boolean; runtimes: InstalledRuntime[] }> {
	const declaredRoot = environment[manager.environmentVariable];
	const roots = [
		...(declaredRoot === undefined || declaredRoot === '' ? [] : [declaredRoot]),
		...manager.homeRoots.map((relative) => path.join(home, relative)),
	];
	for (const root of roots) {
		if (!(await directoryExists(root))) continue;
		const versionsDirectory = path.join(root, manager.versions);
		const runtimes: InstalledRuntime[] = [];
		for (const entry of await entriesOf(versionsDirectory)) {
			const major = leadingMajor(entry);
			if (major === null) continue;
			if (!(await fileExists(path.join(versionsDirectory, entry, manager.bin, 'node'))))
				continue;
			runtimes.push(
				Object.freeze({
					version: normalizedVersion(entry),
					major,
					/**
					 * A version manager installs for the host it runs on, so the
					 * platform and architecture are the host's. This stage read a
					 * directory, not a binary header.
					 */
					platform,
					architecture,
					supplier: manager.supplier,
					location: `${manager.versions}/${entry}`,
				}),
			);
		}
		return { present: true, runtimes };
	}
	return { present: false, runtimes: [] };
}

const SUPPLIER_ORDER: readonly string[] = Object.freeze([
	WORKSPACE_RUNTIME_SUPPLIER,
	'fnm',
	'nvm',
	'volta',
	RUNNING_PROCESS,
]);

function compareRuntimes(left: InstalledRuntime, right: InstalledRuntime): number {
	const leftOrder = SUPPLIER_ORDER.indexOf(left.supplier);
	const rightOrder = SUPPLIER_ORDER.indexOf(right.supplier);
	if (leftOrder !== rightOrder) return leftOrder - rightOrder;
	if (left.version !== right.version) return left.version < right.version ? 1 : -1;
	return left.location < right.location ? -1 : 1;
}

/**
 * Read what this host can supply, without opening a socket and without running
 * another program.
 *
 * Every source is a directory this function reads: the process it runs in, the
 * runtimes the workspace already materialised under its own cache, and the
 * installed-version directories of the version managers it knows the layout of.
 * A runtime installed somewhere none of those reach is reported as absent,
 * which the record states rather than implying the host was enumerated.
 */
export async function readHostCell(
	workspaceRoot = '.',
	environment: NodeJS.ProcessEnv = process.env,
	platform: string = process.platform,
	architecture: string = process.arch,
	runningVersion: string = process.version,
): Promise<HostCellReading> {
	const runningMajor = leadingMajor(runningVersion) ?? 0;
	const suppliers: string[] = [RUNNING_PROCESS];
	const installed: InstalledRuntime[] = [
		Object.freeze({
			version: runningVersion,
			major: runningMajor,
			platform,
			architecture,
			supplier: RUNNING_PROCESS,
			location: RUNNING_PROCESS_LOCATION,
		}),
	];
	const workspaceRuntimes = await readWorkspaceRuntimes(workspaceRoot);
	if (await directoryExists(path.join(workspaceRoot, WORKSPACE_RUNTIME_CACHE)))
		suppliers.push(WORKSPACE_RUNTIME_SUPPLIER);
	installed.push(...workspaceRuntimes);
	const home = homedir();
	for (const manager of VERSION_MANAGERS) {
		const read = await readVersionManagerRuntimes(
			manager,
			environment,
			home,
			platform,
			architecture,
		);
		if (read.present) suppliers.push(manager.supplier);
		installed.push(...read.runtimes);
	}
	return Object.freeze({
		platform,
		architecture,
		runningNodeVersion: runningVersion,
		runningNodeMajor: runningMajor,
		suppliers: Object.freeze(suppliers),
		installed: Object.freeze([...installed].sort(compareRuntimes)),
	});
}

/**
 * The values an operator may declare, each replacing a reading this stage would
 * otherwise have to make.
 */
export type EraCellDeclarations = Readonly<{
	/** `--node`: the Node major, or a version whose major is read. */
	node: string | null;
	/** `--arch`: the architecture the cell must run at. */
	architecture: string | null;
	/** `--cell`: the described cell this application is migrated into. */
	cell: string | null;
}>;

export const DEFAULT_ERA_CELL_DECLARATIONS: EraCellDeclarations = Object.freeze({
	node: null,
	architecture: null,
	cell: null,
});

/** Where a recorded value came from: a declaration, or a reading. */
export type EraCellValueSource = 'declared' | 'inferred';

export type EraCellOutcome = 'provisioned' | 'already-present' | 'refused' | 'not-run';

/**
 * The runtime the lane this pipeline composes will be installed and built in.
 *
 * This is a determination about what the pipeline is *about to do*, and it is
 * separate from the era below on purpose. `run` never builds a baseline —
 * `run.ts` calls `runLaneWitness` with no baseline build — so there is no
 * parity comparison in the chain and no place where the authored era is
 * load-bearing. The runtime is: the install and build stages run the lane in
 * this process's runtime, and `lane-install-build.json` records a lane of this
 * composition doing exactly that.
 */
export type RuntimeDetermination = Readonly<{
	major: number;
	/** The runtime as it names itself, when one was read rather than declared. */
	version: string | null;
	source: EraCellValueSource;
	readFrom: string;
	basis: string;
	claim: string;
	/** The compatibility range the manifest declares, verbatim, or `null`. */
	declaredRange: string | null;
	declaredRangeSource: string | null;
	/**
	 * Whether that range admits the runtime major above.
	 *
	 * A satisfaction check is a reading: it answers a different question from
	 * the era one, it yields a boolean, and it extracts no major. `null` is a
	 * range this stage could not read, or no range at all. No number ever leaves
	 * a range into an era field — T008 §5(b) and T027 §2 both drew that line.
	 */
	satisfiedByDeclaredRange: boolean | null;
}>;

/**
 * Which era the authors of this application were on, when that was read.
 *
 * `not-read` states that no declaration in this tree named exactly one Node
 * major this stage reads. It is not a statement that the application has no
 * era, and it is not a statement that the runtime above is that era.
 */
export type EraDetermination = Readonly<{
	outcome: 'read' | 'not-read';
	/** What the declaration the era was read from literally says. */
	declared: string | null;
	readFrom: string | null;
	/** Every source consulted, including the ones that are not there. */
	consultedSources: readonly NodeMajorSourceReading[];
	claim: string;
}>;

export type RequiredCell = Readonly<{
	/** The cell identifier: a described cell, or the Node-only cell a tree names. */
	cell: string;
	cellSource: EraCellValueSource;
	cellBasis: string;
	/** The runtime the lane will run in, and the era, never sharing a field. */
	runtime: RuntimeDetermination;
	era: EraDetermination;
	nodeMajor: number;
	nodeMajorSource: EraCellValueSource;
	/** Which declaration the Node major was read out of, when it was read. */
	nodeMajorReadFrom: string | null;
	/**
	 * Every declaration in the tree this stage consulted for the Node major,
	 * with what each literally says — not only the one it read the major from.
	 * Empty when a declaration or a published cell settled the era first.
	 */
	nodeMajorSources: readonly NodeMajorSourceReading[];
	architecture: string;
	architectureSource: EraCellValueSource;
	architectureBasis: string;
	/** The closure readings that forced the architecture, when any did. */
	architectureRequirements: readonly ArchitectureRequirement[];
}>;

export type CellProvision = Readonly<{
	supplier: string;
	version: string;
	location: string;
	/** The translation the runtime runs under on this host, or `null`. */
	translation: string | null;
}>;

export type EraCellRecord = Readonly<{
	stage: 'era-cell';
	schemaVersion: string;
	ran: boolean;
	/** Why the stage did not run, when it did not. */
	reason: string | null;
	outcome: EraCellOutcome;
	required: RequiredCell | null;
	/** Which fields were inferred and which were declared. */
	determination: Readonly<{ inferred: readonly string[]; declared: readonly string[] }>;
	host: HostCellReading | null;
	provision: CellProvision | null;
	/** The refusal, when the outcome is `refused`. */
	refusal: PipelineRefusal | null;
	notEstablished: readonly string[];
}>;

const ERA_CELL_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'This record states which toolchain cell the application needs and whether a Node runtime of that cell is on this host. It is not an installation of the cell: nothing here establishes that the framework packages a cell declares were resolved, downloaded, or built.',
	'`already-present` and `provisioned` state that a runtime of the required major and architecture was found at a location this stage read. Nothing here establishes that the application installs, compiles, builds, or behaves on it.',
	'The architecture requirement is read from the closure the lockfile and the manifest declare, against the packages this repository measured a binding reading for. A native dependency nobody measured is not counted, and an absent requirement is not evidence that every dependency in the closure has a binding for this architecture.',
	'Installed runtimes are the ones discoverable at the locations this stage reads: the running process, the workspace runtime cache, and the installed-version directories of the version managers whose layout it knows. A runtime installed anywhere else is reported as absent rather than searched for.',
	'A version manager runtime is read as a directory. Its platform and architecture are recorded as the host’s because that is what a version manager installs for; no binary header was read.',
	'No network was opened and no other program was run. A runtime this host does not already carry is refused, not fetched.',
	'A value recorded with source `declared` was supplied by an operator. This stage did not read it and does not corroborate it.',
	'The runtime named here is the runtime the lane this pipeline composes will be installed and built in. It is not the era this application was authored for: nothing here establishes which toolchain its authors used.',
	'An era recorded as not-read states that no declaration in this tree named exactly one Node major that this stage reads. It is not a statement that the application has no era, and it is not a statement that the runtime below is that era.',
	'Nothing here establishes that this application installs, compiles, builds, or behaves in the runtime named above. The install and build stages are where that is attempted, and their records are where it is stated.',
	'A declared compatibility range that admits this runtime is a satisfied constraint. It states that the application claims to work on a set of runtimes that includes this one; it names no era, and no Node major was read out of it.',
	'Satisfaction of a declared range is not corroborated by anything else this tree says. Where other sources name majors, they are listed above with what each literally says, and this stage picks from none of them.',
]);

/** The record for a stage the run did not ask for. */
export function eraCellNotRequested(reason: string): EraCellRecord {
	return Object.freeze({
		stage: 'era-cell',
		schemaVersion: ERA_CELL_RECORD_SCHEMA,
		ran: false,
		reason,
		outcome: 'not-run',
		required: null,
		determination: Object.freeze({
			inferred: Object.freeze([]),
			declared: Object.freeze([]),
		}),
		host: null,
		provision: null,
		refusal: null,
		notEstablished: ERA_CELL_NOT_ESTABLISHED,
	});
}

/** The record a refused run carries: the named refusal, and what was read. */
export function eraCellRefused(
	refusal: PipelineRefusal,
	host: HostCellReading | null = null,
): EraCellRecord {
	return Object.freeze({
		stage: 'era-cell',
		schemaVersion: ERA_CELL_RECORD_SCHEMA,
		ran: true,
		reason: null,
		outcome: 'refused',
		required: null,
		determination: Object.freeze({
			inferred: Object.freeze([]),
			declared: Object.freeze([]),
		}),
		host,
		provision: null,
		refusal,
		notEstablished: ERA_CELL_NOT_ESTABLISHED,
	});
}

/**
 * The translation a host offers for a foreign architecture, or `null`.
 *
 * One case, and it is the one the spike measured: an Apple Silicon host runs
 * a `darwin-x64` runtime through Rosetta 2. Every other mismatch has no
 * translation here, and this stage says so rather than assuming one.
 */
export function translationFor(host: HostCellReading, architecture: string): string | null {
	if (architecture === host.architecture) return null;
	if (host.platform === 'darwin' && host.architecture === 'arm64' && architecture === 'x64')
		return 'rosetta-2';
	return null;
}

/**
 * The runtimes this host carries for one Node major on one architecture.
 *
 * The filter is the one `establishEraCell` has always applied, lifted out so
 * that a caller asking the same question of a *different* Node major — the one
 * the migrated lane's target names rather than the one the source tree's era
 * declares — asks it through this machinery instead of writing a second reading
 * of the host that could drift from this one.
 */
export function provisionableRuntimes(
	host: HostCellReading,
	nodeMajor: number,
	architecture: string,
): readonly InstalledRuntime[] {
	return host.installed.filter(
		(runtime) =>
			runtime.major === nodeMajor &&
			runtime.architecture === architecture &&
			runtime.platform === host.platform,
	);
}

/**
 * Pick one of them, the way this stage has always picked: the running process
 * when it is itself a match, and otherwise the first candidate in supplier
 * order.
 *
 * `outcome` distinguishes the two, exactly as the era-cell record does:
 * `already-present` is the running process supplying itself, `provisioned` is a
 * runtime read out of some other supplier.
 *
 * One reading is worth recording about the workspace cache this most often
 * resolves to. Its directory is named `angular-13-cell-runtime`, and that name
 * is a historical label from the unit that first materialised a Node 16 there —
 * not a lineage claim. What the cache holds is bytes: a `node-v16.20.2-…` tree
 * that any lineage's cell may legitimately be provisioned from. The name is
 * left alone deliberately: renaming it would move every published `pathPrefix`
 * in `evidence/runs/**` and buy nothing but a tidier word.
 */
export function provisionRuntime(
	host: HostCellReading,
	nodeMajor: number,
	architecture: string,
): Readonly<{
	runtime: InstalledRuntime;
	outcome: 'provisioned' | 'already-present';
	provision: CellProvision;
	candidates: readonly InstalledRuntime[];
}> | null {
	const candidates = provisionableRuntimes(host, nodeMajor, architecture);
	if (candidates.length === 0) return null;
	const running = candidates.find((runtime) => runtime.supplier === RUNNING_PROCESS);
	const chosen = running ?? (candidates[0] as InstalledRuntime);
	return Object.freeze({
		runtime: chosen,
		outcome: running === undefined ? ('provisioned' as const) : ('already-present' as const),
		provision: Object.freeze({
			supplier: chosen.supplier,
			version: chosen.version,
			location: chosen.location,
			translation: translationFor(host, architecture),
		}),
		candidates,
	});
}

function requiredCellOf(
	analysis: ApplicationAnalysis,
	declarations: EraCellDeclarations,
): DescribedCell | null {
	if (declarations.cell !== null) {
		const declared = describedCell(declarations.cell);
		if (declared === null)
			refuse({
				code: 'era-cell.declared-cell-not-described',
				message: `Era cell: --cell ${declarations.cell} names a cell this stage carries no description of. The cells it describes are ${DESCRIBED_CELLS.map((cell) => cell.id).join(', ')}. A cell nobody described has no Node line to read, and this stage does not infer one from an identifier.`,
				stage: 'era-cell',
				origin: 'pipeline',
			});
		return declared;
	}
	/**
	 * The default is the cell the analyze reading already published for this
	 * tree, which is the frozen adapter's own registry. Nothing is chosen here
	 * that the pipeline has not already chosen elsewhere.
	 */
	return analysis.cellReadings.cell === null ? null : describedCell(analysis.cellReadings.cell);
}

/**
 * Determine the era cell this application needs and record whether this host
 * carries it, or refuse by name.
 *
 * Nothing is written, nothing is fetched, and no other program is run.
 */
export async function establishEraCell(
	applicationRoot: string,
	declarations: EraCellDeclarations = DEFAULT_ERA_CELL_DECLARATIONS,
	host: HostCellReading | null = null,
): Promise<EraCellRecord> {
	const analysis = await analyzeApplication(applicationRoot);
	const reading = host ?? (await readHostCell());
	const inferred: string[] = [];
	const declared: string[] = [];

	const cell = requiredCellOf(analysis, declarations);
	if (declarations.cell !== null) declared.push('cell');
	else if (cell !== null) inferred.push('cell');

	/**
	 * The tree's own Node declarations are read only when neither a declaration
	 * nor a published cell has already settled the era. What is consulted is
	 * what was needed, and the record says which.
	 */
	const consulted =
		declarations.node === null && cell === null
			? await readNodeMajorSources(applicationRoot)
			: (Object.freeze([]) as readonly NodeMajorSourceReading[]);
	/**
	 * The sources that are actually there. The full list — absent ones included
	 * — is what the record carries; the counts a refusal states are about the
	 * declarations this tree makes, so they are taken from this one.
	 */
	const stated = consulted.filter((reading) => reading.present);

	let nodeMajor: number;
	let nodeMajorSource: EraCellValueSource;
	let nodeMajorReadFrom: string | null = null;
	let runtime: RuntimeDetermination;
	let era: EraDetermination;
	/** The lane this pipeline composes, when the cell named is that lane. */
	let composedLane: Readonly<{ cell: string; writes: string }> | null = null;
	const eraNotConsulted = (why: string): EraDetermination =>
		Object.freeze({
			outcome: 'not-read' as const,
			declared: null,
			readFrom: null,
			consultedSources: consulted,
			claim: `the era was not read from this tree: ${why}, and this stage consulted no source in it for the toolchain era its authors used`,
		});
	if (declarations.node !== null) {
		const major = leadingMajor(declarations.node);
		if (major === null)
			refuse({
				code: 'era-cell.declared-node-not-a-version',
				message: `Era cell: --node ${declarations.node} does not read as a Node major or a Node version. This stage installs a runtime by major line, so a declaration it cannot read a major out of is refused rather than resolved into one.`,
				stage: 'era-cell',
				origin: 'pipeline',
			});
		nodeMajor = major;
		nodeMajorSource = 'declared';
		declared.push('nodeMajor');
		runtime = Object.freeze({
			major,
			version: null,
			source: 'declared' as const,
			readFrom: `--node ${declarations.node}`,
			basis: `declared with --node ${declarations.node} on this invocation. This stage did not read it and does not corroborate it.`,
			claim: LANE_RUNTIME_CLAIM,
			declaredRange: null,
			declaredRangeSource: null,
			satisfiedByDeclaredRange: null,
		});
		era = eraNotConsulted(
			`--node ${declarations.node} declared the runtime the lane will run in`,
		);
	} else if (cell !== null) {
		nodeMajor = cell.nodeMajor;
		nodeMajorSource = 'inferred';
		nodeMajorReadFrom = `${cell.id}#nodeLine`;
		inferred.push('nodeMajor');
		runtime = Object.freeze({
			major: cell.nodeMajor,
			version: cell.nodeLine,
			source: 'inferred' as const,
			readFrom: `${cell.id}#nodeLine`,
			basis: cell.describedBy,
			claim: LANE_RUNTIME_CLAIM,
			declaredRange: null,
			declaredRangeSource: null,
			satisfiedByDeclaredRange: null,
		});
		era = eraNotConsulted(`the cell ${cell.id} names the Node line the lane is migrated into`);
	} else {
		const named = stated.filter(
			(reading) => reading.majors !== null && reading.majors.length === 1,
		);
		const distinct = [...new Set(named.map((reading) => reading.majors?.[0] as number))].sort(
			(left, right) => left - right,
		);
		if (distinct.length > 1)
			refuse({
				code: 'era-cell.node-major-sources-disagree',
				message: `Era cell: this tree names ${String(distinct.length)} different Node major lines (${distinct.join(', ')}) in ${String(named.length)} of its own declarations — ${named.map(renderNodeMajorSource).join('; ')}. Which one the application was built inside is not something a precedence order settles when the sources contradict each other, so this stage reads none of them; declare it with --node <major>. Every source consulted: ${consulted.map(renderNodeMajorSource).join('; ')}.`,
				stage: 'era-cell',
				origin: 'pipeline',
			});
		if (distinct.length === 1) {
			const winner = named[0] as NodeMajorSourceReading;
			nodeMajor = distinct[0] as number;
			nodeMajorSource = 'inferred';
			nodeMajorReadFrom = winner.source;
			inferred.push('nodeMajor');
			runtime = Object.freeze({
				major: nodeMajor,
				version: null,
				source: 'inferred' as const,
				readFrom: winner.source,
				basis: `${sentence(renderNodeMajorSource(winner))} The install and build stages run the lane in a runtime of that major.`,
				claim: LANE_RUNTIME_CLAIM,
				declaredRange: null,
				declaredRangeSource: null,
				satisfiedByDeclaredRange: null,
			});
			era = Object.freeze({
				outcome: 'read' as const,
				declared: winner.text,
				readFrom: winner.source,
				consultedSources: consulted,
				claim: `${winner.source} names exactly one Node major and this stage read it as the era this tree declares. It is what the tree says, not a statement that the application was built or run on it.`,
			});
		} else {
			/**
			 * The T027 §1 and §2 path: the era is not read, and the runtime is.
			 *
			 * Two different questions were being answered with one refusal. Which
			 * era the authors were on is unanswerable here — either nothing in the
			 * tree names one, or what it names is a range, a matrix or a floating
			 * tag that names no single major. Which runtime the lane will be
			 * installed and built in is determinate: this process's. The refusals
			 * that used to fire here narrow to the case where there is no lane
			 * either, and keep their strings verbatim.
			 */
			const lane = COMPOSED_LANES[analysis.lineage];
			if (lane === undefined) {
				if (stated.length === 0)
					refuse({
						code: 'era-cell.cell-not-declared-for-framework',
						message: `Era cell: the ${analysis.lineage} lineage publishes no target-cell registry this stage can read a Node line out of — ${analysis.cellReadings.reason ?? 'no cell was published for this tree'} — and the tree declares no Node era of its own in .nvmrc, .node-version, package.json#volta.node, .tool-versions, any Dockerfile* FROM a node image, any .github/workflows node-version, or package.json#engines.node. Nothing here names the toolchain era the install stage would run inside; declare it with --cell <id> or --node <major>.`,
						stage: 'era-cell',
						origin: 'pipeline',
					});
				refuse({
					code: 'era-cell.node-major-not-inferable',
					message: `Era cell: ${String(stated.length)} declaration(s) in this tree state a Node line and none of them names exactly one major this stage reads — ${consulted.map(renderNodeMajorSource).join('; ')}. A range with an open lower bound names every major above it, a matrix names several, and a floating image tag names whatever it resolves to today rather than what the authors ran; none of those is a reading, and this stage picks from none of them. Declare the era with --node <major>.`,
					stage: 'era-cell',
					origin: 'pipeline',
				});
			}
			composedLane = lane;
			const engines = stated.find(
				(reading) =>
					reading.source === 'package.json#engines.node' && reading.text !== null,
			);
			const declaredRange = engines?.text ?? null;
			const satisfied =
				declaredRange === null
					? null
					: declaredRangeAdmitsMajor(declaredRange, reading.runningNodeMajor);
			if (satisfied === false)
				refuse({
					code: 'era-cell.declared-range-excludes-the-lane-runtime',
					message: `Era cell: this application declares engines.node ${declaredRange ?? ''} in package.json#engines.node, and the runtime the install and build stages would run the lane in is Node ${String(reading.runningNodeMajor)} (${reading.runningNodeVersion}), which that range does not admit. The lane is not installed in a runtime the application's own manifest excludes; declare the runtime with --node <major> if the range is stale, or provide a runtime the range admits.`,
					stage: 'era-cell',
					origin: 'pipeline',
				});
			nodeMajor = reading.runningNodeMajor;
			nodeMajorSource = 'inferred';
			nodeMajorReadFrom = LANE_RUNTIME_READ_FROM;
			inferred.push('nodeMajor');
			runtime = Object.freeze({
				major: reading.runningNodeMajor,
				version: reading.runningNodeVersion,
				source: 'inferred' as const,
				readFrom: LANE_RUNTIME_READ_FROM,
				basis: LANE_RUNTIME_BASIS,
				claim: satisfied === true ? LANE_RUNTIME_CLAIM_WITH_RANGE : LANE_RUNTIME_CLAIM,
				declaredRange,
				declaredRangeSource: declaredRange === null ? null : 'package.json#engines.node',
				satisfiedByDeclaredRange: satisfied,
			});
			era = Object.freeze({
				outcome: 'not-read' as const,
				declared: null,
				readFrom: null,
				consultedSources: consulted,
				claim: ERA_NOT_READ_CLAIM,
			});
		}
	}

	const frontendRequirements = await readArchitectureRequirements(applicationRoot);
	let architecture: string;
	let architectureSource: EraCellValueSource;
	let architectureBasis: string;
	if (declarations.architecture !== null) {
		if (!ARCHITECTURES.includes(declarations.architecture))
			refuse({
				code: 'era-cell.declared-architecture-not-recognised',
				message: `Era cell: --arch ${declarations.architecture} is not one of ${ARCHITECTURES.join(', ')}. This stage matches a runtime by architecture, and an architecture it does not recognise matches nothing rather than matching everything.`,
				stage: 'era-cell',
				origin: 'pipeline',
			});
		architecture = declarations.architecture;
		architectureSource = 'declared';
		architectureBasis = `declared with --arch ${declarations.architecture}`;
		declared.push('architecture');
	} else if (frontendRequirements.length > 0) {
		const first = frontendRequirements[0] as ArchitectureRequirement;
		architecture = first.requiresArchitecture;
		architectureSource = 'inferred';
		architectureBasis = `the closure carries ${frontendRequirements
			.map(
				(requirement) =>
					`${requirement.package}@${requirement.version} (read from ${requirement.readFrom})`,
			)
			.join(', ')}, which publishes no ${first.noBindingFor} binding: ${first.fact}`;
		inferred.push('architecture');
	} else {
		architecture = reading.architecture;
		architectureSource = 'inferred';
		architectureBasis = `no package in the closure is one this repository measured as publishing no binding for an architecture, so the cell is read at the host architecture ${reading.architecture}`;
		inferred.push('architecture');
	}

	const required: RequiredCell = Object.freeze({
		cell:
			cell !== null
				? cell.id
				: composedLane !== null
					? composedLane.cell
					: `node-${String(nodeMajor)}`,
		cellSource: declarations.cell === null ? 'inferred' : 'declared',
		cellBasis:
			cell !== null
				? cell.describedBy
				: composedLane !== null
					? `the ${analysis.lineage} lineage publishes no target-cell registry, so no cell is read for it. The cell named here is the lane this pipeline composes: the plan and apply stages write ${composedLane.writes}, and the install and build stages run it in the runtime recorded below.`
					: `the ${analysis.lineage} lineage publishes no target-cell registry, so the cell is the Node line the tree itself declares. Only a Node runtime is named by it.`,
		runtime,
		era,
		nodeMajor,
		nodeMajorSource,
		nodeMajorReadFrom,
		nodeMajorSources: consulted,
		architecture,
		architectureSource,
		architectureBasis,
		architectureRequirements: frontendRequirements,
	});

	const translation = translationFor(reading, architecture);
	const provisioned = provisionRuntime(reading, nodeMajor, architecture);
	const candidates = provisioned?.candidates ?? Object.freeze([]);
	if (candidates.length === 0 && architecture !== reading.architecture)
		refuse({
			code: 'era-cell.arch-not-available',
			message: `Era cell: the cell requires a Node ${String(nodeMajor)} runtime at ${architecture} and this host is ${reading.platform}-${reading.architecture}. The requirement is read rather than assumed: ${sentence(architectureBasis)} ${
				translation === null
					? `No translation of ${architecture} is available on ${reading.platform}-${reading.architecture}, so there is no remedy available on this host.`
					: `${translation} can translate ${architecture} here, but no ${architecture} Node ${String(nodeMajor)} runtime is present at any location this stage reads (${reading.suppliers.join(', ')}), and this stage opens no network to obtain one.`
			} The install this cell would run inside is refused before it is attempted rather than after it fails.`,
			stage: 'era-cell',
			origin: 'pipeline',
		});
	if (candidates.length === 0)
		refuse({
			code: 'era-cell.required-node-not-installed',
			message: `Era cell: the cell requires Node ${String(nodeMajor)} on ${reading.platform}-${architecture} and no such runtime is present at any location this stage reads (${reading.suppliers.join(', ')}). The runtimes it found are ${
				reading.installed.length === 0
					? 'none'
					: reading.installed
							.map(
								(runtime) =>
									`${runtime.version} ${runtime.platform}-${runtime.architecture} (${runtime.supplier})`,
							)
							.join(', ')
			}. This stage opens no network, so a runtime this host does not already carry is a refusal rather than a fetch.`,
			stage: 'era-cell',
			origin: 'pipeline',
		});

	/**
	 * Both refusals above fire on an empty candidate list, so a reading that
	 * reaches this line has one. The cast states that rather than re-reading the
	 * host a second time and getting a second chance to disagree with itself.
	 */
	const chosen = provisioned as NonNullable<typeof provisioned>;
	return Object.freeze({
		stage: 'era-cell',
		schemaVersion: ERA_CELL_RECORD_SCHEMA,
		ran: true,
		reason: null,
		outcome: chosen.outcome,
		required,
		determination: Object.freeze({
			inferred: Object.freeze([...inferred].sort()),
			declared: Object.freeze([...declared].sort()),
		}),
		host: reading,
		provision: chosen.provision,
		refusal: null,
		notEstablished: ERA_CELL_NOT_ESTABLISHED,
	});
}

/** The era-cell record as an operator reads it. */
export function renderEraCell(record: EraCellRecord): string {
	if (!record.ran) return `era cell: not run — ${record.reason ?? ''}\n`;
	if (record.outcome === 'refused')
		return `era cell: refused — ${record.refusal?.code ?? ''}\n${record.refusal?.message ?? ''}\n`;
	const required = record.required;
	const lines = [
		`era cell: ${required?.cell ?? ''} (${required?.cellSource ?? ''})`,
		`node: ${String(required?.nodeMajor ?? 0)} (${required?.nodeMajorSource ?? ''}${
			required?.nodeMajorReadFrom === null || required?.nodeMajorReadFrom === undefined
				? ''
				: ` from ${required.nodeMajorReadFrom}`
		})`,
		`runtime: ${String(required?.runtime.major ?? 0)}${
			required?.runtime.version === null || required?.runtime.version === undefined
				? ''
				: ` (${required.runtime.version})`
		} (${required?.runtime.source ?? ''} from ${required?.runtime.readFrom ?? ''})`,
		`runtime basis: ${required?.runtime.basis ?? ''}`,
		`runtime claim: ${required?.runtime.claim ?? ''}`,
		...(required?.runtime.declaredRange === null ||
		required?.runtime.declaredRange === undefined
			? []
			: [
					`declared range: ${required.runtime.declaredRange} (${required.runtime.declaredRangeSource ?? ''}) — satisfied by the lane runtime: ${
						required.runtime.satisfiedByDeclaredRange === null
							? 'not read'
							: String(required.runtime.satisfiedByDeclaredRange)
					}`,
				]),
		`era: ${required?.era.outcome ?? ''}${
			required?.era.readFrom === null || required?.era.readFrom === undefined
				? ''
				: ` from ${required.era.readFrom}`
		} — ${required?.era.claim ?? ''}`,
		...(required?.era.consultedSources ?? []).map(
			(reading) => `era source consulted: ${renderNodeMajorSource(reading)}`,
		),
		`architecture: ${required?.architecture ?? ''} (${required?.architectureSource ?? ''})`,
		`basis: ${required?.architectureBasis ?? ''}`,
		`host: ${record.host?.platform ?? ''}-${record.host?.architecture ?? ''}, running ${record.host?.runningNodeVersion ?? ''}; suppliers: ${(record.host?.suppliers ?? []).join(', ')}`,
		`outcome: ${record.outcome} — ${record.provision?.supplier ?? ''} ${record.provision?.version ?? ''} at ${record.provision?.location ?? ''}${
			record.provision?.translation === null || record.provision?.translation === undefined
				? ''
				: ` under ${record.provision.translation}`
		}`,
		'',
	];
	for (const runtime of record.host?.installed ?? [])
		lines.push(
			`  ${runtime.version} ${runtime.platform}-${runtime.architecture} (${runtime.supplier}) ${runtime.location}`,
		);
	lines.push('');
	for (const line of record.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}
