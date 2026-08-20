/**
 * The offline-faithful rebuild of the `angular-tiny-translator-v0-12-0`
 * migrated lane.
 *
 * u21 read the emitted `dist-13/index.html` and found an `@font-face` rule that
 * exists in no input: the Angular 16 browser builder's font inliner had gone to
 * `fonts.googleapis.com` during the build and pasted the answer into the
 * document. That is a build-time third-party request nobody declared, and it
 * makes the emitted bytes a property of what a font host served on the build
 * day. The capability that turns it off is landed in `@versionless/angular`;
 * this driver applies it to the staged workspace and rebuilds the lane.
 *
 * The driver measures rather than asserts. Every build it runs — including the
 * control it runs BEFORE applying the capability — runs under an in-process
 * egress guard that refuses and records any connection to a non-loopback
 * address. The control is the point: a build of the workspace as u19k left it
 * is expected to reach for the font host and to fail when it cannot, which is
 * what makes the green build afterwards evidence of something. A control that
 * came back green would mean the fetch was being served from somewhere and this
 * whole round would be measuring nothing.
 *
 * Nothing about fonts, hosts or this application is decided here. Which targets
 * carry the option and what value it takes is read out of the capability, whose
 * only inputs are the builder name and the shape of the declared `optimization`
 * value.
 */

import { readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import * as path from 'pathe';
import {
	builderInlinesFonts,
	fontInliningDifference,
	fontInliningDisabled,
	ANGULAR_16_BROWSER_CELL,
} from '../../../frameworks/angular/src/index.ts';
import { APPLIED_TREE, STAGE_DIRECTORY } from './angular-tiny-translator-apply-run.ts';

export const UNIT = 'lrapr-t006/u22-tiny-translator-offline-rebuild';
/** The output roots this round emits: the canonical one and its repeat. */
export const CANONICAL_ROOT = 'dist-15';
export const REPEATED_ROOT = 'dist-16';
/** The control build, run before the capability is applied and expected red. */
export const CONTROL_ROOT = 'dist-offline-control';
/** The Angular 16 cell's Node runtime, already materialised in this checkout. */
const NODE_BIN = path.join(
	path.resolve(import.meta.dirname, '../../../..'),
	'.versionless/cache/angular-jira-clone-runtime/node-v16.20.2-darwin-arm64/bin',
);

/**
 * The egress guard, written beside the stage tree and preloaded into every
 * build this driver runs.
 *
 * It patches the two places a Node process can leave the machine from — the
 * socket connect that every `http`, `https` and `tls` client ends up at, and
 * the DNS lookup that precedes it — records every attempt with its host and
 * port to a JSON-lines file, and then refuses the ones that are not loopback.
 * Recording before refusing is what makes the file evidence: a build that made
 * no attempt and a build whose attempt was refused are different facts, and a
 * guard that only refused could not tell them apart.
 *
 * The guard is process-scoped, exactly like the Witness locality claim. It
 * establishes what THIS process attempted; it does not establish that the
 * machine was offline.
 */
export const EGRESS_GUARD_SOURCE = `'use strict';
const fs = require('node:fs');
const net = require('node:net');
const dns = require('node:dns');
const log = process.env.VERSIONLESS_EGRESS_LOG;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost', '0.0.0.0', '', undefined, null]);
const record = (kind, host, port) => {
  fs.appendFileSync(log, JSON.stringify({ kind, host: String(host), port: port ?? null }) + '\\n');
};
const local = (host) => LOOPBACK.has(host) || String(host).startsWith('127.');
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0];
  const options = typeof first === 'object' && first !== null ? first : { port: first, host: args[1] };
  const host = options.host ?? options.path ?? 'localhost';
  if (options.path === undefined && !local(host)) {
    record('socket-connect', host, options.port);
    throw new Error('VERSIONLESS_EGRESS_REFUSED ' + String(host) + ':' + String(options.port));
  }
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (hostname, ...rest) {
  if (!local(hostname)) {
    record('dns-lookup', hostname, null);
    const callback = rest[rest.length - 1];
    const error = new Error('VERSIONLESS_EGRESS_REFUSED ' + String(hostname));
    if (typeof callback === 'function') { callback(error); return; }
    throw error;
  }
  return lookup.call(dns, hostname, ...rest);
};
`;

export type EgressAttempt = Readonly<{ kind: string; host: string; port: number | null }>;

export type BuildReading = Readonly<{
	name: string;
	command: string;
	outputRoot: string;
	exitStatus: number;
	bundleLines: number;
	egressAttempts: readonly EgressAttempt[];
	failure: string | null;
}>;

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
	const command = `npx ng build --configuration production --output-path ../${outputRoot}`;
	const { code, stdout, stderr } = await new Promise<{
		code: number;
		stdout: string;
		stderr: string;
	}>((settle, fail) => {
		let out = '';
		let err = '';
		const child = spawn(
			'npx',
			['ng', 'build', '--configuration', 'production', '--output-path', `../${outputRoot}`],
			{
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
			},
		);
		child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')));
		child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')));
		child.on('error', fail);
		child.on('close', (status) => settle({ code: status ?? -1, stdout: out, stderr: err }));
	});
	await writeFile(path.join(STAGE_DIRECTORY, `${name}.exit`), `${String(code)}\n`);
	await writeFile(path.join(STAGE_DIRECTORY, `${name}.stdout.log`), stdout);
	await writeFile(path.join(STAGE_DIRECTORY, `${name}.stderr.log`), stderr);
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

/**
 * One site the capability rewrote. `from` is null when the site declared no
 * `optimization` at all, which is a different fact from declaring `null`: an
 * absent option is the schema's `true`, and it is the reason the base options
 * are written rather than left alone.
 */
export type FontInliningSite = Readonly<{ at: string; from: string | null; to: string }>;

export type WorkspaceApplication = Readonly<{
	workspace: string;
	targetsRead: number;
	inliningTargets: number;
	sites: readonly FontInliningSite[];
	declaredDifferences: readonly string[];
	changed: boolean;
}>;

type Json = Readonly<Record<string, unknown>>;

const objectAt = (value: unknown): Json | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;

/**
 * Apply the font-inlining-disable capability to the staged workspace, exactly
 * as the landed workspace migration applies it.
 *
 * Base options are written even when they declare no `optimization`, because an
 * absent option is the schema's `true` and therefore inlines; a named
 * configuration is only rewritten when it declares the option itself, because
 * writing one into a configuration that inherits is a change to what that
 * configuration means. Both rules are the capability's, not this driver's.
 *
 * The tree is a parameter with this lane's tree as its default, because the
 * defect the capability answers is a builder default rather than a property of
 * any application: every migrated Angular 16 lane on the u21 rebuild list needs
 * exactly this application performed against its own workspace, and a second
 * copy of it would be a second thing to keep honest.
 */
export async function applyFontInliningDisable(
	tree: string = APPLIED_TREE,
): Promise<WorkspaceApplication> {
	const file = path.join(tree, 'angular.json');
	const source = await readFile(file, 'utf8');
	const workspace = JSON.parse(source) as Json;
	const sites: FontInliningSite[] = [];
	const declaredDifferences: string[] = [];
	let targetsRead = 0;
	let inliningTargets = 0;
	const projects = objectAt(workspace['projects']) ?? {};
	for (const [projectName, projectValue] of Object.entries(projects)) {
		const architect = objectAt(objectAt(projectValue)?.['architect']);
		if (architect === null) continue;
		for (const [targetName, targetValue] of Object.entries(architect)) {
			const target = objectAt(targetValue);
			if (target === null) continue;
			targetsRead += 1;
			const builder = target['builder'];
			if (typeof builder !== 'string' || !builderInlinesFonts(builder)) continue;
			inliningTargets += 1;
			const prefix = `projects.${projectName}.architect.${targetName}`;
			const options = objectAt(target['options']);
			if (options !== null) {
				const declared = options['optimization'];
				const disabled = fontInliningDisabled(declared);
				if (disabled !== null) {
					(options as Record<string, unknown>)['optimization'] = disabled;
					sites.push({
						at: `${prefix}.options.optimization`,
						from: declared === undefined ? null : JSON.stringify(declared),
						to: JSON.stringify(disabled),
					});
					declaredDifferences.push(
						fontInliningDifference(
							`${prefix}.options.optimization`,
							ANGULAR_16_BROWSER_CELL,
						),
					);
				}
			}
			const configurations = objectAt(target['configurations']);
			if (configurations === null) continue;
			for (const [name, value] of Object.entries(configurations)) {
				const configuration = objectAt(value);
				if (configuration === null || !('optimization' in configuration)) continue;
				const declared = configuration['optimization'];
				const disabled = fontInliningDisabled(declared);
				if (disabled === null) continue;
				(configuration as Record<string, unknown>)['optimization'] = disabled;
				sites.push({
					at: `${prefix}.configurations.${name}.optimization`,
					from: JSON.stringify(declared),
					to: JSON.stringify(disabled),
				});
				declaredDifferences.push(
					fontInliningDifference(
						`${prefix}.configurations.${name}.optimization`,
						ANGULAR_16_BROWSER_CELL,
					),
				);
			}
		}
	}
	const next = `${JSON.stringify(workspace, null, 2)}\n`;
	const changed = next !== source;
	if (changed) await writeFile(file, next);
	return Object.freeze({
		workspace: 'angular.json',
		targetsRead,
		inliningTargets,
		sites: Object.freeze(sites),
		declaredDifferences: Object.freeze(declaredDifferences),
		changed,
	});
}

export type FontRound = Readonly<{
	control: BuildReading;
	application: WorkspaceApplication;
	builds: readonly BuildReading[];
}>;

/**
 * The whole round, in the only order that makes it evidence: control first,
 * against the workspace as u19k left it, then the capability, then the two
 * builds the lane publishes.
 */
export async function runFontRound(): Promise<FontRound> {
	const control = await guardedBuild('build-offline-control', CONTROL_ROOT);
	const application = await applyFontInliningDisable();
	const first = await guardedBuild('build-15', CANONICAL_ROOT);
	const second = await guardedBuild('build-16', REPEATED_ROOT);
	return Object.freeze({ control, application, builds: Object.freeze([first, second]) });
}

export async function main(): Promise<void> {
	const round = await runFontRound();
	await writeFile(
		path.join(STAGE_DIRECTORY, 'font-round.json'),
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

if (process.argv[1]?.endsWith('angular-tiny-translator-u22-font-run.ts'))
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
