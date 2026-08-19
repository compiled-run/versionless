/**
 * The `install` stage: resolve the lane's own closure, under declared policy.
 *
 * Spike C measured two npm decisions on the first unseen application and named
 * them as manual residue: "Two operator decisions per application before the
 * first build. Both are mechanisable as policy, and both are today unwritten
 * judgment" (`evidence/spikes/thin-wrapper-cost/verdict.json`, finding C3). The
 * first was a 2020 lockfile carrying an `https` tarball dependency, which modern
 * npm refuses with `EALLOWREMOTE`; the second was install scripts, which modern
 * npm skips by default, so the tree installed "without its native build ever
 * being attempted".
 *
 * Both are policies here, not judgment. Each has a declared flag, each defaults
 * to *not applied*, and a closure that needs one it was not given is a named
 * refusal rather than an operator reading a wall of npm output and deciding. The
 * defaults are the honest ones: this flow does not widen a package manager's own
 * safety default on an operator's behalf, and it does not install a tree whose
 * native build was silently skipped and call it installed.
 *
 * The policy findings are read out of the lockfile before anything runs, so the
 * refusal arrives before the network is touched rather than after a failed
 * install.
 */

import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { directoryExists, fileExists, readJsonFile } from './analyze.ts';
import { refuse } from './refusals.ts';

const run = promisify(execFile);

/** The registry npm resolves a plain dependency from. */
export const DEFAULT_REGISTRY_HOST = 'registry.npmjs.org';

/** The lockfiles this stage can install from, in the order it looks for them. */
export const NPM_LOCKFILES: readonly string[] = Object.freeze([
	'package-lock.json',
	'npm-shrinkwrap.json',
]);

/** Lockfiles that name a package manager this stage's policies do not cover. */
export const FOREIGN_LOCKFILES: Readonly<Record<string, string>> = Object.freeze({
	'bun.lockb': 'bun',
	'yarn.lock': 'yarn',
	'pnpm-lock.yaml': 'pnpm',
});

export type InstallPolicy = Readonly<{
	/** Carry npm's `--allow-remote` allowance for non-registry tarballs. */
	allowRemoteTarballs: boolean;
	/** Run the closure's install scripts, so a native build is attempted. */
	allowInstallScripts: boolean;
	/** Skip them, as a declared decision rather than as npm's silent default. */
	skipInstallScripts: boolean;
	/**
	 * Install through a peer-dependency conflict.
	 *
	 * The third policy, and the one this repository measured rather than
	 * inherited: a lane whose manifest now declares a current build toolchain
	 * beside an era application's own pins can fail npm's peer resolution
	 * outright (`ERESOLVE`). Carrying the allowance is a decision about what the
	 * lane's closure is allowed to be, so it is declared like the other two.
	 */
	allowPeerConflicts: boolean;
}>;

export const DEFAULT_INSTALL_POLICY: InstallPolicy = Object.freeze({
	allowRemoteTarballs: false,
	allowInstallScripts: false,
	skipInstallScripts: false,
	allowPeerConflicts: false,
});

export type LockfileFindings = Readonly<{
	lockfile: string;
	lockfileVersion: number;
	/** Dependencies resolved from somewhere other than the npm registry. */
	remoteTarballDependencies: readonly string[];
	/** Packages the lockfile marks as carrying an install script. */
	installScriptPackages: readonly string[];
}>;

const INSTALL_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'An install resolves a closure. It is not a build, and it is not evidence that the closure works: nothing here establishes that any package in it compiles or runs.',
	'The policy findings are read from the lockfile. A lockfile that does not mark an install script, or that resolves through a mirror this reading does not recognise, yields a finding this stage did not make.',
	'`installScriptPackages` counts packages the lockfile declares an install script for. Whether a given script would have built anything on this host is not established here.',
	'`closure: resolve` means the lane manifest declares a build toolchain the recorded lockfile predates, so npm resolved rather than replayed. The application’s own pins still come from the lockfile; what was newly resolved is what the manifest rewrite added, and that resolution is not a pin this repository recorded.',
]);

function hostOf(value: string): string | null {
	if (!value.startsWith('http://') && !value.startsWith('https://')) return null;
	const parsed = parseURL(value);
	return parsed.host ?? null;
}

/** Read the two policy-bearing facts out of an npm lockfile. */
export function readLockfileFindings(
	lockfile: string,
	document: Record<string, unknown>,
): LockfileFindings {
	const remote = new Set<string>();
	const scripts = new Set<string>();
	const lockfileVersion =
		typeof document.lockfileVersion === 'number' ? document.lockfileVersion : 1;
	const packages = document.packages as Record<string, unknown> | undefined;
	if (packages !== undefined)
		for (const key of Object.keys(packages).sort()) {
			const entry = packages[key] as Record<string, unknown> | undefined;
			if (entry === undefined || entry === null) continue;
			const resolved = typeof entry.resolved === 'string' ? entry.resolved : null;
			const host = resolved === null ? null : hostOf(resolved);
			if (host !== null && host !== DEFAULT_REGISTRY_HOST)
				remote.add(`${key === '' ? '.' : key} <- ${resolved ?? ''}`);
			if (entry.hasInstallScript === true) scripts.add(key === '' ? '.' : key);
		}
	const walk = (tree: Record<string, unknown> | undefined, prefix: string): void => {
		if (tree === undefined || tree === null) return;
		for (const name of Object.keys(tree).sort()) {
			const entry = tree[name] as Record<string, unknown> | undefined;
			if (entry === undefined || entry === null) continue;
			const identifier = prefix === '' ? name : `${prefix}/${name}`;
			const version = typeof entry.version === 'string' ? entry.version : '';
			const resolved = typeof entry.resolved === 'string' ? entry.resolved : version;
			const host = hostOf(resolved);
			if (host !== null && host !== DEFAULT_REGISTRY_HOST)
				remote.add(`${identifier} <- ${resolved}`);
			if (entry.hasInstallScript === true) scripts.add(identifier);
			walk(entry.dependencies as Record<string, unknown> | undefined, identifier);
		}
	};
	walk(document.dependencies as Record<string, unknown> | undefined, '');
	return Object.freeze({
		lockfile,
		lockfileVersion,
		remoteTarballDependencies: Object.freeze([...remote].sort()),
		installScriptPackages: Object.freeze([...scripts].sort()),
	});
}

/**
 * Whether the closure is replayed or resolved.
 *
 * `replay` is `npm ci`: the lockfile is installed exactly as recorded, and a
 * manifest that disagrees with it is an error. `resolve` is `npm install`, and
 * it is what a lane whose manifest this pipeline rewrote requires — the lane
 * declares a build toolchain the recorded lockfile predates, so there is no
 * recorded closure for it to replay. The application's own pins still come from
 * the lockfile; what is newly resolved is what the rewrite added.
 */
export type ClosureMode = 'replay' | 'resolve';

export type InstallPlan = Readonly<{
	packageManager: string;
	lockfile: string;
	closure: ClosureMode;
	findings: LockfileFindings;
	policy: InstallPolicy;
	command: readonly string[];
}>;

/**
 * Decide the install command for a lane, or refuse by name.
 *
 * Nothing runs here. The whole point is that every decision this stage would
 * otherwise ask an operator for is taken from the declared policy and the
 * lockfile before a registry is contacted.
 */
export async function planLaneInstall(
	laneDir: string,
	policy: InstallPolicy = DEFAULT_INSTALL_POLICY,
	environment: NodeJS.ProcessEnv = process.env,
	closure: ClosureMode = 'replay',
): Promise<InstallPlan> {
	if (policy.allowInstallScripts && policy.skipInstallScripts)
		refuse({
			code: 'install.install-script-policy-conflicts',
			message:
				'Install: the install-script allowance and the install-script skip were both declared. They are opposite policies and this flow does not pick between two declarations.',
			stage: 'install',
			origin: 'pipeline',
		});
	if (environment.VERSIONLESS_NETWORK_MODE === 'offline')
		refuse({
			code: 'install.network-not-permitted',
			message:
				'Install: VERSIONLESS_NETWORK_MODE is offline, so this stage may not reach a registry. No closure was resolved and nothing was installed.',
			stage: 'install',
			origin: 'pipeline',
		});
	/**
	 * Which lockfiles the lane actually carries, read before anything is said
	 * about them. The order matters, and it is the order a reader would want:
	 * an npm lockfile is looked for first, so that "there is nothing to install
	 * from" is only ever said about a lane where that is true.
	 */
	let lockfile: string | null = null;
	for (const name of NPM_LOCKFILES)
		if (lockfile === null && (await fileExists(path.join(laneDir, name)))) lockfile = name;
	const foreign: string[] = [];
	for (const name of Object.keys(FOREIGN_LOCKFILES).sort())
		if (await fileExists(path.join(laneDir, name))) foreign.push(name);
	/**
	 * A lane pinned by another package manager *as well as* by npm. Both are
	 * present, so this is not a lane missing a closure — it is a lane carrying
	 * two, and the policies this stage holds are npm's.
	 */
	if (lockfile !== null && foreign.length > 0) {
		const name = foreign[0] as string;
		refuse({
			code: 'install.package-manager-not-npm',
			message: `Install: the lane carries ${name}, so its closure is pinned by ${FOREIGN_LOCKFILES[name] ?? 'another package manager'}. The two policies this stage carries — the remote-tarball allowance and the install-script allowance — are npm policies, and this flow does not translate them onto another package manager.`,
			stage: 'install',
			origin: 'pipeline',
		});
	}
	/**
	 * A lockfile is present and this stage does not read it. Saying `absent`
	 * here would be false: the application pinned its closure, it pinned it
	 * with a package manager whose lockfile this stage cannot read, and those
	 * are different findings for an operator deciding what to do next.
	 */
	if (lockfile === null && foreign.length > 0)
		refuse({
			code: 'install.lockfile-foreign',
			message: `Install: the lane carries ${foreign.join(', ')}, and this stage reads ${NPM_LOCKFILES.join(', ')}. The closure is pinned — by ${FOREIGN_LOCKFILES[foreign[0] as string] ?? 'another package manager'} — and it is pinned in a lockfile this flow does not read, so it is not absent and it is not installable here.`,
			stage: 'install',
			origin: 'pipeline',
		});
	if (lockfile === null)
		refuse({
			code: 'install.lockfile-absent',
			message: `Install: the lane carries none of ${NPM_LOCKFILES.join(', ')}, so there is no pinned closure to install. This flow installs a recorded closure rather than resolving a new one.`,
			stage: 'install',
			origin: 'pipeline',
		});
	const document = await readJsonFile(path.join(laneDir, lockfile));
	if (document === null)
		refuse({
			code: 'install.lockfile-unreadable',
			message: `Install: ${lockfile} is not readable as a JSON object, so the closure it pins cannot be read and no install policy can be checked against it.`,
			stage: 'install',
			origin: 'pipeline',
		});
	const findings = readLockfileFindings(lockfile, document);
	if (findings.remoteTarballDependencies.length > 0 && !policy.allowRemoteTarballs)
		refuse({
			code: 'install.remote-tarball-policy-not-declared',
			message: `Install: the lockfile resolves ${String(findings.remoteTarballDependencies.length)} dependency(ies) from outside ${DEFAULT_REGISTRY_HOST}, first ${findings.remoteTarballDependencies[0] ?? ''}. Modern npm refuses those with EALLOWREMOTE unless the remote-tarball allowance is declared. Declare --allow-remote-tarballs to carry that policy; this flow does not take the allowance on an operator's behalf.`,
			stage: 'install',
			origin: 'pipeline',
		});
	if (
		findings.installScriptPackages.length > 0 &&
		!policy.allowInstallScripts &&
		!policy.skipInstallScripts
	)
		refuse({
			code: 'install.install-script-policy-not-declared',
			message: `Install: the lockfile declares ${String(findings.installScriptPackages.length)} package(s) carrying an install script, first ${findings.installScriptPackages[0] ?? ''}. Modern npm skips them by default, which produces a tree whose native build was never attempted. Declare --allow-install-scripts to run them or --skip-install-scripts to record the skip as a decision; this flow does not let the default stand unnamed.`,
			stage: 'install',
			origin: 'pipeline',
		});
	const command = [
		'npm',
		closure === 'replay' ? 'ci' : 'install',
		'--no-audit',
		'--no-fund',
		...(policy.allowRemoteTarballs ? ['--allow-remote', 'all'] : []),
		...(policy.allowInstallScripts ? ['--foreground-scripts'] : ['--ignore-scripts']),
		...(policy.allowPeerConflicts ? ['--legacy-peer-deps'] : []),
	];
	return Object.freeze({
		packageManager: 'npm',
		lockfile,
		closure,
		findings,
		policy,
		command: Object.freeze(command),
	});
}

export type InstallRecord = Readonly<{
	stage: 'install';
	ran: boolean;
	/** Why the stage did not run, when it did not. */
	reason: string | null;
	packageManager: string | null;
	lockfile: string | null;
	closure: ClosureMode | null;
	policy: InstallPolicy;
	remoteTarballDependencies: readonly string[];
	installScriptPackages: readonly string[];
	command: readonly string[] | null;
	exitCode: number | null;
	/** Packages present in the lane's installed closure afterwards. */
	installedPackages: number | null;
	notEstablished: readonly string[];
}>;

/** The record for a stage the run did not ask for. */
export function installNotRequested(reason: string): InstallRecord {
	return Object.freeze({
		stage: 'install',
		ran: false,
		reason,
		packageManager: null,
		lockfile: null,
		closure: null,
		policy: DEFAULT_INSTALL_POLICY,
		remoteTarballDependencies: Object.freeze([]),
		installScriptPackages: Object.freeze([]),
		command: null,
		exitCode: null,
		installedPackages: null,
		notEstablished: INSTALL_NOT_ESTABLISHED,
	});
}

/** How many packages the lane's installed closure carries, or null. */
export async function installedPackageCount(laneDir: string): Promise<number | null> {
	const modules = path.join(laneDir, 'node_modules');
	if (!(await directoryExists(modules))) return null;
	let count = 0;
	for (const entry of await readdir(modules, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name === '.bin') continue;
		if (!entry.name.startsWith('@')) {
			count += 1;
			continue;
		}
		for (const scoped of await readdir(path.join(modules, entry.name), { withFileTypes: true }))
			if (scoped.isDirectory()) count += 1;
	}
	return count;
}

/**
 * Run the install this stage planned.
 *
 * A non-zero exit here is a **defect**, not a refusal: the policies were
 * declared, the closure was pinned, and the install still failed. Scoring that
 * as a refusal would let a broken tree be counted as a named, expected outcome.
 */
export async function runLaneInstall(
	laneDir: string,
	policy: InstallPolicy = DEFAULT_INSTALL_POLICY,
	environment: NodeJS.ProcessEnv = process.env,
	closure: ClosureMode = 'replay',
): Promise<InstallRecord> {
	const plan = await planLaneInstall(laneDir, policy, environment, closure);
	const [binary, ...args] = plan.command as readonly [string, ...string[]];
	try {
		await run(binary, args, { cwd: laneDir, env: environment, maxBuffer: 64 * 1024 * 1024 });
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		/**
		 * One npm failure is a policy question rather than a breakage: a peer
		 * conflict is npm reporting that the closure it was asked for is not
		 * one it will assemble by default. That is a decision, so it is a named
		 * refusal an operator can count and answer with a flag. Every other
		 * failure is a defect.
		 */
		if (detail.includes('ERESOLVE') && !policy.allowPeerConflicts)
			refuse({
				code: 'install.peer-resolution-policy-not-declared',
				message: `Install: npm refused the lane closure with ERESOLVE — a peer dependency conflict between the application's own era pins and the build toolchain the lane now declares. Declare --allow-peer-conflicts to install through it, which is a decision about what the lane's closure may be, or change what the lane declares. This flow does not take that decision on an operator's behalf.`,
				stage: 'install',
				origin: 'pipeline',
			});
		throw new Error(
			`install: ${plan.command.join(' ')} failed in the lane. This is a defect rather than a refusal: the declared policies were applied and the pinned closure still did not install. ${detail}`,
		);
	}
	return Object.freeze({
		stage: 'install',
		ran: true,
		reason: null,
		packageManager: plan.packageManager,
		lockfile: plan.lockfile,
		closure: plan.closure,
		policy,
		remoteTarballDependencies: plan.findings.remoteTarballDependencies,
		installScriptPackages: plan.findings.installScriptPackages,
		command: plan.command,
		exitCode: 0,
		installedPackages: await installedPackageCount(laneDir),
		notEstablished: INSTALL_NOT_ESTABLISHED,
	});
}
