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
 *
 * The fifth, `--allow-git-dependencies`, is the first policy whose wall is not
 * readable before the install runs in every case: npm 12 fetches no git
 * dependency by default and stops with `EALLOWGIT`, which this stage used to
 * hand back as `defect:install` with npm's output buried in it. It is a
 * declaration like the other four.
 *
 * The install-script policy was, until T032, a recorded claim rather than a
 * delivered one. Declaring it put `--foreground-scripts` on the command, and
 * `--foreground-scripts` decides only where the output of a script npm has
 * *already chosen to run* is printed. npm 12 blocks a **dependency's** install
 * scripts behind the `allowScripts` field and skips them silently, so a lane
 * installed under a declared allowance got a tree whose dependency scripts npm
 * had never run, and the row said the allowance was taken. What is emitted now
 * is the allowance npm actually honours, chosen per npm major, and the row
 * carries npm's own account of which scripts ran and which it skipped instead
 * of the declaration standing in for the outcome.
 *
 * One measured wall here is a refusal with *no* policy behind it. An install
 * whose closure pins a registry this run cannot reach — measured as
 * `CERT_HAS_EXPIRED` against `registry.npm.taobao.org` — has no honest "proceed
 * anyway": there is no allowance that makes an unreachable host reachable, and
 * re-pinning the closure onto a registry that answers is a migration concern
 * rather than an install policy. It is named, counted, and left at that.
 */

import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import * as path from 'pathe';
import { parseURL } from 'ufo';
import { sha256 } from '../../../core/src/receipts/canonicalize.ts';
import { directoryExists, fileExists, readJsonFile } from './analyze.ts';
import {
	leadingMajor,
	provisionRuntime,
	readHostCell,
	RUNNING_PROCESS,
	RUNNING_PROCESS_LOCATION,
	type HostCellReading,
} from './era-cell.ts';
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
	/**
	 * Fetch the closure's git dependencies.
	 *
	 * The fifth policy, measured on `coverview`: a 2020 application that pins
	 * one dependency at a git ref rather than at a registry version. npm 12
	 * fetches none of those by default (`allow-git` defaults to `none`) and
	 * stops the whole install with `EALLOWGIT`, so the wall is npm's own
	 * safety default meeting an era closure, exactly like the remote-tarball
	 * one.
	 *
	 * Declaring it carries npm's `--allow-git all`, and that is a decision
	 * about what the lane's closure may be: a git dependency is fetched by
	 * running `git` against a remote repository rather than by resolving a
	 * registry version, so what arrives is whatever that ref resolves to at
	 * install time. The declaration is recorded on the install row together
	 * with the git dependencies it admitted, by name.
	 */
	allowGitDependencies: boolean;
}>;

export const DEFAULT_INSTALL_POLICY: InstallPolicy = Object.freeze({
	allowRemoteTarballs: false,
	allowInstallScripts: false,
	skipInstallScripts: false,
	allowPeerConflicts: false,
	allowForeignLockfile: false,
	allowGitDependencies: false,
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

/**
 * The declared name of the git-dependency policy, as an operator declares it.
 *
 * A constant for the same reason the foreign-lockfile one is: the name is
 * written onto the install row, and a reader has to see which declaration
 * bought this install without going to a flag table for it.
 */
export const GIT_DEPENDENCY_POLICY = 'allow-git-dependencies';

/**
 * The git dependencies a declared policy admitted into the closure.
 *
 * Recorded whenever the policy is declared, and `null` otherwise — so a `null`
 * here reads as "no such declaration was made", not as "none were found".
 * `dependencies` is read out of the lockfile before the install runs, and
 * `readFrom` names the lockfile it was read from; with no lockfile read (the
 * foreign-lockfile policy) `readFrom` is `null` and the list is empty because
 * nothing was read, which is not the same as the closure carrying none.
 */
export type GitDependencyAllowance = Readonly<{
	/** The policy that was declared, by the name it is declared under. */
	policy: typeof GIT_DEPENDENCY_POLICY;
	/** The lockfile the list below was read out of, or `null` for none. */
	readFrom: string | null;
	/** Every git dependency the lockfile pins, as npm names it: `name@spec`. */
	dependencies: readonly string[];
	/** What declaring the policy admits, stated where the row is read. */
	consequence: string;
}>;

/** The allowance record for a plan whose findings are `findings`. */
export function gitDependencyAllowance(findings: LockfileFindings | null): GitDependencyAllowance {
	const dependencies = findings?.gitDependencies ?? Object.freeze([]);
	return Object.freeze({
		policy: GIT_DEPENDENCY_POLICY,
		readFrom: findings?.lockfile ?? null,
		dependencies: Object.freeze([...dependencies]),
		consequence:
			findings === null
				? `The ${GIT_DEPENDENCY_POLICY} policy was declared, so npm was given --allow-git all and this install could fetch dependencies from git references. No lockfile was read on this run, so no list of them is recorded here: the empty list means nothing was read, not that the closure carries none.`
				: `The ${GIT_DEPENDENCY_POLICY} policy was declared, so npm was given --allow-git all and fetched the ${String(dependencies.length)} git dependency(ies) above out of ${findings.lockfile}. A git dependency is fetched by running git against a remote repository rather than by resolving a registry version, so what it installs is what that reference resolves to at install time and whoever controls the repository controls it; the registry pin, its integrity hash and its provenance do not apply to it.`,
	});
}

export type LockfileFindings = Readonly<{
	lockfile: string;
	lockfileVersion: number;
	/** Dependencies resolved from somewhere other than the npm registry. */
	remoteTarballDependencies: readonly string[];
	/** Packages the lockfile marks as carrying an install script. */
	installScriptPackages: readonly string[];
	/**
	 * Dependencies the lockfile pins at a git reference, as `name@spec`.
	 *
	 * Written the way npm writes them in its own `EALLOWGIT` refusal, so the
	 * list this stage read out of the lockfile and the specs npm names in its
	 * output can be read against each other without translation.
	 */
	gitDependencies: readonly string[];
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

/**
 * What a run that took the git-dependency policy additionally does not know.
 *
 * Appended to the install row only when the policy was taken, because both
 * statements are false about an install that fetched no git dependency at all.
 */
const GIT_DEPENDENCY_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	`The \`${GIT_DEPENDENCY_POLICY}\` policy was declared, so part of this closure came out of a git repository rather than out of a registry. What a git reference resolves to is decided by whoever controls that repository at fetch time; a tag or a branch may move, and this stage does not record what it pointed at. The registry guarantees that bound the rest of the closure — a version pin, an integrity hash, the registry's own provenance — are not established for these dependencies.`,
	`The git dependencies recorded beside this policy are the ones the lockfile pins. A dependency reached through a git reference that no lockfile records — a transitive one npm resolved fresh — is not in that list, so the list is what was read rather than everything that was fetched.`,
]);

/**
 * The declared name of the install-script policy, as an operator declares it.
 *
 * A constant for the same reason the other two are: the name is written onto
 * the install row beside the reading of what the declaration actually bought.
 */
export const INSTALL_SCRIPT_POLICY = 'allow-install-scripts';

/** The declared name of its opposite. */
export const INSTALL_SCRIPT_SKIP_POLICY = 'skip-install-scripts';

/**
 * The npm the install child actually ran, read rather than assumed.
 *
 * `version` is `npm --version` taken through the very environment the child is
 * given, so it is a measurement of the child's world and not of this process's.
 * `major` is the first component of it, and both are `null` when the reading
 * did not complete — which is a different fact from "npm 12", and this stage
 * never promotes one into the other.
 */
export type NpmRelease = Readonly<{ version: string | null; major: number | null }>;

/** The release reading for a child whose npm was never asked. */
export const UNREAD_NPM_RELEASE: NpmRelease = Object.freeze({ version: null, major: null });

/**
 * The npm major from which a *dependency's* install scripts are gated.
 *
 * Measured on this host, on the two majors this pipeline actually runs. npm
 * 12.0.1: a dependency whose install script is not covered by the `allowScripts`
 * field in the project's `package.json` has that script **silently skipped**,
 * and npm ends the install with a `npm warn install-scripts` block naming the
 * packages it skipped. npm 8.19.4: no such gate exists at all — a dependency's
 * install script runs under the flags this stage already passed.
 *
 * The boundary is drawn at 12 because 12 is where the gate was measured. npm 9,
 * 10 and 11 were not measured on this host and are treated as ungated, which is
 * the reading that cannot invent an allowance: an npm in that range that *does*
 * gate will report its skips in the `npm warn install-scripts` block, and this
 * stage reads that block onto the row rather than assuming the gate away.
 */
export const NPM_ALLOW_SCRIPTS_MAJOR = 12;

/**
 * What `--allow-install-scripts` is worth on a gated npm, and why.
 *
 * `--foreground-scripts` only decides where the output of a script npm has
 * *already decided to run* is printed. It grants nothing. Until this was
 * measured the install-script allowance carried that flag and nothing else, so
 * on npm 12 a declared allowance produced a tree whose dependency scripts npm
 * had silently skipped, and the row recorded the allowance as though it had
 * been delivered.
 *
 * Three forms of allowance exist on npm 12, and only one of them can be spelled
 * on the command line of a project-scoped install:
 *
 * - `--allow-scripts <list>` is **an error** here. Measured: `npm install
 *   --allow-scripts=depwithscript` in a directory with a `package.json` exits
 *   with `npm error code EALLOWSCRIPTS`, `--allow-scripts is not allowed in
 *   project-scoped installs`. It is npm's flag for `npx`, `npm exec` and global
 *   installs, and it is not available to this stage at all.
 * - The `allowScripts` field in the lane's own `package.json`, or an `.npmrc`
 *   entry, carries a per-package list. Deriving that list means deriving it
 *   from the lockfile's `hasInstallScript` markings — a second inference path,
 *   and one this module already records as incomplete (`installScriptPackages`
 *   is what the lockfile *declares*, and a lockfile that does not mark a script
 *   yields a finding this stage did not make). An allowance silently narrowed
 *   by an incomplete reading is the same defect in a new place: the operator
 *   declared that this closure's scripts may run, and would have got the
 *   scripts this stage happened to notice.
 * - `--dangerously-allow-all-scripts` bypasses the `allowScripts` policy
 *   entirely and runs every dependency install script. That is precisely what
 *   the declaration means, it is one flag on the command the row already
 *   records, and it invents nothing.
 *
 * So the fleet-wide declaration is what is emitted, and it is emitted only on
 * the majors that have the gate. On an ungated npm there is nothing to bypass
 * and the flag would be npm-12 vocabulary on a row npm 8 wrote, so it is not
 * passed: measured, npm 8.19.4 runs a dependency's `postinstall` under
 * `--foreground-scripts` alone.
 */
export function installScriptAllowanceFlags(npm: NpmRelease): readonly string[] {
	const gated = npm.major === null || npm.major >= NPM_ALLOW_SCRIPTS_MAJOR;
	return Object.freeze(
		gated
			? ['--foreground-scripts', '--dangerously-allow-all-scripts']
			: ['--foreground-scripts'],
	);
}

/** One install script npm reported starting, as npm named it. */
export type InstallScriptRun = Readonly<{
	/** The package spec npm printed, `name@version`. */
	package: string;
	/** The lifecycle npm named: `preinstall`, `install`, `postinstall`, `prepare`. */
	lifecycle: string;
}>;

/** One install script npm reported skipping, as npm named it. */
export type InstallScriptSkip = Readonly<{
	package: string;
	lifecycle: string;
	/** The script npm quoted as the one it did not run. */
	command: string;
}>;

/**
 * The install-script lifecycles npm gates and reports.
 *
 * Named rather than matched loosely, because the reading below picks a package
 * spec and a lifecycle out of lines that also carry arbitrary shell commands,
 * and a loose match would read `echo DEP2-INSTALL` as a package running a
 * script called `DEP2-INSTALL`.
 */
const INSTALL_SCRIPT_LIFECYCLES = 'preinstall|install|postinstall|prepare|prepublish';

/**
 * A script npm reported starting, in both spellings npm has used for it.
 *
 * npm 12 under `--foreground-scripts`: `npm notice run pkg@1.0.0 postinstall`.
 * npm 8 under the same flag: `> pkg@1.0.0 postinstall`. Both are followed by a
 * second line carrying the shell command itself, which this deliberately does
 * not match: the package spec is required to carry an `@`, and the line is
 * required to be exactly two tokens, so `npm notice run echo DEP2-INSTALL` and
 * `> node -e "…" && echo …` are read as the command lines they are.
 */
const INSTALL_SCRIPT_RAN_LINE = new RegExp(
	`^(?:npm notice run |> )((?:@[^\\s/]+/)?[^\\s@][^\\s]*@[^\\s]+) (${INSTALL_SCRIPT_LIFECYCLES})$`,
);

/**
 * A script npm 12 reported skipping, out of the block it ends the install with:
 *
 * ```
 * npm warn install-scripts 2 packages had install scripts blocked because they are not covered by allowScripts:
 * npm warn install-scripts   @scope/dep2@2.1.0 (install: echo DEP2-INSTALL)
 * ```
 */
const INSTALL_SCRIPT_SKIPPED_LINE = new RegExp(
	`^npm warn install-scripts\\s+((?:@[^\\s/]+/)?[^\\s@][^\\s]*@[^\\s]+) \\((${INSTALL_SCRIPT_LIFECYCLES}): (.*)\\)$`,
);

/** The count npm states at the head of that block, which is read as a check. */
const INSTALL_SCRIPT_SKIPPED_HEADER =
	/^npm warn install-scripts (\d+) packages? had install scripts blocked/;

/**
 * What npm said it ran and what npm said it skipped, read out of its output.
 *
 * `reportedSkipped` is npm's own count from the head of its skip block, kept
 * beside the entries this parsed out of it so a reading that missed a line is
 * visible as a disagreement rather than as a shorter list.
 */
export type InstallScriptActivity = Readonly<{
	ran: readonly InstallScriptRun[];
	skipped: readonly InstallScriptSkip[];
	reportedSkipped: number | null;
}>;

/** Read npm's own account of which install scripts ran and which it skipped. */
export function readInstallScriptActivity(output: string): InstallScriptActivity {
	const ran: InstallScriptRun[] = [];
	const skipped: InstallScriptSkip[] = [];
	let reportedSkipped: number | null = null;
	for (const raw of output.split('\n')) {
		const line = raw.replace(/\r$/, '');
		const started = INSTALL_SCRIPT_RAN_LINE.exec(line);
		if (started !== null) {
			ran.push(Object.freeze({ package: started[1] ?? '', lifecycle: started[2] ?? '' }));
			continue;
		}
		const blocked = INSTALL_SCRIPT_SKIPPED_LINE.exec(line);
		if (blocked !== null) {
			skipped.push(
				Object.freeze({
					package: blocked[1] ?? '',
					lifecycle: blocked[2] ?? '',
					command: blocked[3] ?? '',
				}),
			);
			continue;
		}
		const header = INSTALL_SCRIPT_SKIPPED_HEADER.exec(line);
		if (header !== null && reportedSkipped === null)
			reportedSkipped = Number.parseInt(header[1] ?? '', 10);
	}
	return Object.freeze({
		ran: Object.freeze(ran),
		skipped: Object.freeze(skipped),
		reportedSkipped:
			reportedSkipped === null || Number.isNaN(reportedSkipped) ? null : reportedSkipped,
	});
}

/** Which install-script declaration an install ran under. */
export type InstallScriptStance =
	| typeof INSTALL_SCRIPT_POLICY
	| typeof INSTALL_SCRIPT_SKIP_POLICY
	| 'none-declared';

/**
 * What the install-script policy actually delivered, on the row that claims it.
 *
 * This exists because the row used to claim an allowance instead of reading
 * one. `ran` and `skipped` are npm's own account of this install, taken out of
 * the output npm printed while it ran; neither is derived from the lockfile,
 * and `installScriptPackages` beside them stays what it always was — the
 * packages the *lockfile declares* carry a script, which is a different reading
 * with a different failure mode.
 */
export type InstallScriptReading = Readonly<{
	/** The declaration this install ran under, by the name it is declared under. */
	policy: InstallScriptStance;
	/** The npm the child resolved, read through the child's own environment. */
	npm: NpmRelease;
	/** The flags that declaration put on the command, and nothing else. */
	flags: readonly string[];
	/** Where `ran` and `skipped` were read from. */
	readFrom: string;
	ran: readonly InstallScriptRun[];
	skipped: readonly InstallScriptSkip[];
	/** npm's own count of what it skipped, or `null` when it stated none. */
	reportedSkipped: number | null;
	/** What this reading establishes, stated where the row is read. */
	claim: string;
}>;

const INSTALL_SCRIPT_READ_FROM =
	"npm's own stdout and stderr for this install: the per-script banners --foreground-scripts prints, and the `npm warn install-scripts` block a gated npm ends the install with.";

/** The install-script stance an executed plan ran under. */
export function installScriptStance(policy: InstallPolicy): InstallScriptStance {
	if (policy.allowInstallScripts) return INSTALL_SCRIPT_POLICY;
	if (policy.skipInstallScripts) return INSTALL_SCRIPT_SKIP_POLICY;
	return 'none-declared';
}

function installScriptClaim(
	stance: InstallScriptStance,
	npm: NpmRelease,
	activity: InstallScriptActivity,
	lockfile: string | null,
): string {
	const read = npm.version === null ? 'npm’s version could not be read' : `npm ${npm.version}`;
	const counts = `npm reported ${String(activity.ran.length)} script(s) started and ${String(activity.skipped.length)} skipped by policy.`;
	if (stance === INSTALL_SCRIPT_SKIP_POLICY)
		return `The \`${INSTALL_SCRIPT_SKIP_POLICY}\` policy was declared, so npm was given --ignore-scripts and no install script ran at all — the lane's own included. --ignore-scripts is a blanket skip rather than the allowScripts gate, and npm prints no per-package list for it, so \`skipped\` is empty because there was nothing to read rather than because npm skipped nothing. \`installScriptPackages\` beside this row is what the lockfile declares, which is not a reading of what npm did. Read at ${read}. ${counts}`;
	if (stance === 'none-declared')
		return `No install-script policy was declared, so this stage's refusing default stood: npm was given --ignore-scripts and no install script ran, the lane's own included. Reaching here without a declaration means the stage found nothing to refuse over — either the lockfile marked no package as carrying an install script, or ${lockfile === null ? 'no lockfile was read at all, which is this run’s case' : `${lockfile} marked none`}. \`skipped\` is empty for the same reason it is under the skip policy: --ignore-scripts produces no per-package list. Read at ${read}. ${counts}`;
	const gated = npm.major === null || npm.major >= NPM_ALLOW_SCRIPTS_MAJOR;
	return gated
		? `The \`${INSTALL_SCRIPT_POLICY}\` policy was declared and npm was given ${installScriptAllowanceFlags(npm).join(' ')}. On npm ${String(NPM_ALLOW_SCRIPTS_MAJOR)} and above a dependency's install scripts are blocked behind the \`allowScripts\` field and skipped **silently** unless a matching entry exists; --foreground-scripts decides only where the output of a script npm already chose to run is printed, so it grants nothing. --dangerously-allow-all-scripts bypasses that policy outright, which is what this declaration means: the operator declared that this closure's install scripts may run. \`ran\` and \`skipped\` are npm's own account of what followed, not this stage's expectation of it. Read at ${read}. ${counts}`
		: `The \`${INSTALL_SCRIPT_POLICY}\` policy was declared and ${read} was read through the child's own environment. This npm has no \`allowScripts\` gate: a dependency's install scripts run under --foreground-scripts alone, so no allowance flag was passed and there is none to pass. \`skipped\` is empty because this npm skips nothing by policy — not because a skip list was read and found empty. \`ran\` is what npm printed as it started each script. ${counts}`;
}

/** The install-script reading for an install that ran, from npm's own output. */
export function readInstallScripts(
	policy: InstallPolicy,
	npm: NpmRelease,
	flags: readonly string[],
	output: string,
	lockfile: string | null,
): InstallScriptReading {
	const stance = installScriptStance(policy);
	const activity = readInstallScriptActivity(output);
	return Object.freeze({
		policy: stance,
		npm,
		flags: Object.freeze([...flags]),
		readFrom: INSTALL_SCRIPT_READ_FROM,
		ran: activity.ran,
		skipped: activity.skipped,
		reportedSkipped: activity.reportedSkipped,
		claim: installScriptClaim(stance, npm, activity, lockfile),
	});
}

/**
 * What the install-script reading does not establish, on every row that carries
 * one.
 *
 * The first two are the boundaries of reading a child's output at all. The
 * third is the one a reader would otherwise get wrong: npm prints the same
 * banner for the lane's own lifecycle scripts as for its dependencies', and
 * only the dependencies' are gated.
 */
const INSTALL_SCRIPT_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	'`installScripts.ran` and `installScripts.skipped` are read from what npm printed on this run, and from nothing else. A script npm ran without printing a banner is not in `ran`, and a package npm skipped without listing it is not in `skipped`; neither list is derived from the lockfile, and neither is an inventory of every script the closure carries.',
	'`installScripts.ran` names the scripts npm reported *starting*. Whether a script completed, and whether a native build it exists to perform produced anything, is not established here — the install’s exit code is the only outcome this stage read.',
	'`installScripts.ran` includes the lane’s own package’s lifecycle scripts beside its dependencies’: npm prints the same banner for both, and this reading does not separate them. The allowScripts gate applies only to dependencies, so a lane script appearing in `ran` says nothing about whether the gate was open.',
]);

/**
 * What a run that took the install-script allowance additionally does not know.
 *
 * Appended only when the allowance was declared, because the npm-major boundary
 * only decides anything for a run that asked for scripts to run.
 */
const INSTALL_SCRIPT_ALLOWANCE_NOT_ESTABLISHED: readonly string[] = Object.freeze([
	`Which allowance this stage emits is decided by the npm major, and only two majors were measured on this host: npm 12.0.1, which gates a dependency's install scripts behind \`allowScripts\`, and npm 8.19.4, which has no such gate. npm 9, 10 and 11 were not measured; every npm below ${String(NPM_ALLOW_SCRIPTS_MAJOR)} is treated as ungated. An npm in that unmeasured range that does gate would report its skips in \`installScripts.skipped\`, so the reading stays honest, but this stage would not have granted the allowance it was asked for.`,
	'`installScripts.npm` is `npm --version` read through the environment the install child was given. A null there means the reading did not complete, and the allowance was then emitted in the gated form because that is the only form that grants anything; which npm actually ran this install is not established in that case.',
]);

function hostOf(value: string): string | null {
	if (!value.startsWith('http://') && !value.startsWith('https://')) return null;
	const parsed = parseURL(value);
	return parsed.host ?? null;
}

/** The git URL schemes npm resolves a dependency from, as npm writes them. */
const GIT_SCHEMES: readonly string[] = Object.freeze([
	'git+ssh://',
	'git+https://',
	'git+http://',
	'git+file://',
	'git://',
]);

/** Whether `value` is a git reference rather than a registry resolution. */
function isGitReference(value: string): boolean {
	return GIT_SCHEMES.some((scheme) => value.startsWith(scheme));
}

/**
 * A git dependency written the way npm writes it: `name@spec`.
 *
 * The name is the last path segment of the lockfile's own key, which is where
 * the installed package sits, so a transitive git dependency and a top-level
 * one are both named by the package rather than by their position.
 */
function gitDependencyOf(identifier: string, resolved: string): string {
	const segments = identifier.split('/').filter((part) => part !== '' && part !== 'node_modules');
	const scope = segments.length > 1 && segments[segments.length - 2]?.startsWith('@') === true;
	const name = scope
		? `${segments[segments.length - 2] ?? ''}/${segments[segments.length - 1] ?? ''}`
		: (segments[segments.length - 1] ?? identifier);
	return `${name}@${resolved}`;
}

/** Read the policy-bearing facts out of an npm lockfile. */
export function readLockfileFindings(
	lockfile: string,
	document: Record<string, unknown>,
): LockfileFindings {
	const remote = new Set<string>();
	const scripts = new Set<string>();
	const git = new Set<string>();
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
			if (resolved !== null && isGitReference(resolved))
				git.add(gitDependencyOf(key === '' ? '.' : key, resolved));
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
			if (isGitReference(resolved)) git.add(gitDependencyOf(identifier, resolved));
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
		gitDependencies: Object.freeze([...git].sort()),
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
	/** The git dependencies a declared policy admitted, or `null`. */
	gitDependenciesAllowed: GitDependencyAllowance | null;
	/**
	 * The npm this plan was built for, read through the child's environment.
	 *
	 * It decides which install-script allowance is spelled on the command, so
	 * it is carried on the plan rather than consulted twice.
	 */
	npm: NpmRelease;
	/** The flags the install-script declaration put on the command. */
	installScriptFlags: readonly string[];
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
	/**
	 * The npm the child will run, already read. It is a parameter rather than a
	 * reading taken here because nothing runs in this function, which is the
	 * property that lets a refusal arrive before the network is touched. Unread,
	 * the plan is built for a gated npm — the only shape that grants anything —
	 * and the row says the version was not established rather than naming one.
	 */
	npm: NpmRelease = UNREAD_NPM_RELEASE,
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
	/**
	 * The install-script declaration, spelled in the form the npm that will run
	 * it actually honours. `--foreground-scripts` alone was what this stage used
	 * to spell it as, and on a gated npm that spelled nothing at all.
	 */
	const installScriptFlags = policy.allowInstallScripts
		? installScriptAllowanceFlags(npm)
		: Object.freeze(['--ignore-scripts']);
	const command = [
		'npm',
		resolvedClosure === 'replay' ? 'ci' : 'install',
		'--no-audit',
		'--no-fund',
		...(policy.allowRemoteTarballs ? ['--allow-remote', 'all'] : []),
		...(policy.allowGitDependencies ? ['--allow-git', 'all'] : []),
		...installScriptFlags,
		...(policy.allowPeerConflicts ? ['--legacy-peer-deps'] : []),
	];
	return Object.freeze({
		packageManager: 'npm',
		lockfile,
		closure: resolvedClosure,
		findings,
		policy,
		foreignLockfileDisregarded: disregarded,
		/**
		 * Recorded on the declaration, not on the finding: the operator declared
		 * that this lane may fetch git dependencies, and that is true of the run
		 * whether the lockfile pinned one or not. The list beside it says which
		 * ones were read.
		 */
		gitDependenciesAllowed: policy.allowGitDependencies
			? gitDependencyAllowance(findings)
			: null,
		npm,
		installScriptFlags,
		command: Object.freeze(command),
	});
}

/**
 * The npm the child's own environment resolves, read the way its Node is.
 *
 * `npm --version` through the environment the install child is given, for the
 * same reason `readLaneRuntime` takes `node -v` there: a plan that prepended a
 * cell's `bin` is not evidence that the cell's npm is what answers, and the
 * install-script allowance this stage spells depends on which npm does. A
 * reading that does not complete returns `UNREAD_NPM_RELEASE` rather than
 * falling back to this process's own npm, which is a different npm.
 */
export async function readNpmRelease(environment: NodeJS.ProcessEnv): Promise<NpmRelease> {
	let version: string;
	try {
		const { stdout } = await run('npm', ['--version'], { env: environment });
		version = stdout.trim();
	} catch {
		return UNREAD_NPM_RELEASE;
	}
	if (version === '') return UNREAD_NPM_RELEASE;
	const major = Number.parseInt(version.split('.')[0] ?? '', 10);
	return Object.freeze({ version, major: Number.isNaN(major) ? null : major });
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

/**
 * Which runtime a lane child is to be given, decided before it is spawned.
 *
 * The era-cell stage names a Node runtime and its record states, in those
 * words, that *"the runtime named here is the runtime the lane this pipeline
 * composes will be installed and built in"*. Until this type existed nothing
 * carried that decision out of the stage: the record was written into the
 * stage table and discarded, `PATH` reached the install child verbatim, and
 * the claim was corroborated by nothing. A plan is the smallest thing that can
 * be handed to both children and then recorded on both rows.
 *
 * `pathPrefix` is the runtime directory whose `bin` goes first on `PATH`,
 * spelled as the era-cell record spells it — relative to this checkout, because
 * a record carries no absolute host paths. It is `null` whenever nothing is
 * prepended, and `source` says which of the two cases that is rather than
 * leaving a reader to infer it from a null.
 */
export type LaneRuntimePlan = Readonly<{
	/** `provisioned` when a cell runtime's `bin` is prepended; `host` when the invoking `PATH` is passed through untouched. */
	source: 'provisioned' | 'host';
	/**
	 * The supplier of the runtime this plan chose, or `null` when this stage was
	 * handed no provision at all.
	 *
	 * It is the era-cell stage's supplier exactly when the era-cell stage's
	 * provision is the one the target wants. When the two diverge — the source
	 * tree declares one era and the migrated lane's target requires another —
	 * this names the target's, and `eraDeclared` names the era's beside it.
	 */
	cellSupplier: string | null;
	/** The version read for that provision, or `null`. */
	cellVersion: string | null;
	/** The runtime directory whose `bin` is prepended to `PATH`, or `null` when none is. */
	pathPrefix: string | null;
	/**
	 * The runtime the source tree's era declared, when it is *not* the runtime
	 * above.
	 *
	 * Absent — not null — whenever there is no divergence to report, so every
	 * row published before this field existed for a lane whose era and target
	 * agree is byte-identical to the row published after it.
	 */
	eraDeclared?: EraDeclaredRuntime;
}>;

/**
 * The runtime the era-cell stage read off the source tree, carried beside the
 * one the lane was actually given.
 *
 * T045-b3 measured what its absence costs. `react-your-spotify-1-5-0`'s
 * `client/Dockerfile` reads `FROM node:16-alpine`, the era-cell stage read that
 * truthfully, and Node 16.20.2 was handed to a lane whose composed manifest
 * declares Vite 8 — which refuses Node 16 by name. The build row recorded the
 * runtime it ran in and said nothing about the reading that chose it, so the
 * contradiction between the source's era and the target's requirement was
 * invisible on the record even though both halves of it were known.
 */
export type EraDeclaredRuntime = Readonly<{
	/** `read` when a declaration in the tree named a Node major, `not-read` otherwise. */
	outcome: 'read' | 'not-read';
	/** Which declaration it was read from, e.g. `Dockerfile*#FROM a node image`. */
	source: string | null;
	/** What that declaration literally says, e.g. `node:16-alpine`. */
	declared: string | null;
	/** The supplier the era-cell stage provisioned for it. */
	supplier: string | null;
	/** The version that provision names. */
	version: string | null;
	/** Where that runtime sits, as the era-cell record spells it. */
	location: string | null;
	/** What this field is, and what it is not. */
	note: string;
}>;

/**
 * The plan for a child this flow hands no era-cell provision at all.
 *
 * `migrate --install` and `migrate --build` reach these stages without a
 * pipeline behind them, and a test calls them with a lane and nothing else.
 * The honest reading for all of them is the same one that held before this
 * seam existed: whatever the invoking `PATH` already names.
 */
export const INHERITED_LANE_RUNTIME: LaneRuntimePlan = Object.freeze({
	source: 'host',
	cellSupplier: null,
	cellVersion: null,
	pathPrefix: null,
});

/**
 * The runtime a lane child actually ran in, as the row records it.
 *
 * `resolvedVersion` is the corroboration and the reason this is a reading
 * rather than a restatement of the plan: it is `node -v` executed through the
 * very environment the child was given, so a plan that prepended a directory
 * which does not in fact supply `node` first shows up here as the host version
 * instead of the cell's. `null` means `node` was not resolvable on that
 * environment at all.
 */
export type LaneRuntime = Readonly<{
	source: 'provisioned' | 'host';
	cellSupplier: string | null;
	cellVersion: string | null;
	pathPrefix: string | null;
	/** The era the source tree declared, when it is not the runtime above. */
	eraDeclared?: EraDeclaredRuntime;
	/** `node -v` read through the child's own environment, or `null`. */
	resolvedVersion: string | null;
	/** What this reading establishes, and what it does not. */
	claim: string;
}>;

/**
 * Decide the runtime plan from an era-cell provision, by reading the disk.
 *
 * The question asked of the provision is the only one that can be answered
 * here: does its `location` name a runtime tree in this checkout that carries
 * `bin/node`? The workspace runtime cache spells its locations relative to the
 * checkout, so it does. The running process spells its location as a sentence
 * about itself, and a version manager spells its location relative to that
 * manager's own root — neither resolves here, and neither is guessed at. Both
 * fall to `host`, which is what the child would have got anyway, and the
 * supplier and version the stage named are still carried so the row says which
 * provision it was that could not be prepended.
 */
export async function planLaneRuntime(
	provision: Readonly<{ supplier: string; version: string; location: string }> | null,
): Promise<LaneRuntimePlan> {
	if (provision === null) return INHERITED_LANE_RUNTIME;
	const resolved = path.resolve(provision.location);
	const prepends = await fileExists(path.join(resolved, 'bin', 'node'));
	return Object.freeze({
		source: prepends ? ('provisioned' as const) : ('host' as const),
		cellSupplier: provision.supplier,
		cellVersion: provision.version,
		pathPrefix: prepends ? provision.location : null,
	});
}

/**
 * A Node line the migrated lane's own toolchain requires, as this repository
 * measured it.
 *
 * There is exactly one entry and it is a measurement rather than a table. The
 * temptation is to write a Node-per-Vite-major matrix from memory; this file
 * does not, because a requirement nobody here measured would be an invention
 * with the authority of a reading. A toolchain major that is not this one
 * yields no requirement at all, and the decision below says so in those words
 * rather than assuming it inherits this one's.
 */
export type TargetToolchainRequirement = Readonly<{
	/** The toolchain and major the lane declares, e.g. `vite@8`. */
	toolchain: string;
	/** What the lane manifest literally declares for it. */
	declared: string;
	/** Where that declaration was read. */
	readFrom: string;
	/** The Node lines it admits, as the toolchain itself states them. */
	admits: string;
	/** The measurement this requirement is, verbatim. */
	basis: string;
}>;

/**
 * Vite 8's Node requirement, quoted from the run that measured it.
 *
 * `react-your-spotify-1-5-0` was installed and built under Node 16.20.2 —
 * the era its own `client/Dockerfile` declares — with a lane manifest the
 * pipeline had just rewritten to Vite 8. Vite said so itself before dying, and
 * this is that sentence.
 */
export const VITE_8_NODE_REQUIREMENT =
	'You are using Node.js 16.20.2. Vite requires Node.js version 20.19+ or 22.12+. Please upgrade your Node.js version.';

/** The toolchain package whose declaration in the lane manifest is read. */
const LANE_TOOLCHAIN_PACKAGE = 'vite';

/** The one toolchain major this repository has a measured Node requirement for. */
const MEASURED_TOOLCHAIN_MAJOR = 8;

/**
 * Whether a Node version satisfies the measured Vite 8 requirement.
 *
 * The two admitted lines are the two the toolchain names — `20.19+` and
 * `22.12+` — read as literally as they are written: a `20.x` below `.19` is not
 * admitted, `21.x` is admitted by neither clause, and everything from `22.12`
 * upwards is. `null` is a version string this function could not read, which is
 * not the same answer as `false` and is never treated as one.
 */
export function nodeVersionAdmittedByVite8(version: string): boolean | null {
	const read = /^v?(\d+)\.(\d+)\./.exec(version.trim());
	if (read === null) return null;
	const major = Number.parseInt(read[1] as string, 10);
	const minor = Number.parseInt(read[2] as string, 10);
	if (major === 20) return minor >= 19;
	if (major === 22) return minor >= 12;
	return major >= 23;
}

/**
 * The Node requirement the composed lane's own toolchain declares, read off the
 * lane manifest the install stage is about to resolve.
 *
 * The lane manifest is the honest source for this: it is what the plan and
 * apply stages composed, and the build script it declares is the command the
 * build stage runs. Reading the *source* tree here would repeat the error this
 * whole seam exists to fix.
 */
export async function readLaneToolchainRequirement(
	laneDir: string,
): Promise<TargetToolchainRequirement | null> {
	const manifest = await readJsonFile(path.join(laneDir, 'package.json'));
	if (manifest === null) return null;
	const development = (manifest.devDependencies ?? {}) as Record<string, unknown>;
	const runtimeDependencies = (manifest.dependencies ?? {}) as Record<string, unknown>;
	const field = Object.hasOwn(development, LANE_TOOLCHAIN_PACKAGE)
		? 'devDependencies'
		: Object.hasOwn(runtimeDependencies, LANE_TOOLCHAIN_PACKAGE)
			? 'dependencies'
			: null;
	if (field === null) return null;
	const declared = (field === 'devDependencies' ? development : runtimeDependencies)[
		LANE_TOOLCHAIN_PACKAGE
	];
	if (typeof declared !== 'string') return null;
	const major = leadingMajor(declared);
	if (major !== MEASURED_TOOLCHAIN_MAJOR) return null;
	return Object.freeze({
		toolchain: `${LANE_TOOLCHAIN_PACKAGE}@${String(major)}`,
		declared,
		readFrom: `the lane manifest package.json#${field}.${LANE_TOOLCHAIN_PACKAGE}`,
		admits: 'Node 20.19+ or 22.12+',
		basis: `evidence/runs/react-your-spotify-1-5-0/run-record.json records this toolchain refusing an era runtime in its own words: "${VITE_8_NODE_REQUIREMENT}" No requirement is read here for any other ${LANE_TOOLCHAIN_PACKAGE} major, because this repository has measured none.`,
	});
}

/**
 * Which runtime the *target* of the composed plan needs, and whether this host
 * can be it.
 *
 * This is the correction T045-b3 measured. The era-cell stage reads the era of
 * the **source** tree, truthfully, and until this function existed that reading
 * was what the install and build children were handed. But those children do
 * not run the source tree: they run the lane the plan and apply stages just
 * composed, whose toolchain the migration chose. `react-your-spotify-1-5-0`
 * declared `FROM node:16-alpine`, was given Node 16, and its Vite 8 lane died
 * with `ReferenceError: CustomEvent is not defined` — while `react-cra-redux`,
 * the same adapter and the same Vite, built and went proven for no reason other
 * than that its tree happened to declare no era at all. An application was
 * penalised for declaring its era more precisely than one that declared none.
 *
 * Three shapes, and each says which it is rather than falling through a default:
 *
 * - **An Angular target cell.** The frozen adapter publishes the cell's own
 *   `nodeLine`; a runtime of it is provisioned through the very machinery the
 *   era-cell stage provisions with. The Angular case is *already* correct on
 *   disk today, but by coincidence of values — the 13 cell's `nodeLine` happens
 *   to equal what angular2-hn's era declares. After this it is correct because
 *   the target wants it.
 * - **A lane toolchain requirement.** The composed lane declares its own build
 *   tool, and the one this repository has measured a Node line for says so
 *   itself. The host either satisfies it — in which case the host is the
 *   runtime, which is exactly the path `react-flame-v2-4-0` and
 *   `react-cra-redux` already took — or it does not, and the build stage
 *   refuses by name rather than attempting a build that cannot start.
 * - **Nothing measured.** No target cell and no measured toolchain requirement:
 *   the era-cell provision stands, which is the behaviour every caller had
 *   before this function existed, and `satisfied` is `null` rather than `true`.
 */
export type TargetRuntimeBasis =
	| 'angular-target-cell'
	| 'lane-toolchain-requirement'
	| 'no-measured-requirement';

export type TargetRuntimeDecision = Readonly<{
	basis: TargetRuntimeBasis;
	/** The Node major the target names, when it names one. */
	targetNodeMajor: number | null;
	/** The toolchain requirement read off the lane manifest, when there is one. */
	requirement: TargetToolchainRequirement | null;
	/**
	 * Whether the runtime this host can give the lane meets the target's
	 * requirement. `null` is "no requirement was read", which is not "yes".
	 */
	satisfied: boolean | null;
	/** The plan the install and build children are handed. */
	chosen: LaneRuntimePlan;
	/** What was read, in one sentence, for the row and for a refusal to quote. */
	reading: string;
}>;

/** What the era-cell stage read, narrowed to what this decision consults. */
export type EraRuntimeReading = Readonly<{
	provision: Readonly<{ supplier: string; version: string; location: string }> | null;
	/** The architecture the era-cell stage settled on for this application. */
	architecture: string | null;
	outcome: 'read' | 'not-read' | null;
	declared: string | null;
	readFrom: string | null;
}>;

export type TargetLaneRuntimeOptions = Readonly<{
	/** The lineage the plan stage composed for, or `null` when it composed none. */
	lineage: string | null;
	/** The Angular target cell the plan resolved, with the Node line it publishes. */
	targetCell: Readonly<{ id: string; nodeLine: string; nodeMajor: number }> | null;
	/** The composed lane on disk, or `null` when no lane was written. */
	laneDir: string | null;
	era: EraRuntimeReading;
	/** The host reading the era-cell stage already took, re-read only if absent. */
	host?: HostCellReading | null;
}>;

const ERA_DECLARED_NOTE =
	"The runtime the era-cell stage read off the source tree and provisioned for it. It is recorded because it is not the runtime the lane was given: the lane is the migrated one, and the runtime above is the one that lane's target requires. Nothing here says the era reading was wrong — it is a true reading of a different tree.";

/** The era reading as a recorded divergence, or `undefined` when it agrees. */
function eraDeclaredBeside(
	era: EraRuntimeReading,
	chosen: LaneRuntimePlan,
): EraDeclaredRuntime | undefined {
	const provision = era.provision;
	if (provision === null) return undefined;
	if (provision.supplier === chosen.cellSupplier && provision.version === chosen.cellVersion)
		return undefined;
	return Object.freeze({
		outcome: era.outcome === 'read' ? ('read' as const) : ('not-read' as const),
		source: era.readFrom,
		declared: era.declared,
		supplier: provision.supplier,
		version: provision.version,
		location: provision.location,
		note: ERA_DECLARED_NOTE,
	});
}

/** The plan for a lane whose target runtime is the one this process runs. */
async function hostLaneRuntime(host: HostCellReading): Promise<LaneRuntimePlan> {
	return await planLaneRuntime({
		supplier: RUNNING_PROCESS,
		version: host.runningNodeVersion,
		location: RUNNING_PROCESS_LOCATION,
	});
}

/** Decide the runtime plan from the target of the composed plan. */
export async function planTargetLaneRuntime(
	options: TargetLaneRuntimeOptions,
): Promise<TargetRuntimeDecision> {
	const host = options.host ?? (await readHostCell());
	const architecture = options.era.architecture ?? host.architecture;
	const withEra = (
		basis: TargetRuntimeBasis,
		rest: Omit<TargetRuntimeDecision, 'basis'>,
	): TargetRuntimeDecision => {
		const eraDeclared = eraDeclaredBeside(options.era, rest.chosen);
		return Object.freeze({
			...rest,
			basis,
			chosen: Object.freeze({
				...rest.chosen,
				...(eraDeclared === undefined ? {} : { eraDeclared }),
			}),
		});
	};
	const targetCell = options.targetCell;
	if (options.lineage === 'angular' && targetCell !== null) {
		const provisioned = provisionRuntime(host, targetCell.nodeMajor, architecture);
		if (provisioned === null)
			return withEra('angular-target-cell', {
				targetNodeMajor: targetCell.nodeMajor,
				requirement: null,
				satisfied: false,
				chosen: await hostLaneRuntime(host),
				reading: `The plan stage composed this lane against ${targetCell.id}, whose published nodeLine is ${targetCell.nodeLine}, and no Node ${String(targetCell.nodeMajor)} runtime is present on ${host.platform}-${architecture} at any location this pipeline reads (${host.suppliers.join(', ')}).`,
			});
		return withEra('angular-target-cell', {
			targetNodeMajor: targetCell.nodeMajor,
			requirement: null,
			satisfied: true,
			chosen: await planLaneRuntime(provisioned.provision),
			reading: `The plan stage composed this lane against ${targetCell.id}, whose published nodeLine is ${targetCell.nodeLine}. A Node ${String(targetCell.nodeMajor)} runtime for it was ${provisioned.outcome === 'provisioned' ? 'provisioned from' : 'already present at'} ${provisioned.provision.supplier} ${provisioned.provision.version}.`,
		});
	}
	const requirement =
		options.laneDir === null ? null : await readLaneToolchainRequirement(options.laneDir);
	if (requirement !== null) {
		const satisfied = nodeVersionAdmittedByVite8(host.runningNodeVersion);
		return withEra('lane-toolchain-requirement', {
			targetNodeMajor: leadingMajor(host.runningNodeVersion),
			requirement,
			satisfied,
			chosen: await hostLaneRuntime(host),
			reading: `The composed lane declares ${requirement.toolchain} (${requirement.declared}, read from ${requirement.readFrom}), which admits ${requirement.admits}. This host runs ${host.runningNodeVersion}, which ${satisfied === true ? 'that admits' : satisfied === false ? 'that does not admit' : 'this stage could not read a major and minor out of'}.`,
		});
	}
	return withEra('no-measured-requirement', {
		targetNodeMajor: null,
		requirement: null,
		satisfied: null,
		chosen: await planLaneRuntime(options.era.provision),
		reading: `The ${options.lineage ?? 'unplanned'} lane names no target cell this pipeline reads a Node line from${options.laneDir === null ? ' and no lane manifest was composed' : `, and its manifest declares no ${LANE_TOOLCHAIN_PACKAGE} major this repository has measured a Node requirement for`}. The era-cell stage's own provision stands, which is what every stage was handed before the target was consulted at all.`,
	});
}

/**
 * The environment a lane child is spawned with under `plan`.
 *
 * When nothing is prepended this returns the environment it was given — the
 * same object, not a copy of it — so the path that existed before this seam
 * did is byte-identical to the path that exists after it. That identity is the
 * guard: `react-flame-v2-4-0` is the only fully proven run this repository has,
 * its cell is supplied by the running process, and its install and build
 * children must be spawned with exactly what they were spawned with before.
 */
export function laneRuntimeEnvironment(
	plan: LaneRuntimePlan,
	environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	if (plan.source !== 'provisioned' || plan.pathPrefix === null) return environment;
	const bin = path.join(path.resolve(plan.pathPrefix), 'bin');
	const inherited = environment.PATH ?? '';
	return { ...environment, PATH: inherited === '' ? bin : `${bin}${path.delimiter}${inherited}` };
}

/** `node -v` through `environment`, or `null` when `node` is not on it. */
async function resolvedNodeVersion(environment: NodeJS.ProcessEnv): Promise<string | null> {
	try {
		const { stdout } = await run('node', ['-v'], { env: environment });
		const read = stdout.trim();
		return read === '' ? null : read;
	} catch {
		return null;
	}
}

/**
 * Read back what the child's environment actually resolves `node` to, and say
 * what that does and does not establish.
 *
 * It is deliberately taken from the same environment object the child was
 * spawned with rather than from the plan, so the row reports a measurement of
 * the child's world instead of repeating the intention behind it.
 */
/**
 * The divergence, spelled once, for the two claims that have to state it.
 *
 * Empty for every plan that carries no `eraDeclared`, which is what keeps the
 * claim strings on an undiverged row exactly the strings they were.
 */
function eraDivergenceSentence(plan: LaneRuntimePlan): string {
	const era = plan.eraDeclared;
	if (era === undefined) return '';
	const read =
		era.source === null
			? `The era-cell stage provisioned ${String(era.supplier)} ${String(era.version)} for this tree`
			: `The era-cell stage read ${String(era.source)}, which says ${String(era.declared)}, and provisioned ${String(era.supplier)} ${String(era.version)} for it`;
	return ` ${read} — a different runtime from the one above. The lane this pipeline installs and builds is the *migrated* lane, so the runtime it is given is the one that lane's target requires; the era reading is recorded beside it under \`eraDeclared\` rather than handed to the child. Both readings are true and they are about different trees.`;
}

export async function readLaneRuntime(
	plan: LaneRuntimePlan,
	environment: NodeJS.ProcessEnv,
): Promise<LaneRuntime> {
	const resolvedVersion = await resolvedNodeVersion(environment);
	return Object.freeze({
		source: plan.source,
		cellSupplier: plan.cellSupplier,
		cellVersion: plan.cellVersion,
		pathPrefix: plan.pathPrefix,
		...(plan.eraDeclared === undefined ? {} : { eraDeclared: plan.eraDeclared }),
		resolvedVersion,
		claim:
			plan.eraDeclared !== undefined
				? `${
						plan.source === 'provisioned'
							? `The child was spawned with ${String(plan.pathPrefix)}/bin first on PATH, so \`node\` resolved to the ${String(plan.cellSupplier)} runtime this pipeline provisioned for the migrated lane's target (${String(plan.cellVersion)}).`
							: "Nothing was prepended to PATH: the runtime the migrated lane's target requires is the one this process already runs, so the child inherited the invoking PATH unchanged."
					}${eraDivergenceSentence(plan)} \`resolvedVersion\` is \`node -v\` read through that same environment${resolvedVersion === null ? ', and it read nothing: `node` was not resolvable there' : ''}. It does not establish that a tool the build script invokes by an absolute path of its own resolved through PATH too.`
				: plan.source === 'provisioned'
					? `The child was spawned with ${String(plan.pathPrefix)}/bin first on PATH, so \`node\` — and every shim in the lane's own \`node_modules/.bin\` that starts \`#!/usr/bin/env node\` — resolved to the ${String(plan.cellSupplier)} runtime the era-cell stage named (${String(plan.cellVersion)}). \`resolvedVersion\` is \`node -v\` read through that same environment${resolvedVersion === null ? ', and it read nothing: `node` was not resolvable there' : ''}. It does not establish that a tool the build script invokes by an absolute path of its own resolved through PATH too.`
					: plan.cellSupplier === null
						? `Nothing was prepended to PATH and this stage was handed no era-cell provision, so the child inherited the invoking PATH unchanged. \`resolvedVersion\` is \`node -v\` read through that environment${resolvedVersion === null ? ', and it read nothing: `node` was not resolvable there' : ''}; which runtime that is was decided outside this pipeline.`
						: `Nothing was prepended to PATH. The era-cell stage named ${plan.cellSupplier} ${String(plan.cellVersion)}, whose location is not a runtime directory carrying bin/node that this checkout can resolve — the running process supplies itself, and a version manager spells its location relative to its own root — so the child inherited the invoking PATH unchanged rather than being given a guessed directory. \`resolvedVersion\` is \`node -v\` read through that environment${resolvedVersion === null ? ', and it read nothing: `node` was not resolvable there' : ''}.`,
	});
}

/**
 * The runtime reading for a child whose environment could not be measured.
 *
 * The plan's four fields are what this pipeline decided before the child was
 * spawned, and they are true whatever happened afterwards. `resolvedVersion` is
 * the one field that is a measurement, so when the measurement does not
 * complete it stays `null` and the claim says so in those words. Nothing here
 * promotes `cellVersion` into `resolvedVersion`: a version the cell named is
 * not a version a child was observed to resolve, and a row that blurred the two
 * would be exactly the false corroboration this seam exists to prevent.
 */
export function laneRuntimeUnmeasured(plan: LaneRuntimePlan, why: string): LaneRuntime {
	return Object.freeze({
		source: plan.source,
		cellSupplier: plan.cellSupplier,
		cellVersion: plan.cellVersion,
		pathPrefix: plan.pathPrefix,
		...(plan.eraDeclared === undefined ? {} : { eraDeclared: plan.eraDeclared }),
		resolvedVersion: null,
		claim: `The four fields above are the runtime plan this stage handed the child: ${
			plan.source === 'provisioned'
				? `${String(plan.pathPrefix)}/bin was put first on the child's PATH`
				: 'nothing was prepended and the child inherited the invoking PATH'
		}.${eraDivergenceSentence(plan)} \`resolvedVersion\` is null because the measurement did not complete — ${why} — so no version is recorded here at all, and none is inferred from the plan: what \`node\` resolved to for this child is not established.`,
	});
}

/**
 * The runtime a child ran in, read after that child failed.
 *
 * It is the same reading the success path takes, through the same environment
 * object the child was spawned with, because a failed child does not make its
 * environment unreadable — `node -v` is a second process and the first one
 * exiting non-zero says nothing about it. What this adds is the honest floor: a
 * reading that itself does not complete falls to the plan with
 * `resolvedVersion: null` rather than propagating a second error out of a
 * failure path, so the row that records why a stage stopped is never lost to
 * the reading taken about it.
 */
export async function readLaneRuntimeAfterFailure(
	plan: LaneRuntimePlan,
	environment: NodeJS.ProcessEnv,
): Promise<LaneRuntime> {
	try {
		return await readLaneRuntime(plan, environment);
	} catch (error) {
		return laneRuntimeUnmeasured(
			plan,
			`reading it raised ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * What a lane child's failure carries out of the stage it stopped.
 *
 * The install and build rows record `runtime` because their records are
 * composed after the child exits 0. A child that exits non-zero throws, and the
 * row `run` composes for that throw carried five fields and no runtime at all —
 * so the runs where the runtime *is* the diagnosis (a build that dies inside
 * webpack under a Node the cell never named, with a message that names neither)
 * were exactly the runs that lost it.
 *
 * The reading is therefore taken in the stage, where the child's own
 * environment object is still in hand, and travels on the error as its `cause`.
 * Two properties of that choice are deliberate. The throw statement stays
 * `throw new Error(...)`, which is the form the refusal census counts a defect
 * site by, so carrying a runtime does not silently remove a counted site. And
 * `childError` keeps the error the child actually raised, which was previously
 * flattened into the defect message and dropped.
 */
export type LaneChildFailure = Readonly<{
	/** The runtime the failed child was measured in, or the plan it was given. */
	laneRuntime: LaneRuntime;
	/** The error the child raised, unaltered. */
	childError: unknown;
}>;

/** The `cause` a lane stage's defect is thrown with. */
export function laneChildFailure(laneRuntime: LaneRuntime, childError: unknown): LaneChildFailure {
	return Object.freeze({ laneRuntime, childError });
}

/**
 * The runtime an error carries out of the stage whose child it stopped, or
 * `null` for every error that carries none.
 *
 * `null` is the honest answer for the stages that never took a runtime plan and
 * for a failure raised before any child was spawned, and the caller records the
 * row without a runtime rather than inventing one.
 */
export function laneRuntimeOf(error: unknown): LaneRuntime | null {
	const cause: unknown = error instanceof Error ? error.cause : null;
	if (cause === null || typeof cause !== 'object') return null;
	const carried = (cause as { laneRuntime?: unknown }).laneRuntime;
	if (carried === null || typeof carried !== 'object') return null;
	const runtime = carried as LaneRuntime;
	return typeof runtime.source === 'string' && typeof runtime.claim === 'string' ? runtime : null;
}

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
	/**
	 * The git dependencies a declared policy admitted, or `null`.
	 *
	 * Present exactly when `--allow-git-dependencies` was declared, so `null`
	 * reads as "this run fetched from no git reference by declaration" rather
	 * than as "none were found".
	 */
	gitDependenciesAllowed: GitDependencyAllowance | null;
	remoteTarballDependencies: readonly string[];
	installScriptPackages: readonly string[];
	/**
	 * Which install scripts npm ran and which it skipped, read from npm.
	 *
	 * `null` only when this stage did not run, because a stage that ran always
	 * had an install-script stance — including the undeclared default, which is
	 * `--ignore-scripts` and is recorded as `none-declared` rather than left
	 * unsaid. This is the reading `installScriptPackages` above is not: that
	 * list is what the lockfile *declares*, and until this field existed the row
	 * carried the declaration and no account of what the declaration bought.
	 */
	installScripts: InstallScriptReading | null;
	command: readonly string[] | null;
	exitCode: number | null;
	/** Packages present in the lane's installed closure afterwards. */
	installedPackages: number | null;
	/** The lane-owned environment the install child was confined to. */
	sandbox: Readonly<{
		home: string | null;
		strippedVariables: readonly string[];
	}> | null;
	/** The Node runtime the install child resolved, and where it came from. */
	runtime: LaneRuntime | null;
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
		gitDependenciesAllowed: null,
		remoteTarballDependencies: Object.freeze([]),
		installScriptPackages: Object.freeze([]),
		installScripts: null,
		command: null,
		exitCode: null,
		installedPackages: null,
		sandbox: null,
		runtime: null,
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
 * What a failed install's output says about itself, read rather than guessed.
 *
 * npm prints its diagnosis on `npm error` lines and this reads those lines and
 * nothing else: the code it named, the package specs it quoted, and the request
 * it reported failing. Every field is npm's own text, carried through
 * unaltered, because the classification below turns into a refusal an operator
 * reads and the words they debug with have to be npm's rather than this
 * repository's summary of npm's.
 *
 * Both prefixes are read. npm printed `npm ERR!` through version 9 and
 * `npm error` after it, and a lane can be installed by either.
 */
export type NpmFailureReading = Readonly<{
	/** The code npm named, or `null` when it named none. */
	code: string | null;
	/** Every `npm error` line of the output, verbatim and in order. */
	errorLines: readonly string[];
	/** Every package spec npm quoted as refused, exactly as npm quoted it. */
	refusedSpecs: readonly string[];
	/** The request npm reported failing, or `null` when it reported none. */
	request: Readonly<{ url: string; host: string; reason: string }> | null;
}>;

/** npm's own prefix on a diagnostic line, in both spellings it has used. */
const NPM_ERROR_LINE = /^npm (?:error|ERR!)\s?/;

/**
 * The npm error codes that name a failure to reach a registry.
 *
 * `CERT_HAS_EXPIRED` is the measured one — `antd-admin`'s closure pins
 * `registry.npm.taobao.org`, whose certificate expired after the mirror was
 * retired. The rest are the siblings npm's own error handling names for the
 * same thing: the certificate errors Node raises for a host whose TLS cannot be
 * verified, and the two connection failures npm prints a registry-specific
 * message for (`ENOTFOUND`, `ECONNREFUSED`). The list stops there on purpose.
 * It is not a taxonomy of network failures and must not grow into one: a code
 * earns a place here by being measured against a pinned registry, not by
 * sounding like it belongs.
 */
export const REGISTRY_UNREACHABLE_CODES: readonly string[] = Object.freeze([
	'CERT_HAS_EXPIRED',
	'DEPTH_ZERO_SELF_SIGNED_CERT',
	'SELF_SIGNED_CERT_IN_CHAIN',
	'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
	'ENOTFOUND',
	'ECONNREFUSED',
]);

/** Read what npm said about the install it stopped. */
export function readNpmFailure(detail: string): NpmFailureReading {
	const errorLines: string[] = [];
	const refused: string[] = [];
	let code: string | null = null;
	let request: NpmFailureReading['request'] = null;
	for (const raw of detail.split('\n')) {
		const line = raw.replace(/\r$/, '');
		if (!NPM_ERROR_LINE.test(line)) continue;
		errorLines.push(line);
		const body = line.replace(NPM_ERROR_LINE, '');
		const named = /^code (\S+)$/.exec(body);
		if (named !== null && code === null) code = named[1] ?? null;
		const refusing = /^Refusing to fetch "(.+)"$/.exec(body);
		if (refusing !== null && refusing[1] !== undefined) refused.push(refusing[1]);
		const failing = /^request to (\S+) failed, reason: (.+)$/.exec(body);
		if (failing !== null && request === null) {
			const url = failing[1] ?? '';
			const host = hostOf(url);
			if (host !== null) request = Object.freeze({ url, host, reason: failing[2] ?? '' });
		}
	}
	return Object.freeze({
		code,
		errorLines: Object.freeze(errorLines),
		refusedSpecs: Object.freeze(refused),
		request,
	});
}

/** npm's own output, quoted into a refusal without a word changed. */
function verbatim(reading: NpmFailureReading): string {
	return `npm’s own output, unaltered:\n${reading.errorLines.join('\n')}`;
}

/**
 * The npm-failure interpretation point: name what npm refused, or say nothing.
 *
 * Every install failure used to leave here as `defect:install` with npm's wall
 * of output flattened into the message, and three of them are not defects at
 * all — they are npm reporting a decision, which is a thing an operator can
 * answer. This function is where that reading is taken, and it is deliberately
 * the *only* place: it returns for everything it does not recognise, so an
 * unclassified npm failure keeps landing on the defect path byte-for-byte as it
 * did before. A refusal is earned by a measured wall, not by a pattern that
 * looked close enough.
 */
export function refuseNamedNpmFailure(detail: string, policy: InstallPolicy): void {
	const reading = readNpmFailure(detail);
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
	 * The second: npm 12 fetches no git dependency by default, and an era
	 * application that pinned one at a git ref meets that default head-on
	 * (`coverview`, `file-saver@git+ssh://…`). It is npm's safety default
	 * meeting an era closure, which is the same shape as the remote-tarball
	 * wall and gets the same answer — a declaration, or a stop.
	 */
	if (reading.code === 'EALLOWGIT' && !policy.allowGitDependencies)
		refuse({
			code: 'install.git-dependency-policy-not-declared',
			message: `Install: npm refused the lane closure with EALLOWGIT — the closure resolves ${String(reading.refusedSpecs.length)} dependency(ies) from a git reference${reading.refusedSpecs.length === 0 ? '' : `, first ${reading.refusedSpecs[0] ?? ''}`}, and npm fetches none of those by default. Declare --${GIT_DEPENDENCY_POLICY} to carry that policy, which is a decision about what the lane's closure may be: a git dependency is fetched by running git against a remote repository rather than by resolving a registry version, so the registry's version pin, integrity hash and provenance do not apply to it. This flow does not take that decision on an operator's behalf. ${verbatim(reading)}`,
			stage: 'install',
			origin: 'pipeline',
		});
	/**
	 * The third, and the one with no policy behind it: the closure pins a
	 * registry this run could not reach (`antd-admin`, `CERT_HAS_EXPIRED`
	 * against the retired `registry.npm.taobao.org` mirror). There is no honest
	 * allowance to declare — nothing an operator can say makes an unreachable
	 * host answer — so this is a refusal that names the wall and stops, and the
	 * remedy it points at is re-pinning the closure, which is a migration.
	 *
	 * The registry host is required, and it must not be npm's own: a failure
	 * against `registry.npmjs.org` is this host's connectivity rather than
	 * something the closure pinned, and calling that a refusal of the closure
	 * would be a lie about whose problem it is. That failure stays a defect.
	 */
	if (
		reading.code !== null &&
		REGISTRY_UNREACHABLE_CODES.includes(reading.code) &&
		reading.request !== null &&
		reading.request.host !== DEFAULT_REGISTRY_HOST
	)
		refuse({
			code: 'install.closure-registry-unreachable',
			message: `Install: this closure pins ${reading.request.host}, and npm could not reach it — ${reading.code}, requesting ${reading.request.url}. There is no policy to declare here and this flow offers none: no allowance makes an unreachable registry answer, and a closure that resolves through a registry that is gone cannot be installed as recorded. What this establishes is that this run did not reach ${reading.request.host}; whether that host is retired or momentarily unreachable is not established here, and neither is what it would have served. The remedy is re-pinning the closure onto a registry that answers, which changes what the application declares and is therefore a migration decision rather than an install policy. ${verbatim(reading)}`,
			stage: 'install',
			origin: 'pipeline',
		});
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
	runtime: LaneRuntimePlan = INHERITED_LANE_RUNTIME,
): Promise<InstallRecord> {
	/**
	 * The runtime decision is applied once, here, rather than by the caller:
	 * the sandbox keeps `PATH` verbatim, so an environment prepended before it
	 * reaches this function and an environment prepended inside it are the same
	 * environment, and doing it in one place is what makes the row's `runtime`
	 * a reading of the child rather than a restatement of a caller's intent.
	 */
	const inherited = laneRuntimeEnvironment(runtime, environment);
	/**
	 * Which npm is about to run, read before the plan is built.
	 *
	 * The sandbox passes `PATH` through verbatim, so the npm this resolves is
	 * the npm the install child resolves. It is read here rather than assumed
	 * because the install-script allowance has two spellings and only one of
	 * them is honest on each npm major.
	 */
	const npm = await readNpmRelease(inherited);
	const plan = await planLaneInstall(laneDir, policy, inherited, closure, npm);
	const sandbox = planInstallSandbox(laneDir, inherited, boundaryRoot);
	for (const directory of sandbox.directories) await mkdir(directory, { recursive: true });
	const before = await snapshotInstallBoundary(boundaryRoot, laneDir);
	const [binary, ...args] = plan.command as readonly [string, ...string[]];
	let failure: unknown = null;
	/**
	 * npm's own account of the install, kept rather than discarded: it is where
	 * the per-script banners and the skipped-package block are read from.
	 */
	let output = '';
	try {
		const result = await run(binary, args, {
			cwd: laneDir,
			env: sandbox.environment,
			maxBuffer: 64 * 1024 * 1024,
		});
		output = `${result.stdout}\n${result.stderr}`;
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
		 * Every npm failure this stage has a name for is named there, in one
		 * place, and everything else falls through to the defect below exactly
		 * as it always has.
		 */
		refuseNamedNpmFailure(detail, policy);
		/**
		 * A defect after the foreign-lockfile policy was taken is bounded
		 * differently from every other install defect, and the message says so
		 * where it will be read: there was no recorded closure here, so what
		 * failed is a resolution this run made rather than a pin the application
		 * shipped. Naming the policy in the defect keeps that readable even when
		 * the stage produced no record to carry it.
		 */
		const disregard = plan.foreignLockfileDisregarded;
		/**
		 * The runtime is read here, through the sandbox environment the child was
		 * actually given, and carried out on the defect. A closure that will not
		 * install under the Node the cell named and a closure that will not
		 * install under the host's are different findings, and the row a failed
		 * install leaves behind could not tell them apart until this reading
		 * reached it.
		 */
		const childFailure = laneChildFailure(
			await readLaneRuntimeAfterFailure(runtime, sandbox.environment),
			error,
		);
		throw new Error(
			`install: ${plan.command.join(' ')} failed in the lane. This is a defect rather than a refusal: the declared policies were applied and the pinned closure still did not install.${
				disregard === null
					? ''
					: ` The \`${disregard.policy}\` policy was declared and ${disregard.lockfile} (${disregard.packageManager}) was disregarded, so there was no pinned closure: what failed is a fresh npm resolution from the lane manifest, and it is not established that the era closure would have failed the same way.`
			} ${detail}`,
			{ cause: childFailure },
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
		gitDependenciesAllowed: plan.gitDependenciesAllowed,
		remoteTarballDependencies: plan.findings?.remoteTarballDependencies ?? Object.freeze([]),
		installScriptPackages: plan.findings?.installScriptPackages ?? Object.freeze([]),
		installScripts: readInstallScripts(
			policy,
			plan.npm,
			plan.installScriptFlags,
			output,
			plan.lockfile,
		),
		command: plan.command,
		exitCode: 0,
		installedPackages: await installedPackageCount(laneDir),
		sandbox: Object.freeze({
			home: sandbox.home,
			strippedVariables: sandbox.strippedVariables,
		}),
		runtime: await readLaneRuntime(runtime, sandbox.environment),
		boundary: Object.freeze({
			root: path.resolve(boundaryRoot),
			pathsObservedBefore: before.size,
			pathsObservedAfter: after.size,
			writesOutsideLane: writes,
		}),
		notEstablished: Object.freeze([
			...INSTALL_NOT_ESTABLISHED,
			...(plan.foreignLockfileDisregarded === null ? [] : FOREIGN_LOCKFILE_NOT_ESTABLISHED),
			...(plan.gitDependenciesAllowed === null ? [] : GIT_DEPENDENCY_NOT_ESTABLISHED),
			...INSTALL_SCRIPT_NOT_ESTABLISHED,
			...(policy.allowInstallScripts ? INSTALL_SCRIPT_ALLOWANCE_NOT_ESTABLISHED : []),
		]),
	});
}
