/**
 * Capability-coverage map: the version-generality artifact.
 *
 * Every capability exported from `@versionless/react` and `@versionless/angular`
 * is enumerated here together with the independent applications whose recorded
 * migrations actually exercised it. A capability is claimed **general**
 * (`cross-proven`, in-matrix) only once at least two genuinely independent
 * applications prove it; anything a single application — or no determinable
 * application — proves is `experimental` (out-of-matrix). The honest boundary is
 * the point: single-application capabilities are not silently claimed general.
 *
 * Classification is never hand-set. It is derived from the count of distinct
 * proving applications, and {@link verifyCapabilityCoverage} recomputes it so a
 * stored classification cannot drift away from the applications it lists.
 *
 * Grounding rule (stated so the mapping is reproducible, not assumed):
 *   1. Adopt the classification the frozen `adapter-freeze.json` editorial
 *      already records for the capabilities it names — this map does not
 *      contradict the seal.
 *   2. `ngrx-effects-migration` is the one documented supersession: the freeze
 *      editorial predates super-productivity, whose twenty effect files the
 *      createEffect migration ran over unprompted as a second independent
 *      application. The seal is retained unchanged; this map governs current
 *      coverage.
 *   3. Capabilities the freeze editorial does not name are classified from
 *      concrete run evidence — a direct invocation in an application's migration
 *      fixture, or a construct-gated firing recorded in its build-lane run.
 *   4. Where an application set cannot be determined from records, coverage is
 *      marked `unproven` and the capability defaults to `experimental`.
 */

export const CAPABILITY_COVERAGE_SCHEMA = 'versionless.capability-coverage.v1' as const;

export const CAPABILITY_COVERAGE_PURPOSE =
	'Map every exported migration capability to the independent applications that prove it, and derive its generality classification from that proof count' as const;

/** A capability is claimed general only once this many independent applications prove it. */
export const CROSS_PROVEN_THRESHOLD = 2 as const;

export type CapabilityLineage = 'react' | 'angular';
export type CapabilityPackage = '@versionless/react' | '@versionless/angular';
export type CapabilityClassification = 'cross-proven' | 'experimental';
export type CapabilityCoverageState = 'proven' | 'unproven';
export type CapabilityAttribution =
	| 'direct-invocation'
	| 'orchestrated-unconditional'
	| 'orchestrated-construct-gated'
	| 'narrative'
	| 'unproven';

export interface CapabilityRecordInput {
	readonly name: string;
	readonly lineage: CapabilityLineage;
	readonly package: CapabilityPackage;
	readonly entryPoints: readonly string[];
	readonly provenApps: readonly string[];
	readonly attribution: CapabilityAttribution;
	readonly coverage: CapabilityCoverageState;
	readonly evidence: readonly string[];
	readonly note: string;
}

export interface CapabilityRecord extends CapabilityRecordInput {
	readonly proofCount: number;
	readonly classification: CapabilityClassification;
}

export interface CapabilityLineageSummary {
	readonly total: number;
	readonly crossProven: number;
	readonly experimental: number;
}

export interface CapabilityCoverage {
	readonly schemaVersion: typeof CAPABILITY_COVERAGE_SCHEMA;
	readonly purpose: typeof CAPABILITY_COVERAGE_PURPOSE;
	readonly crossProvenThreshold: typeof CROSS_PROVEN_THRESHOLD;
	readonly method: readonly string[];
	readonly independentApplications: {
		readonly react: readonly string[];
		readonly angular: readonly string[];
	};
	readonly summary: {
		readonly total: number;
		readonly crossProven: number;
		readonly experimental: number;
		readonly react: CapabilityLineageSummary;
		readonly angular: CapabilityLineageSummary;
	};
	readonly capabilities: readonly CapabilityRecord[];
}

/**
 * Derives the classification from the proving-application set alone. Distinctness
 * is enforced by counting a Set: a capability cannot reach the cross-proven
 * threshold by listing the same application twice.
 */
export function classifyCapability(provenApps: readonly string[]): {
	proofCount: number;
	classification: CapabilityClassification;
} {
	const distinct = new Set(provenApps);
	const proofCount = distinct.size;
	return {
		proofCount,
		classification: proofCount >= CROSS_PROVEN_THRESHOLD ? 'cross-proven' : 'experimental',
	};
}

const REACT_INDEPENDENT_APPLICATIONS = [
	'react-boilerplate',
	'papercups',
	'react-hospitalrun',
	'react-memos',
	'next-killedbygoogle',
	'react-linkfree',
	'react-avataaars',
] as const;

const ANGULAR_INDEPENDENT_APPLICATIONS = [
	'angular-factoriolab',
	'angular-jira-clone',
	'angular-tiny-translator',
	'angular-super-productivity',
	'angular-fuxa',
] as const;

const CAPABILITY_METHOD = [
	'Enumerated from the @versionless/react and @versionless/angular index barrels: seven React modules and fifty Angular modules.',
	'Proving applications are the independent applications whose recorded migration exercised the capability — a direct invocation in the application migration fixture, or a construct-gated firing recorded in its build-lane run.',
	'angular-pigallery2 appears as a proving application and is deliberately absent from the independent-application matrix below: it is the T018 holdout, whose migrated build is recorded RED. A capability it exercises is recorded on that one application and is therefore experimental, and nothing here claims the application builds.',
	'angular-eshop-webspa appears as a proving application on the same footing and is likewise absent from the matrix: it is the T023 replacement holdout, an Angular 6.1.4 workspace that was recorded RED at install under the frozen f1a63359 adapter and whose migrated production build, after the authorized T024 reopen, completes and repeats byte-identically. Every capability it proves is recorded on that one application and is therefore experimental. No witness journey has run against it in either lane, so nothing here claims the application behaves — only that it installs and builds.',
	'Classification is derived: cross-proven (in-matrix) requires at least two distinct independent applications; fewer is experimental (out-of-matrix).',
	'Where the frozen adapter-freeze.json editorial already classifies a capability this map adopts it unchanged, except ngrx-effects-migration, reclassified cross-proven on the second application (super-productivity) admitted after the freeze.',
	'Where an application set cannot be determined from records the capability is marked unproven coverage and defaults to experimental.',
] as const;

/**
 * The enumerated capabilities. Ordered React barrel first, then the Angular
 * barrel. Every `provenApps` entry is an independent application whose recorded
 * migration exercised the capability; `evidence` points to the run or orchestrator
 * source that records it, as repository-relative paths.
 */
const CAPABILITY_INPUTS: readonly CapabilityRecordInput[] = [
	// ---- React lineage (@versionless/react) ----
	{
		name: 'react-cra-vite-adapter',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: [
			'craEntryDocument',
			'createCraGlobalIdentifierPlugin',
			'resolveCraNodeCoreModule',
			'createCraNonUtf8ModuleSourcePlugin',
		],
		provenApps: ['papercups', 'react-hospitalrun', 'react-linkfree'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: [
			'packages/cli/src/fixture/react-papercups-v1-0-0-vite8.ts',
			'packages/cli/src/fixture/react-hospitalrun-vite8-run.ts',
			'packages/cli/src/fixture/react-linkfree-v0-72-0-vite8-run.ts',
		],
		note: 'create-react-app to Vite 8 adapter; fired on three independent create-react-app applications. Cross-proven in adapter-freeze.',
	},
	{
		name: 'react-cra-process-global',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: [
			'readProcessGlobalUsage',
			'craProcessGlobalShim',
			'createCraProcessGlobalPlugin',
		],
		provenApps: ['cypress-realworld-app'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/react-cypress-rwa-calibrate-run.ts'],
		note: 'webpack 4 / process-browser functional process global parity, analyzer-driven from the bundle\'s own process.<member> usage. Proven on one create-react-app application whose migrated Vite bundle threw `process is not defined` at module evaluation and now boots; experimental until a second create-react-app application proves it.',
	},
	{
		name: 'react-next-static-adapter',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: ['scanNextStaticSurface', 'liftNextStaticModule', 'nextStaticFrameworkLift'],
		provenApps: ['next-killedbygoogle'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/next-killedbygoogle-v3-0-0-static-run.ts'],
		note: 'Next.js static-export to Vite client-build adapter; only the killedbygoogle legacy-Next application exercises it.',
	},
	{
		name: 'react-vite-origin-adapter',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: ['analyzeViteOriginConfig', 'planViteOriginConfig', 'viteOriginBuildTarget'],
		provenApps: ['react-memos'],
		attribution: 'narrative',
		coverage: 'proven',
		evidence: [
			'evidence/trust/current/corpus-conformance.json',
			'packages/cli/src/fixture/react-memos-aggregate-append.ts',
		],
		note: 'Old-Vite-origin (Vite 2 to Vite 8) adapter; only the memos application, whose origin bundler is Vite rather than webpack, exercises it.',
	},
	{
		name: 'react-connect-to-hooks',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: ['transformReactConnectToHooks'],
		provenApps: ['react-boilerplate'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/react-boilerplate-v4-data-flow-run.ts'],
		note: 'react-redux connect to hooks migration; single application. Experimental in adapter-freeze.',
	},
	{
		name: 'react-data-flow-connect-to-hooks',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: ['transformHomePageConnectToHooks', 'transformRepoListItemConnectToHooks'],
		provenApps: ['react-boilerplate'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/react-boilerplate-v4-data-flow-run.ts'],
		note: 'Data-flow connect to hooks over the exact HomePage and RepoListItem shapes; single application. Experimental in adapter-freeze.',
	},
	{
		name: 'react-composed-migration',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: ['planReactComposedMigration'],
		provenApps: ['react-boilerplate'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/react-boilerplate-v4-composed-run.ts'],
		note: 'Atomic composed connect-to-hooks migration; single application. Experimental in adapter-freeze.',
	},
	{
		name: 'react-class-lifecycle-to-hooks',
		lineage: 'react',
		package: '@versionless/react',
		entryPoints: ['transformReactClassLifecycleToHooks'],
		provenApps: ['react-avataaars'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/react-avataaars-run.ts'],
		note: 'Class-lifecycle to hooks; only the avataaars compatibility probe exercises it. Experimental in adapter-freeze.',
	},

	// ---- Angular lineage (@versionless/angular) ----
	{
		name: 'template-analysis',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['analyzeAngularTemplate', 'analyzeAngularTemplates'],
		provenApps: ['angular-fuxa'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-fuxa-template-compiler-run.ts'],
		note: 'Angular template lexical analysis; exercised only by the fuxa holdout probe.',
	},
	{
		name: 'semantic-module',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['parseModule', 'readModuleImports', 'applySourceEdits'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18c-run.ts'],
		note: 'Shared source-parsing infrastructure; not claimed general as a standalone user-facing capability.',
	},
	{
		name: 'undeclared-runtime-dependency',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['declareUndeclaredRuntimeDependencies', 'undeclaredRuntimeDependencies'],
		provenApps: [],
		attribution: 'unproven',
		coverage: 'unproven',
		evidence: ['evidence/trust/current/adapter-freeze.json'],
		note: 'Invoked unconditionally by the era orchestrator, but per-application firing is not separately recorded; adapter-freeze records single-application basis. Defaulted experimental.',
	},
	{
		name: 'package-exports-style-imports',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: [
			'migratePackageStyleImports',
			'resolvePackageExport',
			'republishedSubpath',
			'rootAggregateStylesheet',
		],
		provenApps: ['angular-eshop-webspa'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-eshop-webspa-migration-run.ts'],
		note: "A stylesheet import of a subpath a package's `exports` map does not answer, resolved against that map as the lane installed it. Two rules in order of narrowness. The first, added by T024 u4, is the exact successor: a blocked specifier whose file the map still publishes under another key — the extensionless spelling packages routinely adopt, `\"./toastr-bs4-alert\"` for the file `./toastr-bs4-alert.scss` — is rewritten onto that key, which is the same bytes and therefore declares no difference and removes nothing. It is taken only when it answers every blocked import of the package in that stylesheet, because repairing some beside an aggregate substitution for the rest would import the same rules twice. The second is the aggregate substitution: where no republished key exists, the package's own root aggregate stylesheet replaces the blocked import and the granular siblings it now contains are removed by name, with the payload change declared in bytes when the closure was measured. A package publishing neither is refused by name and the import is left exactly as it is. Gated on a `packageExports` reading of the installed closure — wired driver-side by T024 u4, because which files a specifier can reach is a fact about the closure the lane installed and not about any table. The eShopOnContainers WebSPA holdout is the application it fired on, and that application's migrated production build completes and emits byte-identical output across two runs.",
	},
	{
		name: 'modal-content-params-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateModalContentParams'],
		provenApps: ['angular-jira-clone'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-jira-clone-apply-run.ts'],
		note: 'ng-zorro modal componentParams migration; only the jira-clone application carries the construct. Experimental in adapter-freeze.',
	},
	{
		name: 'angular-target-cell',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['alignAngularPackageManifest', 'verifyForkLineage', 'AngularTargetCell'],
		provenApps: [
			'angular-factoriolab',
			'angular-jira-clone',
			'angular-super-productivity',
			'angular-tiny-translator',
		],
		attribution: 'orchestrated-unconditional',
		coverage: 'proven',
		evidence: [
			'packages/frameworks/angular/src/angular-cli-era-migration.ts',
			'packages/cli/src/fixture/angular-factoriolab-migration-run.ts',
			'packages/cli/src/fixture/angular-super-productivity-lanes-run.ts',
			'packages/cli/src/fixture/angular-tiny-translator-lanes-run.ts',
		],
		note: 'Target-cell manifest alignment; invoked unconditionally by the era orchestrator across all four Angular applications. Cross-proven in adapter-freeze. Extended by T021 u2 with three readings the Angular holdout demanded — @angular-devkit/build-optimizer and ng2-slim-loading-bar as no-successor, ngx-toastr aligned to ^17.0.2 by its compiled-with stamp — and with `familyPrefixedEcosystemReadings`, which enumerates the packages whose per-package reading overrides their family prefix. A family prefix infers a range from a name; the ecosystem table reads the package, and `alignedVersionRange` consults it first, which is what stops the rule writing a version nobody published. First measured end to end on 2026-08-14: the pigallery2 migrated closure resolves and installs 2278 packages under this alignment. Extended again by T021 u3 with the compile-stage readings — the class an install-stage reading hides, where an open-ended peer range lets a library through the resolver and its published .d.ts refuse at the compiler: ngx-bootstrap aligned to ^11.0.2 (its peers do discriminate; the compiled-with stamp 16.1.4 confirms them), @yaga/leaflet-ng2 and jw-bootstrap-switch-ng2 as no-successor, and xlf-google-translate aligned to ^1.0.4 to leave behind an era line whose own dependency the registry deleted.',
	},
	{
		name: 'custom-webpack-absorption',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['analyzeCustomWebpackFragment'],
		provenApps: ['angular-jira-clone'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-jira-clone-apply-run.ts'],
		note: 'Custom-webpack builder absorption; only the jira-clone application uses the custom-webpack builder. Experimental in adapter-freeze.',
	},
	{
		name: 'tslint-toolchain-removal',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['tslintTargetRemoval', 'tslintConfigRemovals'],
		provenApps: ['angular-jira-clone'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-jira-clone-migration-run.ts'],
		note: 'TSLint toolchain removal; recorded firing on the jira-clone application. Experimental in adapter-freeze.',
	},
	{
		name: 'font-inlining-disable',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['fontInliningDifference', 'fontInliningDisabled'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-u22-font-run.ts'],
		note: 'Font-inlining disable difference; single application.',
	},
	{
		name: 'angular-workspace-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateAngularWorkspace', 'migrateAngularTsConfig'],
		provenApps: [
			'angular-factoriolab',
			'angular-jira-clone',
			'angular-super-productivity',
			'angular-tiny-translator',
		],
		attribution: 'orchestrated-unconditional',
		coverage: 'proven',
		evidence: [
			'packages/frameworks/angular/src/angular-cli-era-migration.ts',
			'packages/cli/src/fixture/angular-factoriolab-migration-run.ts',
			'packages/cli/src/fixture/angular-jira-clone-apply-run.ts',
			'packages/cli/src/fixture/angular-super-productivity-lanes-run.ts',
			'packages/cli/src/fixture/angular-tiny-translator-lanes-run.ts',
		],
		note: 'Workspace and tsconfig migration; invoked unconditionally by the era orchestrator across all four Angular applications. Cross-proven in adapter-freeze.',
	},
	{
		name: 'angular-cli-json-workspace-synthesis',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['synthesizeAngularWorkspace', 'isAngularCliOneWorkspace'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-lanes-run.ts'],
		note: 'Angular CLI 1.x angular-cli.json to angular.json synthesis; only tiny-translator predates angular.json.',
	},
	{
		name: 'builder-package-declaration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['declareBuilderPackages', 'workspaceBuilderPackages'],
		provenApps: [],
		attribution: 'unproven',
		coverage: 'unproven',
		evidence: ['packages/frameworks/angular/src/angular-cli-era-migration.ts'],
		note: 'Declared unconditionally by the era orchestrator, but per-application builder-declaration deltas are not separately recorded. Defaulted experimental.',
	},
	{
		name: 'angular-source-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateAngularSourceModule'],
		provenApps: [
			'angular-factoriolab',
			'angular-jira-clone',
			'angular-super-productivity',
			'angular-tiny-translator',
		],
		attribution: 'orchestrated-unconditional',
		coverage: 'proven',
		evidence: [
			'packages/frameworks/angular/src/angular-cli-era-migration.ts',
			'packages/cli/src/fixture/angular-factoriolab-migration-run.ts',
			'packages/cli/src/fixture/angular-super-productivity-lanes-run.ts',
			'packages/cli/src/fixture/angular-tiny-translator-lanes-run.ts',
		],
		note: 'Source-module specifier migration (zone.js, rxjs, renamed exports); invoked per module for every application the era orchestrator migrates. Cross-proven in adapter-freeze.',
	},
	{
		name: 'ngrx-effects-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateNgrxEffectDecorators'],
		provenApps: ['angular-factoriolab', 'angular-super-productivity'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: [
			'packages/cli/src/fixture/angular-factoriolab-build-lanes-run.ts',
			'packages/cli/src/fixture/angular-factoriolab-migration-run.ts',
			'packages/cli/src/fixture/angular-super-productivity-u18h-run.ts',
			'packages/cli/src/fixture/angular-super-productivity-migrated-lane-run.ts',
		],
		note: 'createEffect decorator-removal migration. Reclassified cross-proven: written for factoriolab, it ran unprompted over super-productivity twenty effect files as a second independent application admitted after the adapter-freeze editorial (which still records it single-application).',
	},
	{
		name: 'node-core-binding-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateNodeCoreBindings', 'readFormatDirectives'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-green-run.ts'],
		note: 'Node core-module format-binding migration; single application.',
	},
	{
		name: 'node-core-runtime-globals',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['supplyNodeCoreRuntimeGlobals', 'declarePolyfillEntryPoint'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-globals-run.ts'],
		note: 'Node core runtime-globals supply; single application.',
	},
	{
		name: 'template-i18n-runtime',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['declareTemplateI18nRuntime', 'readTemplateI18nMarkers'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-localize-run.ts'],
		note: 'Template i18n localize runtime declaration; only the tiny-translator localization application exercises it. Audited class (a) by the T021 G5 wiring repair — the era composition already holds the manifest, the templates and the cell it needs — and deliberately not composed there: it also hands back a polyfill entry point that has to be declared into the builder target, and that seam collides with the hand-composed tiny-translator localize lane. Which of the two owns the declaration is an open decision.',
	},
	{
		name: 'rxjs-prototype-patch-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateRxjsPrototypePatches'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-green-run.ts'],
		note: 'rxjs add/operator prototype-patch migration; single application.',
	},
	{
		name: 'deep-import-redirection',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['redirectUnreachableImports'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-final-run.ts'],
		note: 'Deep-import redirection for unreachable specifiers; single application.',
	},
	{
		name: 'entry-components-removal',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['removeEntryComponents'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-final-run.ts'],
		note: 'NgModule entryComponents removal; single application.',
	},
	{
		name: 'module-with-providers-type-argument',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['addModuleWithProvidersTypeArgument'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-final-run.ts'],
		note: 'ModuleWithProviders type-argument insertion; single application. Composed into migrateAngularCliEraWorkspace by the T021 G5 wiring repair, so every application the era migration is pointed at now reaches it.',
	},
	{
		name: 'widened-union-narrowing',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['narrowWidenedAssignments'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-final-run.ts'],
		note: 'Widened-union assignment narrowing; single application.',
	},
	{
		name: 'webpack-tilde-style-specifier',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['dropWebpackTildeSpecifiers', 'renamePackageInSpecifier'],
		provenApps: ['angular-super-productivity', 'angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: [
			'packages/cli/src/fixture/angular-super-productivity-u18c-run.ts',
			'packages/cli/src/fixture/angular-tiny-translator-final-run.ts',
		],
		note: 'Webpack tilde style-specifier removal; fired on two independent applications. Admitted cross-proven by this map (absent from the coarse adapter-freeze editorial).',
	},
	{
		name: 'forms-legacy-disabled-state',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['declareLegacyCallSetDisabledState', 'readControlValueAccessors'],
		provenApps: ['angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-tiny-translator-cva-run.ts'],
		note: 'Legacy callSetDisabledState forms config; single application.',
	},
	{
		name: 'template-binding-reorder',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['reorderTemplateBindings', 'readDirectiveBindingDependencies'],
		provenApps: ['angular-super-productivity'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u20c2e-record.ts'],
		note: 'Setter-input template-binding reorder; only the super-productivity application carries the construct.',
	},
	{
		name: 'barrel-entry-point-split',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['splitBarrelImports', 'readEntryPointSurface', 'resolveBarrelSymbol'],
		provenApps: ['angular-super-productivity', 'angular-tiny-translator'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: [
			'packages/cli/src/fixture/angular-super-productivity-u18c-run.ts',
			'packages/cli/src/fixture/angular-tiny-translator-green-run.ts',
		],
		note: '@angular/material root-barrel entry-point split; the same root-barrel demand measured on two independent applications. Admitted cross-proven by this map (absent from the coarse adapter-freeze editorial).',
	},
	{
		name: 'declared-type-member-rename',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['renameDeclaredTypeMembers', 'readMissingMembers'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18e-run.ts'],
		note: 'Documented type-member rename (ngrx entity setAll); single application.',
	},
	{
		name: 'json-module-named-import',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['rewriteJsonNamedImports', 'readNamedBindings'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18i-run.ts'],
		note: 'JSON-module named-import rewrite; single application.',
	},
	{
		name: 'promise-executor-void-parameter',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['parameteriseVoidPromiseExecutors'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18g-run.ts'],
		note: 'Void Promise-executor parameterisation; single application. Composed into migrateAngularCliEraWorkspace by the T021 G5 wiring repair.',
	},
	{
		name: 'removed-entry-point-symbol-successor',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['succeedRemovedEntryPointSymbols'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18f-run.ts'],
		note: 'Removed entry-point symbol successor; single application.',
	},
	{
		name: 'sass-mixin-hyphenation-successor',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['renameHyphenatedSassMixins', 'readSassMixinDeclarations'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18i-run.ts'],
		note: 'Sass mixin hyphenation successor; single application.',
	},
	{
		name: 'split-element-successor',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['resolveSplitElementSuccessors', 'checkElementSplit'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18f-run.ts'],
		note: 'Split-element template successor; single application.',
	},
	{
		name: 'stylesheet-url-rebase',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['rebaseStylesheetUrls'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18i-run.ts'],
		note: 'Tree-relative stylesheet URL rebase; single application.',
	},
	{
		name: 'subject-void-type-argument',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['parameteriseVoidSubjects'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18h-run.ts'],
		note: 'Void rxjs Subject type-argument parameterisation; single application. Composed into migrateAngularCliEraWorkspace by the T021 G5 wiring repair.',
	},
	{
		name: 'successor-fork-package',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateSuccessorForkImports'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18c-run.ts'],
		note: 'Successor-fork package import migration; single application.',
	},
	{
		name: 'suggested-export-rename',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['applySuggestedExportRenames', 'readSuggestedExportRenames'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18d-run.ts'],
		note: 'Compiler-suggested export rename; single application.',
	},
	{
		name: 'unparameterised-base-class',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['parameteriseBaseClasses', 'readUnparameterisedBaseClasses'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18e-run.ts'],
		note: 'Unparameterised generic base-class migration; single application. Reachable from migrateAngularCliEraWorkspace since the T021 G5 wiring repair, through the optional baseClassDiagnostics and genericBaseClasses inputs: the capability is positioned by compiler coordinates, so a caller that has not compiled the tree supplies none and none is applied.',
	},
	{
		name: 'web-worker-url-specifier',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['rewriteWorkerUrlSpecifiers'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18j-run.ts'],
		note: 'Web-worker new URL specifier rewrite; single application.',
	},
	{
		name: 'synthetic-default-import-interop',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['enableSyntheticDefaultImports', 'readModuleInterop'],
		provenApps: ['angular-super-productivity'],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-super-productivity-u18g-run.ts'],
		note: 'Synthetic default-import interop; single application.',
	},
	{
		name: 'sentry-v8-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateSentryV8Tracing'],
		provenApps: ['angular-jira-clone'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-jira-clone-apply-run.ts'],
		note: 'Sentry v8 tracing migration; only the jira-clone application carries the construct. Experimental in adapter-freeze.',
	},
	{
		name: 'workspace-engines-retarget',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: [
			'retargetWorkspaceEngines',
			'nodeRangeReading',
			'cellNodeEngineRange',
			'parseNodeVersion',
		],
		provenApps: ['angular-pigallery2'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-pigallery2-migration-run.ts'],
		note: "Workspace-manifest engines.node retarget; composed into migrateAngularCliEraWorkspace by T021 u3 and gated on the construct — it fires only where the manifest declares an engines.node range that excludes the target cell's own Node line, and stands down on a workspace declaring no engines, on one whose declaration already admits the cell, and on a range shape it cannot read. The range written is derived from the cell (the caret on its declared Node line); no version appears in the capability. Only the pigallery2 holdout carries the construct: its era engines.node \">= 6.9 <11.0\" excluded Node 16.20.2 and every install under the migrated manifest reported EBADENGINE against the workspace itself.",
	},
	{
		name: 'undecorated-angular-base-class',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['decorateUndecoratedBaseClasses'],
		provenApps: ['angular-pigallery2'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-pigallery2-migration-run.ts'],
		note: "NG2007 undecorated-base-class decorator synthesis; composed into migrateAngularCliEraWorkspace by T021 u4 and gated on the module's own resolved bindings — a member decorator resolving to @angular/core's Input/Output/ViewChild/ViewChildren/ContentChild/ContentChildren/HostBinding/HostListener, or an `implements` clause resolving to one of its lifecycle interfaces, on a class carrying no decorator, on a cell whose Angular major is 9 or above. It writes `@Directive()` with no selector, which is the abstract-directive form Angular's own undecorated-classes migration shipped for this hop. It stands down on a pre-Ivy cell, on an already-decorated class, and on a class whose only Angular-looking feature is a constructor — that one is an @Injectable/@Directive question a constructor does not answer, and it is refused rather than guessed. One application carries the construct, whose migrated build is RED; nothing here claims that application builds.",
	},
	{
		name: 'application-source-dependency',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: [
			'readApplicationPackageUses',
			'declareApplicationSourceDependencies',
			'inlineLoaderPackages',
			'typesCompanionOf',
		],
		provenApps: ['angular-pigallery2'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-pigallery2-migration-run.ts'],
		note: "Post-disposition application-source dependency declaration; composed into migrateAngularCliEraWorkspace by T021 u4, after the cell alignment because the hole it reads is one the disposition opens. It reads bare package names out of the application's own parsed source — static imports and re-exports, and webpack inline loader chains inside require, including chains whose module request is a template literal — and declares the ones no field of the migrated manifest supplies, at the cell's range and never at an invented one. A package the cell read and found no successor for is reported with every import site instead, which is what states a wall rather than hiding it. The @types companion is declared only when the era closure actually carried one, read off the era lane. One application carries the construct, whose migrated build is RED.",
	},
	{
		name: 'use-position-symbol-successor',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['succeedRemovedSymbolUses', 'readRemovedSpecifierImports'],
		provenApps: ['angular-eshop-webspa'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-eshop-webspa-migration-run.ts'],
		note: "Cross-package removed-symbol carriage read one use position at a time, composed into migrateAngularCliEraWorkspace by T024 u2 and supply-gated on a reading of the successor package's installed surface. It classifies each reference to an imported name as a type reference, a constructor parameter type, a `new` target, an NgModule `imports` member or a call, and writes only what the claim states for that position: `HttpModule` becomes `HttpClientModule` as an `imports` member, while `Http`, `Response` and `Headers` are refused at every position — `HttpClient` emits the parsed body rather than a `Response`, `HttpResponse<T>` is generic where `Response` was not, and `HttpHeaders` is immutable where `Headers` mutated, so a rename there compiles and lies. The `Response` refusal was measured, not reasoned: substituting `HttpResponse<any>` into the holdout's four type-position sites produced eighteen new TS2322/TS2345 diagnostics against the observable the application's own DataService declares. `JsonpModule` has no successor by rename and is dropped only where the application imports none of the services it provided, measured across the whole supplied source set, with the loss declared. Refusal is per declaration and total. One application supplies the reading; its migrated build is not established here.",
	},
	{
		name: 'removed-static-module-method',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['removeRemovedStaticModuleMethods'],
		provenApps: ['angular-eshop-webspa'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-eshop-webspa-migration-run.ts'],
		note: "Removal of a static module configuration method the aligned line no longer declares — `NgbModule.forRoot()`, dropped by ng-bootstrap 4.0 when the module became import-direct — composed into migrateAngularCliEraWorkspace by T024 u2 and gated on a reading of the installed `.d.ts`: a line that still declares the method is refused, an incomplete reading is refused, a call carrying arguments is refused because the configuration it passed has nowhere to go, and a call outside an NgModule `imports` array is refused because what the value is for at that position is not read. One application supplies the reading; its migrated build is not established here.",
	},
	{
		name: 'http-client-call-surface',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateHttpClientCallSurface'],
		provenApps: ['angular-eshop-webspa'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-eshop-webspa-migration-run.ts'],
		note: "The call surface of a removed HTTP client carried as one flow at a time, composed into migrateAngularCliEraWorkspace by T024 u3 after the use-position carriage whose refusals it answers, and supply-gated twice: on the successor package's installed root surface and on the installed declarations of the successor classes themselves, member by member. Four things changed at once and a flow gets all four or none. `.json()` is removed rather than renamed because the successor emits the parsed body, and the emitted type is restated in the same edit from the application's own declared `Observable<T>` return type — a flow the application never typed is refused instead of typed `any` by the capability's choice. A `GET` carrying a `body` is moved to `request(method, url, options)` rather than having the option dropped, proved against both members' option keys as the lane installed them. Every discarded `Headers.append` becomes an assignment back to its receiver, gated on reading that the successor's mutator returns the class; a mutator call whose value the era code did not discard is refused. A `Response` annotation on an operator callback parameter is carried to the type the era `.json()` returned, `any`, with the loss of checking declared — the measured alternative, `HttpResponse<any>`, produced eighteen new diagnostics and is recorded withdrawn. Refusal is per declaration and total. One application proves it; nothing here claims that application builds.",
	},
	{
		name: 'superseded-era-lockfile',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: [
			'supersedeEraLockfiles',
			'readNpmLockfileResolutions',
			'lockfileContradictions',
			'isNpmLockfilePath',
		],
		provenApps: ['angular-eshop-webspa'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-eshop-webspa-migration-run.ts'],
		note: "Era-lockfile supersession, composed into migrateAngularCliEraWorkspace by T024 u1 and decided last, on the manifest every other manifest capability has finished writing. It removes a lockfile only where that lockfile's own bytes contradict the migrated manifest's own bytes — a package both documents name, resolved to a major the migrated range does not name — and it names the contradictions in the declared difference. It stands down on a lockfile that agrees with the migrated manifest, because that resolution is still the manifest's own, and it reports rather than removes a lockfile it cannot read: a yarn.lock, a pnpm-lock.yaml, a JSON document that is not an npm lockfile. A tree that supplies no lockfile bytes has none removed, which is why no earlier vertical's changeset moves: the capability reads what it is handed and never the file system. Before it, every lane moved the era lockfile out by convention and the changeset did not say so — a changeset that describes a tree which cannot be installed. One application supplies the reading, whose migrated build is not established here.",
	},
	{
		name: 'workspace-script-flags',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: [
			'retargetWorkspaceScripts',
			'removedBuilderOptionFlags',
			'declaredConfigurationNames',
			'REMOVED_ANGULAR_CLI_FLAGS',
		],
		provenApps: ['angular-eshop-webspa'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-eshop-webspa-migration-run.ts'],
		note: "npm-script flag retargeting, composed into migrateAngularCliEraWorkspace by T024 u1 after the workspace migration whose decisions it carries. It edits only a command segment whose first word is the workspace's own CLI binary, drops only a flag whose builder option *this* workspace migration removed — read from that migration's own changes, not from a list of flags removed somewhere — and retargets only a flag the cell's Angular major is past, and only onto a configuration the migrated workspace really declares. Everything else is reported: a quoted command it declines to take apart, a flag that may be carrying a separate value, a `--prod` whose replacement configuration does not exist. It stands down entirely on a manifest with no scripts, on a workspace migration that removed no builder option, and on a cell that has not crossed the removal. One application carries the construct, whose migrated build is not established here.",
	},
	{
		name: 'departed-dom-lib-member',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['accommodateDepartedDomMembers', 'isVendorPrefixedStyleMember'],
		provenApps: ['angular-pigallery2'],
		attribution: 'orchestrated-construct-gated',
		coverage: 'proven',
		evidence: ['packages/cli/src/fixture/angular-pigallery2-migration-run.ts'],
		note: "lib.dom.d.ts drift accommodation; composed into migrateAngularCliEraWorkspace by T021 u4 through the same supply-gated seam unparameterised-base-class uses — a caller that has not compiled the tree supplies no TS2339 positions and gets no transform. It acts only where the compiler resolved the receiver to CSSStyleDeclaration and the member is spelled as a vendor-prefixed CSS property, and it widens that one receiver at that one access to CSSStyleDeclaration & Record<string, string>, leaving the emitted JavaScript unchanged. The capability carries no list of departed properties: the property is the compiler's word. A stale position refuses, which is also what makes a second application a no-op. One application carries the construct, whose migrated build is RED.",
	},
	{
		name: 'angular-cli-era-migration',
		lineage: 'angular',
		package: '@versionless/angular',
		entryPoints: ['migrateAngularCliEraWorkspace'],
		provenApps: [
			'angular-factoriolab',
			'angular-jira-clone',
			'angular-super-productivity',
			'angular-tiny-translator',
		],
		attribution: 'direct-invocation',
		coverage: 'proven',
		evidence: [
			'packages/cli/src/fixture/angular-factoriolab-migration-run.ts',
			'packages/cli/src/fixture/angular-jira-clone-apply-run.ts',
			'packages/cli/src/fixture/angular-super-productivity-lanes-run.ts',
			'packages/cli/src/fixture/angular-tiny-translator-lanes-run.ts',
		],
		note: 'The CLI-era migration orchestrator; run directly by all four independent Angular applications. Cross-proven in adapter-freeze.',
	},
];

function summariseLineage(
	capabilities: readonly CapabilityRecord[],
	lineage: CapabilityLineage,
): CapabilityLineageSummary {
	const lineageCapabilities = capabilities.filter((capability) => capability.lineage === lineage);
	const crossProven = lineageCapabilities.filter(
		(capability) => capability.classification === 'cross-proven',
	).length;
	return {
		total: lineageCapabilities.length,
		crossProven,
		experimental: lineageCapabilities.length - crossProven,
	};
}

/**
 * Derives the full capability-coverage record. Every classification is computed
 * from the proving-application count — nothing is read from a stored field —
 * and a duplicate proving application is rejected so a count cannot be inflated.
 */
export function buildCapabilityCoverage(): CapabilityCoverage {
	const capabilities = CAPABILITY_INPUTS.map((input): CapabilityRecord => {
		if (new Set(input.provenApps).size !== input.provenApps.length)
			throw new Error(`Duplicate proving application listed for ${input.name}`);
		if (input.coverage === 'unproven' && input.provenApps.length !== 0)
			throw new Error(`Unproven coverage must list no applications: ${input.name}`);
		const { proofCount, classification } = classifyCapability(input.provenApps);
		return { ...input, proofCount, classification };
	});
	const crossProven = capabilities.filter(
		(capability) => capability.classification === 'cross-proven',
	).length;
	return {
		schemaVersion: CAPABILITY_COVERAGE_SCHEMA,
		purpose: CAPABILITY_COVERAGE_PURPOSE,
		crossProvenThreshold: CROSS_PROVEN_THRESHOLD,
		method: CAPABILITY_METHOD,
		independentApplications: {
			react: [...REACT_INDEPENDENT_APPLICATIONS],
			angular: [...ANGULAR_INDEPENDENT_APPLICATIONS],
		},
		summary: {
			total: capabilities.length,
			crossProven,
			experimental: capabilities.length - crossProven,
			react: summariseLineage(capabilities, 'react'),
			angular: summariseLineage(capabilities, 'angular'),
		},
		capabilities,
	};
}

function asRecordOf(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label}`);
	return value as Record<string, unknown>;
}

/**
 * Re-derives classification from the listed applications and rejects any drift.
 * This is the guard the packet requires: a stored classification cannot be
 * hand-set, a capability proven on fewer than two applications cannot be
 * cross-proven, and the proof count must equal the distinct applications listed.
 */
export function verifyCapabilityCoverage(value: unknown): CapabilityCoverage {
	const root = asRecordOf(value, 'capability coverage');
	if (root.schemaVersion !== CAPABILITY_COVERAGE_SCHEMA)
		throw new Error('Unsupported capability-coverage schema');
	if (root.crossProvenThreshold !== CROSS_PROVEN_THRESHOLD)
		throw new Error('Capability-coverage threshold is not the required two applications');
	if (!Array.isArray(root.capabilities) || root.capabilities.length === 0)
		throw new Error('Capability-coverage capabilities are absent');
	const names = new Set<string>();
	let crossProven = 0;
	const reactSummary = { total: 0, crossProven: 0 };
	const angularSummary = { total: 0, crossProven: 0 };
	for (const entry of root.capabilities) {
		const capability = asRecordOf(entry, 'capability');
		const name = capability.name;
		if (typeof name !== 'string' || name.length === 0)
			throw new Error('Capability name is absent');
		if (names.has(name)) throw new Error(`Duplicate capability: ${name}`);
		names.add(name);
		if (!Array.isArray(capability.provenApps))
			throw new Error(`Capability ${name} omits its proving applications`);
		const provenApps = capability.provenApps.map((app) => {
			if (typeof app !== 'string' || app.length === 0)
				throw new Error(`Capability ${name} lists a non-string proving application`);
			return app;
		});
		if (new Set(provenApps).size !== provenApps.length)
			throw new Error(`Capability ${name} lists a duplicate proving application`);
		const { proofCount, classification } = classifyCapability(provenApps);
		if (capability.proofCount !== proofCount)
			throw new Error(`Capability ${name} proof count does not match its applications`);
		if (capability.classification !== classification)
			throw new Error(`Capability ${name} classification is not derived from its proof count`);
		if (classification === 'cross-proven' && proofCount < CROSS_PROVEN_THRESHOLD)
			throw new Error(`Capability ${name} is cross-proven on fewer than two applications`);
		if (capability.coverage === 'unproven' && proofCount !== 0)
			throw new Error(`Capability ${name} is unproven yet lists applications`);
		if (!Array.isArray(capability.evidence) || capability.evidence.length === 0)
			throw new Error(`Capability ${name} omits evidence pointers`);
		if (classification === 'cross-proven') crossProven += 1;
		const lineageSummary = capability.lineage === 'react' ? reactSummary : angularSummary;
		lineageSummary.total += 1;
		if (classification === 'cross-proven') lineageSummary.crossProven += 1;
	}
	const summary = asRecordOf(root.summary, 'capability-coverage summary');
	if (summary.total !== root.capabilities.length)
		throw new Error('Capability-coverage summary total does not match the enumerated capabilities');
	if (summary.crossProven !== crossProven)
		throw new Error('Capability-coverage summary cross-proven count does not match the derivation');
	if (summary.experimental !== root.capabilities.length - crossProven)
		throw new Error('Capability-coverage summary experimental count does not match the derivation');
	const reactReported = asRecordOf(summary.react, 'react summary');
	const angularReported = asRecordOf(summary.angular, 'angular summary');
	if (
		reactReported.total !== reactSummary.total ||
		reactReported.crossProven !== reactSummary.crossProven ||
		reactReported.experimental !== reactSummary.total - reactSummary.crossProven
	)
		throw new Error('Capability-coverage React lineage summary does not match the derivation');
	if (
		angularReported.total !== angularSummary.total ||
		angularReported.crossProven !== angularSummary.crossProven ||
		angularReported.experimental !== angularSummary.total - angularSummary.crossProven
	)
		throw new Error('Capability-coverage Angular lineage summary does not match the derivation');
	return value as CapabilityCoverage;
}
