/**
 * The operator command surface: `analyze`, `plan`, `migrate`, `verify` and
 * `supported-matrix`.
 *
 * These are the framework-neutral entry points. They compose the same frozen
 * public APIs the fixture-driven drivers compose, and they add no migration
 * decision of their own — what they add is argument validation, a
 * machine-readable output mode, and a refusal for every input this repository
 * cannot answer for.
 *
 * Every flow is local and offline. None of them opens a socket, and none of
 * them writes into the application it was pointed at.
 */

import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { analyzeApplication, fileExists, type ApplicationAnalysis } from './analyze.ts';
import { applyPlan, type AppliedChangeset } from './apply.ts';
import { buildNotRequested, runLaneBuild, type BuildRecord } from './build.ts';
import {
	installNotRequested,
	runLaneInstall,
	type InstallPolicy,
	type InstallRecord,
} from './install.ts';
import {
	ingestApplicationSource,
	ingestNotRequested,
	renderIngest,
	type IngestDeclarations,
	type IngestRecord,
} from './ingest.ts';
import {
	DEFAULT_ERA_CELL_DECLARATIONS,
	establishEraCell,
	eraCellNotRequested,
	eraCellRefused,
	readHostCell,
	renderEraCell,
	type EraCellDeclarations,
	type EraCellRecord,
} from './era-cell.ts';
import { acquireApplicationSource, renderAcquire } from './acquire.ts';
import { writeLaneFiles, type LaneComposition } from './lane.ts';
import { composeLane, displayPath, writeRecord } from './record.ts';
import { renderRun, runFullPipeline, type RunDeclarations } from './run.ts';
import {
	cliEntryPath,
	countInterventions,
	DEFAULT_STAGE_BUDGET_MS,
	renderInterventionCount,
	runArgvFor,
	writeInterventionRecord,
} from './intervention-count.ts';
import { defaultBatchName, readFleet, renderBatch, runFleetBatch } from './batch.ts';
import { readLicenceAtPin, renderLicenceAtPin, type LicencePolicy } from './license.ts';
import { readSupportedMatrix, renderSupportedMatrix } from './matrix.ts';
import { planApplication, type OperatorPlan } from './plan.ts';
import {
	buildRefusalCensus,
	REFUSAL_CENSUS_FILE,
	writeRefusalCensus,
	type RefusalCensus,
} from './refusal-census.ts';
import {
	EXIT_PROCEEDED,
	EXIT_REFUSAL,
	pipelineRefusalOf,
	refusalRecord,
	refuse,
	renderRefusal,
} from './refusals.ts';
import { runOperatorVerification, type OperatorVerification } from './verify.ts';
import { runLaneWitness, witnessNotRequested, type WitnessRecord } from './witness.ts';
import {
	readCrawlBound,
	renderWitnessSynthesis,
	synthesizeWitnessJourneys,
} from './witness-synthesize.ts';
import { CRAWL_DEFAULT_BOUNDS } from '../witness/journey-synthesis/crawl.ts';

export const OPERATOR_COMMANDS = [
	/**
	 * Fetch an application source into a baseline tree the generic `ingest`
	 * stage can read. It is the one stage that touches the network, and it is
	 * separate from `run` for that reason: a pipeline stage nobody consented to
	 * a fetch for must not acquire anything.
	 */
	'acquire',
	'ingest',
	'license-at-pin',
	'era-cell',
	'analyze',
	'plan',
	'migrate',
	/**
	 * The whole pipeline, in one command, with every stage on by default.
	 *
	 * `migrate` keeps its opt-in stages exactly as they are: its exit-0 path
	 * must stay runnable with no registry, and a stage it was not asked for is
	 * recorded as not run rather than implied. `run` is the other entry — the
	 * one an operator reaches for when the answer wanted is "what does this
	 * application do when every stage is asked for", and the first refusing
	 * stage settles the exit code for all nine.
	 */
	'run',
	/**
	 * The harness that counts what a `run` needed from a human, from outside it.
	 *
	 * It is a command of its own rather than a flag on `run` because the gate
	 * must not be scored by the thing under test: this one snapshots the disk,
	 * spawns `run` exactly once as a child, re-snapshots and writes the count.
	 * `run` is never asked what it did.
	 */
	'intervention-count',
	/**
	 * The fleet loop: many applications, one at a time, each scored by the
	 * harness above and each filed where the coverage report reads it.
	 *
	 * The list of applications is a manifest or a set of roots this command was
	 * handed. It is never a list in source — a batch that carries its own fleet
	 * is a fixture, and the whole point of this surface is that it is not one.
	 */
	'batch',
	'verify',
	'supported-matrix',
	'refusal-census',
	'witness-synthesize',
] as const;

export type OperatorCommand = (typeof OPERATOR_COMMANDS)[number];

export function isOperatorCommand(value: string | undefined): value is OperatorCommand {
	return (OPERATOR_COMMANDS as readonly string[]).includes(value ?? '');
}

/** Flags that take a value, per command. A repeatable flag collects. */
/** The declarations the ingest stage accepts, wherever it is invoked from. */
const INGEST_VALUE_FLAGS: readonly string[] = Object.freeze([
	'--id',
	'--frontend-root',
	'--revision',
	'--repository',
	'--ref',
	'--lockfile',
	'--license',
]);

/** The declarations the era-cell stage accepts, wherever it is invoked from. */
const ERA_CELL_VALUE_FLAGS: readonly string[] = Object.freeze(['--node', '--arch', '--cell']);

const VALUE_FLAGS: Readonly<Record<OperatorCommand, readonly string[]>> = Object.freeze({
	acquire: Object.freeze(['--ref', '--id', '--consent', '--license', '--record']),
	ingest: Object.freeze([...INGEST_VALUE_FLAGS, '--record']),
	'license-at-pin': Object.freeze(['--frontend-root', '--license', '--record']),
	'era-cell': Object.freeze([...ERA_CELL_VALUE_FLAGS, '--record']),
	analyze: Object.freeze(['--record']),
	/**
	 * `--cell` is here as well as on the era-cell stage because the two stages
	 * read the same declaration for different things: the era-cell stage reads
	 * the Node line a cell needs, and the plan stage aligns the manifest to the
	 * cell itself. A `plan` that accepted the declaration only for the former
	 * would compose against the default cell while reporting the declared one.
	 */
	plan: Object.freeze([
		'--source-dir',
		'--template-dir',
		'--style-dir',
		'--entry',
		'--cell',
		'--record',
	]),
	migrate: Object.freeze([
		'--source-dir',
		'--template-dir',
		'--style-dir',
		'--entry',
		'--record',
		'--out',
		/**
		 * The ingest stage reads the *repository* root, because that is where a
		 * licence sits, and the positional is the application root, which for an
		 * application in a subdirectory is not the same directory. Declaring the
		 * source root is how the two are told apart; it defaults to the
		 * application root rather than to its parent, because a parent this flow
		 * was not pointed at is a guess.
		 */
		'--source-root',
		...INGEST_VALUE_FLAGS,
		...ERA_CELL_VALUE_FLAGS,
	]),
	/**
	 * Every value flag the nine stages accept, and not one this pipeline does
	 * not already have a stage for. `run` forwards; it declares nothing of its
	 * own.
	 */
	run: Object.freeze([
		'--source-dir',
		'--template-dir',
		'--style-dir',
		'--entry',
		'--record',
		'--out',
		'--source-root',
		...INGEST_VALUE_FLAGS,
		...ERA_CELL_VALUE_FLAGS,
	]),
	/**
	 * Every declaration `run` accepts, because the harness forwards them
	 * unchanged: what is counted has to be the run an operator would have
	 * launched, not a narrowed one this harness chose for it.
	 */
	'intervention-count': Object.freeze([
		'--source-dir',
		'--template-dir',
		'--style-dir',
		'--entry',
		'--record',
		'--out',
		'--source-root',
		...INGEST_VALUE_FLAGS,
		...ERA_CELL_VALUE_FLAGS,
	]),
	/**
	 * `--apps` is the fleet and repeats; everything else is a declaration this
	 * batch forwards to every application's harness unchanged, so that the run
	 * being scored is the run an operator would have launched for each of them.
	 */
	batch: Object.freeze([
		'--apps',
		'--out',
		'--name',
		'--record',
		'--source-dir',
		'--template-dir',
		'--style-dir',
		'--entry',
		'--source-root',
		...INGEST_VALUE_FLAGS,
		...ERA_CELL_VALUE_FLAGS,
	]),
	verify: Object.freeze(['--receipt', '--trust-dir', '--record']),
	'supported-matrix': Object.freeze(['--trust-dir', '--record']),
	'witness-synthesize': Object.freeze([
		'--lane-url',
		'--max-depth',
		'--max-routes',
		'--out',
		'--record',
	]),
	'refusal-census': Object.freeze(['--out', '--record']),
});

/** Flags that take no value, per command. `--offline` is accepted everywhere. */
const BOOLEAN_FLAGS: Readonly<Record<OperatorCommand, readonly string[]>> = Object.freeze({
	acquire: Object.freeze([]),
	ingest: Object.freeze([]),
	'license-at-pin': Object.freeze([]),
	'era-cell': Object.freeze([]),
	analyze: Object.freeze([]),
	plan: Object.freeze([]),
	migrate: Object.freeze([
		'--materialize',
		'--ingest',
		'--era-cell',
		'--install',
		'--build',
		'--witness',
		'--allow-remote-tarballs',
		'--allow-install-scripts',
		'--skip-install-scripts',
		'--allow-peer-conflicts',
		'--allow-foreign-lockfile',
		'--allow-git-dependencies',
	]),
	/**
	 * The stage switches are absent on purpose: `run` runs every stage, so
	 * there is nothing to opt into. What remains are the install policies,
	 * which keep the refusing defaults they have in `install.ts`, the
	 * materialize choice, and `--dry-run`.
	 *
	 * `run` materializes by default, because the stages after `apply` read the
	 * lane as a tree: an install needs the application's own lockfile and a
	 * build needs its sources, and neither is in a changeset lane. `--materialize`
	 * stays accepted so a caller that declares it is not refused, and
	 * `--compose-only` is the opt-out that asks for the changeset lane instead.
	 */
	run: Object.freeze([
		'--materialize',
		'--compose-only',
		'--dry-run',
		'--allow-remote-tarballs',
		'--allow-install-scripts',
		'--skip-install-scripts',
		'--allow-peer-conflicts',
		'--allow-foreign-lockfile',
		'--allow-git-dependencies',
	]),
	'intervention-count': Object.freeze([
		'--materialize',
		'--compose-only',
		'--dry-run',
		'--allow-remote-tarballs',
		'--allow-install-scripts',
		'--skip-install-scripts',
		'--allow-peer-conflicts',
		'--allow-foreign-lockfile',
		'--allow-git-dependencies',
	]),
	/**
	 * `--publish` is the ordering step, not a stage switch: it runs the build,
	 * generate, verify and report chain after the loop, so a batch ends in a
	 * report that was re-derived from what the loop just filed.
	 */
	batch: Object.freeze([
		'--publish',
		'--materialize',
		'--compose-only',
		'--dry-run',
		'--allow-remote-tarballs',
		'--allow-install-scripts',
		'--skip-install-scripts',
		'--allow-peer-conflicts',
		'--allow-foreign-lockfile',
		'--allow-git-dependencies',
	]),
	verify: Object.freeze([]),
	'supported-matrix': Object.freeze([]),
	'refusal-census': Object.freeze(['--verify-only']),
	'witness-synthesize': Object.freeze([]),
});

const UNIVERSAL_BOOLEAN_FLAGS: readonly string[] = Object.freeze(['--json', '--offline', '--help']);

/** Commands that take exactly one positional application root. */
const TAKES_APPLICATION_ROOT: readonly OperatorCommand[] = Object.freeze([
	'ingest',
	'license-at-pin',
	'era-cell',
	'analyze',
	'plan',
	'migrate',
	'run',
	'intervention-count',
	'witness-synthesize',
]);

/** Flags that settle one value, so a second occurrence is a contradiction. */
const SINGLE_VALUE_FLAGS: readonly string[] = Object.freeze([
	'--out',
	'--entry',
	'--trust-dir',
	'--source-root',
	'--lane-url',
	'--max-depth',
	'--max-routes',
	'--consent',
	...INGEST_VALUE_FLAGS,
	...ERA_CELL_VALUE_FLAGS,
]);

/**
 * Commands taking exactly one positional that is not an application root.
 *
 * `acquire` takes a repository, which is a name of something not yet on disk.
 * Counting it with the application-root commands would make its refusal say
 * "application root" about an `owner/name`, which is the wrong noun.
 */
const TAKES_ONE_REPOSITORY: readonly OperatorCommand[] = Object.freeze(['acquire']);

export type ParsedArguments = Readonly<{
	positional: readonly string[];
	flags: Readonly<Record<string, readonly string[]>>;
	json: boolean;
	help: boolean;
}>;

/**
 * Parse and validate a command line. An unknown flag, a repeated single-value
 * flag, a missing value, or the wrong number of positionals is refused by name
 * rather than ignored.
 */
export function parseOperatorArguments(
	command: OperatorCommand,
	args: readonly string[],
): ParsedArguments {
	const valueFlags = VALUE_FLAGS[command];
	const booleanFlags = [...BOOLEAN_FLAGS[command], ...UNIVERSAL_BOOLEAN_FLAGS];
	const positional: string[] = [];
	const flags: Record<string, string[]> = {};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index] as string;
		if (arg === '--') continue;
		if (!arg.startsWith('--')) {
			positional.push(arg);
			continue;
		}
		if (booleanFlags.includes(arg)) {
			flags[arg] = [...(flags[arg] ?? []), 'true'];
			continue;
		}
		if (!valueFlags.includes(arg))
			refuse({
				code: 'arguments.unknown-flag',
				message: `${command}: unknown flag ${arg}. Accepted flags: ${[...valueFlags, ...booleanFlags].sort().join(', ')}`,
				stage: 'arguments',
				origin: 'pipeline',
			});
		const value = args[index + 1];
		if (value === undefined || value.startsWith('--'))
			refuse({
				code: 'arguments.flag-requires-a-value',
				message: `${command}: ${arg} requires a value`,
				stage: 'arguments',
				origin: 'pipeline',
			});
		flags[arg] = [...(flags[arg] ?? []), value];
		index += 1;
	}
	const help = flags['--help'] !== undefined;
	if (!help) {
		const repositoryPositional = TAKES_ONE_REPOSITORY.includes(command);
		const expected = TAKES_APPLICATION_ROOT.includes(command) || repositoryPositional ? 1 : 0;
		if (positional.length !== expected)
			refuse({
				code: 'arguments.wrong-positional-count',
				message:
					expected === 0
						? `${command}: takes no positional arguments, received ${String(positional.length)}`
						: repositoryPositional
							? `${command}: exactly one owner/name repository is required, received ${String(positional.length)}`
							: `${command}: exactly one application root is required, received ${String(positional.length)}`,
				stage: 'arguments',
				origin: 'pipeline',
			});
		for (const flag of SINGLE_VALUE_FLAGS)
			if ((flags[flag]?.length ?? 0) > 1)
				refuse({
					code: 'arguments.single-value-flag-repeated',
					message: `${command}: ${flag} may be given at most once`,
					stage: 'arguments',
					origin: 'pipeline',
				});
		if (command === 'migrate' && flags['--out'] === undefined)
			refuse({
				code: 'arguments.migrate-requires-an-output-lane',
				message: 'migrate: --out <dir> is required; this flow never writes in place',
				stage: 'arguments',
				origin: 'pipeline',
			});
		if (command === 'batch' && flags['--out'] === undefined)
			refuse({
				code: 'arguments.batch-requires-an-output-lane-root',
				message:
					'batch: --out <lane-root> is required; every application in a fleet gets its own lane below it, and this flow never writes in place',
				stage: 'arguments',
				origin: 'pipeline',
			});
		if ((command === 'run' || command === 'intervention-count') && flags['--out'] === undefined)
			refuse({
				code: 'arguments.run-requires-an-output-lane',
				message: `${command}: --out <dir> is required; this flow never writes in place`,
				stage: 'arguments',
				origin: 'pipeline',
			});
	}
	return Object.freeze({
		positional: Object.freeze(positional),
		flags: Object.freeze(flags),
		json: flags['--json'] !== undefined,
		help,
	});
}

const HELP: Readonly<Record<OperatorCommand, string>> = Object.freeze({
	acquire: [
		'versionless acquire <owner/name> --ref <tag-or-sha> --id <identifier>',
		'                    [--consent <id>] [--license <identifier>] [--record <file>] [--json]',
		'',
		'Fetch an application source at a named pin into .versionless/work/<id>/baseline, which',
		'the generic ingest stage reads with no per-application module and no allowlist entry.',
		'',
		'The ref is resolved to a commit and the archive is fetched at that commit, twice. The',
		'two streams must be byte-identical, and what they carry is reconciled file by file',
		'against the Git tree the repository publishes at the same commit: a missing file, an',
		'extra file, or a blob whose Git object id differs is a named refusal, never a note.',
		'',
		'Every byte travels through the consented HTTPS transaction, which stamps the consent',
		'id on each request and journals the exact response bytes it accepted. Absent a consent',
		'id — --consent <id> or VERSIONLESS_CONSENT_ID, with VERSIONLESS_NETWORK_MODE=consented',
		'— this stage refuses before opening a socket. There is no unconsented fetch path.',
		'',
		'A tree carrying no licence file at the pin is refused rather than acquired: the terms',
		'an application is offered under are not recoverable from bytes nobody fetched.',
		'',
		'Acquiring a source is not admitting one, and nothing here installs, builds or runs.',
		'',
		'Exit 2 is a refusal, 1 is a defect, 0 is a run that proceeded.',
	].join('\n'),
	ingest: [
		'versionless ingest <source-root> [--id <identifier>] [--frontend-root <dir>]',
		'                   [--revision <commit-sha>] [--repository <owner/name>] [--ref <ref>]',
		'                   [--lockfile <file>] [--license <identifier>] [--record <file>] [--json]',
		'',
		'Admit an application source that is already on disk: read its identity, the revision',
		'it is pinned to, a digest of the tree, the licence at that pin, and the dependency',
		'closure its lockfile records. No allowlist is consulted and no per-application module',
		'is required — this is the generic path beside the 34 hand-written ingest modules.',
		'',
		'Every value has a refusing default. The identity comes from the frontend manifest’s',
		'own name, the frontend root from the one subdirectory carrying a manifest, and the',
		'revision from the checkout’s Git metadata. A value this stage cannot read and was not',
		'given is a named refusal, never the directory name or a plausible substitute.',
		'',
		'Nothing is fetched and nothing is written into the source. Acquiring an application',
		'over the network stays behind its own purpose-bound consent, and choosing a toolchain',
		'era is not part of admission.',
		'',
		'Exit 2 is a refusal, 1 is a defect, 0 is a run that proceeded.',
	].join('\n'),
	'license-at-pin': [
		'versionless license-at-pin <source-root> [--frontend-root <dir>] [--license <identifier>]',
		'                           [--record <file>] [--json]',
		'',
		'Read the licence the application carries at the revision it is pinned to: the licence',
		'files at the source root, their digests and Git blob ids, the copyright notice, and',
		'the identifier the text itself states.',
		'',
		'The identifier is observed by default. A text this stage does not read verbatim, two',
		'root licence files stating different identifiers, or a manifest field that disagrees',
		'with the licence text is a named refusal — --license <identifier> is the declaration',
		'that settles it, and the record then says the identifier was declared rather than',
		'observed.',
		'',
		'This is a reading of the bytes present at the pin. It is not a legal opinion, not a',
		'compatibility finding, and it evaluates no dependency’s terms.',
	].join('\n'),
	'era-cell': [
		'versionless era-cell <app-root> [--cell <id>] [--node <major>] [--arch <arm64|x64>]',
		'                     [--record <file>] [--json]',
		'',
		'Determine the toolchain cell this application is installed and built inside, and',
		'state whether this host carries a Node runtime for it. The cell is the one the',
		'analyze reading already publishes for the tree — the frozen adapter’s own target',
		'cell, with the Node line that cell declares — and for a lineage that publishes no',
		'cell registry it is the Node line the tree itself declares in .nvmrc, .node-version',
		'or package.json#engines.node.',
		'',
		'The architecture is read from the closure. A dependency this repository measured as',
		'publishing no binding for an architecture makes the cell require the other one, and',
		'a host that carries no runtime at that architecture is a named refusal rather than',
		'an install that fails halfway through a native build.',
		'',
		'--cell, --node and --arch declare what the tree does not state. A declaration this',
		'stage cannot read a major or a described cell out of is refused rather than resolved.',
		'',
		'Nothing is fetched and no other program is run: the runtimes this stage counts are',
		'the ones already on disk at the locations it reads. Recording a cell as present says',
		'a Node runtime of that major and architecture is here; it does not say the framework',
		'toolchain the cell names was installed.',
		'',
		'Exit 2 is a refusal, 1 is a defect, 0 is a run that proceeded.',
	].join('\n'),
	analyze: [
		'versionless analyze <app-root> [--json] [--offline]',
		'',
		'Read an application tree and report what was detected: lineage, declared framework',
		'version, builder, Node era, package manager, and the target cell’s verdict on every',
		'declared dependency. A dependency the cell has no reading for is reported `unknown`;',
		'unknown is never reported as supported.',
		'',
		'Detection reads declarations. It builds nothing and installs nothing.',
	].join('\n'),
	plan: [
		'versionless plan <app-root> [--source-dir <dir>]... [--template-dir <dir>]...',
		'                 [--style-dir <dir>]... [--entry <module>] [--cell <id>]',
		'                 [--record <file>] [--json]',
		'',
		'Compose the changeset the frozen adapter produces for this tree and report it',
		'without writing anything into the tree: files changed, files removed, unhandled',
		'findings, and the differences the migration declares it no longer carries.',
		'',
		'--source-dir overrides the Angular source directories the workspace declares, for a',
		'workspace whose compilation unit reaches past its own sourceRoot. Capabilities gated',
		'on a compiler diagnostic or an installed closure stand down here; the plan reports',
		'which readings it supplied.',
		'',
		'--cell declares which target cell the changeset is composed against. It is resolved',
		'against the cells the frozen adapters publish as migration targets, and an identifier',
		'none of them publishes is a named refusal rather than a silent fall back to the',
		'default cell. Declaring nothing plans against the default, exactly as before. A cell',
		'the era-cell stage can describe is not necessarily one an adapter publishes: being',
		'describable says a Node line was read for it, not that a migration engine targets it.',
	].join('\n'),
	migrate: [
		'versionless migrate <app-root> --out <dir> [--materialize] [--ingest] [--era-cell]',
		'                    [--install] [--build]',
		'                    [--source-root <dir>] [--id <identifier>] [--frontend-root <dir>]',
		'                    [--revision <commit-sha>] [--repository <owner/name>] [--ref <ref>]',
		'                    [--lockfile <file>] [--license <identifier>]',
		'                    [--cell <id>] [--node <major>] [--arch <arm64|x64>]',
		'                    [--allow-remote-tarballs] [--allow-install-scripts]',
		'                    [--skip-install-scripts] [--allow-peer-conflicts]',
		'                    [--allow-foreign-lockfile] [--allow-git-dependencies]',
		'                    [--record <file>] [--json]',
		'',
		'Apply the composed changeset into a separate output lane. The lane may not be inside',
		'the application, the application may not be inside the lane, and a lane that already',
		'carries files is refused: this flow never writes in place.',
		'',
		'By default the lane carries only the files the changeset rewrites. --materialize',
		'copies the application into the lane first (node_modules and .git excluded), so the',
		'lane is a whole tree.',
		'',
		'For a create-react-app tree the lane stage then writes the build configuration the',
		'lane needs — a vite.config.ts composed from the frozen adapter exports, and a',
		'package.json whose build script and toolchain declaration match it. Anything the',
		'generic composition cannot carry is reported as a named unhandled finding.',
		'',
		'--ingest runs the admission stage on the source before anything is composed: identity,',
		'pinned revision, tree digest, licence at the pin, and the recorded dependency closure.',
		'It reads --source-root, which defaults to the application root — declare the repository',
		'root when the application sits in a subdirectory, because that is where a licence lives.',
		'',
		'--era-cell runs the toolchain-cell stage before anything is installed, because the',
		'install runs inside the cell. It states which Node line and which architecture the',
		'application needs, and whether this host carries a runtime for them; a cell this',
		'host cannot provide is a named refusal rather than a native build that fails. It is',
		'off unless declared, and the record then says the cell was not established rather',
		'than implying the lane was installed on the era toolchain.',
		'',
		'--cell is read by both stages. The era-cell stage reads the Node line the cell needs;',
		'the plan stage composes the changeset against the cell itself, so a declared cell is',
		'the cell the manifest is aligned to rather than a label on a default plan. It is',
		'resolved against the cells the frozen adapters publish as migration targets, and an',
		'identifier none of them publishes is a named refusal from the plan stage. It does not',
		'have to be declared: with no --cell the plan composes against the default cell.',
		'',
		'--witness runs the witness stage on the built lane, after the build, because there is',
		'nothing to witness until something has been emitted. It is off unless declared, and the',
		'record then says the lane was not witnessed rather than implying it was. Where the',
		'application has no hand-authored witness driver the journeys are synthesized — from its',
		'own end-to-end suite where it ships one, from a bounded loopback crawl where it does',
		'not — and the record states which, and what fraction of the derived journeys named a',
		'route to start from.',
		'',
		'--install and --build run those stages on the lane. They are off unless declared, and',
		'the record says so rather than implying the lane was proven to install. The two npm',
		'policy decisions are declarations, not judgment: --allow-remote-tarballs carries the',
		'allowance a lockfile with non-registry tarballs needs, and --allow-install-scripts or',
		'--skip-install-scripts settles whether a closure with install scripts runs them.',
		'--allow-peer-conflicts settles the third, which this repository measured rather than',
		'inherited: a current build toolchain declared beside an era application’s own pins can',
		'fail npm peer resolution outright. --allow-foreign-lockfile settles the fourth: a lane',
		'that pinned its closure with yarn, pnpm or bun is refused by default, and declaring the',
		'policy installs it without that lockfile — the file is left untouched and unread, and',
		'npm resolves from the manifest instead. That is the one policy that gives something up,',
		'so the install row records which lockfile was disregarded and states that the closure is',
		'no longer pinned by the era lockfile and may drift from what the application shipped',
		'with. It is never inferred from the lockfile kind. --allow-git-dependencies settles the',
		'fifth: npm fetches no dependency from a git reference by default and stops the install',
		'with EALLOWGIT, and declaring the policy carries npm’s --allow-git all. The install row',
		'then records which git dependencies the lockfile pinned, and that a registry version',
		'pin, integrity hash and provenance do not apply to any of them. A closure that needs a',
		'policy nobody declared is a named refusal, not a guess.',
		'',
		'One measured wall is a refusal with no policy at all. A closure that pins a registry',
		'this run cannot reach — a retired mirror whose certificate has expired, for instance —',
		'is install.closure-registry-unreachable, and no flag answers it: nothing an operator',
		'declares makes an unreachable host answer, and re-pinning the closure onto a registry',
		'that does is a migration decision rather than an install policy.',
		'',
		'Exit 2 is a refusal, 1 is a defect, 0 is a run that proceeded.',
	].join('\n'),
	run: [
		'versionless run <app-root> --out <dir> [--compose-only] [--dry-run]',
		'                [--source-root <dir>] [--id <identifier>] [--frontend-root <dir>]',
		'                [--revision <commit-sha>] [--repository <owner/name>] [--ref <ref>]',
		'                [--lockfile <file>] [--license <identifier>]',
		'                [--cell <id>] [--node <major>] [--arch <arm64|x64>]',
		'                [--source-dir <dir>]... [--template-dir <dir>]... [--style-dir <dir>]...',
		'                [--entry <module>]',
		'                [--allow-remote-tarballs] [--allow-install-scripts]',
		'                [--skip-install-scripts] [--allow-peer-conflicts]',
		'                [--allow-foreign-lockfile] [--allow-git-dependencies]',
		'                [--record <file>] [--json]',
		'',
		'Run every stage on one application, in order: analyze, ingest, license-at-pin,',
		'era-cell, plan, apply, install, build, witness. Nothing is opted into — this is',
		'the command for the question "what does this application do when the whole',
		'pipeline is asked for", and it composes the same stage functions `migrate` and',
		'the single-stage commands compose, with no migration decision of its own.',
		'',
		'Each stage keeps its own declarations and its own refusing defaults. A flag here',
		'is forwarded to the stage that owns it; a policy nobody declared is that stage’s',
		'named refusal, exactly as it is when the stage is invoked alone.',
		'',
		'--cell is forwarded to two stages, because two of them read it: the era-cell stage',
		'reads the Node line the cell needs, and the plan stage composes the changeset against',
		'the cell itself. A cell the era-cell stage can describe but no frozen adapter publishes',
		'as a migration target passes the first and is refused by the second, named, at exit 2 —',
		'rather than being planned against the default cell and reported as the declared one.',
		'',
		'The first stage to refuse settles the outcome: its refusal is emitted verbatim at',
		'exit 2, and every later stage is recorded as not run, with the stage that refused',
		'named as the reason. A stage that raised something other than a refusal is a',
		'defect at exit 1, with the stage named. Exit 0 is a run where all nine proceeded.',
		'',
		'The lane is materialized: the apply stage copies the application into --out',
		'(node_modules and .git excluded) before the changeset is written over it, because',
		'the stages after apply read the lane as a tree — install looks for the',
		'application’s own lockfile there and build compiles its sources. --compose-only',
		'asks for the changeset lane instead, and the apply row then records',
		'`changeset-lane` rather than `materialized`.',
		'',
		'--dry-run prints the stage order and the flags each stage would be given, and',
		'runs none of them.',
		'',
		'The record carries one row per stage — its status, its timestamps and the record',
		'or refusal it produced. The coverage report is not derived here: the record',
		'carries the slot it will occupy and states that nothing has been emitted into it.',
		'',
		'`migrate` is unchanged and remains the flow whose stages are opted into one at a',
		'time. Use it when the run has to reach a terminal outcome without a registry.',
	].join('\n'),
	'intervention-count': [
		'versionless intervention-count <app-root> --out <dir> [--record <file>]',
		'                               [every declaration `run` accepts] [--json]',
		'',
		'Count what one `versionless run` needed from a human, from outside it. This harness',
		'snapshots the disk, spawns `run` exactly once as a child process, snapshots again,',
		'diffs the two readings and writes the count. `run` is never asked what it did: a',
		'gate scored by the thing under test reports the number a bad stage would report.',
		'',
		'Four counters, and the gate passes only when all four are zero. Worktree mutation',
		'outside the declared write set — every tracked path in the checkout, the application',
		'root and the lane parent, hashed before and after, with --out, --record and the',
		'harness record itself as the declared write set. Prompt or stdin reads — the child is',
		'spawned with stdin `ignore` and CI=1, so no prompt could have been answered.',
		'Invocations — one spawn is permitted and a retry is one intervention. Authoring-home',
		'writes — the eight homes where hand-authored residue lands, named per file.',
		'',
		'A child that emits no stdout inside the stage budget is killed and classified',
		'`defect:hang`: a hang is a defect, never a refusal and never an intervention. A',
		'refusal exit is not an intervention either — it is a terminal outcome the fleet',
		'report tallies. The terminal classification is read from the run’s own record: what',
		'a run may state about itself is which refusal it named, never its own count.',
		'',
		'The record is written beside the run record as <record>.interventions.json, which is',
		'where the coverage report reads the count from. This command exits 0 whenever it',
		'produced a record; the count is the payload, not the exit code.',
	].join('\n'),
	batch: [
		'versionless batch --apps <manifest-file|app-root> [--apps ...] --out <lane-root>',
		'                  [--name <batch>] [--publish] [--record <file>] [--json]',
		'                  [every declaration `run` accepts, forwarded to every application]',
		'',
		'Run the intervention-count harness over a fleet, one application at a time, and fold',
		'what each reached into one summary. The fleet is whatever --apps names: a manifest',
		'file (a JSON document carrying `applications`, or a newline list of roots), or an',
		'application root, repeatable. There is no fleet inside this command — a batch that',
		'lists its applications in source is a fixture rather than a fleet tool.',
		'',
		'Each application is invoked as `intervention-count <root> --out <lane-root>/<id>',
		'--record evidence/runs/<id>/run-record.json --json`, which is where the coverage',
		'report reads run records and harness counts from. The identifier is the acquisition',
		'lane id when the root is a lane baseline, and the directory name otherwise.',
		'',
		'The loop is serial and stays serial: the witness surface serializes per host, and a',
		'fleet that fans out trades the determinism-under-load reading for a faster number.',
		'A refusal is a row carrying its named code and its message verbatim, not a stop. A',
		'harness that breaks for one application is one `defect:*` row, not a batch abort.',
		'',
		'--publish runs the ordering that makes the coverage report readable, after the loop',
		'and in exactly this order: `pnpm exec vp pack` when packages/cli/dist is older than',
		'the sources it is built from, then trust:generate offline, then trust:verify offline,',
		'then report:coverage --verify-only. Each step records what it exited with, and the',
		'chain stops at the first step that did not exit 0. Without --publish the summary says',
		'`publish: not-declared` and the published report is left exactly as it was.',
		'',
		'The summary is written to evidence/runs/fleet-batch/<name>/fleet-summary.{json,md}',
		'and passes the enterprise honesty guard before it is written. Exit 0 requires every',
		'application to have produced a harness record and every declared publish step to have',
		'exited 0; a defect row or a failed step exits 1. A refusal does not.',
	].join('\n'),
	verify: [
		'versionless verify [--receipt <path>]... [--trust-dir <dir>] [--json] [--offline]',
		'',
		'Run the offline verifications in one summary: the frozen adapter subtrees recomputed',
		'from the checkout, the trust package, corpus conformance, and one receipt (the',
		'composed React run by default). A failing check is reported beside the passing ones;',
		'a check that could not run at all is reported `unknown`.',
	].join('\n'),
	'supported-matrix': [
		'versionless supported-matrix [--trust-dir <dir>] [--json] [--offline]',
		'',
		'Verify the trust package and print the derived support matrix it carries: the counted',
		'cells per lineage, the demotions, the holdouts with their exact outcome strings, the',
		'permanent falsification history, the declared boundary and its prevalence.',
		'',
		'The rendered text is checked by the enterprise surface’s own honesty guard before it',
		'is printed. Blanket-support vocabulary, or a bounded outcome restated as a generic',
		'pass, stops the render.',
	].join('\n'),
	'refusal-census': [
		'versionless refusal-census [--out <file>] [--verify-only] [--record <file>] [--json]',
		'',
		'Derive the refusal census from the checkout: every refusal the pipeline flows and the',
		'frozen adapter subtrees can raise, with its exact string, the guard that raises it,',
		'the stage that composes the module, and whether the decision is the pipeline’s or a',
		'frozen adapter’s.',
		'',
		'The census is read out of the source rather than maintained by hand, so a refusal',
		'cannot be added, reworded or removed without it moving. --verify-only compares the',
		'published census against the derivation and writes nothing.',
	].join('\n'),
	'witness-synthesize': [
		'versionless witness-synthesize <app-root> [--lane-url <loopback-url>]',
		'                               [--max-depth <n>] [--max-routes <n>]',
		'                               [--out <file>] [--record <file>] [--json]',
		'',
		'Derive witness journeys for an application nobody has hand-authored one for. The',
		'application’s own Cypress and Playwright specs are read for the visits, clicks and',
		'typed input that replay against a served lane with nothing behind them; a construct',
		'the readers cannot express — a custom command, a network intercept, fixture-seeded',
		'state — is recorded by name rather than dropped.',
		'',
		'An application that ships no readable suite falls back to --lane-url: a bounded,',
		'loopback-only breadth-first crawl of the routes its served lane links to. An',
		'application with neither is refused by name at exit 2 rather than reported as an',
		'empty journey list.',
		'',
		'The emitted outcome vocabulary is closed and states measurements rather than',
		'verdicts, so a derived journey cannot report a bare result verb about an',
		'application nobody read.',
	].join('\n'),
});

export function operatorHelp(command: OperatorCommand): string {
	return `${HELP[command]}\n`;
}

export { displayPath } from './record.ts';

function renderAnalysis(root: string, analysis: ApplicationAnalysis): string {
	const lines = [
		`application: ${displayPath(root)}`,
		`lineage: ${analysis.lineage} (detected from ${analysis.detectedFrom})`,
		`declared framework version: ${analysis.frameworkVersionDeclared}`,
		`builder: ${analysis.builder} (from ${analysis.builderSource})`,
		`node era: ${analysis.nodeEra.declared} (from ${analysis.nodeEra.source})`,
		`package manager: ${analysis.packageManager.manager} (lockfiles: ${
			analysis.packageManager.lockfiles.length === 0
				? 'none'
				: analysis.packageManager.lockfiles.join(', ')
		}; declared: ${analysis.packageManager.declared})`,
		'',
	];
	if (analysis.cellReadings.cell === null)
		lines.push(`cell: none — ${analysis.cellReadings.reason ?? ''}`);
	else {
		lines.push(`cell: ${analysis.cellReadings.cell}`);
		for (const key of Object.keys(analysis.cellReadings.counts).sort())
			lines.push(`  ${key}: ${String(analysis.cellReadings.counts[key] ?? 0)}`);
		for (const verdict of analysis.cellReadings.verdicts)
			if (verdict.verdict !== 'unknown')
				lines.push(
					`  ${verdict.package} ${verdict.declaredRange} -> ${verdict.verdict}${
						verdict.alignedRange === 'unknown' ? '' : ` (${verdict.alignedRange})`
					}`,
				);
	}
	lines.push('');
	for (const line of analysis.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}

function renderPlan(root: string, plan: OperatorPlan): string {
	const changed = plan.files.filter((file) => file.changed);
	const lines = [
		`application: ${displayPath(root)}`,
		`lineage: ${plan.lineage} — ${plan.engine}`,
		`cell: ${plan.cell ?? 'none'}`,
		`readings supplied: ${plan.inputsSupplied.join(', ')}`,
		`files scanned: ${String(plan.applicationFilesScanned)}; files changed: ${String(changed.length)}; files removed: ${String(plan.removedFiles.length)}`,
		'',
	];
	for (const file of changed) {
		lines.push(
			`  ${file.path} (${file.kind}) ${file.sha256Before.slice(0, 12)} -> ${file.sha256After.slice(0, 12)}`,
		);
		for (const change of file.changes) lines.push(`    - ${change}`);
	}
	if (plan.removedFiles.length > 0) {
		lines.push('');
		lines.push('removed');
		for (const file of plan.removedFiles) lines.push(`  ${file}`);
	}
	if (plan.declaredDifferences.length > 0) {
		lines.push('');
		lines.push('declared differences');
		for (const entry of plan.declaredDifferences) lines.push(`  - ${entry}`);
	}
	if (plan.unhandled.length > 0) {
		lines.push('');
		lines.push('unhandled');
		for (const entry of plan.unhandled) lines.push(`  - ${entry}`);
	}
	lines.push('');
	for (const line of plan.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}

function renderApplied(
	out: string,
	applied: AppliedChangeset,
	composition: LaneComposition,
	install: InstallRecord,
	build: BuildRecord,
	ingest: IngestRecord,
	eraCell: EraCellRecord,
	witness: WitnessRecord,
): string {
	const lines = [
		ingest.ran
			? `ingest: ${ingest.id ?? ''} at ${ingest.pin?.commitSha ?? ''} — ${ingest.licence?.identifier ?? ''} (${ingest.licence?.identifierSource ?? ''})`
			: `ingest: not run — ${ingest.reason ?? ''}`,
		eraCell.ran
			? `era cell: ${eraCell.required?.cell ?? ''} on node ${String(eraCell.required?.nodeMajor ?? 0)}-${eraCell.required?.architecture ?? ''} — ${eraCell.outcome} (${eraCell.provision?.supplier ?? ''} ${eraCell.provision?.version ?? ''})`
			: `era cell: not run — ${eraCell.reason ?? ''}`,
		`lane: ${displayPath(out)} (${applied.mode})`,
		`files copied: ${String(applied.copied)}; files written: ${String(applied.written.length)}; files the changeset removes: ${String(applied.removed.length)}`,
		'',
	];
	for (const file of applied.written)
		lines.push(`  ${file.path} ${file.sha256After.slice(0, 12)}`);
	for (const file of applied.removed) lines.push(`  removed ${file}`);
	lines.push('');
	lines.push(
		composition.composed
			? `lane build configuration: ${String(composition.files.length)} file(s) generated`
			: `lane build configuration: none — ${composition.reason ?? ''}`,
	);
	for (const file of composition.files) {
		lines.push(`  ${file.path} ${file.sha256.slice(0, 12)}`);
		for (const change of file.changes) lines.push(`    - ${change}`);
	}
	if (composition.declaredDifferences.length > 0) {
		lines.push('');
		lines.push('declared differences');
		for (const entry of composition.declaredDifferences) lines.push(`  - ${entry}`);
	}
	if (composition.unhandled.length > 0) {
		lines.push('');
		lines.push('unhandled');
		for (const entry of composition.unhandled) lines.push(`  - ${entry}`);
	}
	lines.push('');
	lines.push(
		install.ran
			? `install: ${(install.command ?? []).join(' ')} — ${String(install.installedPackages ?? 0)} package(s) in the lane closure`
			: `install: not run — ${install.reason ?? ''}`,
	);
	/**
	 * What the install-script declaration bought, on the line under the command
	 * that carried it. The record has always named the policy; what it could not
	 * say until T032 is which scripts npm ran and which it skipped, and an
	 * operator reading a wall of install output is exactly who needs that said
	 * rather than implied by a flag.
	 */
	if (install.installScripts !== null) {
		const scripts = install.installScripts;
		lines.push(
			`  install scripts: ${scripts.policy} under npm ${scripts.npm.version ?? 'unread'} — ${String(scripts.ran.length)} ran, ${String(scripts.skipped.length)} skipped by npm`,
		);
		for (const entry of scripts.ran) lines.push(`    ran ${entry.package} ${entry.lifecycle}`);
		for (const entry of scripts.skipped)
			lines.push(`    skipped ${entry.package} ${entry.lifecycle}`);
	}
	lines.push(
		build.ran
			? `build: ${(build.command ?? []).join(' ')} — ${String(build.outputFiles ?? 0)} file(s) under ${build.outDirectory ?? ''}`
			: `build: not run — ${build.reason ?? ''}`,
	);
	lines.push(
		witness.ran
			? `witness: ${witness.journeySource ?? ''} — ${String(witness.journeysRun ?? 0)} journey(s) replayed, replayability ${String(witness.replayabilityRatio ?? 0)}`
			: `witness: not run — ${witness.reason ?? ''}`,
	);
	lines.push('');
	for (const line of [
		...ingest.notEstablished,
		...eraCell.notEstablished,
		...applied.notEstablished,
		...composition.notEstablished,
		...install.notEstablished,
		...build.notEstablished,
		...witness.notEstablished,
	])
		lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}

function renderCensus(census: RefusalCensus, written: string | null): string {
	const lines = [
		`refusal census: ${String(census.summary.sites)} site(s) over ${String(census.filesScanned)} scanned file(s)`,
		`adapter freeze composite: ${census.adapterFreezeComposite}`,
		'',
		'by origin',
	];
	for (const key of Object.keys(census.summary.byOrigin))
		lines.push(`  ${key}: ${String(census.summary.byOrigin[key] ?? 0)}`);
	lines.push('');
	lines.push('by classification');
	for (const key of Object.keys(census.summary.byClassification))
		lines.push(`  ${key}: ${String(census.summary.byClassification[key] ?? 0)}`);
	lines.push('');
	lines.push('by stage');
	for (const key of Object.keys(census.summary.byStage))
		lines.push(`  ${key}: ${String(census.summary.byStage[key] ?? 0)}`);
	lines.push('');
	lines.push(written === null ? 'written: nothing (verify only)' : `written: ${written}`);
	lines.push('');
	for (const line of census.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}

function renderVerification(verification: OperatorVerification): string {
	const lines = [`result: ${verification.result}`, ''];
	for (const check of verification.checks)
		lines.push(`  [${check.state}] ${check.name}: ${check.detail}`);
	lines.push('');
	for (const line of verification.notEstablished) lines.push(`not established: ${line}`);
	return `${lines.join('\n')}\n`;
}

/**
 * The declarations the harness hands the child `run`, minus the two it settles.
 *
 * `--out` and `--record` are the write set, so they are declared by the harness
 * rather than forwarded twice; `--json`, `--help` and `--offline` are this
 * command's own reading, not the run's. Everything else travels unchanged,
 * because a narrowed run is not the run being scored.
 */
export function forwardedRunFlags(
	flags: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
	const settled: readonly string[] = ['--out', '--record', '--json', '--help', '--offline'];
	const booleans: readonly string[] = BOOLEAN_FLAGS['intervention-count'];
	const forwarded: string[] = [];
	for (const flag of Object.keys(flags).sort()) {
		if (settled.includes(flag)) continue;
		const values = flags[flag] ?? [];
		if (booleans.includes(flag)) {
			forwarded.push(flag);
			continue;
		}
		for (const value of values) forwarded.push(flag, value);
	}
	return Object.freeze(forwarded);
}

export type OperatorOutcome = Readonly<{
	text: string;
	json: unknown;
	exitCode: number;
}>;

/**
 * Run one operator command and return what it would print.
 *
 * A named refusal is a returned outcome carrying exit 2, not a thrown stack
 * trace: a fleet report has to be able to tally the reason an application was
 * declined, and an exception with a formatted stack is not a tally. A defect
 * still throws — an exception is the honest shape for something that broke —
 * and the caller scores it 1.
 */
export async function runOperatorCommand(
	command: OperatorCommand,
	args: readonly string[],
): Promise<OperatorOutcome> {
	try {
		return await runOperatorFlow(command, args);
	} catch (error) {
		const refusal = pipelineRefusalOf(error);
		if (refusal === null) throw error;
		const json = refusalRecord(command, refusal);
		/**
		 * Read without the parser, because the parser is itself one of the
		 * stages that can refuse. A refused run still writes its record: the
		 * refusal is the outcome the fleet report needs, not the absence of one.
		 */
		const recordIndex = args.indexOf('--record');
		await writeRecord(recordIndex < 0 ? undefined : args[recordIndex + 1], json);
		return Object.freeze({
			text: args.includes('--json') ? `${JSON.stringify(json)}\n` : renderRefusal(refusal),
			json,
			exitCode: EXIT_REFUSAL,
		});
	}
}

async function runOperatorFlow(
	command: OperatorCommand,
	args: readonly string[],
): Promise<OperatorOutcome> {
	const parsed = parseOperatorArguments(command, args);
	if (parsed.help)
		return Object.freeze({ text: operatorHelp(command), json: { help: command }, exitCode: 0 });
	const root = parsed.positional[0] ?? '.';
	const angular = {
		sourceDirectories: parsed.flags['--source-dir'],
		templateDirectories: parsed.flags['--template-dir'],
		styleSheetDirectories: parsed.flags['--style-dir'],
		/**
		 * The same `--cell` the era-cell stage reads, carried into the plan
		 * stage as the target the changeset is composed against. It is passed as
		 * the identifier rather than as a resolved cell so the resolution — and
		 * the refusal for an identifier no adapter publishes — happens inside the
		 * plan stage, where a `run` record can attribute it to the plan row.
		 */
		cellId: parsed.flags['--cell']?.[0] ?? null,
	};
	const react = { entryModule: parsed.flags['--entry']?.[0] };
	const licence: LicencePolicy = Object.freeze({
		declaredIdentifier: parsed.flags['--license']?.[0] ?? null,
	});
	const declarations: IngestDeclarations = Object.freeze({
		id: parsed.flags['--id']?.[0] ?? null,
		frontendRoot: parsed.flags['--frontend-root']?.[0] ?? null,
		revision: parsed.flags['--revision']?.[0] ?? null,
		repository: parsed.flags['--repository']?.[0] ?? null,
		ref: parsed.flags['--ref']?.[0] ?? null,
		lockfile: parsed.flags['--lockfile']?.[0] ?? null,
		licence,
	});
	const eraCellDeclarations: EraCellDeclarations = Object.freeze({
		...DEFAULT_ERA_CELL_DECLARATIONS,
		node: parsed.flags['--node']?.[0] ?? null,
		architecture: parsed.flags['--arch']?.[0] ?? null,
		cell: parsed.flags['--cell']?.[0] ?? null,
	});
	if (command === 'acquire') {
		const record = await acquireApplicationSource({
			repository: parsed.positional[0] ?? '',
			ref: parsed.flags['--ref']?.[0] ?? null,
			id: parsed.flags['--id']?.[0] ?? null,
			consentId: parsed.flags['--consent']?.[0] ?? null,
			declaredLicence: licence.declaredIdentifier,
		});
		const json = { flow: 'acquire', ...record };
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderAcquire(record),
			json,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'ingest') {
		const record = await ingestApplicationSource(root, declarations);
		const json = { flow: 'ingest', source: displayPath(root), ...record };
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderIngest(record),
			json,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'license-at-pin') {
		const frontendRoot = parsed.flags['--frontend-root']?.[0] ?? '.';
		const manifest = path.join(root, frontendRoot, 'package.json');
		const record = await readLicenceAtPin(
			root,
			(await fileExists(manifest)) ? manifest : null,
			licence,
		);
		const json = { flow: 'license-at-pin', source: displayPath(root), ...record };
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderLicenceAtPin(record),
			json,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'era-cell') {
		/**
		 * The host is read before the stage runs, so a refused run still reports
		 * what this host carries. A refusal that says only "not available" and
		 * not what was there is a refusal an operator cannot act on.
		 */
		const host = await readHostCell();
		let record: EraCellRecord;
		try {
			record = await establishEraCell(root, eraCellDeclarations, host);
		} catch (error) {
			const refusal = pipelineRefusalOf(error);
			if (refusal === null) throw error;
			record = eraCellRefused(refusal, host);
			const refused = {
				flow: 'era-cell',
				application: displayPath(root),
				...refusalRecord('era-cell', refusal),
				eraCell: record,
			};
			await writeRecord(parsed.flags['--record']?.[0], refused);
			return Object.freeze({
				text: parsed.json ? `${JSON.stringify(refused)}\n` : renderRefusal(refusal),
				json: refused,
				exitCode: EXIT_REFUSAL,
			});
		}
		const json = { flow: 'era-cell', application: displayPath(root), ...record };
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderEraCell(record),
			json,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'analyze') {
		const analysis = await analyzeApplication(root);
		const json = { flow: 'analyze', application: displayPath(root), ...analysis };
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderAnalysis(root, analysis),
			json,
			exitCode: 0,
		});
	}
	if (command === 'plan') {
		const { analysis, plan } = await planApplication({ appRoot: root, angular, react });
		const json = {
			flow: 'plan',
			application: displayPath(root),
			detected: analysis,
			plan: { ...plan, files: plan.files.map(({ source: _source, ...rest }) => rest) },
		};
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderPlan(root, plan),
			json,
			exitCode: 0,
		});
	}
	if (command === 'migrate') {
		const out = parsed.flags['--out']?.[0] as string;
		/**
		 * Admission runs first, because a licence this flow never read is a
		 * reason not to compose a lane at all. It is opt-in for the same reason
		 * install and build are: a run that did not ask for it gets a record
		 * saying so, not a record implying the source was admitted.
		 */
		const ingest =
			parsed.flags['--ingest'] === undefined
				? ingestNotRequested(
						'--ingest was not declared. The application was migrated without being admitted, and this run establishes nothing about its identity, its pinned revision, or the licence it carries.',
					)
				: await ingestApplicationSource(
						parsed.flags['--source-root']?.[0] ?? root,
						declarations,
					);
		/**
		 * The cell is established before the lane is composed and long before
		 * anything is installed, because the install runs inside the cell. A cell
		 * this host cannot provide is a refusal that arrives before a lane exists,
		 * not after a native build failed inside one.
		 */
		const eraCell =
			parsed.flags['--era-cell'] === undefined
				? eraCellNotRequested(
						'--era-cell was not declared. The lane was composed without the toolchain era it needs being determined, and this run establishes nothing about which Node line or architecture it would install inside.',
					)
				: await establishEraCell(root, eraCellDeclarations);
		const { analysis, plan } = await planApplication({ appRoot: root, angular, react });
		const applied = await applyPlan(plan, {
			appRoot: root,
			out,
			materialize: parsed.flags['--materialize'] !== undefined,
		});
		const composition = await composeLane(root, out, plan.lineage, analysis.builder);
		await writeLaneFiles(out, composition);
		const policy: InstallPolicy = Object.freeze({
			allowRemoteTarballs: parsed.flags['--allow-remote-tarballs'] !== undefined,
			allowInstallScripts: parsed.flags['--allow-install-scripts'] !== undefined,
			skipInstallScripts: parsed.flags['--skip-install-scripts'] !== undefined,
			allowPeerConflicts: parsed.flags['--allow-peer-conflicts'] !== undefined,
			allowForeignLockfile: parsed.flags['--allow-foreign-lockfile'] !== undefined,
			allowGitDependencies: parsed.flags['--allow-git-dependencies'] !== undefined,
		});
		const install =
			parsed.flags['--install'] === undefined
				? installNotRequested(
						'--install was not declared. The lane was composed and not installed, and this run establishes nothing about whether its closure resolves.',
					)
				: await runLaneInstall(
						out,
						policy,
						process.env,
						composition.composed ? 'resolve' : 'replay',
					);
		const build =
			parsed.flags['--build'] === undefined
				? buildNotRequested(
						'--build was not declared. The lane was composed and not built, and this run establishes nothing about whether it compiles or emits.',
					)
				: await runLaneBuild(out);
		/**
		 * The witness stage is last, because it is the only stage that needs an
		 * emitted lane to exist. A run that declared it without a build gets a
		 * witness of whatever the lane already carried, which is the same
		 * discipline every other opt-in stage holds: the record says what ran.
		 */
		const witness: WitnessRecord =
			parsed.flags['--witness'] === undefined
				? witnessNotRequested(
						'--witness was not declared. The lane was built and not witnessed, and this run establishes nothing about whether anything renders in it or whether any route it serves is reachable.',
					)
				: await runLaneWitness({
						application: path.basename(root),
						sourceRoot: root,
						laneBuild: path.join(out, build.outDirectory ?? 'dist'),
					});
		const json = {
			flow: 'migrate',
			outcome: 'proceeded',
			exitCode: EXIT_PROCEEDED,
			application: displayPath(root),
			lane: displayPath(out),
			engine: plan.engine,
			cell: plan.cell,
			ingest,
			eraCell,
			applied,
			/**
			 * The generated sources are not carried in the record. They are in
			 * the lane, they are digested here, and the specifier the generated
			 * configuration resolves the frozen adapter by is a path on this
			 * host — a record is evidence and evidence carries no host paths.
			 */
			laneComposition: {
				...composition,
				files: composition.files.map(({ source: _source, ...rest }) => rest),
			},
			install,
			build,
			witness,
			unhandled: Object.freeze([...plan.unhandled, ...composition.unhandled]),
			unhandledByStage: Object.freeze({
				plan: plan.unhandled,
				lane: composition.unhandled,
			}),
			declaredDifferences: Object.freeze([
				...plan.declaredDifferences,
				...composition.declaredDifferences,
			]),
		};
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json
				? `${JSON.stringify(json)}\n`
				: renderApplied(
						out,
						applied,
						composition,
						install,
						build,
						ingest,
						eraCell,
						witness,
					),
			json,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'run') {
		/**
		 * Every stage, in order, with the declarations each stage's own command
		 * would give it. The stage switches `migrate` carries are absent because
		 * there is nothing to opt into here, and the install policies are
		 * forwarded exactly as declared — an undeclared policy stays the stage's
		 * own refusal rather than becoming an allowance this flow granted.
		 */
		const runDeclarations: RunDeclarations = Object.freeze({
			appRoot: root,
			out: parsed.flags['--out']?.[0] as string,
			sourceRoot: parsed.flags['--source-root']?.[0] ?? root,
			/**
			 * Materialized unless the caller opts out. `run` runs every stage,
			 * and the stages after `apply` read the lane as a tree — the install
			 * stage looks for the application's own lockfile there and the build
			 * stage compiles its sources. A changeset lane carries neither, so a
			 * composition-only default made every `run` refuse at install for a
			 * reason that was an artifact of the lane shape rather than a reading
			 * of the application. `--compose-only` still asks for that lane.
			 */
			materialize: parsed.flags['--compose-only'] === undefined,
			dryRun: parsed.flags['--dry-run'] !== undefined,
			ingest: declarations,
			licence,
			eraCell: eraCellDeclarations,
			angular,
			react,
			install: Object.freeze({
				allowRemoteTarballs: parsed.flags['--allow-remote-tarballs'] !== undefined,
				allowInstallScripts: parsed.flags['--allow-install-scripts'] !== undefined,
				skipInstallScripts: parsed.flags['--skip-install-scripts'] !== undefined,
				allowPeerConflicts: parsed.flags['--allow-peer-conflicts'] !== undefined,
				allowForeignLockfile: parsed.flags['--allow-foreign-lockfile'] !== undefined,
				allowGitDependencies: parsed.flags['--allow-git-dependencies'] !== undefined,
			}),
			flags: parsed.flags,
		});
		const record = await runFullPipeline(runDeclarations);
		await writeRecord(parsed.flags['--record']?.[0], record);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(record)}\n` : renderRun(record),
			json: record,
			exitCode: record.exitCode,
		});
	}
	if (command === 'intervention-count') {
		/**
		 * The harness forwards every declaration `run` owns and adds none of its
		 * own beyond where the two records land. What it counts has to be the run
		 * an operator would have launched.
		 */
		const out = parsed.flags['--out']?.[0] as string;
		const runRecord = parsed.flags['--record']?.[0] ?? `${out}.run-record.json`;
		const forwarded = forwardedRunFlags(parsed.flags);
		const record = await countInterventions({
			appRoot: root,
			out,
			runRecord,
			root: process.cwd(),
			evidencePaths: Object.freeze([]),
			attempts: Object.freeze([
				runArgvFor(cliEntryPath(), { appRoot: root, out, runRecord }, forwarded),
			]),
			stageBudgetMs: DEFAULT_STAGE_BUDGET_MS,
		});
		await writeInterventionRecord(runRecord, record);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(record)}\n` : renderInterventionCount(record),
			json: record,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'batch') {
		/**
		 * The fleet loop invokes this same command surface, once per application,
		 * through `runOperatorCommand` — so a refusal arrives as the returned
		 * outcome it is, exit code and record and all, rather than as an exception
		 * this loop would have to interpret.
		 */
		const laneRoot = parsed.flags['--out']?.[0] as string;
		const own: readonly string[] = ['--apps', '--publish', '--name'];
		const forwardable: Record<string, readonly string[]> = {};
		for (const flag of Object.keys(parsed.flags))
			if (!own.includes(flag)) forwardable[flag] = parsed.flags[flag] ?? [];
		const applications = await readFleet(parsed.flags['--apps'] ?? []);
		const result = await runFleetBatch(
			{
				applications,
				laneRoot,
				forwarded: forwardedRunFlags(forwardable),
				name: parsed.flags['--name']?.[0] ?? defaultBatchName(),
				publish: parsed.flags['--publish'] !== undefined,
				root: process.cwd(),
				appsSource: Object.freeze([...(parsed.flags['--apps'] ?? [])]),
			},
			{
				runHarness: async (invocation) =>
					await runOperatorCommand('intervention-count', invocation.argv),
				cliEntry: cliEntryPath(),
			},
		);
		await writeRecord(parsed.flags['--record']?.[0], result.summary);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(result.summary)}\n` : renderBatch(result),
			json: result.summary,
			exitCode: result.exitCode,
		});
	}
	if (command === 'refusal-census') {
		const census = await buildRefusalCensus();
		const target = parsed.flags['--out']?.[0] ?? REFUSAL_CENSUS_FILE;
		const verifyOnly = parsed.flags['--verify-only'] !== undefined;
		const derived = `${JSON.stringify(census, null, '\t')}\n`;
		const published = (await fileExists(path.resolve(target)))
			? await readFile(path.resolve(target), 'utf8')
			: null;
		const matches = published === derived;
		if (!verifyOnly) await writeRefusalCensus(census, target);
		const json = {
			flow: 'refusal-census',
			file: target,
			verifyOnly,
			matchesPublished: matches,
			published: published !== null,
			census,
		};
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json
				? `${JSON.stringify(json)}\n`
				: renderCensus(census, verifyOnly ? null : target),
			json,
			exitCode: verifyOnly && !matches ? 1 : EXIT_PROCEEDED,
		});
	}
	if (command === 'witness-synthesize') {
		const synthesis = await synthesizeWitnessJourneys({
			root,
			laneUrl: parsed.flags['--lane-url']?.[0],
			crawlBounds: {
				maxDepth: readCrawlBound(
					'--max-depth',
					parsed.flags['--max-depth']?.[0],
					CRAWL_DEFAULT_BOUNDS.maxDepth,
				),
				maxRoutes: readCrawlBound(
					'--max-routes',
					parsed.flags['--max-routes']?.[0],
					CRAWL_DEFAULT_BOUNDS.maxRoutes,
				),
				requestTimeoutMs: CRAWL_DEFAULT_BOUNDS.requestTimeoutMs,
			},
		});
		const target = parsed.flags['--out']?.[0];
		await writeRecord(target, synthesis);
		await writeRecord(parsed.flags['--record']?.[0], synthesis);
		return Object.freeze({
			text: parsed.json
				? `${JSON.stringify(synthesis)}\n`
				: renderWitnessSynthesis(synthesis, target ?? null),
			json: synthesis,
			exitCode: EXIT_PROCEEDED,
		});
	}
	if (command === 'verify') {
		const verification = await runOperatorVerification({
			receipts: parsed.flags['--receipt'],
			trustDir: parsed.flags['--trust-dir']?.[0],
		});
		const json = { flow: 'verify', ...verification };
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderVerification(verification),
			json,
			exitCode: verification.result === 'pass' ? 0 : 1,
		});
	}
	const reading = await readSupportedMatrix({ trustDir: parsed.flags['--trust-dir']?.[0] });
	const rendered = renderSupportedMatrix(reading);
	const json = {
		flow: 'supported-matrix',
		source: reading.source,
		trustDigest: reading.trustDigest,
		certification: reading.certification,
		supportMatrix: reading.matrix,
	};
	await writeRecord(parsed.flags['--record']?.[0], json);
	return Object.freeze({
		text: parsed.json ? `${JSON.stringify(json)}\n` : rendered,
		json,
		exitCode: 0,
	});
}
