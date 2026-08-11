/**
 * Removal of the TSLint lint toolchain from a workspace whose target cell has
 * no TSLint line to move it to.
 *
 * TSLint is the one part of an Angular workspace that cannot be *migrated*. Its
 * packages stopped, its rule sets stopped, and no version of any of them was
 * ever published for a modern Angular line — so a cell that lifts a workspace
 * past that point either drops the toolchain or refuses the hop. This capability
 * drops it, and records every removal by name so the drop is a declared
 * difference between the era workspace and the migrated one rather than a
 * silent loss of a lint gate.
 *
 * Nothing here decides *whether* the drop applies: the cell does, by declaring
 * `tslint` a `no-successor` package in its ecosystem table. A cell that carries
 * a TSLint line leaves every target and configuration file below untouched.
 *
 * What this deliberately does not do: choose a replacement. Whether the
 * workspace adopts @angular-eslint, keeps an ESLint configuration it already
 * has, or lints nothing is a decision about the project. The removal record says
 * what was lost so that decision can be made with the loss in view.
 */

import type { AngularTargetCell } from './angular-target-cell.ts';

/** Configuration files that exist only to configure TSLint. */
export const TSLINT_CONFIG_FILENAMES: readonly string[] = Object.freeze([
	'tslint.json',
	'tslint.yaml',
	'tslint.yml',
]);

/**
 * True when the cell has read the TSLint line and found no successor for it.
 *
 * This is read off the cell's own ecosystem table rather than carried as a
 * separate flag, so a cell cannot declare `tslint` unmigratable in one place and
 * keep its targets in another.
 */
export function targetLineDropsTslint(cell: AngularTargetCell): boolean {
	return cell.ecosystemPackages['tslint']?.kind === 'no-successor';
}

/**
 * True for a builder that runs TSLint.
 *
 * Matched on the `:tslint` target suffix rather than on one package name: the
 * devkit shipped `@angular-devkit/build-angular:tslint`, and community builders
 * that wrap TSLint use the same target name, so the suffix is the honest
 * signal. A builder is identified by what it runs, not by who published it.
 */
export function isTslintBuilder(builder: string): boolean {
	return builder.endsWith(':tslint');
}

/** The file's name without its directories, for a workspace-relative path. */
function basenameOf(path: string): string {
	const slash = path.lastIndexOf('/');
	return slash === -1 ? path : path.slice(slash + 1);
}

/** True for a path naming a TSLint configuration file, at any depth. */
export function isTslintConfigPath(path: string): boolean {
	return TSLINT_CONFIG_FILENAMES.includes(basenameOf(path));
}

export type TslintRemoval = Readonly<{
	kind: 'target' | 'config';
	/** The workspace path of the target, or the path of the configuration file. */
	at: string;
	/** What was removed and why, recorded verbatim in evidence. */
	reason: string;
}>;

/**
 * The TSLint configuration files this workspace carries, as removals.
 *
 * Handed the workspace's file paths; a file that was not handed here is not
 * removed, because a capability that deletes files it never saw is a capability
 * that deletes files it does not understand.
 */
export function tslintConfigRemovals(
	paths: readonly string[],
	cell: AngularTargetCell,
): readonly TslintRemoval[] {
	if (!targetLineDropsTslint(cell)) return Object.freeze([]);
	return Object.freeze(
		paths.filter(isTslintConfigPath).map((path) =>
			Object.freeze({
				kind: 'config' as const,
				at: path,
				reason:
					`${path} configures TSLint, and ${cell.id} carries no TSLint line for it to configure. ` +
					'The file was removed with the targets that read it; no rule in it was translated to another linter.',
			}),
		),
	);
}

/** The removal record for one TSLint target, for the workspace migration. */
export function tslintTargetRemoval(
	targetPath: string,
	builder: string,
	cell: AngularTargetCell,
): TslintRemoval {
	return Object.freeze({
		kind: 'target',
		at: targetPath,
		reason:
			`${targetPath} ran ${builder}, and ${cell.id} carries no TSLint line. The target was removed ` +
			'as a declared migration difference: the era workspace lints with TSLint and the migrated ' +
			'workspace does not, and no replacement lint capability was chosen here.',
	});
}
