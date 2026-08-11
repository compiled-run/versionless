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

/**
 * What a community library offers the target line, and the registry reading
 * that established it.
 *
 * `aligned` names the range to write. `no-successor` says the library published
 * nothing this cell can accept, which is a decision to *drop* the package —
 * recorded, per package, as a declared difference between the era workspace and
 * the migrated one. There is deliberately no third state: a library the cell has
 * not read is absent from the table and left exactly as the application declared
 * it, which is a different thing from a library the cell read and rejected.
 */
export type EcosystemPackage =
	| Readonly<{ kind: 'aligned'; range: string; fact: string }>
	| Readonly<{ kind: 'no-successor'; fact: string }>;

export type EcosystemPackages = Readonly<Record<string, EcosystemPackage>>;

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
	/**
	 * The community library layer, keyed by exact package name.
	 *
	 * Angular's own packages, the devkit and the lint and test toolchains are
	 * facts about the framework. This table is a different kind of fact: what a
	 * *third party* published for this Angular major. Every entry is a reading of
	 * the registry — the declared `@angular/*` peer ranges and `engines.node` of
	 * the lines that library actually shipped — and each one carries the reading
	 * that produced it in {@link EcosystemPackage.fact}.
	 *
	 * A library that never published a line this cell can accept is not silently
	 * pinned to an era version and is not silently left behind: it is declared
	 * `no-successor`, which drops it from the manifest and records why. That is a
	 * migration difference the cell states out loud, not a defect it hides.
	 */
	ecosystemPackages: EcosystemPackages;
	/** Why this cell and not a newer one. Recorded verbatim in evidence. */
	rationale: readonly string[];
	/** What adopting this cell does not establish. */
	nonclaims: readonly string[];
}>;

/**
 * The community layer as `registry.npmjs.org` published it for Angular 16,
 * read under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-11.
 *
 * One rule chose every entry, and it is mechanical rather than editorial: take
 * the newest line the package published whose declared peer ranges and
 * `engines.node` are all satisfied by this cell — its Angular major, its Node
 * line, and the ranges the cell itself writes for `rxjs`, `tslib` and the other
 * packages it names. A package whose own family versions in lockstep with the
 * Angular major collapses to the matching major under that rule; a package with
 * a wide peer range is held back by the cell's Node line rather than floated to
 * whatever is newest today. Where the rule excluded a newer line, the fact says
 * which declaration excluded it, so the reading can be checked rather than
 * trusted.
 *
 * `fact` is the reading, not a justification: each one names the published
 * version and the declaration on it that the rule tested.
 */
export const ANGULAR_16_ECOSYSTEM_PACKAGES: EcosystemPackages = Object.freeze({
	'@ant-design/icons-angular': Object.freeze({
		kind: 'aligned',
		range: '^16.0.0',
		fact: '@ant-design/icons-angular versions in lockstep with the Angular major: 16.0.0 is the only 16.x release and declares peer @angular/core ^16.0.0, @angular/common ^16.0.0, @angular/platform-browser ^16.0.0. 17.0.0 declares ^17.0.1.',
	}),
	'ng-zorro-antd': Object.freeze({
		kind: 'aligned',
		range: '^16.2.2',
		fact: 'ng-zorro-antd versions in lockstep with the Angular major: 16.2.2 is the last 16.x release and declares peer @angular/core ^16.0.0 across the six @angular packages it uses. It depends on @ant-design/icons-angular ^16.0.0 and @angular/cdk ^16.0.0, both of which this cell also carries. 17.0.0 declares ^17.0.0.',
	}),
	'@angular/http': Object.freeze({
		kind: 'no-successor',
		fact: '@angular/http stops at 7.2.16 and is deprecated on the registry with "Package no longer supported. Use @angular/common instead". Angular removed the package after the 7 line; there is no 8.x and no 16.x, so the `@angular/` family range this cell writes for its own packages names a version that was never published. The HTTP client that succeeded it is `@angular/common/http`, an entry point of a package this cell already carries, so the dependency is dropped rather than pinned to a v7 line beside a v16 framework.',
	}),
	'@angular/flex-layout': Object.freeze({
		kind: 'aligned',
		range: '^15.0.0-beta.42',
		fact: '@angular/flex-layout stops at 15.0.0-beta.42 — the newest version published on any line, and the `latest` dist-tag — so the `@angular/` family range this cell writes for Angular\'s own packages names a 16.x that was never published. Under this cell\'s rule 15.0.0-beta.42 is still the newest satisfying line: it declares peer @angular/core, @angular/common and @angular/platform-browser ">=15.0.2", @angular/cdk ">=15.0.0" and rxjs "^6.5.3 || ^7.4.0", all satisfied by the ^16.2.0 and ~7.8.0 this cell writes, and it declares no engines.node. The package is deprecated on the registry ("consider using CSS Flexbox and CSS Grid"); that is recorded here rather than acted on, because dropping a layout library an application imports is a source decision, not a cell reading.',
	}),
	'@ctrl/tinycolor': Object.freeze({
		kind: 'aligned',
		range: '^4.2.0',
		fact: '@ctrl/tinycolor declares no peers at all, so nothing in this cell excludes a line of it on that ground; 4.2.0 is the newest release published and declares engines.node ">=14", which this cell\'s Node 16.20.2 satisfies. The 3.x line before it declares ">=10" and is therefore not the newest satisfying line. Read from https://registry.npmjs.org/@ctrl/tinycolor under consent VL-LEGACY-CORPUS-2026-08-10; the four named exports the Angular 16 community layer reaches for — TinyColor, inputToRGB, rgbToHex, rgbToHsv — are all declared by 4.2.0 (https://unpkg.com/@ctrl/tinycolor@4.2.0/dist/index.d.ts, /dist/format-input.d.ts, /dist/conversion.d.ts).',
	}),
	'@datorama/akita': Object.freeze({
		kind: 'aligned',
		range: '^7.1.1',
		fact: 'Akita declares no @angular peer at all, so the Angular major does not choose it. The newer 8.0.1 is excluded by this cell: it declares peer tslib "2.4.1" as an exact version, which the tslib ^2.3.0 this cell writes does not resolve to. 7.1.1 declares only peer rxjs "*".',
	}),
	'@datorama/akita-ng-entity-service': Object.freeze({
		kind: 'aligned',
		range: '^7.0.0',
		fact: '8.0.0 declares peer @datorama/akita ">= 8.0.0", which the 7.1.1 this cell carries does not satisfy. 7.0.0 declares peer @angular/core ">= 13.0.0" and @datorama/akita ">= 7.0.0", both satisfied here.',
	}),
	'@datorama/akita-ng-router-store': Object.freeze({
		kind: 'aligned',
		range: '^7.0.0',
		fact: '8.0.0 declares peer @datorama/akita ">= 8.0.0", excluded for the same reason as the entity service. 7.0.0 declares peer @angular/core ">= 13.0.0" and @datorama/akita ">= 7.0.0".',
	}),
	'@datorama/akita-ngdevtools': Object.freeze({
		kind: 'aligned',
		range: '^7.0.0',
		fact: '7.0.0 is the newest release the package ever published; it declares peer @angular/core ">= 13.0.0" and @datorama/akita ">= 7.0.0", both satisfied here.',
	}),
	'@ngneat/content-loader': Object.freeze({
		kind: 'aligned',
		range: '^7.0.0',
		fact: '7.0.0 is the newest release and declares peer @angular/core ">= 13.0.0", satisfied by this cell. The 6.x line the era workspace carried declares no @angular peer.',
	}),
	'@ngneat/until-destroy': Object.freeze({
		kind: 'aligned',
		range: '^10.0.0',
		fact: '10.0.0 is the newest release and declares peer @angular/core ">=13" and rxjs "^6.4.0 || ^7.0.0", both satisfied by this cell.',
	}),
	'@ngneat/tailwind': Object.freeze({
		kind: 'aligned',
		range: '^7.0.3',
		fact: '7.0.3 is the newest release the package ever published and declares no peers at all, so nothing in this cell excludes it. The range is unchanged from the era workspace; it is recorded because the reading happened, not because a byte moved.',
	}),
	'@ngx-formly/core': Object.freeze({
		kind: 'aligned',
		range: '^7.1.0',
		fact: '@ngx-formly/core 7.1.0 is the newest release published and declares peer @angular/forms ">=13.2.0" and rxjs "^6.5.3 || ^7.0.0", both satisfied by this cell. It declares no @angular/core peer and no engines.node, so nothing on either axis excludes it.',
	}),
	'@ngx-formly/material': Object.freeze({
		kind: 'aligned',
		range: '^7.1.0',
		fact: '@ngx-formly/material 7.1.0 declares peer @ngx-formly/core "7.1.0" as an exact version, so the two packages move together or not at all; it also declares peer @angular/material ">=16.0.0", satisfied by the ^16.2.0 this cell writes for the @angular/ family.',
	}),
	'@ngx-translate/core': Object.freeze({
		kind: 'aligned',
		range: '^17.0.0',
		fact: '18.0.0 is the newest release but declares peer @angular/core ">=18" and @angular/common ">=18", which the ^16.2.0 this cell writes does not satisfy. 17.0.0 is the newest line left: peer @angular/core ">=16" and @angular/common ">=16", and no engines.node.',
	}),
	'@ngx-translate/http-loader': Object.freeze({
		kind: 'aligned',
		range: '^17.0.0',
		fact: '18.0.0 declares peer @angular/core ">=18", excluded for the same reason as the core package. 17.0.0 declares peer @angular/core ">=16" and @angular/common ">=16". The loader is aligned to the same major as the core it loads for, because a translate installation carrying two majors of its own core is not an installation.',
	}),
	'angular-material-css-vars': Object.freeze({
		kind: 'aligned',
		range: '^5.0.3',
		fact: 'This package versions ahead of the Angular major it supports: 11.0.0 (the `latest` dist-tag) declares peer @angular/core, @angular/common and @angular/material ">=22", 10.0.0 declares ">=21" and 9.1.1 declares ">=20". 5.0.3 is the newest release whose peers ">=16" the ^16.2.0 this cell writes satisfies. It declares no engines.node, and its own dependency @ctrl/tinycolor ^4.0.0 is a package this cell already reads at ^4.2.0.',
	}),
	'angular2-promise-buttons': Object.freeze({
		kind: 'aligned',
		range: '^6.0.0',
		fact: '6.0.0 is the newest release published and declares peer @angular/core and @angular/common ">=9.0.4", which this cell satisfies, plus dependency tslib ^2.0.0, which the ^2.3.0 this cell writes satisfies. It declares no engines.node.',
	}),
	'chart.js': Object.freeze({
		kind: 'aligned',
		range: '^4.5.1',
		fact: 'chart.js is framework independent — 4.5.1, the newest release and the `latest` dist-tag, declares no peerDependencies and no engines.node, so neither axis of this cell excludes it. It is in this table because an Angular package that is in it depends on the reading: ng2-charts 5.0.4 declares peer chart.js "^3.4.0 || ^4.0.0", so a workspace holding chart.js on its 2.x line beside that peer has no resolvable dependency tree, which is what `npm install` reports before any compiler runs. The reading is a version fact and not a source claim: chart.js 3 renamed the type surface the 2.x line published, and nothing here rewrites a call site that names one.',
	}),
	'jasmine-marbles': Object.freeze({
		kind: 'aligned',
		range: '^0.9.2',
		fact: 'jasmine-marbles versions against RxJS rather than against Angular: 0.9.2, the newest release and the `latest` dist-tag, declares peer rxjs "^7.0.0", which the ~7.8.0 this cell writes satisfies; 0.8.4 and every earlier 0.8.x declare "^6.5.3", which it does not. It declares no @angular/* peer and no engines.node. The package sits in this table rather than in the generated test toolchain because it is a community library the cell reads, and because leaving it at an era range pinned to RxJS 6 makes the whole closure unresolvable beside the RxJS 7 this cell writes.',
	}),
	'ng2-charts': Object.freeze({
		kind: 'aligned',
		range: '^5.0.4',
		fact: 'ng2-charts versions ahead of the Angular major: 10.0.0 declares peer @angular/core ">=21.0.0", 9.0.0 ">=20.0.0" and 8.0.0 ">=19.0.0". 5.0.4 is the newest release whose peer @angular/core ">=16.0.0" this cell satisfies. It also declares peer chart.js "^3.4.0 || ^4.0.0", which the era chart.js ^2.8.0 does not satisfy — that is a source-visible change of charting major and is recorded here rather than silently carried.',
	}),
	'ng2-dragula': Object.freeze({
		kind: 'aligned',
		range: '^7.0.0',
		fact: 'The `latest` dist-tag points at 6.0.0, but 7.0.0 is the newest version published and declares peer @angular/core, @angular/common and @angular/animations ">=16.0.0 <21.0.0" and rxjs ">=6.0.0 <8.0.0", all satisfied by this cell. Its peers dragula ^3.7.2 and @types/dragula ^2.1.34 are supplied by the package itself as dependencies of the installation, not by the workspace.',
	}),
	'ngx-markdown': Object.freeze({
		kind: 'aligned',
		range: '^16.0.0',
		fact: 'ngx-markdown versions in lockstep with the Angular major: 16.0.0 is the 16.x line and declares peer @angular/core, @angular/common and @angular/platform-browser "^16.0.0" plus zone.js "~0.13.0", which is exactly the zone.js range this cell writes. 22.0.0, 21.3.0 and 21.2.0 declare ^22.0.0 and ^21.0.0 respectively.',
	}),
	'ng-pick-datetime': Object.freeze({
		kind: 'no-successor',
		fact: 'ng-pick-datetime stops at 7.0.0, published 2018-10-21, and declares peer @angular/cdk "^7.0.0". No release of this package name exists for any Angular line at or beyond this cell — the maintained continuation was republished under different package names, which is a source decision about which date-time picker the application uses and not a version this cell can pick. The package is dropped and the components importing it are left for a source answer.',
	}),
	'ngx-electron': Object.freeze({
		kind: 'aligned',
		range: '^2.2.0',
		fact: '2.2.0 is the newest release published and declares peer @angular/core ">=8.0.0" and rxjs ">=6.3.0", both satisfied by this cell. Its third peer, electron ">=6.0.10", is a desktop-sidecar dependency the web build does not resolve; the range is recorded as read, and nothing here establishes that the sidecar builds.',
	}),
	jira2md: Object.freeze({
		kind: 'aligned',
		range: '^3.0.1',
		fact: 'jira2md is Angular-major independent: 3.0.1, the newest release and the `latest` dist-tag, declares no peerDependencies at all and no engines.node, so neither axis of this cell excludes it. Its single runtime dependency is marked ^4.0.12. A workspace may declare this package by a `git+https://` specifier carrying no version and no integrity hash; the registry publishes the same library under this name, so the cell aligns such a declaration onto a resolvable registry range rather than carrying an unpinned git specifier into the migrated closure.',
	}),
	'rxjs-tslint': Object.freeze({
		kind: 'no-successor',
		fact: 'rxjs-tslint stops at 0.1.8 and is a TSLint rule set, so it shares TSLint\'s fate: there is no release of it for any lint line this cell carries. It is dropped with the rest of the TSLint toolchain rather than pinned beside a lint target that no longer exists.',
	}),
	'@sentry/angular': Object.freeze({
		kind: 'aligned',
		range: '^8.55.2',
		fact: 'The 7.x line — including the era 6.x line before it — declares peer @angular/core ">= 10.x <= 15.x" and refuses Angular 16. 9.46.0 and 10.70.0 declare peer @angular/core ranges that do admit 16, but both declare engines.node ">=18", which this cell\'s Node 16.20.2 does not satisfy. 8.55.2 is the newest line left: peer @angular/core ">= 14.x <= 19.x", engines.node ">=14.18".',
	}),
	'@sentry/tracing': Object.freeze({
		kind: 'no-successor',
		fact: '@sentry/tracing stops at 7.120.4; the package has no 8.x line, because the v8 SDK folded tracing into @sentry/angular itself. Holding it at a v7 range beside a v8 SDK would install two incompatible Sentry cores, so the package is dropped and the tracing import it served is left for a source transform to answer.',
	}),
	'ngx-quill': Object.freeze({
		kind: 'aligned',
		range: '^23.0.3',
		fact: 'ngx-quill versions in lockstep with the Angular major: 23.0.3 is the last release declaring peer @angular/core ^16.0.0, and 24.0.0 moves to ^17.0.0. 23.0.3 also declares peer quill ^1.3.7, which the era workspace already carries, and engines.node "^16.14.0 || >=18.10.0", satisfied by this cell.',
	}),
	'@storybook/angular': Object.freeze({
		kind: 'aligned',
		range: '^7.6.24',
		fact: '8.6.18 declares engines.node ">=18.0.0", which this cell\'s Node 16.20.2 does not satisfy. 7.6.24 is the newest line left: engines.node ">=16.0.0" and peer @angular/core, @angular/cli, @angular-devkit/build-angular and @angular/compiler-cli all ">=14.1.0 < 19.0.0", satisfied by this cell.',
	}),
	'@storybook/addon-actions': Object.freeze({
		kind: 'aligned',
		range: '^7.6.24',
		fact: 'Storybook publishes its addons in lockstep with its core, and 7.6.24 is the last 7.x release of this addon. It is aligned to the same version as @storybook/angular because a Storybook installation with two core majors in it is not an installation.',
	}),
	'@storybook/addon-essentials': Object.freeze({
		kind: 'aligned',
		range: '^7.6.24',
		fact: 'Last 7.x release, aligned with @storybook/angular. It declares peer react and react-dom "^16.8.0 || ^17.0.0 || ^18.0.0", which the workspace does not declare and the package manager supplies.',
	}),
	'@storybook/addon-links': Object.freeze({
		kind: 'aligned',
		range: '^7.6.24',
		fact: 'Last 7.x release, aligned with @storybook/angular.',
	}),
	'@storybook/addon-google-analytics': Object.freeze({
		kind: 'no-successor',
		fact: 'The addon stops at 6.2.9: Storybook shipped no 7.x release of it, so there is no version to pair with the 7.6.24 core this cell selects. A 6.x addon beside a 7.x core is not a supported Storybook installation, so the package is dropped rather than pinned.',
	}),
	tslint: Object.freeze({
		kind: 'no-successor',
		fact: 'TSLint stops at 6.1.3 and was deprecated by its own maintainers in favour of ESLint before Angular 13 shipped. There is no TSLint release for any Angular line at or beyond this cell, so the whole TSLint toolchain is dropped rather than carried.',
	}),
	codelyzer: Object.freeze({
		kind: 'no-successor',
		fact: 'codelyzer stops at 6.0.2, a TSLint rule set for Angular 9-era workspaces. Nothing succeeds it on the TSLint line and its ESLint replacement is @angular-eslint, which this cell already aligns as a family.',
	}),
	'nz-tslint-rules': Object.freeze({
		kind: 'no-successor',
		fact: 'nz-tslint-rules stops at 0.901.2, the only version ever published. It is a TSLint rule set for ng-zorro-antd and has no successor on any lint line.',
	}),
});

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
		'@angular-eslint/': '^16.1.0',
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
	ecosystemPackages: ANGULAR_16_ECOSYSTEM_PACKAGES,
	rationale: Object.freeze([
		'Angular 16 accepts Node ^16.14.0 || ^18.10.0; this host carries a native Node 16.20.2, which is inside that range.',
		'The `browser` builder the era workspace already declares is still the mainstream application builder on the Angular 16 line, so the builder identity survives the hop unchanged.',
		'A newer line was not declared because it would pair an unverified Node line with a builder swap in the same step, and neither could be evidenced here.',
		'@angular-eslint is versioned in lockstep with the Angular major it lints — its 16.x line is the one published for Angular 16 — and its schematics package pins a peer range on the matching @angular/cli major. An era @angular-eslint left in place makes the closure unresolvable, so the family is aligned with the framework rather than left behind.',
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
	/**
	 * Removals the cell declared rather than discovered: one line per package the
	 * cell read and found no successor for. These are differences between the era
	 * workspace and the migrated one that a reader is owed by name, not defects.
	 */
	declaredDifferences: readonly string[];
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

/**
 * The cell's disposition of one community package, or null when the cell has
 * not read it.
 */
export function ecosystemDispositionOf(
	name: string,
	cell: AngularTargetCell,
): EcosystemPackage | null {
	return cell.ecosystemPackages[name] ?? null;
}

/** The range the cell asks for, or null when the cell says nothing about it. */
export function alignedVersionRange(name: string, cell: AngularTargetCell): string | null {
	const exact = cell.packages[name];
	if (exact !== undefined) return exact;
	const test = cell.testPackages[name];
	if (test !== undefined) return test;
	const ecosystem = cell.ecosystemPackages[name];
	if (ecosystem !== undefined) return ecosystem.kind === 'aligned' ? ecosystem.range : null;
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
	const declaredDifferences: string[] = [];
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
				/**
				 * A package can be released by a removed target *and* be one the cell
				 * read and found no successor for. The removal is recorded once, but
				 * the disposition is recorded too: the target going away is why it
				 * left this manifest, and the missing successor line is why it is not
				 * coming back on another target.
				 */
				const alsoDeclared = cell.ecosystemPackages[name];
				if (alsoDeclared !== undefined && alsoDeclared.kind === 'no-successor')
					declaredDifferences.push(
						`${field}.${name} was removed: the migrated workspace no longer carries it. ${alsoDeclared.fact}`,
					);
				continue;
			}
			const disposition = cell.ecosystemPackages[name];
			if (disposition !== undefined && disposition.kind === 'no-successor') {
				changes.push({
					field,
					name,
					from,
					to: null,
					reason: `no successor line for ${cell.id}: ${disposition.fact}`,
				});
				declaredDifferences.push(
					`${field}.${name} was removed: the migrated workspace no longer carries it. ${disposition.fact}`,
				);
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
					reason: alignmentReason(name, cell),
				});
		}
		next[field] = updated;
	}
	return Object.freeze({
		manifest: Object.freeze(next),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort(compareStrings)),
		declaredDifferences: Object.freeze(declaredDifferences.sort(compareStrings)),
	});
}

function alignmentReason(name: string, cell: AngularTargetCell): string {
	if (cell.testPackages[name] !== undefined)
		return `aligned to the test toolchain ${cell.id} generates`;
	const ecosystem = cell.ecosystemPackages[name];
	if (ecosystem !== undefined && ecosystem.kind === 'aligned')
		return `aligned to the community layer ${cell.id} declares: ${ecosystem.fact}`;
	return `aligned to ${cell.id}`;
}

const TEST_TOOLCHAIN_PREFIXES: readonly string[] = Object.freeze([
	'karma',
	'jasmine',
	'@types/jasmine',
]);
