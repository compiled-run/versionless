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

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'pathe';
import { analyzeApplication, type ApplicationAnalysis } from './analyze.ts';
import { applyPlan, type AppliedChangeset } from './apply.ts';
import { readSupportedMatrix, renderSupportedMatrix } from './matrix.ts';
import { planApplication, type OperatorPlan } from './plan.ts';
import { runOperatorVerification, type OperatorVerification } from './verify.ts';

export const OPERATOR_COMMANDS = [
	'analyze',
	'plan',
	'migrate',
	'verify',
	'supported-matrix',
] as const;

export type OperatorCommand = (typeof OPERATOR_COMMANDS)[number];

export function isOperatorCommand(value: string | undefined): value is OperatorCommand {
	return (OPERATOR_COMMANDS as readonly string[]).includes(value ?? '');
}

/** Flags that take a value, per command. A repeatable flag collects. */
const VALUE_FLAGS: Readonly<Record<OperatorCommand, readonly string[]>> = Object.freeze({
	analyze: Object.freeze(['--record']),
	plan: Object.freeze(['--source-dir', '--template-dir', '--style-dir', '--entry', '--record']),
	migrate: Object.freeze([
		'--source-dir',
		'--template-dir',
		'--style-dir',
		'--entry',
		'--record',
		'--out',
	]),
	verify: Object.freeze(['--receipt', '--trust-dir', '--record']),
	'supported-matrix': Object.freeze(['--trust-dir', '--record']),
});

/** Flags that take no value, per command. `--offline` is accepted everywhere. */
const BOOLEAN_FLAGS: Readonly<Record<OperatorCommand, readonly string[]>> = Object.freeze({
	analyze: Object.freeze([]),
	plan: Object.freeze([]),
	migrate: Object.freeze(['--materialize']),
	verify: Object.freeze([]),
	'supported-matrix': Object.freeze([]),
});

const UNIVERSAL_BOOLEAN_FLAGS: readonly string[] = Object.freeze(['--json', '--offline', '--help']);

/** Commands that take exactly one positional application root. */
const TAKES_APPLICATION_ROOT: readonly OperatorCommand[] = Object.freeze([
	'analyze',
	'plan',
	'migrate',
]);

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
			throw new Error(
				`${command}: unknown flag ${arg}. Accepted flags: ${[...valueFlags, ...booleanFlags].sort().join(', ')}`,
			);
		const value = args[index + 1];
		if (value === undefined || value.startsWith('--'))
			throw new Error(`${command}: ${arg} requires a value`);
		flags[arg] = [...(flags[arg] ?? []), value];
		index += 1;
	}
	const help = flags['--help'] !== undefined;
	if (!help) {
		const expected = TAKES_APPLICATION_ROOT.includes(command) ? 1 : 0;
		if (positional.length !== expected)
			throw new Error(
				expected === 1
					? `${command}: exactly one application root is required, received ${String(positional.length)}`
					: `${command}: takes no positional arguments, received ${String(positional.length)}`,
			);
		for (const flag of ['--out', '--entry', '--trust-dir'])
			if ((flags[flag]?.length ?? 0) > 1)
				throw new Error(`${command}: ${flag} may be given at most once`);
		if (command === 'migrate' && flags['--out'] === undefined)
			throw new Error('migrate: --out <dir> is required; this flow never writes in place');
	}
	return Object.freeze({
		positional: Object.freeze(positional),
		flags: Object.freeze(flags),
		json: flags['--json'] !== undefined,
		help,
	});
}

const HELP: Readonly<Record<OperatorCommand, string>> = Object.freeze({
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
		'                 [--style-dir <dir>]... [--entry <module>] [--record <file>] [--json]',
		'',
		'Compose the changeset the frozen adapter produces for this tree and report it',
		'without writing anything into the tree: files changed, files removed, unhandled',
		'findings, and the differences the migration declares it no longer carries.',
		'',
		'--source-dir overrides the Angular source directories the workspace declares, for a',
		'workspace whose compilation unit reaches past its own sourceRoot. Capabilities gated',
		'on a compiler diagnostic or an installed closure stand down here; the plan reports',
		'which readings it supplied.',
	].join('\n'),
	migrate: [
		'versionless migrate <app-root> --out <dir> [--materialize] [--record <file>] [--json]',
		'',
		'Apply the composed changeset into a separate output lane. The lane may not be inside',
		'the application, the application may not be inside the lane, and a lane that already',
		'carries files is refused: this flow never writes in place.',
		'',
		'By default the lane carries only the files the changeset rewrites. --materialize',
		'copies the application into the lane first (node_modules and .git excluded), so the',
		'lane is a whole tree.',
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
});

export function operatorHelp(command: OperatorCommand): string {
	return `${HELP[command]}\n`;
}

/** A path as a reader should see it: relative to the working directory. */
export function displayPath(value: string): string {
	const relative = path.relative(process.cwd(), path.resolve(value));
	return relative === '' ? '.' : relative;
}

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

function renderApplied(out: string, applied: AppliedChangeset): string {
	const lines = [
		`lane: ${displayPath(out)} (${applied.mode})`,
		`files copied: ${String(applied.copied)}; files written: ${String(applied.written.length)}; files the changeset removes: ${String(applied.removed.length)}`,
		'',
	];
	for (const file of applied.written)
		lines.push(`  ${file.path} ${file.sha256After.slice(0, 12)}`);
	for (const file of applied.removed) lines.push(`  removed ${file}`);
	lines.push('');
	for (const line of applied.notEstablished) lines.push(`not established: ${line}`);
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

export type OperatorOutcome = Readonly<{
	text: string;
	json: unknown;
	exitCode: number;
}>;

async function writeRecord(file: string | undefined, value: unknown): Promise<void> {
	if (file === undefined) return;
	await mkdir(path.dirname(path.resolve(file)), { recursive: true });
	await writeFile(path.resolve(file), `${JSON.stringify(value, null, '\t')}\n`);
}

/** Run one operator command and return what it would print. */
export async function runOperatorCommand(
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
	};
	const react = { entryModule: parsed.flags['--entry']?.[0] };
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
		const { plan } = await planApplication({ appRoot: root, angular, react });
		const applied = await applyPlan(plan, {
			appRoot: root,
			out,
			materialize: parsed.flags['--materialize'] !== undefined,
		});
		const json = {
			flow: 'migrate',
			application: displayPath(root),
			lane: displayPath(out),
			engine: plan.engine,
			cell: plan.cell,
			applied,
			unhandled: plan.unhandled,
			declaredDifferences: plan.declaredDifferences,
		};
		await writeRecord(parsed.flags['--record']?.[0], json);
		return Object.freeze({
			text: parsed.json ? `${JSON.stringify(json)}\n` : renderApplied(out, applied),
			json,
			exitCode: 0,
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
