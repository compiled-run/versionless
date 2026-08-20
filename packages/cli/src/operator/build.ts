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
 * Two lane kinds are recognised, and the lane on disk chooses between them
 * rather than a declaration this stage was handed: a lane carrying an
 * `angular.json` is built by whatever its own build script tells the Angular
 * CLI to do, and a lane carrying the generated Vite configuration is built by
 * Vite. Neither command is composed here. A lane that is neither is refused by
 * a name that says so, instead of being told it carries no `vite.config.ts` —
 * that sentence described this stage's expectation rather than the lane's
 * condition, and it is now reserved for the lane it is true of.
 *
 * A non-zero exit from the build is a **defect**, not a refusal.
 */

import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { directoryExists, readJsonFile } from './analyze.ts';
import {
	INHERITED_LANE_RUNTIME,
	laneRuntimeEnvironment,
	readLaneRuntime,
	type LaneRuntime,
	type LaneRuntimePlan,
} from './install.ts';
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
 * not a property of this stage. Two lane kinds are recognised and each answers
 * for itself: a Vite lane answers with the constant its own generated
 * configuration was written with, an Angular lane answers with the
 * `outputPath` its own workspace declares. The field carries whatever the
 * recognised lane answers.
 *
 * The first two gates are lineage-independent — a lane with no closure and a
 * lane with no build script are the same fact whatever built it — so they run
 * before the lane kind is asked for at all, exactly as they did.
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
	const kind = await laneBuildKind(laneDir, configuration, script);
	if (kind === null)
		refuse({
			code: 'build.lane-kind-unrecognised',
			message: `Build: the lane carries an installed closure and the build script \`${script}\`, but neither an ${ANGULAR_WORKSPACE_FILE} nor a ${configuration}, so this stage holds no build contract for it. It declines to run an unrecognised lane's script rather than run it and then count files below a directory no lane declared.`,
			stage: 'build',
			origin: 'pipeline',
		});
	if (kind === 'angular') return angularLaneBuildPlan(laneDir, script, scripts);
	const outDirectory = await viteLaneOutDirectory(laneDir, configuration);
	return Object.freeze({
		command: Object.freeze(['npm', 'run', 'build']),
		script,
		configuration,
		outDirectory,
	});
}

/** The build contracts this stage holds. A lane answers to one of them or none. */
type LaneBuildKind = 'angular' | 'vite';

/**
 * Which build contract the lane answers to, read off the lane rather than
 * declared to this stage.
 *
 * `run` passes this stage a lane, an environment and a runtime and nothing
 * else, so the lineage the analyze stage read is not available
 * here and the lane itself has to say what it is. An `angular.json` at the lane
 * root is the Angular workspace's own declaration of itself and is asked for
 * first; a lane that carries the generated Vite configuration is the Vite lane
 * this stage has always built.
 *
 * The third question is what keeps `build.configuration-absent` meaning
 * something. A lane whose build script invokes `vite` and which carries no
 * configuration is a Vite lane with its configuration missing — that is the
 * fact that refusal names — while a lane that answers neither question is not
 * a Vite lane at all and is owed a different sentence.
 */
async function laneBuildKind(
	laneDir: string,
	configuration: string,
	script: string,
): Promise<LaneBuildKind | null> {
	if (await fileInLane(laneDir, ANGULAR_WORKSPACE_FILE)) return 'angular';
	if (await fileInLane(laneDir, configuration)) return 'vite';
	return INVOKES_VITE.test(script) ? 'vite' : null;
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

/** The file an Angular workspace declares itself in, at the lane root. */
const ANGULAR_WORKSPACE_FILE = 'angular.json';

/**
 * A script that invokes the Angular CLI's build, in either spelling this
 * repository has evidence of: the bare `ng build` angular2-hn's manifest
 * declares, and the `…/@angular/cli/bin/ng.js build` form pigallery2's probe
 * ran. `ng-build` and `packaging build` are not it.
 */
const INVOKES_NG_BUILD = /(?:^|[\s;&|(]|[./])ng(?:\.js)?\s+build(?![\w-])/;

/** A script that invokes Vite. `vitest` is not it. */
const INVOKES_VITE = /(?:^|[\s;&|(]|[./])vite(?![\w-])/;

/**
 * The plan for a lane that declares an Angular workspace.
 *
 * Two things are read off the lane and nothing is composed. The command is
 * `npm run build` — the same command the Vite lane gets — because the honest
 * builder of an Angular application is the application's own script: the green
 * precedent in this repository is eshop-webspa, whose production build ran
 * `build:prod`, and whose era flag spellings (`--prod --aot --extract-css`)
 * were translated by the frozen adapter rather than composed by a pipeline
 * (`packages/frameworks/angular/src/workspace-script-flags.ts`). A stage that
 * wrote `ng build --configuration production` in here would be stepping over
 * that translation seam and disagreeing with every lane whose script says
 * something else.
 *
 * The output directory is the workspace's own `outputPath`. It is why this
 * branch exists at all: angular2-hn declares `dist/angular-hnpwa`, and the
 * constant a Vite lane answers with would have counted files below a directory
 * the Angular build never writes.
 *
 * What this plan does **not** establish: that `npm run build` selects the
 * production configuration. angular2-hn's script is bare `ng build` and its
 * build target declares no `defaultConfiguration`, so the CLI takes base
 * options — no `fileReplacements`, no `outputHashing`, no budgets. That is the
 * lane's declaration, reported by running it, not a choice made here.
 */
async function angularLaneBuildPlan(
	laneDir: string,
	script: string,
	scripts: Record<string, string>,
): Promise<BuildPlan> {
	if (!INVOKES_NG_BUILD.test(script))
		refuse({
			code: 'build.no-ng-build-script',
			message: `Build: the lane declares an ${ANGULAR_WORKSPACE_FILE}, so its build is the one its own Angular CLI script runs, but its build script is \`${script}\` and nothing in it invokes \`ng build\`. ${otherNgBuildScripts(scripts)} This stage runs the lane's build script and composes no \`ng\` command of its own, so it refuses rather than run a script that will not build this workspace.`,
			stage: 'build',
			origin: 'pipeline',
		});
	return Object.freeze({
		command: Object.freeze(['npm', 'run', 'build']),
		script,
		configuration: ANGULAR_WORKSPACE_FILE,
		outDirectory: angularLaneOutDirectory(
			await readJsonFile(path.join(laneDir, ANGULAR_WORKSPACE_FILE)),
		),
	});
}

/** Which other scripts invoke `ng build`, for a manifest whose `build` does not. */
function otherNgBuildScripts(scripts: Record<string, string>): string {
	const invoking = Object.entries(scripts)
		.filter(([name, value]) => name !== 'build' && INVOKES_NG_BUILD.test(String(value)))
		.map(([name]) => name);
	return invoking.length === 0
		? 'No other script in this manifest invokes it either.'
		: `The scripts that do invoke it are ${invoking.join(', ')}; this stage runs \`npm run build\` and does not choose among them.`;
}

/**
 * Where an Angular lane's build lands: the `outputPath` the one project with a
 * build target declares, read off the workspace the lane carries.
 *
 * A single-project workspace is the whole population this stage has evidence
 * of — angular2-hn declares one project, eshop-webspa declares one — and a
 * workspace with two buildable projects is a question nobody answered: `run`
 * carries no project declaration, so choosing one would be a guess about which
 * application the lane is. The empty case, the unreadable case and the
 * ambiguous case are one refusal, because they mean one thing: this stage
 * cannot name a single build target. The message says which of the three it
 * was, so the refusal is countable without being vague.
 *
 * `architect` and `targets` are the two spellings of the same slot in the
 * workspace schema, so both are read rather than one being preferred.
 */
function angularLaneOutDirectory(workspace: Record<string, unknown> | null): string {
	const projects = objectOf(workspace?.projects);
	const declared = Object.entries(projects)
		.map(([name, project]) => ({ name, target: buildTargetOf(project) }))
		.filter(
			(entry): entry is { name: string; target: Record<string, unknown> } =>
				entry.target !== null,
		);
	if (declared.length !== 1)
		refuse({
			code: 'build.workspace-target-absent',
			message: `Build: the lane's ${ANGULAR_WORKSPACE_FILE} ${
				workspace === null
					? 'does not read as a JSON object, so no project in it can be read'
					: declared.length === 0
						? `declares no project with a build target (projects declared: ${Object.keys(projects).join(', ') || 'none'})`
						: `declares a build target for more than one project (${declared.map((entry) => entry.name).join(', ')}), and this run names no project to build`
			}, so this stage has no single build target to read the output directory from. It refuses rather than build one project and record it as the lane's.`,
			stage: 'build',
			origin: 'pipeline',
		});
	const [only] = declared as [{ name: string; target: Record<string, unknown> }];
	const outputPath = objectOf(only.target.options).outputPath;
	if (typeof outputPath !== 'string' || outputPath.trim() === '')
		refuse({
			code: 'build.output-path-absent',
			message: `Build: the build target of project ${only.name} in the lane's ${ANGULAR_WORKSPACE_FILE} declares no \`options.outputPath\` this stage can read as a path, so where its build lands is unknown. This stage counts the files a build emitted below the directory the lane declared; it will not assume one.`,
			stage: 'build',
			origin: 'pipeline',
		});
	return outputPath;
}

/** The `build` target a workspace project declares, in either spelling, or null. */
function buildTargetOf(project: unknown): Record<string, unknown> | null {
	const declared = objectOf(project);
	const targets = objectOf(declared.architect ?? declared.targets);
	const build = targets.build;
	return build !== null && typeof build === 'object' && !Array.isArray(build)
		? (build as Record<string, unknown>)
		: null;
}

/** A reading as the record it is, or an empty one for anything that is not one. */
function objectOf(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
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
	/** The Node runtime the build child resolved, and where it came from. */
	runtime: LaneRuntime | null;
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
		runtime: null,
		notEstablished: BUILD_NOT_ESTABLISHED,
	});
}

/**
 * Run the build this stage planned. A non-zero exit is a defect.
 *
 * `runtime` is the era-cell stage's provision, carried this far so the build
 * child runs in the runtime that stage named instead of in whatever the
 * invoking `PATH` happens to hold. It matters most where it is least visible:
 * the Angular CLI 13 this repository's Angular lanes carry warns and proceeds
 * on an even Node major above 16 rather than refusing it, so a build under the
 * wrong runtime does not fail at the CLI — it fails somewhere inside webpack
 * with a diagnostic that names neither Node nor the cell.
 */
export async function runLaneBuild(
	laneDir: string,
	configuration = 'vite.config.ts',
	environment: NodeJS.ProcessEnv = process.env,
	runtime: LaneRuntimePlan = INHERITED_LANE_RUNTIME,
): Promise<BuildRecord> {
	const plan = await planLaneBuild(laneDir, configuration);
	const inherited = laneRuntimeEnvironment(runtime, environment);
	const [binary, ...args] = plan.command as readonly [string, ...string[]];
	try {
		await run(binary, args, { cwd: laneDir, env: inherited, maxBuffer: 64 * 1024 * 1024 });
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
		runtime: await readLaneRuntime(runtime, inherited),
		notEstablished: BUILD_NOT_ESTABLISHED,
	});
}
