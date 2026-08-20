/**
 * T047 — the runtime a migrated lane is installed and built in is the
 * **target's**, not the source era's.
 *
 * Four shapes, each read off a run this repository actually published, and each
 * asserted through the same functions the pipeline composes rather than through
 * a re-implementation of them:
 *
 * - `react-your-spotify-1-5-0`: the source tree declares `FROM node:16-alpine`,
 *   the composed lane declares Vite 8, and the host is modern. The lane must be
 *   built at the host, and the era reading must be recorded beside it — that is
 *   the divergence whose invisibility produced an unnamed
 *   `ReferenceError: CustomEvent is not defined` at commit 8f79c30.
 * - `angular2-hn`: the plan composes against `angular-13.4.0`, whose published
 *   `nodeLine` is 16.20.2. The runtime must be provisioned for *that* rather
 *   than for what the tree declares — the two agree here, and the point of the
 *   assertion is that the agreement is now a consequence rather than a
 *   coincidence.
 * - `react-cra-redux-1a06509b`: no era in the tree at all. The row must be the
 *   row it was: host, `running-process`, and no divergence field.
 * - A host below the target's requirement: a named refusal, never an attempt.
 *
 * Every runtime here is a shell shim in a temporary directory. Nothing is
 * fetched and no network is opened.
 */

import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'pathe';
import { afterAll, describe, expect, it } from 'vitest';
import { runLaneBuild } from '../src/operator/build.ts';
import {
	RUNNING_PROCESS,
	RUNNING_PROCESS_LOCATION,
	type HostCellReading,
	type InstalledRuntime,
} from '../src/operator/era-cell.ts';
import {
	nodeVersionAdmittedByVite8,
	planTargetLaneRuntime,
	readLaneToolchainRequirement,
	type EraRuntimeReading,
} from '../src/operator/install.ts';
import { LANE_BUILD_DIRECTORY } from '../src/operator/lane.ts';
import { pipelineRefusalOf } from '../src/operator/refusals.ts';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'vl-target-runtime-'));
	directories.push(directory);
	return directory;
}

/** A runtime tree carrying `bin/node`, the way the workspace cache carries one. */
async function shimRuntime(version: string): Promise<string> {
	const directory = await temporaryDirectory();
	await mkdir(path.join(directory, 'bin'), { recursive: true });
	const shim = path.join(directory, 'bin', 'node');
	await writeFile(
		shim,
		[
			'#!/bin/sh',
			`if [ "$1" = "-v" ]; then echo "${version}"; exit 0; fi`,
			`exec ${JSON.stringify(process.execPath)} "$@"`,
			'',
		].join('\n'),
	);
	await chmod(shim, 0o755);
	return directory;
}

/** A lane whose manifest declares a toolchain and whose build script emits two files. */
async function lane(viteRange: string | null): Promise<string> {
	const directory = await temporaryDirectory();
	await mkdir(path.join(directory, 'node_modules'), { recursive: true });
	await writeFile(path.join(directory, 'vite.config.ts'), '\n');
	await writeFile(
		path.join(directory, 'package.json'),
		`${JSON.stringify(
			{
				name: 'lane',
				version: '0.0.0',
				private: true,
				...(viteRange === null ? {} : { devDependencies: { vite: viteRange } }),
				scripts: { build: 'node build.mjs' },
			},
			null,
			'\t',
		)}\n`,
	);
	await writeFile(
		path.join(directory, 'build.mjs'),
		[
			"import { mkdir, writeFile } from 'node:fs/promises';",
			`const out = ${JSON.stringify(LANE_BUILD_DIRECTORY)};`,
			'await mkdir(out, { recursive: true });',
			"await writeFile(`${out}/index.html`, '<!doctype html>\\n');",
			"await writeFile(`${out}/app.js`, 'export {};\\n');",
			'',
		].join('\n'),
	);
	return directory;
}

const runtimeOf = (version: string, supplier: string, location: string): InstalledRuntime =>
	Object.freeze({
		version,
		major: Number.parseInt(version.replace('v', '').split('.')[0] as string, 10),
		platform: 'darwin',
		architecture: 'arm64',
		supplier,
		location,
	});

/** A host reading of the shape `readHostCell` returns, with no disk read. */
const hostReading = (
	runningVersion: string,
	installed: readonly InstalledRuntime[] = [],
): HostCellReading =>
	Object.freeze({
		platform: 'darwin',
		architecture: 'arm64',
		runningNodeVersion: runningVersion,
		runningNodeMajor: Number.parseInt(
			runningVersion.replace('v', '').split('.')[0] as string,
			10,
		),
		suppliers: Object.freeze([RUNNING_PROCESS, 'workspace-runtime-cache']),
		installed: Object.freeze([
			runtimeOf(runningVersion, RUNNING_PROCESS, RUNNING_PROCESS_LOCATION),
			...installed,
		]),
	});

/** The era-cell reading `react-your-spotify-1-5-0` published, verbatim. */
const yourSpotifyEra = (location: string): EraRuntimeReading =>
	Object.freeze({
		provision: Object.freeze({
			supplier: 'workspace-runtime-cache',
			version: 'v16.20.2',
			location,
		}),
		architecture: 'arm64',
		outcome: 'read' as const,
		declared: 'node:16-alpine',
		readFrom: 'Dockerfile*#FROM a node image',
	});

/** The era-cell reading `react-cra-redux-1a06509b` published: no era at all. */
const craReduxEra = (runningVersion: string): EraRuntimeReading =>
	Object.freeze({
		provision: Object.freeze({
			supplier: RUNNING_PROCESS,
			version: runningVersion,
			location: RUNNING_PROCESS_LOCATION,
		}),
		architecture: 'arm64',
		outcome: 'not-read' as const,
		declared: null,
		readFrom: null,
	});

describe('the migrated lane runs in the target’s runtime', () => {
	afterAll(async () => {
		for (const directory of directories) await rm(directory, { recursive: true, force: true });
	});

	it('reads the Vite 8 requirement off the lane manifest, and invents none for any other major', async () => {
		expect(await readLaneToolchainRequirement(await lane('8.0.16'))).toMatchObject({
			toolchain: 'vite@8',
			declared: '8.0.16',
			readFrom: 'the lane manifest package.json#devDependencies.vite',
			admits: 'Node 20.19+ or 22.12+',
		});
		/**
		 * The measurement this repository holds is Vite 8's. A major nobody here
		 * measured yields no requirement rather than an extrapolated one: a table
		 * written from memory would be an invention carrying a reading's
		 * authority.
		 */
		expect(await readLaneToolchainRequirement(await lane('^4.5.0'))).toBeNull();
		expect(await readLaneToolchainRequirement(await lane('^9.0.0'))).toBeNull();
		expect(await readLaneToolchainRequirement(await lane(null))).toBeNull();
	});

	it('reads the two Node lines Vite 8 names, exactly as it names them', () => {
		/** `20.19+ or 22.12+`, read as literally as the toolchain writes it. */
		expect(nodeVersionAdmittedByVite8('v16.20.2')).toBe(false);
		expect(nodeVersionAdmittedByVite8('v20.18.3')).toBe(false);
		expect(nodeVersionAdmittedByVite8('v20.19.0')).toBe(true);
		expect(nodeVersionAdmittedByVite8('v21.7.3')).toBe(false);
		expect(nodeVersionAdmittedByVite8('v22.11.0')).toBe(false);
		expect(nodeVersionAdmittedByVite8('v22.12.0')).toBe(true);
		expect(nodeVersionAdmittedByVite8('v24.15.0')).toBe(true);
		/** A string no major and minor can be read out of is not a `false`. */
		expect(nodeVersionAdmittedByVite8('lts/*')).toBeNull();
	});

	it('the your-spotify shape: era says 16, the Vite 8 lane is built at the host, and the divergence is on the row', async () => {
		const eraRuntime = await shimRuntime('v16.20.2');
		const decision = await planTargetLaneRuntime({
			lineage: 'react',
			targetCell: null,
			laneDir: await lane('8.0.16'),
			era: yourSpotifyEra(eraRuntime),
			host: hostReading('v24.15.0', [
				runtimeOf('v16.20.2', 'workspace-runtime-cache', eraRuntime),
			]),
		});
		expect(decision.basis).toBe('lane-toolchain-requirement');
		expect(decision.satisfied).toBe(true);
		expect(decision.chosen.source).toBe('host');
		expect(decision.chosen.cellSupplier).toBe(RUNNING_PROCESS);
		expect(decision.chosen.cellVersion).toBe('v24.15.0');
		expect(decision.chosen.pathPrefix).toBeNull();
		/** The era reading is not discarded; it is recorded beside the chosen one. */
		expect(decision.chosen.eraDeclared).toMatchObject({
			outcome: 'read',
			source: 'Dockerfile*#FROM a node image',
			declared: 'node:16-alpine',
			supplier: 'workspace-runtime-cache',
			version: 'v16.20.2',
		});
		/** And the built row carries it, with a claim that says which is which. */
		const record = await runLaneBuild(
			await lane('8.0.16'),
			undefined,
			process.env,
			decision.chosen,
			decision,
		);
		expect(record.ran).toBe(true);
		expect(record.runtime?.eraDeclared?.version).toBe('v16.20.2');
		expect(record.runtime?.resolvedVersion).not.toBe('v16.20.2');
		expect(record.runtime?.claim).toContain('node:16-alpine');
		expect(record.runtime?.claim).toContain('migrated');
	}, 120_000);

	it('the angular2-hn shape: the target cell’s own nodeLine is provisioned, and it agrees with the era', async () => {
		const cellRuntime = await shimRuntime('v16.20.2');
		const era: EraRuntimeReading = Object.freeze({
			provision: Object.freeze({
				supplier: 'workspace-runtime-cache',
				version: 'v16.20.2',
				location: cellRuntime,
			}),
			architecture: 'arm64',
			outcome: 'not-read' as const,
			declared: null,
			readFrom: null,
		});
		const decision = await planTargetLaneRuntime({
			lineage: 'angular',
			targetCell: { id: 'angular-13.4.0', nodeLine: '16.20.2', nodeMajor: 16 },
			laneDir: await lane(null),
			era,
			host: hostReading('v24.15.0', [
				runtimeOf('v16.20.2', 'workspace-runtime-cache', cellRuntime),
			]),
		});
		expect(decision.basis).toBe('angular-target-cell');
		expect(decision.targetNodeMajor).toBe(16);
		expect(decision.satisfied).toBe(true);
		expect(decision.chosen.source).toBe('provisioned');
		expect(decision.chosen.cellVersion).toBe('v16.20.2');
		expect(decision.chosen.pathPrefix).toBe(cellRuntime);
		expect(decision.reading).toContain('angular-13.4.0');
		/** Era and target name the same runtime, so there is no divergence to record. */
		expect(decision.chosen.eraDeclared).toBeUndefined();
		expect(Object.hasOwn(decision.chosen, 'eraDeclared')).toBe(false);
	});

	it('the angular target’s runtime is not on this host: a named refusal, not an attempt', async () => {
		const laneDir = await lane(null);
		const decision = await planTargetLaneRuntime({
			lineage: 'angular',
			targetCell: { id: 'angular-13.4.0', nodeLine: '16.20.2', nodeMajor: 16 },
			laneDir,
			era: Object.freeze({
				provision: null,
				architecture: 'arm64',
				outcome: 'not-read' as const,
				declared: null,
				readFrom: null,
			}),
			host: hostReading('v24.15.0'),
		});
		expect(decision.satisfied).toBe(false);
		let raised: unknown = null;
		try {
			await runLaneBuild(laneDir, undefined, process.env, decision.chosen, decision);
		} catch (error) {
			raised = error;
		}
		const refusal = pipelineRefusalOf(raised);
		expect(refusal?.code).toBe('build.target-runtime-not-installed');
		expect(refusal?.stage).toBe('build');
		expect(refusal?.message).toContain('angular-13.4.0');
	});

	it('the cra-redux shape: no era in the tree, host runtime, and the row is the row it was', async () => {
		const decision = await planTargetLaneRuntime({
			lineage: 'react',
			targetCell: null,
			laneDir: await lane('8.0.16'),
			era: craReduxEra('v24.15.0'),
			host: hostReading('v24.15.0'),
		});
		expect(decision.satisfied).toBe(true);
		/**
		 * The four published fields, byte-compatible with
		 * `evidence/runs/react-flame-v2-4-0/run-record.json` and with
		 * `react-cra-redux-1a06509b`: the era-cell provision *is* the running
		 * process there, so the target reading changes nothing about the row.
		 */
		expect({ ...decision.chosen }).toEqual({
			source: 'host',
			cellSupplier: 'running-process',
			cellVersion: 'v24.15.0',
			pathPrefix: null,
		});
		expect(Object.hasOwn(decision.chosen, 'eraDeclared')).toBe(false);
	});

	it('a host below the target’s requirement is the named refusal, never a silent attempt', async () => {
		const laneDir = await lane('8.0.16');
		const decision = await planTargetLaneRuntime({
			lineage: 'react',
			targetCell: null,
			laneDir,
			era: Object.freeze({
				provision: null,
				architecture: 'arm64',
				outcome: 'read' as const,
				declared: 'node:16-alpine',
				readFrom: 'Dockerfile*#FROM a node image',
			}),
			host: hostReading('v16.20.2'),
		});
		expect(decision.satisfied).toBe(false);
		expect(decision.requirement?.toolchain).toBe('vite@8');
		let raised: unknown = null;
		try {
			await runLaneBuild(laneDir, undefined, process.env, decision.chosen, decision);
		} catch (error) {
			raised = error;
		}
		const refusal = pipelineRefusalOf(raised);
		expect(refusal?.code).toBe('build.host-runtime-below-target-requirement');
		expect(refusal?.stage).toBe('build');
		expect(refusal?.origin).toBe('pipeline');
		/** The refusal quotes the measurement rather than asserting a rule. */
		expect(refusal?.message).toContain('Vite requires Node.js version 20.19+ or 22.12+');
		expect(refusal?.message).toContain('v16.20.2');
	});

	it('a lineage with no target cell and no measured toolchain keeps the era-cell provision', async () => {
		const eraRuntime = await shimRuntime('v16.20.2');
		const decision = await planTargetLaneRuntime({
			lineage: 'react',
			targetCell: null,
			laneDir: await lane('^4.5.0'),
			era: yourSpotifyEra(eraRuntime),
			host: hostReading('v24.15.0'),
		});
		expect(decision.basis).toBe('no-measured-requirement');
		expect(decision.satisfied).toBeNull();
		expect(decision.chosen.source).toBe('provisioned');
		expect(decision.chosen.cellVersion).toBe('v16.20.2');
	});
});
