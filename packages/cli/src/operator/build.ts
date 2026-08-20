/**
 * The `build` stage: run the lane's own build script against the lane's own
 * generated configuration.
 *
 * The build path for the applications already completed is not in the operator
 * flow at all — `packages/cli/src/fixture/react-hospitalrun-vite8-run.ts` runs
 * the *workspace's* Vite binary against a *workspace* configuration file, and
 * that file imports the frozen adapter by source path. The lane is never
 * self-contained in that arrangement, and nothing an operator can run
 * reproduces it.
 *
 * This stage runs the script the lane's own rewritten manifest declares, from
 * the lane, resolving the build tool out of the lane's own installed closure.
 * The one thing the lane still reaches into this workspace for is the frozen
 * adapter source, exactly as the fixture configurations do. Making the lane
 * resolve a published `@versionless/react` instead is a packaging decision this
 * stage deliberately does not take, and the record says so rather than leaving
 * a reader to discover it from the import specifier.
 *
 * A non-zero exit from the build is a **defect**, not a refusal.
 */

import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { directoryExists, readJsonFile } from './analyze.ts';
import { LANE_BUILD_DIRECTORY } from './lane.ts';
import { refuse } from './refusals.ts';

const run = promisify(execFile);

const BUILD_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'A completed build establishes that the lane emitted output. It is not a browser proof, a parity reading, or a witness pass; nothing here establishes that the emitted bundle behaves as the application did on its era toolchain.',
	'The lane resolves the frozen adapter from this workspace by relative path, so this build is reproducible by this pipeline in this checkout. It does not establish that the lane builds anywhere else.',
	'`outputFiles` counts files below the build directory. It is a count, not a comparison against any previous build.',
]);

export type BuildPlan = Readonly<{
	command: readonly string[];
	script: string;
	configuration: string;
	/** Where the identified lane says its build lands, relative to the lane. */
	outDirectory: string;
}>;

/**
 * Decide the build command for a lane and read where its output lands, or
 * refuse by name.
 *
 * `outDirectory` is a reading taken from the lane the gates just identified,
 * not a property of this stage. Today one lane kind is recognised and its
 * reading is the constant its own generated configuration was written with;
 * the field carries whatever the recognised lane answers.
 */
export async function planLaneBuild(
	laneDir: string,
	configuration = 'vite.config.ts',
): Promise<BuildPlan> {
	if (!(await directoryExists(path.join(laneDir, 'node_modules'))))
		refuse({
			code: 'build.lane-closure-absent',
			message:
				'Build: the lane carries no node_modules, so the build tool its manifest declares is not resolvable from the lane. Run the install stage first rather than have this stage build against the workspace closure instead of the lane closure.',
			stage: 'build',
			origin: 'pipeline',
		});
	const manifest = await readJsonFile(path.join(laneDir, 'package.json'));
	const scripts = (manifest?.scripts ?? {}) as Record<string, string>;
	const script = scripts.build;
	if (typeof script !== 'string' || script.trim() === '')
		refuse({
			code: 'build.no-build-script',
			message:
				"Build: the lane's package.json declares no build script, so there is no command to run. The lane composition rewrites that script; a lane without one was not composed by this flow.",
			stage: 'build',
			origin: 'pipeline',
		});
	const outDirectory = await viteLaneOutDirectory(laneDir, configuration);
	return Object.freeze({
		command: Object.freeze(['npm', 'run', 'build']),
		script,
		configuration,
		outDirectory,
	});
}

/**
 * Where a Vite lane's build lands, asked of the lane rather than assumed of
 * every lane.
 *
 * The plan used to write `LANE_BUILD_DIRECTORY` in directly, which was true of
 * the only lane this stage can build and said nothing about the lane itself. It
 * is a reading now: the lane is identified by the configuration it carries, and
 * that identification is what answers where the output goes. The answer for a
 * Vite lane is still the constant, and deliberately so — `lane.ts:486` wrote
 * that same constant into the generated configuration this gate just found, so
 * reading the lane and reading the constant are one fact. It is imported rather
 * than repeated here so the two cannot drift apart.
 */
async function viteLaneOutDirectory(laneDir: string, configuration: string): Promise<string> {
	if (!(await fileInLane(laneDir, configuration)))
		refuse({
			code: 'build.configuration-absent',
			message: `Build: the lane carries no ${configuration}, so the generated build configuration this stage runs against is missing. The lane composition writes it; a lane without one was not composed by this flow.`,
			stage: 'build',
			origin: 'pipeline',
		});
	return LANE_BUILD_DIRECTORY;
}

async function fileInLane(laneDir: string, file: string): Promise<boolean> {
	try {
		return (await readdir(laneDir)).includes(file);
	} catch {
		return false;
	}
}

async function countFilesBelow(directory: string): Promise<number> {
	if (!(await directoryExists(directory))) return 0;
	let count = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			count += await countFilesBelow(path.join(directory, entry.name));
			continue;
		}
		if (entry.isFile()) count += 1;
	}
	return count;
}

export type BuildRecord = Readonly<{
	stage: 'build';
	ran: boolean;
	reason: string | null;
	command: readonly string[] | null;
	script: string | null;
	configuration: string | null;
	outDirectory: string | null;
	exitCode: number | null;
	outputFiles: number | null;
	notEstablished: readonly string[];
}>;

/** The record for a stage the run did not ask for. */
export function buildNotRequested(reason: string): BuildRecord {
	return Object.freeze({
		stage: 'build',
		ran: false,
		reason,
		command: null,
		script: null,
		configuration: null,
		outDirectory: null,
		exitCode: null,
		outputFiles: null,
		notEstablished: BUILD_NOT_ESTABLISHED,
	});
}

/** Run the build this stage planned. A non-zero exit is a defect. */
export async function runLaneBuild(
	laneDir: string,
	configuration = 'vite.config.ts',
	environment: NodeJS.ProcessEnv = process.env,
): Promise<BuildRecord> {
	const plan = await planLaneBuild(laneDir, configuration);
	const [binary, ...args] = plan.command as readonly [string, ...string[]];
	try {
		await run(binary, args, { cwd: laneDir, env: environment, maxBuffer: 64 * 1024 * 1024 });
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(
			`build: ${plan.command.join(' ')} failed in the lane. This is a defect rather than a refusal: the lane was composed and installed and the build still did not complete. ${detail}`,
		);
	}
	return Object.freeze({
		stage: 'build',
		ran: true,
		reason: null,
		command: plan.command,
		script: plan.script,
		configuration: plan.configuration,
		outDirectory: plan.outDirectory,
		exitCode: 0,
		outputFiles: await countFilesBelow(path.join(laneDir, plan.outDirectory)),
		notEstablished: BUILD_NOT_ESTABLISHED,
	});
}
