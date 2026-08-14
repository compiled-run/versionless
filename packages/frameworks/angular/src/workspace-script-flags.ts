/**
 * The npm scripts that drive the workspace, retargeted onto the flags the
 * migrated workspace and the cell's CLI line still accept.
 *
 * A workspace migration rewrites the document the build is *configured* by and
 * leaves the command line that *invokes* it exactly where it was. For most of a
 * manifest that is correct — a script is a project's own sentence and not a
 * schema — but two classes of flag stop being sentences and become defects the
 * moment the workspace beneath them changes:
 *
 * - a flag that sets a builder option the workspace migration just removed, and
 * - a flag the CLI line the cell targets no longer parses at all.
 *
 * Either one turns a build script into an immediate refusal from the CLI's own
 * argument parser, and neither is visible in a changeset that reports only the
 * workspace document. The measured case is one line of one application:
 * `ng build --prod --aot --extract-css`, where `extractCss` was removed from the
 * production configuration by the workspace migration in the same changeset and
 * `--prod` was removed from the CLI after the 11 line.
 *
 * ## What gates it
 *
 * Nothing here rewrites a script because it looks like a build. Three detectors
 * have to agree before a byte moves:
 *
 * - the command segment has to *invoke the workspace's own CLI binary* — its
 *   first word is `ng` — because a flag spelled the same way on another program
 *   means whatever that program says it means,
 * - a dropped flag has to name a builder option this workspace migration actually
 *   removed, read from the migration's own changes rather than from a list of
 *   flags that were removed somewhere at some point, and
 * - a retargeted flag has to be one the cell's Angular major is past, and its
 *   replacement has to name a configuration the migrated workspace really
 *   declares.
 *
 * Everything else is reported rather than rewritten: a script whose command this
 * cannot parse without guessing — a quoted segment, a flag that may be carrying a
 * separate value — is left byte-identical and named in `unhandled`, because a
 * half-rewritten command line is worse than one that fails honestly.
 */

import { compareStrings, majorOf, type AngularTargetCell, type PackageManifest } from './angular-target-cell.ts';
import { REMOVED_BUILDER_OPTIONS, type ConfigChange } from './angular-workspace-migration.ts';

/** The npm script field this capability reads. */
const SCRIPTS_FIELD = 'scripts';

/** The workspace's own CLI binary, as a script's first word. */
export const ANGULAR_CLI_BINARY = 'ng';

/**
 * A flag the Angular CLI stopped parsing, and what it became.
 *
 * This is a reading of the CLI's own flag surface, kept here rather than on the
 * cell because it is a fact about the tool the cell names rather than about the
 * package versions the cell writes. `removedAfterMajor` is the last CLI major
 * that accepted the flag, so a cell on that major or below leaves it alone: the
 * capability stands down on a hop that does not cross the removal.
 */
export type RemovedCliFlag = Readonly<{
	flag: string;
	removedAfterMajor: number;
	/** The spelling that replaces it, or null when the flag simply went away. */
	successor: string | null;
	/**
	 * The configuration name the successor selects, when the successor is a
	 * configuration selection. The retarget is refused unless the migrated
	 * workspace really declares it.
	 */
	requiresConfiguration?: string;
	fact: string;
}>;

export const REMOVED_ANGULAR_CLI_FLAGS: readonly RemovedCliFlag[] = Object.freeze([
	Object.freeze({
		flag: '--prod',
		removedAfterMajor: 11,
		successor: '--configuration production',
		requiresConfiguration: 'production',
		fact: '`--prod` was a shorthand for `--configuration production` and was removed from the Angular CLI after the 11 line; a 12-or-later CLI reports it as an unknown argument and exits before the builder runs. The replacement selects the same configuration by name, which is why the retarget is refused where the migrated workspace does not declare one.',
	}),
]);

export type ScriptFlagChange = Readonly<{
	kind: 'removed-builder-flag' | 'retargeted-cli-flag';
	/** The npm script the flag was written in. */
	script: string;
	/** The flag exactly as the era script wrote it. */
	from: string;
	/** What replaced it, or null when it was dropped. */
	to: string | null;
	reason: string;
}>;

export type WorkspaceScriptMigration = Readonly<{
	manifest: PackageManifest;
	changes: readonly ScriptFlagChange[];
	unhandled: readonly string[];
}>;

function objectAt(value: unknown): Readonly<Record<string, unknown>> | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	return value as Readonly<Record<string, unknown>>;
}

/** camelCase as a command-line flag spells it: `extractCss` -> `--extract-css`. */
export function optionFlagSpelling(option: string): string {
	let spelled = '';
	for (const character of option) {
		const lower = character.toLowerCase();
		if (lower !== character) spelled += '-';
		spelled += lower;
	}
	return `--${spelled}`;
}

/**
 * The flags whose builder option *this* workspace migration removed.
 *
 * Read from the migration's own changes so the set is a fact about this
 * workspace: an option the era document never declared is not in it, and a
 * script that passes the matching flag anyway is left alone and reported. The
 * change has to be a removal (`to === null`) of a key the builder schema is
 * known to have dropped, which is what keeps an unrelated removal — a
 * `defaultProject`, a lint target — from inventing a flag rule.
 */
export function removedBuilderOptionFlags(
	changes: readonly ConfigChange[],
): Readonly<Record<string, string>> {
	const flags: Record<string, string> = {};
	for (const change of changes) {
		if (change.to !== null) continue;
		const option = change.path.split('.').at(-1) ?? '';
		if (!REMOVED_BUILDER_OPTIONS.includes(option)) continue;
		flags[optionFlagSpelling(option)] = change.path;
	}
	return Object.freeze(flags);
}

/** Every configuration name the migrated workspace declares, across its targets. */
export function declaredConfigurationNames(workspaceConfig: string): readonly string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(workspaceConfig) as unknown;
	} catch {
		return Object.freeze([]);
	}
	const names = new Set<string>();
	const projects = objectAt(objectAt(parsed)?.['projects']);
	for (const project of Object.values(projects ?? {})) {
		const entry = objectAt(project);
		if (entry === null) continue;
		const architect = objectAt(entry['architect']) ?? objectAt(entry['targets']);
		for (const target of Object.values(architect ?? {})) {
			const configurations = objectAt(objectAt(target)?.['configurations']);
			for (const name of Object.keys(configurations ?? {})) names.add(name);
		}
	}
	return Object.freeze([...names].sort(compareStrings));
}

/** True for a command segment this capability declines to take apart. */
function isUnparseableSegment(segment: string): boolean {
	return segment.includes('"') || segment.includes("'") || segment.includes('`');
}

type SegmentRewrite = Readonly<{
	segment: string;
	changes: readonly ScriptFlagChange[];
	unhandled: readonly string[];
}>;

function rewriteSegment(
	script: string,
	segment: string,
	removedFlags: Readonly<Record<string, string>>,
	cell: AngularTargetCell,
	configurations: readonly string[],
): SegmentRewrite {
	const tokens = segment.split(' ').filter((token) => token !== '');
	if (tokens[0] !== ANGULAR_CLI_BINARY)
		return Object.freeze({ segment, changes: Object.freeze([]), unhandled: Object.freeze([]) });
	const cellMajor = majorOf(cell.angularLine);
	const changes: ScriptFlagChange[] = [];
	const unhandled: string[] = [];
	const written: string[] = [];
	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index] as string;
		if (!token.startsWith('--')) {
			written.push(token);
			continue;
		}
		const carriesValue = token.includes('=');
		const next = tokens[index + 1];
		const separatedValue = !carriesValue && next !== undefined && !next.startsWith('-');
		const removedFrom = removedFlags[token];
		if (removedFrom !== undefined) {
			if (carriesValue || separatedValue) {
				written.push(token);
				unhandled.push(
					`${SCRIPTS_FIELD}.${script} passes ${token}, whose builder option this migration ` +
						`removed at ${removedFrom}, and the flag is written with a value. The script was left ` +
						'byte-identical: dropping a flag without knowing whether the word after it is that ' +
						"flag's value would rewrite the command into a different one.",
				);
				continue;
			}
			changes.push(
				Object.freeze({
					kind: 'removed-builder-flag' as const,
					script,
					from: token,
					to: null,
					reason:
						`${token} sets a builder option this migration removed from the workspace at ` +
						`${removedFrom}; the ${cell.builder} of ${cell.id} rejects the option, so the script ` +
						'that passes it would be refused by the builder schema before the build began.',
				}),
			);
			continue;
		}
		const removedFlag = REMOVED_ANGULAR_CLI_FLAGS.find((entry) => entry.flag === token);
		if (removedFlag === undefined) {
			written.push(token);
			continue;
		}
		if (cellMajor === null || cellMajor <= removedFlag.removedAfterMajor) {
			written.push(token);
			continue;
		}
		if (
			removedFlag.requiresConfiguration !== undefined &&
			!configurations.includes(removedFlag.requiresConfiguration)
		) {
			written.push(token);
			unhandled.push(
				`${SCRIPTS_FIELD}.${script} passes ${token}, which the Angular CLI removed after the ` +
					`${String(removedFlag.removedAfterMajor)} line, and its replacement selects the ` +
					`"${removedFlag.requiresConfiguration}" configuration, which the migrated workspace does ` +
					'not declare. The script was left as it is rather than pointed at a configuration that ' +
					'does not exist.',
			);
			continue;
		}
		if (removedFlag.successor === null) {
			changes.push(
				Object.freeze({
					kind: 'retargeted-cli-flag' as const,
					script,
					from: token,
					to: null,
					reason: removedFlag.fact,
				}),
			);
			continue;
		}
		written.push(...removedFlag.successor.split(' '));
		changes.push(
			Object.freeze({
				kind: 'retargeted-cli-flag' as const,
				script,
				from: token,
				to: removedFlag.successor,
				reason: removedFlag.fact,
			}),
		);
	}
	return Object.freeze({
		segment: written.join(' '),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}

/**
 * Retarget the workspace's own npm scripts onto the migrated workspace.
 *
 * The manifest handed here is the migrated one, and the changes handed here are
 * the workspace migration's own: this capability decides nothing about which
 * builder options survive, it only carries what that decision means for the
 * command lines that invoke them. A manifest with no `scripts` block has nothing
 * retargeted, and so does a workspace migration that removed no builder option
 * and a cell whose CLI line still parses every flag the scripts write.
 */
export function retargetWorkspaceScripts(
	manifest: PackageManifest,
	workspaceChanges: readonly ConfigChange[],
	cell: AngularTargetCell,
	migratedWorkspaceConfig = '',
): WorkspaceScriptMigration {
	const scripts = objectAt(manifest[SCRIPTS_FIELD]);
	if (scripts === null)
		return Object.freeze({
			manifest,
			changes: Object.freeze([]),
			unhandled: Object.freeze([]),
		});
	const removedFlags = removedBuilderOptionFlags(workspaceChanges);
	const configurations = declaredConfigurationNames(migratedWorkspaceConfig);
	const changes: ScriptFlagChange[] = [];
	const unhandled: string[] = [];
	const next: Record<string, unknown> = {};
	for (const [script, command] of Object.entries(scripts)) {
		if (typeof command !== 'string') {
			next[script] = command;
			continue;
		}
		const separator = '&&';
		const segments = command.split(separator);
		if (!segments.some((segment) => segment.trim().startsWith(`${ANGULAR_CLI_BINARY} `))) {
			next[script] = command;
			continue;
		}
		if (isUnparseableSegment(command)) {
			next[script] = command;
			unhandled.push(
				`${SCRIPTS_FIELD}.${script} invokes ${ANGULAR_CLI_BINARY} inside a quoted command this ` +
					'migration does not take apart, so it was left byte-identical. Whether the flags it ' +
					'passes are still accepted by the migrated workspace is unestablished.',
			);
			continue;
		}
		const rewritten: string[] = [];
		const scriptChanges: ScriptFlagChange[] = [];
		for (const segment of segments) {
			const trimmed = segment.trim();
			const result = rewriteSegment(script, trimmed, removedFlags, cell, configurations);
			scriptChanges.push(...result.changes);
			unhandled.push(...result.unhandled);
			rewritten.push(result.segment);
		}
		changes.push(...scriptChanges);
		next[script] =
			scriptChanges.length === 0 ? command : rewritten.join(` ${separator} `).trim();
	}
	return Object.freeze({
		manifest: Object.freeze({ ...manifest, [SCRIPTS_FIELD]: Object.freeze(next) }),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled),
	});
}
