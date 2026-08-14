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

import { parseURL } from 'ufo';

export type AngularVersionRanges = Readonly<Record<string, string>>;

/**
 * The fork relation between two package names, as the packages and the forge
 * that hosts them declare it.
 *
 * A fork claim is the one ecosystem reading that cannot be made from the
 * registry alone. Two packages describing themselves the same way, or naming
 * each other in prose, establishes nothing: the same description is what a
 * reimplementation and a continuation both have. What this record carries is a
 * relation a third party states about the two repositories — the forge's own
 * answer to "what was this repository forked from" — together with where that
 * answer was read, so the claim can be re-checked rather than trusted.
 */
export type ForkLineage = Readonly<{
	/** The repository the era package declares, exactly as it declares it. */
	eraRepository: string;
	/** The repository the successor package declares, exactly as it declares it. */
	successorRepository: string;
	/**
	 * The repository the forge reports the successor was forked from, or null
	 * when the forge reports that it is not a fork at all.
	 */
	forkedFrom: string | null;
	/** The forge endpoint the fork relation was read from. */
	readFrom: string;
	/** What the reading says, quoted for the record rather than summarised. */
	fact: string;
}>;

/**
 * What a community library offers the target line, and the registry reading
 * that established it.
 *
 * `aligned` names the range to write. `no-successor` says the library published
 * nothing this cell can accept, which is a decision to *drop* the package —
 * recorded, per package, as a declared difference between the era workspace and
 * the migrated one. `successor-fork` says the library's maintained continuation
 * is published under a *different package name*, which is a decision to remove
 * one name and write another: it is the only disposition that changes what the
 * application's own source has to say, and it is admitted only when the lineage
 * verifies (see {@link verifyForkLineage}).
 *
 * There is deliberately no further state: a library the cell has not read is
 * absent from the table and left exactly as the application declared it, which
 * is a different thing from a library the cell read and rejected.
 */
export type SuccessorForkPackage = Readonly<{
	kind: 'successor-fork';
	/** The package name that continues the era package's source tree. */
	successor: string;
	/** The range to write for the successor, read the way every other range is. */
	range: string;
	fact: string;
	lineage: ForkLineage;
}>;

/**
 * The Angular version a published library was *compiled with*, read off the
 * library's own emitted partial declarations.
 *
 * This exists because a library's declared `@angular/*` peer ranges are a claim
 * its author maintains by hand and can therefore leave behind, and when they are
 * left behind the peer rule reads them faithfully and selects a line the cell
 * cannot consume. The compiled-with version is not maintained by hand: the
 * Angular compiler stamps it into every `ɵɵngDeclare*` call it emits, and the
 * linker in the consuming application refuses a library whose stamp comes from a
 * newer Angular major than the compiler doing the linking — "This application
 * depends upon a library published using Angular version X, which requires
 * Angular version Y or newer to work correctly". It is the declaration that
 * actually decides, so where the peers do not discriminate it is the one that is
 * read.
 */
export type AngularBuildStamp = Readonly<{
	/** The published version of the library the stamp was read from. */
	libraryVersion: string;
	/** The Angular version the library's partial declarations carry. */
	compiledWith: string;
	/** The published file the stamp was read in. */
	readFrom: string;
}>;

export type EcosystemPackage =
	| Readonly<{
			kind: 'aligned';
			range: string;
			fact: string;
			/**
			 * The compiled-with reading. It is required on an entry whose declared
			 * peers do not discriminate between the library's lines, because there it
			 * is the declaration that decides; it may also be recorded where the peers
			 * did decide and the stamp was read to confirm them, which costs one more
			 * reading and buys a check {@link buildStampContradictions} can run.
			 * Absent means the peers decided and no stamp was read.
			 */
			buildStamp?: AngularBuildStamp;
			/** Lines the peer rule admitted and the compiled-with reading excluded. */
			excludedByBuildStamp?: readonly AngularBuildStamp[];
	  }>
	| Readonly<{ kind: 'no-successor'; fact: string }>
	| SuccessorForkPackage;

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
	/**
	 * Version range per package name prefix, longest prefix wins.
	 *
	 * A family prefix is a naming convention, not a release train, and the
	 * difference is not cosmetic: `@angular/http` stops at 7.2.16 and
	 * `@angular-devkit/build-optimizer` stops at 0.1302.1, so a prefix rule applied
	 * to either of them writes a range naming a version nobody ever published and
	 * the package manager refuses the whole tree with ETARGET before a single peer
	 * is read. Nothing in a package name says whether its family kept publishing
	 * it, and this module observes no registry, so the correction cannot be
	 * computed here — it is a per-package reading, and {@link ecosystemPackages} is
	 * where such a reading lives. {@link alignedVersionRange} consults that table
	 * before it reaches this one for exactly that reason, so a package the cell has
	 * read is never given a range by its name; {@link familyPrefixedEcosystemReadings}
	 * makes the overriding set checkable rather than implied.
	 */
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
 *
 * ## The peer-strictness refinement
 *
 * The rule above tests declared peers, and declared peers are hand-maintained.
 * A library whose author never updated them publishes the same peer object
 * across three Angular majors, and the rule then reads it faithfully and selects
 * the newest line — which is exactly what happened to `@ngx-formly`, whose 6.x
 * and 7.x lines both declare `@angular/forms ">=13.2.0"` and no `@angular/core`
 * peer at all. Nothing in the peer declarations distinguishes a release built for
 * Angular 13 from one built for Angular 18, so on that evidence alone the rule
 * cannot be right.
 *
 * The refinement is not a special case and it is not an exception list. Where a
 * candidate line's declared `@angular/*` peers do not discriminate between the
 * library's own lines — they are absent, or identical across the majors under
 * consideration — the selection is decided by the version the Angular compiler
 * stamped into the library's published partial declarations, which no author
 * maintains by hand. That reading is recorded on the entry as
 * {@link AngularBuildStamp}, together with the lines it excluded, and it is
 * tested by {@link cellAcceptsBuildStamp}: a library stamped with an Angular
 * major above the cell's is refused, because the cell's linker refuses it.
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
	'@ng-bootstrap/ng-bootstrap': Object.freeze({
		kind: 'aligned',
		range: '^15.1.2',
		fact: '@ng-bootstrap/ng-bootstrap versions one major *behind* the Angular major it supports, which is the whole hazard of reading this package by its name: the 16.x line is the Angular 17 line. Its peers discriminate exactly and they are what selects the line — every 15.x release (15.0.0 through 15.1.2) declares peer @angular/core, @angular/common, @angular/forms and @angular/localize "^16.0.0" with rxjs "^6.5.3 || ^7.4.0" and @popperjs/core "^2.11.6", where 14.2.0 and the rest of the 14.x line declare "^15.0.0" and 16.0.0 moves to "^17.0.0". 15.1.2 is therefore the newest line this cell accepts and the newest 15.x published; it declares dependency tslib ^2.3.0, exactly this cell\'s range, and no engines.node. The `latest` dist-tag points at 21.0.0, which declares peer @angular/core "^22.0.0" — a package this table read by its dist-tag alone would write a range six majors past this cell\'s linker. The compiled-with stamp was read anyway, because a peer is a hand-maintained claim: 15.1.2 carries version "16.0.6" in all 433 of its ɵɵngDeclare* partial declarations and ships the fesm2022 layout, where 16.0.0 carries "17.0.0" in 421 of them. Two further readings, because a peer this workspace does not itself declare is still a peer: @angular/localize ^16.0.0 is inside the ^16.2.0 family range this cell writes, and @popperjs/core ^2.11.6 is a different package name from the `popper.js` an era Bootstrap 4 workspace declares — npm supplies both as auto-installed peers, and nothing here rewrites a `popper.js` import into a @popperjs/core one. Read from https://registry.npmjs.org/@ng-bootstrap/ng-bootstrap, https://unpkg.com/@ng-bootstrap/ng-bootstrap@15.1.2/fesm2022/ng-bootstrap.mjs and https://unpkg.com/@ng-bootstrap/ng-bootstrap@16.0.0/fesm2022/ng-bootstrap.mjs under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14. The reading is a version fact and not a source claim: the 3.x line an Angular 6-era workspace pins published NgbModule with a `forRoot()` static and component selectors this line has since renamed, and nothing here rewrites a call site that names one.',
		buildStamp: Object.freeze({
			libraryVersion: '15.1.2',
			compiledWith: '16.0.6',
			readFrom: 'https://unpkg.com/@ng-bootstrap/ng-bootstrap@15.1.2/fesm2022/ng-bootstrap.mjs',
		}),
		excludedByBuildStamp: Object.freeze([
			Object.freeze({
				libraryVersion: '16.0.0',
				compiledWith: '17.0.0',
				readFrom: 'https://unpkg.com/@ng-bootstrap/ng-bootstrap@16.0.0/fesm2022/ng-bootstrap.mjs',
			}),
		]),
	}),
	preboot: Object.freeze({
		kind: 'no-successor',
		fact: 'preboot published ninety-four versions and the newest of them is 8.0.0, published 2021-01-18; it is the `latest` dist-tag and the only tag the package carries. Its declared peer does not exclude it — 8.0.0 declares @angular/common and @angular/core ">=11.0.0" and dependency tslib ^2.0.0, both satisfied by this cell — so a reading that stopped at the resolver would align the package and be wrong, for the same reason jw-bootstrap-switch-ng2 was wrong: what 8.0.0 published is a pre-Ivy ViewEngine library. Its tarball ships preboot.metadata.json beside bundles/preboot.umd.js, esm2015/ and fesm2015/; the fesm bundle declares its module the ViewEngine way (`PrebootModule.decorators = [{ type: NgModule, args: [...] }]`) and carries no ɵɵngDeclare* partial declaration and no ɵɵdefineNgModule at all, and module.d.ts publishes `export declare class PrebootModule` with no ɵmod, ɵfac or ɵinj. The converter that used to make such a library consumable is gone: @angular/compiler-cli 16.2.12 ships `ngcc` only as a stub whose own message reads "As of Angular 16, \'ngcc\' is no longer required and not invoked during CLI builds". The registry also marks every version of the package deprecated with "This package is no longer maintained and is unnecessary with the recent versions of Angular." There is therefore no line to align to: not a newer one, because none exists, and not the newest one, because this cell\'s linker does not consume what it publishes. The package is dropped as a declared difference. Doing so turns any `PrebootModule` or `EventReplayer` import into a source demand the compiler states by name; an application that declares preboot and never imports it loses a declaration and nothing else, and choosing a replacement server-side-render replay library is a source decision this table does not make. Read from https://registry.npmjs.org/preboot and from the published tarball https://registry.npmjs.org/preboot/-/preboot-8.0.0.tgz under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14.',
	}),
	'@angular/http': Object.freeze({
		kind: 'no-successor',
		fact: '@angular/http stops at 7.2.16 and is deprecated on the registry with "Package no longer supported. Use @angular/common instead". Angular removed the package after the 7 line; there is no 8.x and no 16.x, so the `@angular/` family range this cell writes for its own packages names a version that was never published. The HTTP client that succeeded it is `@angular/common/http`, an entry point of a package this cell already carries, so the dependency is dropped rather than pinned to a v7 line beside a v16 framework.',
	}),
	'@angular-devkit/build-optimizer': Object.freeze({
		kind: 'no-successor',
		fact: 'The `@angular-devkit/` family range this cell writes names a version of this package that was never published. @angular-devkit/build-optimizer stops at 0.1302.1, published 2022-07-21 and the `latest` dist-tag; no 16.x exists on any tag, and none of the nine dist-tags the package carries points above the 13 line. The registry marks the package deprecated with "This package has been folded in @angular-devkit/build-angular and should no longer be needed. This package has always been experimental and never hit 1.0.0, meaning it should not be used directly outside of Angular." The optimizer it once published separately is inside the @angular-devkit/build-angular ^16.2.0 this cell already writes, so the direct declaration is dropped rather than pinned to a 0.13 line beside a 16 builder. Read from https://registry.npmjs.org/@angular-devkit/build-optimizer under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14. An application that declares this package is declaring a build-time detail of the builder rather than a library it imports; nothing in application source names it, and dropping it is a declared difference rather than a source demand.',
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
		range: '^6.3.12',
		fact: '@ngx-formly/core is the entry that made the peer-strictness refinement necessary, and the reading that corrects it is worth stating in full. Its declared peers do not move: 6.1.8, 6.2.2, 6.3.9, 6.3.12, 7.0.0, 7.0.1 and 7.1.0 every one declare exactly {"@angular/forms": ">=13.2.0", "rxjs": "^6.5.3 || ^7.0.0"}, no @angular/core peer and no engines.node. Read that way the peer rule selects 7.1.0, the newest release and the `latest` dist-tag, and 7.1.0 is unusable here: the Angular linker refuses it with "This application depends upon a library published using Angular version 18.2.13, which requires Angular version 17.0.0 or newer to work correctly". So the peers were not misread — they are simply not a discriminating declaration for this package, and the compiled-with stamp is. Every 7.x release carries version "18.2.13" in its partial declarations and ships the Angular-16-and-later fesm2022 layout; every 6.x release back to 6.1.8 carries "13.3.12" and ships the Angular-13-era fesm2015/fesm2020 layout. 6.3.12 is therefore the newest line this cell accepts, and it is the newest 6.x published. Read from https://registry.npmjs.org/@ngx-formly/core and https://unpkg.com/@ngx-formly/core@6.3.12/fesm2020/ngx-formly-core.mjs under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-11.',
		buildStamp: Object.freeze({
			libraryVersion: '6.3.12',
			compiledWith: '13.3.12',
			readFrom: 'https://unpkg.com/@ngx-formly/core@6.3.12/fesm2020/ngx-formly-core.mjs',
		}),
		excludedByBuildStamp: Object.freeze([
			Object.freeze({
				libraryVersion: '7.1.0',
				compiledWith: '18.2.13',
				readFrom: 'https://unpkg.com/@ngx-formly/core@7.1.0/fesm2022/ngx-formly-core.mjs',
			}),
			Object.freeze({
				libraryVersion: '7.0.1',
				compiledWith: '18.2.13',
				readFrom: 'https://unpkg.com/@ngx-formly/core@7.0.1/fesm2022/ngx-formly-core.mjs',
			}),
			Object.freeze({
				libraryVersion: '7.0.0',
				compiledWith: '18.2.13',
				readFrom: 'https://unpkg.com/@ngx-formly/core@7.0.0/fesm2022/ngx-formly-core.mjs',
			}),
		]),
	}),
	'@ngx-formly/material': Object.freeze({
		kind: 'aligned',
		range: '^6.3.12',
		fact: '@ngx-formly/material declares peer @ngx-formly/core at an exact version on every release — "6.3.12" on 6.3.12, "7.1.0" on 7.1.0 — so the two packages move together or not at all, and the core reading decides this one. Its other peer, @angular/material, declares ">=13.0.0" on the whole 6.x line and ">=16.0.0" on 7.1.0; both are satisfied by the ^16.2.0 this cell writes, which is again a declaration that does not discriminate. 6.3.12 carries Angular "13.3.12" in its partial declarations where 7.1.0 carries "18.2.13". Read from https://registry.npmjs.org/@ngx-formly/material and https://unpkg.com/@ngx-formly/material@6.3.12/fesm2020/ngx-formly-material.mjs under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-11. The type surface the cell was already relying on is unchanged across the correction: material 6.3.12 declares `abstract class FieldType<F extends FormlyFieldConfig<FormlyFieldProps>>` with one parameter and no default, exactly as 7.1.0 does, and core 6.3.12 publishes `interface FieldTypeConfig<T = FormlyFieldConfig[\'props\']> extends FormlyFieldConfig<T>` declaring formControl and props, exactly as 7.1.0 does.',
		buildStamp: Object.freeze({
			libraryVersion: '6.3.12',
			compiledWith: '13.3.12',
			readFrom: 'https://unpkg.com/@ngx-formly/material@6.3.12/fesm2020/ngx-formly-material.mjs',
		}),
		excludedByBuildStamp: Object.freeze([
			Object.freeze({
				libraryVersion: '7.1.0',
				compiledWith: '18.2.13',
				readFrom: 'https://unpkg.com/@ngx-formly/material@7.1.0/fesm2022/ngx-formly-material.mjs',
			}),
		]),
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
	'ng2-slim-loading-bar': Object.freeze({
		kind: 'no-successor',
		fact: 'ng2-slim-loading-bar published twenty-eight versions and the newest of them is 4.0.0, published 2017-04-04; it is the `latest` dist-tag, it is the only tag the package carries, and it is the exact version an Angular 8-era workspace pins. It declares peer @angular/core "^2.4.7 || ^4.0.0", which the ^16.2.0 this cell writes does not satisfy, and no later line exists to read: the package is dead rather than behind. The reading does not stop at the peer, because a peer is only a resolver fact. This library was published for the pre-Ivy ViewEngine and the converter that used to make such a library consumable is gone: @angular/compiler-cli 16.2.12 ships `ngcc` only as a stub whose own message reads "As of Angular 16, \'ngcc\' is no longer required and not invoked during CLI builds", so nothing on this cell converts a ViewEngine library\'s metadata for the Ivy linker. A resolver told to ignore the declared peer would therefore install bytes this cell\'s compiler cannot consume, which is why the disposition is to drop the package rather than to relax the install. Read from https://registry.npmjs.org/ng2-slim-loading-bar under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14, and from the installed @angular/compiler-cli 16.2.12 in an Angular 16 closure. Dropping it turns the imports it served into source demands the compiler states by name; choosing a replacement loading-bar library is a source decision this table does not make.',
	}),
	leaflet: Object.freeze({
		kind: 'aligned',
		range: '^1.9.4',
		fact: 'leaflet 1.9.4 is the newest released line and the `latest` dist-tag (published 2023-05-18); the only newer versions on the registry are 2.0.0-alpha and 2.0.0-alpha.1 on the `alpha` tag, which this cell does not select because a pre-release is not a published line. 1.9.4 declares no peerDependencies, no dependencies and no engines, so nothing in this cell excludes it — the map library is framework-independent, and the Angular wrapper an era application put in front of it is a separate reading. It publishes no type declarations of its own; `@types/leaflet` is the companion, and DefinitelyTyped is what publishes it. Read from https://registry.npmjs.org/leaflet under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-13.',
	}),
	'@types/leaflet': Object.freeze({
		kind: 'aligned',
		range: '1.9.20',
		fact: "@types/leaflet is a DefinitelyTyped package, and the declaration that discriminates its lines is not a peer range: it is the minimum TypeScript version DefinitelyTyped publishes as a `tsX.Y` dist-tag. This cell writes typescript ~5.1.3, and the registry's `ts5.1` tag points at 1.9.20 while `latest` is 1.9.22 — so the newest line this cell's compiler can read is 1.9.20, and it is written as an exact version rather than a caret range because a caret would resolve to 1.9.22 and reintroduce exactly the incompatibility the tag exists to state. 1.9.20 declares one dependency, @types/geojson, and no peers. Read from https://registry.npmjs.org/@types/leaflet under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-13.",
	}),
	'raw-loader': Object.freeze({
		kind: 'aligned',
		range: '^4.0.2',
		fact: 'raw-loader 4.0.2 is the newest version published and the `latest` dist-tag (2020-10-09); the package is no longer developed because webpack 5 absorbed what it does into the `asset/source` module type, but it is not deprecated on the registry and it is the line that still answers an inline `raw-loader!` request. 4.0.2 declares peer webpack "^4.0.0 || ^5.0.0" — satisfied by the webpack 5 the @angular-devkit/build-angular ^16.2.0 this cell writes builds with — and engines.node ">= 10.13.0", satisfied by this cell\'s Node 16.20.2. The 3.x line before it declares peer webpack "^4.3.0" and is excluded by the target builder\'s webpack major. Read from https://registry.npmjs.org/raw-loader under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-13.',
	}),
	'ngx-bootstrap': Object.freeze({
		kind: 'aligned',
		range: '^11.0.2',
		fact: 'ngx-bootstrap is the first entry in this table selected against a *compile-stage* reading rather than an install-stage one, and the distinction is the whole reason it is here. The era 5.1.0 declares peer @angular/core and @angular/common ">=7.0.0" — an open lower bound with no upper bound — so npm resolves it against Angular 16 without a word and the closure looks healthy; the refusal arrives from the TypeScript program, which reads the package\'s own published declarations: seven of the eight TS2314 in a first migrated build are `Generic type \'ModuleWithProviders<T>\' requires 1 type argument(s)` inside ngx-bootstrap\'s {collapse,datepicker,dropdown,modal,popover,tooltip}/*.module.d.ts, which were correct before Angular 10 made the parameter required. Unlike the peers this table usually has to refine, this package\'s peers do discriminate exactly: 10.3.0 and the rest of the 10.x line declare @angular/core, @angular/common, @angular/forms and @angular/animations "^15.0.0", 11.0.0 through 11.0.2 declare "^16.0.0", and 12.0.0 moves to "^17.0.0". 11.0.2 is therefore the newest line this cell accepts and the newest 11.x published; it also declares peer rxjs "^6.5.3 || ^7.6.0", satisfied by the ~7.8.0 this cell writes, dependency tslib ^2.3.0, exactly this cell\'s range, and no engines.node. The compiled-with stamp was read anyway, because a peer is a hand-maintained claim and this one is load-bearing: 11.0.2\'s secondary entry points carry `version: "16.1.4"` in every ɵɵngDeclare* call and pin peer @angular/core at that exact version, so the declaration the linker reads agrees with the declaration the resolver reads. 11.0.2 publishes `ModuleWithProviders<CollapseModule>` with its argument, so the seven TS2314 are answered by the line rather than by a source edit. Two further readings, because a workspace can name a package\'s files rather than import them: 11.0.2 still publishes datepicker/bs-datepicker.css at that path and names it in its `exports` map, so an `angular.json` styles entry naming ./node_modules/ngx-bootstrap/datepicker/bs-datepicker.css keeps resolving across this hop; and that same `exports` map is a narrowing this reading does not hide — 5.1.0 published no exports map and every file on disk was addressable, where 11.0.2 answers only its documented entry points, so an application importing a subpath such as `ngx-bootstrap/modal/bs-modal-ref.service` reaches a specifier the installed package no longer publishes. The symbol is on the public surface (modal/public_api.d.ts re-exports BsModalRef), which is a source demand for a redirection and not a reason to hold the package on a line the compiler refuses. Read from https://registry.npmjs.org/ngx-bootstrap and from the published tarballs of 11.0.2 under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14.',
		buildStamp: Object.freeze({
			libraryVersion: '11.0.2',
			compiledWith: '16.1.4',
			readFrom:
				'https://unpkg.com/ngx-bootstrap@11.0.2/collapse/fesm2022/ngx-bootstrap-collapse.mjs',
		}),
	}),
	'@yaga/leaflet-ng2': Object.freeze({
		kind: 'no-successor',
		fact: '@yaga/leaflet-ng2 published thirteen versions and the newest of them is 1.1.0, published 2021-05-22; it is the `latest` dist-tag and no line exists after it. Every one of those versions declares peer @angular/core ">=2.0.0" — an unbounded range written before Angular 5 shipped — so the resolver admits the package against Angular 16 and says nothing, and the refusal arrives from the compiler instead: `Property \'addData\' in type \'GeoJSONDirective<T>\' is not assignable to the same property in base type \'GeoJSON<any, Geometry>\'` in lib/geojson.directive.d.ts. Moving to the newest line does not answer it. 1.1.0 declares that member as `addData(data: GeoJSONFeature<GeometryObject, T>): Layer` exactly as 1.0.0 does, narrowing the base signature of the @types/leaflet it still depends on at ^1.2.8, so the TS2416 the era pin produces is present on the newest published version too. The second reading is the one that closes the question rather than merely failing to open it: 1.1.0 was built against Angular 12 (its devDependencies pin @angular/* ^12.0.0) in *full* compilation mode — lib/geojson.directive.js emits `ɵɵdefineDirective` and `ɵɵProvidersFeature` calls directly, and the package ships no `ɵɵngDeclare*` partial declarations and no ViewEngine metadata.json. Those instruction calls are the private, version-locked API of the @angular/core the library was compiled with; the Angular Package Format requires partial declarations precisely so that a *consuming* linker can re-emit them for its own version, and there is nothing here for this cell\'s linker to link. So there is no line to align to: not a newer one, because none exists, and not the newest one, because it neither fixes the declaration nor is published in a form this cell consumes. The package is dropped as a declared difference. Doing so turns `YagaModule` in frontend/app/app.module.ts and `MapComponent` in the two map components into source demands the compiler states by name; choosing a replacement Angular Leaflet library is a source decision this table does not make, and no verified fork of yagajs/leaflet-ng2 was found to make it under the successor-fork rule. Read from https://registry.npmjs.org/@yaga/leaflet-ng2 and from the published tarballs of 1.0.0 and 1.1.0 under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14.',
	}),
	'jw-bootstrap-switch-ng2': Object.freeze({
		kind: 'no-successor',
		fact: 'jw-bootstrap-switch-ng2 published twenty-five versions and the newest of them is 2.0.5, published 2019-01-29; it is the `latest` dist-tag, it is the only tag the package carries, and it is the exact version an Angular 8-era workspace pins — the package is dead rather than behind, which is the same reading that decided ng2-slim-loading-bar. Its declared peer is the reason it was never caught at the resolver: 2.0.5 declares @angular/common, @angular/core and @angular/forms "^6.0.0-rc.0 || ^6.0.0 || >=7.0.0", whose last alternative has no upper bound, so npm installs it against Angular 16 without complaint. What it published is a pre-Ivy ViewEngine library in Angular Package Format v6: jw-bootstrap-switch-ng2.metadata.json beside bundles/*.umd.js, esm5/ and fesm5/, and declarations carrying no ɵmod, ɵfac or ɵcmp at all — `export declare class JwBootstrapSwitchNg2Module {}` is the whole of its module declaration. The converter that used to make such a library consumable is gone: @angular/compiler-cli 16.2.12 ships `ngcc` only as a stub whose own message reads "As of Angular 16, \'ngcc\' is no longer required and not invoked during CLI builds". It also declares dependency tslib ^1.9.0 beside the ^2.3.0 this cell writes. The package is dropped as a declared difference, which turns `JwBootstrapSwitchNg2Module` in frontend/app/app.module.ts into a source demand the compiler states by name; choosing a replacement switch component is a source decision this table does not make. Read from https://registry.npmjs.org/jw-bootstrap-switch-ng2 and from the published tarball of 2.0.5 under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14.',
	}),
	'xlf-google-translate': Object.freeze({
		kind: 'aligned',
		range: '^1.0.4',
		fact: 'xlf-google-translate is Angular-major independent: 1.0.4, the newest release and the `latest` dist-tag, declares no peerDependencies at all and no engines.node, so neither axis of this cell excludes it, and the newest-satisfying-line rule selects it without a refinement. It is in this table because an era range of it makes the closure unresolvable for a reason no version of Angular caused: the 1.0.0-beta.13 through 1.0.0-beta.21 lines declare a dependency on @k3rn31p4nic/google-translate-api, which was deleted from the public registry, so a manifest naming one of them reaches E404 before any peer is read. The dependency was dropped by the package itself at 1.0.0-beta.22, and 1.0.1 and later declare {xml2js 0.6.2, typeconfig 2.3.1, reflect-metadata 0.2.2} — all resolvable. That an unresolvable declaration is not a closure is the jira2md precedent: a workspace may declare a package by a specifier this cell cannot install, and aligning it onto a resolvable registry range is what carries it into the migrated closure rather than a narrowing performed around it. One further reading, because a workspace can name a package\'s executable rather than import it: 1.0.4 declares the same bin entry the era line did, `{"xlf-google-translate": "./cli.js"}`, so a script invoking that command keeps resolving across this hop. Read from https://registry.npmjs.org/xlf-google-translate and from the published tarball of 1.0.4 under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14. The reading is a version fact and not a behavioural one: the 1.x line translates through a different provider surface than the beta line did, and nothing here establishes that a translation task run under it produces what the era task produced.',
	}),
	'ngx-markdown': Object.freeze({
		kind: 'aligned',
		range: '^16.0.0',
		fact: 'ngx-markdown versions in lockstep with the Angular major: 16.0.0 is the 16.x line and declares peer @angular/core, @angular/common and @angular/platform-browser "^16.0.0" plus zone.js "~0.13.0", which is exactly the zone.js range this cell writes. 22.0.0, 21.3.0 and 21.2.0 declare ^22.0.0 and ^21.0.0 respectively.',
	}),
	'ng-pick-datetime': Object.freeze({
		kind: 'successor-fork',
		successor: '@danielmoncada/angular-datetime-picker',
		range: '^16.1.0',
		fact: 'ng-pick-datetime stops at 7.0.0, published 2018-10-21, and declares peer @angular/cdk "^7.0.0"; no release of that package name exists for any Angular line at or beyond this cell. Its maintained continuation is published under the name @danielmoncada/angular-datetime-picker, and 16.1.0 is the newest line this cell can accept: it declares peer @angular/cdk, @angular/core and @angular/common "^13.0.3 || ^14.0.0 || ^15.0.0 || ^16.0.0" and dependency tslib ^2.3.1, all satisfied here, where 16.0.0 stops at ^15 and 17.0.0 declares ^17.0.0 across the three. Read from https://registry.npmjs.org/@danielmoncada/angular-datetime-picker under consent VL-LEGACY-CORPUS-2026-08-10.',
		lineage: Object.freeze({
			eraRepository: 'git+https://github.com/DanielYKPan/date-time-picker.git',
			successorRepository: 'git+https://github.com/danielmoncada/date-time-picker.git',
			forkedFrom: 'https://github.com/DanielYKPan/date-time-picker',
			readFrom: 'https://api.github.com/repos/danielmoncada/date-time-picker',
			fact: 'api.github.com/repos/danielmoncada/date-time-picker reports fork: true with parent and source both DanielYKPan/date-time-picker — the exact repository the era package declares. The fork was created 2020-02-10 and the first release under the new name, 9.0.1, was published 2020-02-11. Read under consent VL-LEGACY-CORPUS-2026-08-10. A verified continuation of one source tree is not a behavioural equivalence: nothing in this reading establishes that the fork renders or behaves as the era package did.',
		}),
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
	'ngx-toastr': Object.freeze({
		kind: 'aligned',
		range: '^17.0.2',
		fact: 'ngx-toastr is the second entry the peer-strictness refinement decides, and its peers fail to discriminate in the plainer of the two ways: they are identical across four consecutive majors. 20.0.5, the newest release and the `latest` dist-tag, declares peer @angular/common and @angular/core "^21.0.0" and rxjs "^7.8.2"; the ^16.2.0 this cell writes excludes it. Every release from 17.0.0 through 19.1.0 declares exactly {"@angular/core": ">=16.0.0-0", "@angular/common": ">=16.0.0-0", "@angular/platform-browser": ">=16.0.0-0"}, no rxjs peer and no engines.node, so on the peer rule alone the newest satisfying line is 19.1.0 — and nothing in those declarations separates a release built for Angular 16 from one built for Angular 18. The compiled-with stamps separate them: 19.1.0 and 19.0.0 carry Angular "18.0.0" in their partial declarations, 18.0.0 carries "17.0.3", and 17.0.2, 17.0.1 and 17.0.0 all carry "16.0.1". 17.0.2 is therefore the newest line this cell links, and it is the newest 17.x published. Its only dependency is tslib ^2.3.0, exactly the range this cell writes. One further reading, because a workspace configuration can name a package\'s files directly rather than importing them: 17.0.2 still publishes toastr.css at the package root (https://unpkg.com/ngx-toastr@17.0.2/toastr.css), the same path the Angular 8-era 10.0.4 published, so an `angular.json` styles entry naming ./node_modules/ngx-toastr/toastr.css keeps resolving across this hop. Read from https://registry.npmjs.org/ngx-toastr and https://unpkg.com/ngx-toastr@17.0.2/fesm2022/ngx-toastr.mjs under consent VL-LEGACY-CORPUS-2026-08-10 on 2026-08-14. The era 10.0.4 line declares peer @angular/core, @angular/common and @angular/platform-browser ">=6.0.0 <9.0.0" and rxjs "^6.1.0" — two independent collisions with this cell, either of them fatal to the tree, and both answered by the same move.',
		buildStamp: Object.freeze({
			libraryVersion: '17.0.2',
			compiledWith: '16.0.1',
			readFrom: 'https://unpkg.com/ngx-toastr@17.0.2/fesm2022/ngx-toastr.mjs',
		}),
		excludedByBuildStamp: Object.freeze([
			Object.freeze({
				libraryVersion: '19.1.0',
				compiledWith: '18.0.0',
				readFrom: 'https://unpkg.com/ngx-toastr@19.1.0/fesm2022/ngx-toastr.mjs',
			}),
			Object.freeze({
				libraryVersion: '19.0.0',
				compiledWith: '18.0.0',
				readFrom: 'https://unpkg.com/ngx-toastr@19.0.0/fesm2022/ngx-toastr.mjs',
			}),
			Object.freeze({
				libraryVersion: '18.0.0',
				compiledWith: '17.0.3',
				readFrom: 'https://unpkg.com/ngx-toastr@18.0.0/fesm2022/ngx-toastr.mjs',
			}),
		]),
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

/** The major of a dotted version string, or null when it carries none. */
export function majorOf(version: string): number | null {
	const head = version.split('.')[0] ?? '';
	if (!/^\d+$/u.test(head)) return null;
	return Number.parseInt(head, 10);
}

/**
 * Does a cell's Angular line accept a library carrying this compiled-with stamp.
 *
 * The Angular linker in the consuming application reads the partial declarations
 * a library published and refuses the ones a *newer* Angular major emitted,
 * because their shape is not one it knows how to link. A stamp at or below the
 * cell's major is accepted; a stamp above it is not, and that is the whole of
 * the test. A stamp whose major cannot be read is refused, because an unreadable
 * declaration is not evidence of compatibility.
 */
export function cellAcceptsBuildStamp(angularLine: string, stamp: AngularBuildStamp): boolean {
	const cell = majorOf(angularLine);
	const library = majorOf(stamp.compiledWith);
	if (cell === null || library === null) return false;
	return library <= cell;
}

/**
 * Every entry in a cell's ecosystem table whose recorded readings contradict
 * the cell — an aligned line the cell's linker would refuse, or an exclusion
 * the cell would in fact have accepted.
 *
 * This is the peer-strictness refinement made checkable rather than asserted:
 * the table states compiled-with readings, and this says whether they support
 * the ranges beside them.
 */
export function buildStampContradictions(cell: AngularTargetCell): readonly string[] {
	const problems: string[] = [];
	for (const [name, disposition] of Object.entries(cell.ecosystemPackages).sort(([left], [right]) =>
		compareStrings(left, right),
	)) {
		if (disposition.kind !== 'aligned') continue;
		const { buildStamp, excludedByBuildStamp } = disposition;
		if (buildStamp !== undefined && !cellAcceptsBuildStamp(cell.angularLine, buildStamp))
			problems.push(
				`${name}: aligned to ${disposition.range}, but ${buildStamp.libraryVersion} is stamped ` +
					`Angular ${buildStamp.compiledWith}, which Angular ${cell.angularLine} does not link.`,
			);
		for (const excluded of excludedByBuildStamp ?? [])
			if (cellAcceptsBuildStamp(cell.angularLine, excluded))
				problems.push(
					`${name}: ${excluded.libraryVersion} is recorded as excluded by its stamp ` +
						`Angular ${excluded.compiledWith}, which Angular ${cell.angularLine} does link.`,
				);
	}
	return Object.freeze(problems);
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

/**
 * A repository declaration reduced to the thing two declarations of the same
 * repository always agree on: host and path, without the protocol, the `git+`
 * prefix, the `.git` suffix, the fragment or the case.
 *
 * `git+https://github.com/Owner/Name.git`, `https://github.com/owner/name` and
 * `git@github.com:owner/name.git` are one repository, and a comparison that
 * said otherwise would refuse a real lineage on spelling.
 */
export function repositoryIdentity(declaration: string): string {
	let value = declaration.trim();
	if (value.startsWith('git+')) value = value.slice('git+'.length);
	const fragment = value.indexOf('#');
	if (fragment >= 0) value = value.slice(0, fragment);
	if (value.endsWith('.git')) value = value.slice(0, -'.git'.length);
	const parsed = parseURL(value);
	let host = parsed.host ?? '';
	let route = parsed.pathname;
	if (host === '') {
		/**
		 * An scp-style ssh declaration — `git@github.com:owner/name` — is not a URL
		 * and parses as one long path. The host is what precedes the colon after the
		 * user, and the repository path is what follows it.
		 */
		const at = route.indexOf('@');
		const colon = route.indexOf(':', at + 1);
		if (colon > 0) {
			host = route.slice(at + 1, colon);
			route = route.slice(colon + 1);
		}
	}
	const segments = [host, ...route.split('/')].filter((segment) => segment.length > 0);
	return segments.join('/').toLowerCase();
}

export type ForkLineageVerdict =
	| Readonly<{ verified: true }>
	| Readonly<{ verified: false; reason: string }>;

/**
 * Whether a declared fork lineage is one this cell may act on.
 *
 * Three things have to hold, and each of them is a separate way for a plausible
 * successor to be the wrong package:
 *
 * - the forge has to say the successor repository *is* a fork, rather than an
 *   independent repository with a similar name,
 * - what it says the successor was forked from has to be the repository the era
 *   package itself declares, not merely some repository, and
 * - the reading has to have been taken from the successor's own repository, so
 *   that a fork relation belonging to a third repository cannot be borrowed.
 *
 * A lineage that fails any of them is refused by name. The refusal is the point:
 * renaming a module specifier onto a package that is not the same source tree
 * produces a workspace that compiles and is not the same application.
 */
export function verifyForkLineage(name: string, fork: SuccessorForkPackage): ForkLineageVerdict {
	const lineage = fork.lineage;
	const era = repositoryIdentity(lineage.eraRepository);
	const successor = repositoryIdentity(lineage.successorRepository);
	if (era === '' || successor === '')
		return Object.freeze({
			verified: false,
			reason: `${name} or ${fork.successor} declares no repository this reading could identify, so there is nothing for a fork relation to be about`,
		});
	if (lineage.forkedFrom === null)
		return Object.freeze({
			verified: false,
			reason: `${lineage.readFrom} does not report ${fork.successor}'s repository as a fork of anything, so its continuation of ${name} is a claim rather than a reading`,
		});
	const parent = repositoryIdentity(lineage.forkedFrom);
	if (parent !== era)
		return Object.freeze({
			verified: false,
			reason: `${lineage.readFrom} reports ${successor} as a fork of ${parent}, and ${name} declares ${era}; a fork of a different repository is a different source tree`,
		});
	const read = repositoryIdentity(lineage.readFrom);
	const path = successor.split('/').slice(-2).join('/');
	if (path === '' || !read.endsWith(path))
		return Object.freeze({
			verified: false,
			reason: `the fork relation was read from ${read}, which is not ${successor}'s own repository, so it does not say what ${fork.successor} was forked from`,
		});
	return Object.freeze({ verified: true });
}

/**
 * The module-specifier renames the cell's verified fork dispositions imply, from
 * era package name to successor package name.
 *
 * This is the whole of what a fork disposition hands to the source layer: a pair
 * of package names. What a source capability then does with the pair — whether
 * the symbols a module names are on the successor's published surface at all —
 * is a reading of the installed closure that this table cannot make and does not
 * pretend to.
 */
export function successorForkRenames(cell: AngularTargetCell): Readonly<Record<string, string>> {
	const renames: Record<string, string> = {};
	for (const [name, disposition] of Object.entries(cell.ecosystemPackages)) {
		if (disposition.kind !== 'successor-fork') continue;
		if (!verifyForkLineage(name, disposition).verified) continue;
		renames[name] = disposition.successor;
	}
	return Object.freeze(renames);
}

/** The longest family prefix of the cell's that this name carries, or null. */
export function familyPrefixOf(name: string, cell: AngularTargetCell): string | null {
	let matched: string | null = null;
	for (const prefix of Object.keys(cell.families))
		if (name.startsWith(prefix) && prefix.length > (matched?.length ?? 0)) matched = prefix;
	return matched;
}

/**
 * The packages whose family prefix the cell's own reading overrides, and what it
 * writes instead of the family range.
 *
 * This is the family-prefix hazard made visible. Every entry here is a package
 * the prefix rule would have given the family's range and the table gives
 * something else — a different range, or no range at all because the package left
 * the version train and nothing succeeds it. Reading the set is how a change to
 * either table can be checked against the other: an entry that agrees with its
 * family range is not an override and does not appear.
 */
export function familyPrefixedEcosystemReadings(
	cell: AngularTargetCell,
): readonly Readonly<{ name: string; prefix: string; familyRange: string; writes: string | null }>[] {
	const overrides: Readonly<{
		name: string;
		prefix: string;
		familyRange: string;
		writes: string | null;
	}>[] = [];
	for (const name of Object.keys(cell.ecosystemPackages).sort(compareStrings)) {
		const prefix = familyPrefixOf(name, cell);
		if (prefix === null) continue;
		const familyRange = cell.families[prefix] as string;
		const disposition = cell.ecosystemPackages[name] as EcosystemPackage;
		const writes = disposition.kind === 'aligned' ? disposition.range : null;
		if (writes === familyRange) continue;
		overrides.push(Object.freeze({ name, prefix, familyRange, writes }));
	}
	return Object.freeze(overrides);
}

/**
 * The range the cell asks for, or null when the cell says nothing about it.
 *
 * The order is the whole of the rule and it is not arbitrary: an exact reading
 * beats a generated toolchain default, which beats a community-layer reading,
 * which beats a family prefix. The family prefix is last because it is the only
 * one of the four that is not a reading of the package — it is an inference from
 * the package's name — and a name is the weakest evidence available here.
 */
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
			if (disposition !== undefined && disposition.kind === 'successor-fork') {
				const verdict = verifyForkLineage(name, disposition);
				if (!verdict.verified) {
					updated[name] = from;
					unhandled.push(
						`${field}.${name} carries a successor-fork disposition naming ` +
							`${disposition.successor}, and it was not acted on: ${verdict.reason}. The ` +
							'package was left at its era range rather than renamed onto a package whose ' +
							'lineage this cell cannot establish.',
					);
					continue;
				}
				changes.push({
					field,
					name,
					from,
					to: null,
					reason:
						`removed in favour of its successor fork ${disposition.successor}, whose lineage ` +
						`${cell.id} verified: ${disposition.lineage.fact}`,
				});
				declaredDifferences.push(
					`${field}.${name} was replaced by ${disposition.successor} ${disposition.range}: the ` +
						`package name changed at the fork and the application's own imports of it change ` +
						`with it. ${disposition.fact}`,
				);
				const declared = current[disposition.successor];
				if (declared !== disposition.range)
					changes.push({
						field,
						name: disposition.successor,
						from: declared ?? from,
						to: disposition.range,
						reason:
							declared === undefined
								? `added as the successor fork of ${name} (which declared ${from}), at the ` +
									`range ${cell.id} read for it: ${disposition.fact}`
								: `aligned to the range ${cell.id} read for the successor fork of ${name}: ${disposition.fact}`,
					});
				updated[disposition.successor] = disposition.range;
				continue;
			}
			const range = alignedVersionRange(name, cell);
			if (range === null) {
				updated[name] = from;
				unhandled.push(unreadDeclarationReason(field, name, from, cell));
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
		/**
		 * The field is written back in name order. Every entry but one already
		 * arrives that way, because the loop above walks the era declarations
		 * sorted; a successor fork is written under a name the era manifest never
		 * had, and re-sorting is what keeps that one entry from landing wherever the
		 * package it replaced happened to sit.
		 */
		const ordered: Record<string, string> = {};
		for (const name of Object.keys(updated).sort(compareStrings))
			ordered[name] = updated[name] as string;
		next[field] = ordered;
	}
	return Object.freeze({
		manifest: Object.freeze(next),
		changes: Object.freeze(changes),
		unhandled: Object.freeze(unhandled.sort(compareStrings)),
		declaredDifferences: Object.freeze(declaredDifferences.sort(compareStrings)),
	});
}

/**
 * Why an era-pinned declaration the cell has read no line for is reported rather
 * than carried in silence.
 *
 * Silence was the failure mode this closes. A package outside every one of the
 * cell's four tables reaches {@link alignedVersionRange} as `null`, and the
 * alignment then writes the era range back — which is the right *edit*, because
 * choosing a version for a package nobody read would be an invention. It was the
 * wrong *report*: the package appeared in neither `changes`, nor
 * `declaredDifferences`, nor `unhandled`, so a manifest carrying an era pin whose
 * declared peers name a framework major the cell no longer writes looked exactly
 * like a manifest that was fully aligned. The first anyone learned of it was the
 * package manager refusing the whole tree.
 *
 * The line therefore names three things and not two: the package, the era pin
 * that was carried, and the fact that no reading exists for it. What it does not
 * do is guess — an unread declaration is not claimed to be a defect, because a
 * package the cell has never read may be perfectly installable. It is claimed to
 * be *unread*, which is a fact this function can establish.
 *
 * A test-toolchain package keeps the more specific line it already had. That
 * sentence says the same thing about silence and adds why the cell declines to
 * choose for this particular class of package, so replacing it would trade a
 * reading for a generality that is already present.
 */
function unreadDeclarationReason(
	field: string,
	name: string,
	from: string,
	cell: AngularTargetCell,
): string {
	if (TEST_TOOLCHAIN_PREFIXES.some((prefix) => name.startsWith(prefix)))
		return (
			`${field}.${name} is coupled to the Angular test cell but is not part of the ` +
			`toolchain ${cell.id} generates, so it was left at its era range`
		);
	return (
		`${field}.${name} is declared at ${from} and ${cell.id} has read no line for it: it is named ` +
		'by none of the cell\'s exact ranges, its generated test toolchain or its community layer, ' +
		'and no family prefix it writes matches the name. The era declaration was carried into the ' +
		'migrated manifest unchanged, which is the only honest edit for a package nobody read — and ' +
		'it is reported here rather than left silent, because an era pin standing beside an aligned ' +
		'framework is where a dependency-resolution refusal comes from, and a lane is owed that ' +
		'before the package manager tells it.'
	);
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
