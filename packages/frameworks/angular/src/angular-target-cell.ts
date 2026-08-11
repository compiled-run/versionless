/**
 * Declared migration target cells for an Angular CLI workspace, and the
 * dependency alignment an upgrade to one of them performs.
 *
 * A cell is a named tuple of (Angular line, official builder, Node line,
 * TypeScript line). Nothing here is application specific: the tables describe
 * the Angular ecosystem, keyed by package name and package family, and are
 * applied to whatever manifest they are handed.
 *
 * The version strings are *ranges written into the manifest*, exactly as the
 * official upgrade path writes them. They are a request to the package
 * manager, not a claim that any particular patch release was resolved: this
 * module performs no installation and observes no registry.
 */

export type AngularVersionRanges = Readonly<Record<string, string>>;

export type AngularTargetCell = Readonly<{
	/** Stable identifier used in migration records. */
	id: string;
	/** The Angular major line this cell targets. */
	angularLine: string;
	/** The official builder the application is expected to build with. */
	builder: string;
	/** The Node line the target cell is declared against. */
	nodeLine: string;
	/** The TypeScript range the Angular line accepts. */
	typescriptRange: string;
	/** Version range per exact package name. Wins over {@link families}. */
	packages: AngularVersionRanges;
	/** Version range per package name prefix, longest prefix wins. */
	families: AngularVersionRanges;
	/**
	 * The unit-test toolchain the Angular line's own schematics generate, keyed
	 * by exact package name.
	 *
	 * This is a separate table from {@link packages} because it answers a
	 * different question. `packages` says what the build cell needs; this says
	 * what the line's `ng new` output pairs with that build cell. A package named
	 * here is aligned; a test-toolchain package the line does not generate is
	 * left at its era range and reported, because choosing a version for it is a
	 * decision about the application's test cell rather than a fact about the
	 * Angular line.
	 */
	testPackages: AngularVersionRanges;
	/** Why this cell and not a newer one. Recorded verbatim in evidence. */
	rationale: readonly string[];
	/** What adopting this cell does not establish. */
	nonclaims: readonly string[];
}>;

/**
 * Angular 16 with the `browser` builder.
 *
 * Chosen over a newer line for reasons that are recorded rather than implied:
 * Angular 16 is the newest line whose published Node support range includes a
 * Node runtime this host actually carries natively (Node 16.20.2 sits inside
 * Angular 16's `^16.14.0 || ^18.10.0`), and it is the newest line on which
 * `@angular-devkit/build-angular:browser` — the builder the era workspace
 * already declares — is still the mainstream application builder, so the
 * builder identity is carried across the hop instead of being swapped for the
 * `application` builder at the same time as the framework version.
 */
export const ANGULAR_16_BROWSER_CELL: AngularTargetCell = Object.freeze({
	id: 'angular-16-browser-builder',
	angularLine: '16.2',
	builder: '@angular-devkit/build-angular:browser',
	nodeLine: '16.20.2',
	typescriptRange: '~5.1.3',
	packages: Object.freeze({
		rxjs: '~7.8.0',
		'zone.js': '~0.13.0',
		tslib: '^2.3.0',
		typescript: '~5.1.3',
	}),
	families: Object.freeze({
		'@angular/': '^16.2.0',
		'@angular-devkit/': '^16.2.0',
		'@schematics/': '^16.2.0',
		'@ngrx/': '^16.3.0',
	}),
	testPackages: Object.freeze({
		'@types/jasmine': '~4.3.0',
		'jasmine-core': '~4.6.0',
		karma: '~6.4.0',
		'karma-chrome-launcher': '~3.2.0',
		'karma-coverage': '~2.2.0',
		'karma-jasmine': '~5.1.0',
		'karma-jasmine-html-reporter': '~2.1.0',
	}),
	rationale: Object.freeze([
		'Angular 16 accepts Node ^16.14.0 || ^18.10.0; this host carries a native Node 16.20.2, which is inside that range.',
		'The `browser` builder the era workspace already declares is still the mainstream application builder on the Angular 16 line, so the builder identity survives the hop unchanged.',
		'A newer line was not declared because it would pair an unverified Node line with a builder swap in the same step, and neither could be evidenced here.',
		'The test toolchain is declared as the versions this line’s own schematics generate. Leaving it at its era ranges is not a neutral choice: an era jasmine pinned below what a floating karma reporter range now demands makes the dependency closure unresolvable, so the install that the build cell needs cannot happen at all.',
	]),
	nonclaims: Object.freeze([
		'Declaring a cell installs nothing and resolves nothing. The version ranges here are requests written into a manifest, not observed registry contents.',
		'Nothing here establishes that an application aligned to this cell compiles, builds, or behaves as it did on its era cell.',
		'Aligning the test toolchain to the versions the line generates makes the closure resolvable. It does not migrate a karma configuration file, and it establishes nothing about whether the application’s tests then run or pass.',
	]),
});

export const ANGULAR_TARGET_CELLS: readonly AngularTargetCell[] = Object.freeze([
	ANGULAR_16_BROWSER_CELL,
]);

export type PackageManifest = Readonly<Record<string, unknown>>;

export type DependencyChange = Readonly<{
	field: 'dependencies' | 'devDependencies';
	name: string;
	from: string;
	to: string | null;
	reason: string;
}>;

export type ManifestAlignment = Readonly<{
	manifest: PackageManifest;
	changes: readonly DependencyChange[];
	unhandled: readonly string[];
}>;

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'] as const;

/**
 * Packages that exist only to serve a builder the modern devkit no longer
 * ships. They are removed together with the target that used them, never on
 * their own — the workspace migration decides whether the target is dropped
 * and passes the released package names here.
 */
export const REMOVED_BUILDER_PACKAGES: Readonly<Record<string, readonly string[]>> = Object.freeze({
	'@angular-devkit/build-angular:tslint': Object.freeze(['tslint', 'codelyzer']),
	'@angular-devkit/build-angular:protractor': Object.freeze([
		'protractor',
		'jasmine-spec-reporter',
		'@types/jasminewd2',
	]),
});

export function compareStrings(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

/** The range the cell asks for, or null when the cell says nothing about it. */
export function alignedVersionRange(name: string, cell: AngularTargetCell): string | null {
	const exact = cell.packages[name];
	if (exact !== undefined) return exact;
	const test = cell.testPackages[name];
	if (test !== undefined) return test;
	let match: string | null = null;
	let matchedPrefix = '';
	for (const [prefix, range] of Object.entries(cell.families))
		if (name.startsWith(prefix) && prefix.length > matchedPrefix.length) {
			match = range;
			matchedPrefix = prefix;
		}
	return match;
}

function dependencyRecord(manifest: PackageManifest, field: string): Record<string, string> {
	const value = manifest[field];
	if (value === undefined) return {};
	if (typeof value !== 'object' || value === null || Array.isArray(value))
		throw new Error(`Angular manifest alignment: "${field}" is not an object`);
	const entries: Record<string, string> = {};
	for (const [name, range] of Object.entries(value as Record<string, unknown>)) {
		if (typeof range !== 'string')
			throw new Error(`Angular manifest alignment: "${field}.${name}" is not a string`);
		entries[name] = range;
	}
	return entries;
}

/**
 * Rewrite a manifest's Angular-ecosystem dependency ranges onto the declared
 * cell, and drop packages released by builders the workspace migration removed.
 *
 * What this does not do, and reports instead of hiding: a package outside the
 * cell's tables is left exactly as it is. The test toolchain is aligned only as
 * far as the cell's `testPackages` table reaches — the packages the line's own
 * schematics generate — and a karma or jasmine package outside that set is left
 * at its era range and reported as unhandled, because picking a version for it
 * is a decision about the application's test cell rather than a fact about the
 * Angular line.
 */
export function alignAngularPackageManifest(
	manifest: PackageManifest,
	cell: AngularTargetCell,
	removedPackages: readonly string[] = [],
): ManifestAlignment {
	const removed = new Set(removedPackages);
	const changes: DependencyChange[] = [];
	const unhandled: string[] = [];
	const next: Record<string, unknown> = { ...manifest };
	for (const field of DEPENDENCY_FIELDS) {
		if (manifest[field] === undefined) continue;
		const current = dependencyRecord(manifest, field);
		const updated: Record<string, string> = {};
		for (const name of Object.keys(current).sort(compareStrings)) {
			const from = current[name] as string;
			if (removed.has(name)) {
				changes.push({
					field,
					name,
					from,
					to: null,
					reason: 'released by a builder target the workspace migration removed',
				});
				continue;
			}
			const range = alignedVersionRange(name, cell);
			if (range === null) {
				updated[name] = from;
				if (TEST_TOOLCHAIN_PREFIXES.some((prefix) => name.startsWith(prefix)))
					unhandled.push(
						`${field}.${name} is coupled to the Angular test cell but is not part of the ` +
							`toolchain ${cell.id} generates, so it was left at its era range`,
					);
				continue;
			}
			updated[name] = range;
			if (range !== from)
				changes.push({
					field,
					name,
					from,
					to: range,
					reason:
						cell.testPackages[name] === undefined
							? `aligned to ${cell.id}`
							: `aligned to the test toolchain ${cell.id} generates`,
				});
		}
		next[field] = updated;
	}
	return Object.freeze({
		manifest: Object.freeze(next),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort(compareStrings)),
	});
}

const TEST_TOOLCHAIN_PREFIXES: readonly string[] = Object.freeze([
	'karma',
	'jasmine',
	'@types/jasmine',
]);
