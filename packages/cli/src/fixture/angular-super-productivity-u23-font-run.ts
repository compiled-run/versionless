/**
 * The offline-faithful rebuild of the `angular-super-productivity-v2-13-15`
 * migrated lane.
 *
 * u21 read the emitted `app/dist/index.html` of the lane u18j published and
 * found forty-five `@font-face` rules that exist in no input: the Angular 16
 * browser builder's font inliner had gone to `fonts.googleapis.com` during the
 * build — for the Roboto stylesheet this application's own `index.html` links —
 * and pasted the answer into the document. That is a build-time third-party
 * request nobody declared, and it makes the emitted bytes a property of what a
 * font host served on the build day. The capability that turns it off is landed
 * in `@versionless/angular`; this driver applies it to the staged workspace and
 * rebuilds the lane.
 *
 * The driver measures rather than asserts. Every build it runs — including the
 * control it runs BEFORE applying the capability — runs under the in-process
 * egress guard u22 wrote, which refuses and records any connection to a
 * non-loopback address. The control is the point: a build of the workspace as
 * u18j left it is expected to reach for the font host and to fail when it
 * cannot, which is what makes the green build afterwards evidence of something.
 * A control that came back green would mean the fetch was being served from
 * somewhere and this whole round would be measuring nothing.
 *
 * Nothing about fonts, hosts or this application is decided here. Which targets
 * carry the option and what value it takes is read out of the capability, whose
 * only inputs are the builder name and the shape of the declared `optimization`
 * value; the guard and the workspace application are u22's, run against this
 * lane's tree rather than copied.
 */

import { readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import * as path from 'pathe';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-super-productivity-apply-run.ts';
import {
	applyFontInliningDisable,
	EGRESS_GUARD_SOURCE,
	type BuildReading,
	type EgressAttempt,
	type WorkspaceApplication,
} from './angular-tiny-translator-u22-font-run.ts';

export const UNIT = 'lrapr-t006/u23-super-productivity-offline-rebuild';
/** The output roots this round emits: the canonical one and its repeat. */
export const CANONICAL_ROOT = 'dist-23';
export const REPEATED_ROOT = 'dist-24';
/** The control build, run before the capability is applied and expected red. */
export const CONTROL_ROOT = 'dist-offline-control';
/** The Angular 16 cell's Node runtime, already materialised in this checkout. */
const NODE_BIN = path.join(
	path.resolve(import.meta.dirname, '../../../..'),
	'.versionless/cache/angular-jira-clone-runtime/node-v16.20.2-darwin-arm64/bin',
);

/**
 * The build this cell's records have always run: the repository's own
 * `buildFrontend` heap size, the modern configuration name, and the CLI entry
 * point invoked through the era runtime rather than through `npx`.
 */
const BUILD_ARGUMENTS: readonly string[] = Object.freeze([
	'--max_old_space_size=4096',
	'./node_modules/@angular/cli/bin/ng.js',
	'build',
	'--configuration',
	'production',
]);

/** Every non-loopback attempt one guarded build made, in the order it made them. */
async function readEgress(logFile: string): Promise<readonly EgressAttempt[]> {
	const text = await readFile(logFile, 'utf8').catch(() => '');
	return Object.freeze(
		text
			.split('\n')
			.filter((line) => line.length > 0)
			.map((line) => JSON.parse(line) as EgressAttempt),
	);
}

/** The one line of a build log that says why an inlining build died. */
function failureLine(log: string): string | null {
	const line = log.split('\n').find((entry) => entry.includes('Inlining of fonts failed'));
	return line === undefined ? null : line.trim();
}

/**
 * Run one production build under the egress guard, into a cleaned output root.
 *
 * The output root is removed first so a build that emits nothing cannot be read
 * as a build that emitted what the previous one left behind, and the guard log
 * is removed with it so each reading belongs to exactly one build.
 */
export async function guardedBuild(name: string, outputRoot: string): Promise<BuildReading> {
	const guard = path.join(STAGE_DIRECTORY, 'egress-guard.cjs');
	const egressLog = path.join(STAGE_DIRECTORY, `${name}.egress.jsonl`);
	await writeFile(guard, EGRESS_GUARD_SOURCE);
	await rm(egressLog, { force: true });
	await writeFile(egressLog, '');
	await rm(path.join(STAGE_DIRECTORY, outputRoot), { recursive: true, force: true });
	const argv = [...BUILD_ARGUMENTS, '--output-path', `../${outputRoot}`];
	const command = `node ${argv.join(' ')}`;
	const { code, stdout, stderr } = await new Promise<{
		code: number;
		stdout: string;
		stderr: string;
	}>((settle, fail) => {
		let out = '';
		let err = '';
		const child = spawn(path.join(NODE_BIN, 'node'), argv, {
			cwd: APPLIED_TREE,
			env: {
				...process.env,
				PATH: `${NODE_BIN}:${process.env['PATH'] ?? ''}`,
				NODE_OPTIONS: `--require ${guard}`,
				VERSIONLESS_EGRESS_LOG: egressLog,
				VERSIONLESS_NETWORK_MODE: 'offline',
				NPM_CONFIG_OFFLINE: 'true',
				NG_CLI_ANALYTICS: 'false',
			},
		});
		child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
		child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')));
		child.on('error', fail);
		child.on('close', (status) => settle({ code: status ?? -1, stdout: out, stderr: err }));
	});
	await writeFile(path.join(STAGE_DIRECTORY, `${name}.exit`), `${String(code)}\n`);
	await writeFile(path.join(STAGE_DIRECTORY, `${name}.log`), `${stdout}\n${stderr}`);
	return Object.freeze({
		name,
		command,
		outputRoot,
		exitStatus: code,
		bundleLines: stdout.split('\n').filter((line) => line.includes('.js')).length,
		egressAttempts: await readEgress(egressLog),
		failure: failureLine(`${stdout}\n${stderr}`),
	});
}

export type FontRound = Readonly<{
	control: BuildReading;
	application: WorkspaceApplication;
	builds: readonly BuildReading[];
}>;

/**
 * The whole round, in the only order that makes it evidence: control first,
 * against the workspace as u18j left it, then the capability, then the two
 * builds the lane publishes.
 */
export async function runFontRound(): Promise<FontRound> {
	const control = await guardedBuild('build-offline-control', CONTROL_ROOT);
	const application = await applyFontInliningDisable(APPLIED_TREE);
	const first = await guardedBuild('build-23', CANONICAL_ROOT);
	const second = await guardedBuild('build-24', REPEATED_ROOT);
	return Object.freeze({ control, application, builds: Object.freeze([first, second]) });
}

export async function main(): Promise<void> {
	const round = await runFontRound();
	await writeFile(
		path.join(STAGE_DIRECTORY, 'u23-font-round.json'),
		`${JSON.stringify(round, null, '\t')}\n`,
	);
	process.stdout.write(
		`control exit ${String(round.control.exitStatus)}, ` +
			`${String(round.control.egressAttempts.length)} egress attempt(s)\n`,
	);
	for (const site of round.application.sites) process.stdout.write(`applied: ${site.at}\n`);
	for (const build of round.builds)
		process.stdout.write(
			`${build.name} exit ${String(build.exitStatus)}, ` +
				`${String(build.egressAttempts.length)} egress attempt(s)\n`,
		);
}

if (process.argv[1]?.endsWith('angular-super-productivity-u23-font-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
