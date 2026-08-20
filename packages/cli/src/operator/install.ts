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
 *
 * Two more policies have been added since, both measured here rather than
 * inherited from npm: `--allow-peer-conflicts`, for a lane whose current build
 * toolchain fails peer resolution against the application's own era pins, and
 * `--allow-foreign-lockfile`, for the widest wall of all — an era application
 * that pinned its closure with yarn, pnpm or bun. The fourth is the only one
 * that buys its install by giving something up: taken, the lane installs with no
 * pin at all, and the record says so in those words.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
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
	/**
	 * Install without the lockfile another package manager pinned.
	 *
	 * The fourth policy, and the widest admission wall this repository has
	 * measured: an era-appropriate application overwhelmingly ships a yarn-era
	 * `yarn.lock`, and this stage reads npm lockfiles. Undeclared, that is
	 * `install.lockfile-foreign` and the run stops there. Declared, the install
	 * proceeds *without* the foreign lockfile — the file is left on disk
	 * untouched and is never consulted, and npm resolves the closure fresh from
	 * the lane manifest instead.
	 *
	 * That is a decision about what the lane's closure may be, and an expensive
	 * one: the resolution is no longer pinned by the era lockfile, so the
	 * installed closure may drift from the one the application shipped with.
	 * It is therefore declared like the other three, it is never inferred from
	 * the lockfile kind, and the drift it buys is written onto the install row
	 * by name rather than left for a reader to work out.
	 */
	allowForeignLockfile: boolean;
}>;

export const DEFAULT_INSTALL_POLICY: InstallPolicy = Object.freeze({
	allowRemoteTarballs: false,
	allowInstallScripts: false,
	skipInstallScripts: false,
	allowPeerConflicts: false,
	allowForeignLockfile: false,
});

/**
 * The declared name of the foreign-lockfile policy, as an operator declares it.
 *
 * It is a constant because it is written into the run record: a reader of the
 * install row has to be able to see *which* declaration bought this install
 * without cross-referencing a flag table.
 */
export const FOREIGN_LOCKFILE_POLICY = 'allow-foreign-lockfile';

/**
 * The foreign lockfile a declared policy disregarded, and what that cost.
 *
 * Recorded whenever the policy is taken, and absent otherwise. `consulted` is
 * `false` and not a computed field: this stage has no reader for any of these
 * formats, so "disregarded" here means the bytes were never opened, not that
 * they were read and overruled.
 */
export type ForeignLockfileDisregard = Readonly<{
	/** The policy that was declared, by the name it is declared under. */
	policy: typeof FOREIGN_LOCKFILE_POLICY;
	/** The lockfile that was left alone, relative to the lane. */
	lockfile: string;
	/** The package manager that wrote it. */
	packageManager: string;
	/** Every foreign lockfile the lane carries, when it carries more than one. */
	lockfilesPresent: readonly string[];
	/** Whether this stage read it. It did not. */
	consulted: false;
	/** What declaring the policy costs, stated where the row is read. */
	consequence: string;
}>;

/** The disregard record for a lane whose foreign lockfiles are `foreign`. */
export function foreignLockfileDisregard(foreign: readonly string[]): ForeignLockfileDisregard {
	const name = foreign[0] as string;
	const manager = FOREIGN_LOCKFILES[name] ?? 'another package manager';
	return Object.freeze({
		policy: FOREIGN_LOCKFILE_POLICY,
		lockfile: name,
		packageManager: manager,
		lockfilesPresent: Object.freeze([...foreign]),
		consulted: false,
		consequence: `The ${FOREIGN_LOCKFILE_POLICY} policy was declared, so this install proceeded without the closure ${manager} pinned in ${foreign.join(', ')}: the file was left on disk untouched and was not consulted, and npm resolved every dependency fresh from the lane manifest instead. This resolution is NOT pinned by the era lockfile, so the installed closure may drift from the one the era application shipped with, and every claim downstream of this install is bounded by that drift.`,
	});
}

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
	'The sandbox is an environment and a working directory, not a container. It moves every path npm resolves from the environment into the lane and drops inherited variables that name the user’s home or this checkout; it does not stop a script that hard-codes an absolute path, and `PATH` is passed through so the child can find its own node. Writes outside the lane are therefore *detected* — the checkout’s `.git/hooks` and its top level are hashed before and after — and refused by name, not prevented.',
	'The boundary reading watches two places: the top level of the checkout and `.git/hooks`. A write anywhere else outside the lane — a sibling directory, a deeper path in the checkout, another checkout on this host — is not observed here, and `writesOutsideLane: []` does not establish that none happened.',
	'`closure: resolve` means the lane manifest declares a build toolchain the recorded lockfile predates, so npm resolved rather than replayed. The application’s own pins still come from the lockfile; what was newly resolved is what the manifest rewrite added, and that resolution is not a pin this repository recorded.',
]);

/**
 * What a run that took the foreign-lockfile policy additionally does not know.
 *
 * Appended to the install row only when the policy was taken, because both
 * statements are false about every other install: an install that replayed or
 * resolved against an npm lockfile *did* read one.
 */
const FOREIGN_LOCKFILE_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	`The \`${FOREIGN_LOCKFILE_POLICY}\` policy was declared and no lockfile was read, so nothing pinned this closure: \`closure: resolve\` here means npm resolved every dependency fresh from the lane manifest at install time, and the era lockfile on disk played no part in it. The installed closure is therefore not established to be the closure the era application shipped with, and nothing downstream of this install can be read as though it were.`,
	'`remoteTarballDependencies` and `installScriptPackages` are empty because no lockfile was read, not because the closure carries none. The remote-tarball and install-script policies are read out of an npm lockfile, and with no lockfile to read they had nothing to find; what npm resolved may still carry either.',
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
	/** The npm lockfile this install reads, or `null` when it reads none. */
	lockfile: string | null;
	closure: ClosureMode;
	/** What was read out of the lockfile, or `null` when none was read. */
	findings: LockfileFindings | null;
	policy: InstallPolicy;
	/** The foreign lockfile a declared policy disregarded, or `null`. */
	foreignLockfileDisregarded: ForeignLockfileDisregard | null;
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
	 * A lockfile is present and this stage does not read it.
	 *
	 * Undeclared this is a refusal, and saying `absent` here would be false: the
	 * application pinned its closure, it pinned it with a package manager whose
	 * lockfile this stage cannot read, and those are different findings for an
	 * operator deciding what to do next.
	 *
	 * `--allow-foreign-lockfile` is the declaration that answers it, and what it
	 * declares is *not* that the foreign lockfile is readable after all — it is
	 * that this lane may be installed without any pin at all. The foreign file is
	 * left exactly where it is and is never opened; npm resolves the closure
	 * fresh from the manifest. The drift that buys is recorded on the row rather
	 * than swallowed, and the policy is only ever taken because an operator
	 * declared it: nothing here infers it from the lockfile kind.
	 */
	let disregarded: ForeignLockfileDisregard | null = null;
	if (lockfile === null) {
		if (foreign.length > 0) {
			if (!policy.allowForeignLockfile)
				refuse({
					code: 'install.lockfile-foreign',
					message: `Install: the lane carries ${foreign.join(', ')}, and this stage reads ${NPM_LOCKFILES.join(', ')}. The closure is pinned — by ${FOREIGN_LOCKFILES[foreign[0] as string] ?? 'another package manager'} — and it is pinned in a lockfile this flow does not read, so it is not absent and it is not installable here.`,
					stage: 'install',
					origin: 'pipeline',
				});
			disregarded = foreignLockfileDisregard(foreign);
		} else
			refuse({
				code: 'install.lockfile-absent',
				message: `Install: the lane carries none of ${NPM_LOCKFILES.join(', ')}, so there is no pinned closure to install. This flow installs a recorded closure rather than resolving a new one.`,
				stage: 'install',
				origin: 'pipeline',
			});
	}
	/**
	 * The policy findings, when there is a lockfile to read them out of. With
	 * the foreign-lockfile policy taken there is none, and the two gates below
	 * are not silently satisfied — they are recorded as never having run, on the
	 * row itself.
	 */
	let findings: LockfileFindings | null = null;
	if (lockfile !== null) {
		const document = await readJsonFile(path.join(laneDir, lockfile));
		if (document === null)
			refuse({
				code: 'install.lockfile-unreadable',
				message: `Install: ${lockfile} is not readable as a JSON object, so the closure it pins cannot be read and no install policy can be checked against it.`,
				stage: 'install',
				origin: 'pipeline',
			});
		findings = readLockfileFindings(lockfile, document);
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
	}
	/**
	 * `npm ci` replays a lockfile, and there is none to replay when the policy
	 * was taken. The mode is therefore `resolve` regardless of what the caller
	 * asked for — recorded as `resolve`, so the row says what actually happened.
	 */
	const resolvedClosure: ClosureMode = disregarded === null ? closure : 'resolve';
	const command = [
		'npm',
		resolvedClosure === 'replay' ? 'ci' : 'install',
		'--no-audit',
		'--no-fund',
		...(policy.allowRemoteTarballs ? ['--allow-remote', 'all'] : []),
		...(policy.allowInstallScripts ? ['--foreground-scripts'] : ['--ignore-scripts']),
		...(policy.allowPeerConflicts ? ['--legacy-peer-deps'] : []),
	];
	return Object.freeze({
		packageManager: 'npm',
		lockfile,
		closure: resolvedClosure,
		findings,
		policy,
		foreignLockfileDisregarded: disregarded,
		command: Object.freeze(command),
	});
}

/**
 * The lane-owned home an install child is given, relative to the lane.
 *
 * `--allow-install-scripts` is a policy about what may run, and until this
 * existed it was silently also a policy about where those scripts may write.
 * On 2026-08-10 an acquired application's `postinstall` — husky v4, out of
 * `.versionless/work/react-mycrypto/baseline/node_modules` — overwrote all 18
 * of this repository's own Git hooks and rewrote them to source a file it
 * created in `.git/hooks`. Nothing refused, nothing counted it, and the hooks
 * fired on every commit afterwards. They were inert only because `yarn` was
 * missing from `PATH`.
 */
export const INSTALL_HOME_DIRECTORY = '.install-home';

/**
 * The variables kept verbatim even when they name the user's home.
 *
 * `PATH` is the honest exception and it is named rather than hidden: the node
 * and npm this stage runs are frequently installed under the invoking user's
 * home (nvm, volta, asdf), so filtering `PATH` for home references would leave
 * the child unable to find the binary it is supposed to be. Everything else
 * that points at the user's home or at this checkout is dropped.
 */
export const SANDBOX_KEPT_VARIABLES: readonly string[] = Object.freeze(['PATH']);

export type InstallSandbox = Readonly<{
	/** The lane-owned directory handed to the child as `HOME`. */
	home: string;
	/** Every directory created before the child runs. */
	directories: readonly string[];
	/** The exact environment the child is spawned with. */
	environment: Readonly<Record<string, string>>;
	/** Inherited variables dropped, and why they were dropped. */
	strippedVariables: readonly string[];
}>;

/** Whether `value` names `base` or anything under it. */
function referencesDirectory(value: string, base: string | null): boolean {
	if (base === null || base.length < 2) return false;
	return value === base || value.includes(base);
}

/**
 * The environment an install child gets: lane-owned, and nothing borrowed.
 *
 * Every path npm writes to outside a project — its cache, its prefix, its two
 * config files, and the XDG directories a package's own script reads — is
 * pointed inside the lane, so the ordinary case of a script writing "to the
 * user's config" lands in a directory the lane owns and the run can throw away.
 * Then every inherited variable that names the user's home or this checkout is
 * dropped, so a script cannot read the escape route out of its own environment.
 */
export function planInstallSandbox(
	laneDir: string,
	environment: NodeJS.ProcessEnv,
	boundaryRoot: string,
): InstallSandbox {
	const lane = path.resolve(laneDir);
	const home = path.join(lane, INSTALL_HOME_DIRECTORY);
	const config = path.join(home, '.config');
	const cache = path.join(home, '.cache');
	const npmCache = path.join(home, 'npm-cache');
	const prefix = path.join(home, 'npm-prefix');
	const owned: Record<string, string> = {
		HOME: home,
		XDG_CONFIG_HOME: config,
		XDG_CACHE_HOME: cache,
		npm_config_cache: npmCache,
		npm_config_prefix: prefix,
		npm_config_userconfig: path.join(home, '.npmrc'),
		npm_config_globalconfig: path.join(prefix, 'etc', 'npmrc'),
	};
	const inheritedHome =
		typeof environment.HOME === 'string' && environment.HOME !== ''
			? path.resolve(environment.HOME)
			: null;
	const root = path.resolve(boundaryRoot);
	const stripped: string[] = [];
	const passed: Record<string, string> = {};
	for (const key of Object.keys(environment).sort()) {
		const value = environment[key];
		if (value === undefined) continue;
		if (key in owned) {
			stripped.push(`${key} (replaced with a lane-owned directory)`);
			continue;
		}
		/** npm reads its configuration from `npm_config_*` case-insensitively. */
		if (/^npm_config_/i.test(key)) {
			stripped.push(`${key} (inherited npm configuration)`);
			continue;
		}
		if (SANDBOX_KEPT_VARIABLES.includes(key)) {
			passed[key] = value;
			continue;
		}
		if (referencesDirectory(value, inheritedHome)) {
			stripped.push(`${key} (names the invoking user's home)`);
			continue;
		}
		if (referencesDirectory(value, root)) {
			stripped.push(`${key} (names this checkout)`);
			continue;
		}
		passed[key] = value;
	}
	return Object.freeze({
		home,
		directories: Object.freeze([home, config, cache, npmCache, prefix]),
		environment: Object.freeze({ ...passed, ...owned }),
		strippedVariables: Object.freeze(stripped),
	});
}

/** One digest per watched file, keyed by absolute path. */
export type BoundarySnapshot = ReadonlyMap<string, string>;

async function hashIfReadable(file: string): Promise<string | null> {
	try {
		return sha256(await readFile(file));
	} catch {
		return null;
	}
}

async function hashTree(directory: string, into: Map<string, string>): Promise<void> {
	let entries;
	try {
		entries = await readdir(directory, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			await hashTree(full, into);
			continue;
		}
		if (!entry.isFile()) continue;
		const digest = await hashIfReadable(full);
		if (digest !== null) into.set(full, digest);
	}
}

/**
 * The surface an install child is not allowed to move, hashed.
 *
 * Two places, and both are chosen because a write there is executable rather
 * than merely untidy: the checkout's `.git/hooks`, which is what the husky
 * escape took, and the top level of the checkout, which is where a `postinstall`
 * that guesses at a project root lands. Neither is walked deeply, so the reading
 * is cheap enough to take on every install. Anything inside the lane is excluded
 * by construction: the lane is what the child is *for*.
 */
export async function snapshotInstallBoundary(
	boundaryRoot: string,
	laneDir: string,
): Promise<BoundarySnapshot> {
	const root = path.resolve(boundaryRoot);
	const lane = path.resolve(laneDir);
	const snapshot = new Map<string, string>();
	let entries;
	try {
		entries = await readdir(root, { withFileTypes: true });
	} catch {
		entries = [];
	}
	for (const entry of entries) {
		if (!entry.isFile()) continue;
		const digest = await hashIfReadable(path.join(root, entry.name));
		if (digest !== null) snapshot.set(path.join(root, entry.name), digest);
	}
	await hashTree(path.join(root, '.git', 'hooks'), snapshot);
	for (const file of [...snapshot.keys()])
		if (file === lane || file.startsWith(`${lane}/`)) snapshot.delete(file);
	return snapshot;
}

/** Every watched path the child created, changed, or removed, named. */
export function boundaryWrites(
	before: BoundarySnapshot,
	after: BoundarySnapshot,
	boundaryRoot: string,
): readonly string[] {
	const root = path.resolve(boundaryRoot);
	const name = (file: string): string => {
		const relative = path.relative(root, file);
		return relative === '' || relative.startsWith('..') ? file : relative;
	};
	const writes: string[] = [];
	for (const [file, digest] of after)
		if (before.get(file) !== digest)
			writes.push(`${before.has(file) ? 'modified' : 'created'} ${name(file)}`);
	for (const file of before.keys()) if (!after.has(file)) writes.push(`deleted ${name(file)}`);
	return Object.freeze(writes.sort());
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
	/**
	 * The foreign lockfile a declared policy disregarded, or `null`.
	 *
	 * Present only when `--allow-foreign-lockfile` was declared *and* the lane
	 * actually carried one, so `null` reads as "no such decision was taken here"
	 * rather than as "the flag was off".
	 */
	foreignLockfileDisregarded: ForeignLockfileDisregard | null;
	remoteTarballDependencies: readonly string[];
	installScriptPackages: readonly string[];
	command: readonly string[] | null;
	exitCode: number | null;
	/** Packages present in the lane's installed closure afterwards. */
	installedPackages: number | null;
	/** The lane-owned environment the install child was confined to. */
	sandbox: Readonly<{
		home: string | null;
		strippedVariables: readonly string[];
	}> | null;
	/** What was watched outside the lane, and what moved there. */
	boundary: Readonly<{
		root: string;
		pathsObservedBefore: number;
		pathsObservedAfter: number;
		writesOutsideLane: readonly string[];
	}> | null;
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
		foreignLockfileDisregarded: null,
		remoteTarballDependencies: Object.freeze([]),
		installScriptPackages: Object.freeze([]),
		command: null,
		exitCode: null,
		installedPackages: null,
		sandbox: null,
		boundary: null,
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
	boundaryRoot: string = process.cwd(),
): Promise<InstallRecord> {
	const plan = await planLaneInstall(laneDir, policy, environment, closure);
	const sandbox = planInstallSandbox(laneDir, environment, boundaryRoot);
	for (const directory of sandbox.directories) await mkdir(directory, { recursive: true });
	const before = await snapshotInstallBoundary(boundaryRoot, laneDir);
	const [binary, ...args] = plan.command as readonly [string, ...string[]];
	let failure: unknown = null;
	try {
		await run(binary, args, {
			cwd: laneDir,
			env: sandbox.environment,
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (error) {
		failure = error;
	}
	/**
	 * The boundary is read before the exit code is, and it decides first.
	 *
	 * A script that wrote into the checkout and then failed is not a broken
	 * install that happens to have had a side effect; it is the side effect,
	 * and reporting the exit code instead would bury the only fact an operator
	 * needs. So the escape is named whether the install succeeded or not.
	 */
	const after = await snapshotInstallBoundary(boundaryRoot, laneDir);
	const writes = boundaryWrites(before, after, boundaryRoot);
	if (writes.length > 0)
		refuse({
			code: 'install.script-wrote-outside-lane',
			message: `Install: the closure's install scripts wrote outside the lane. ${String(writes.length)} watched path(s) under ${path.resolve(boundaryRoot)} moved while \`${plan.command.join(' ')}\` ran: ${writes.join('; ')}. The install ran with the install-script allowance, which permits a package's own build to run inside the lane; it does not permit it to write into the checkout that acquired it. The child was given a lane-owned HOME and a lane cwd, so this write reached the checkout by naming it rather than by inheriting it. The lane is not accepted as installed and the paths above are left as they are, so an operator can read what was attempted.`,
			stage: 'install',
			origin: 'pipeline',
		});
	if (failure !== null) {
		const error = failure;
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
		/**
		 * A defect after the foreign-lockfile policy was taken is bounded
		 * differently from every other install defect, and the message says so
		 * where it will be read: there was no recorded closure here, so what
		 * failed is a resolution this run made rather than a pin the application
		 * shipped. Naming the policy in the defect keeps that readable even when
		 * the stage produced no record to carry it.
		 */
		const disregard = plan.foreignLockfileDisregarded;
		throw new Error(
			`install: ${plan.command.join(' ')} failed in the lane. This is a defect rather than a refusal: the declared policies were applied and the pinned closure still did not install.${
				disregard === null
					? ''
					: ` The \`${disregard.policy}\` policy was declared and ${disregard.lockfile} (${disregard.packageManager}) was disregarded, so there was no pinned closure: what failed is a fresh npm resolution from the lane manifest, and it is not established that the era closure would have failed the same way.`
			} ${detail}`,
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
		foreignLockfileDisregarded: plan.foreignLockfileDisregarded,
		remoteTarballDependencies: plan.findings?.remoteTarballDependencies ?? Object.freeze([]),
		installScriptPackages: plan.findings?.installScriptPackages ?? Object.freeze([]),
		command: plan.command,
		exitCode: 0,
		installedPackages: await installedPackageCount(laneDir),
		sandbox: Object.freeze({
			home: sandbox.home,
			strippedVariables: sandbox.strippedVariables,
		}),
		boundary: Object.freeze({
			root: path.resolve(boundaryRoot),
			pathsObservedBefore: before.size,
			pathsObservedAfter: after.size,
			writesOutsideLane: writes,
		}),
		notEstablished:
			plan.foreignLockfileDisregarded === null
				? INSTALL_NOT_ESTABLISHED
				: Object.freeze([...INSTALL_NOT_ESTABLISHED, ...FOREIGN_LOCKFILE_NOT_ESTABLISHED]),
	});
}
