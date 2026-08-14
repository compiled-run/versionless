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
	'Enumerated from the @versionless/react and @versionless/angular index barrels: seven React modules and forty-one Angular modules.',
	'Proving applications are the independent applications whose recorded migration exercised the capability — a direct invocation in the application migration fixture, or a construct-gated firing recorded in its build-lane run.',
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
		entryPoints: ['migratePackageStyleImports', 'resolvePackageExport'],
		provenApps: [],
		attribution: 'unproven',
		coverage: 'unproven',
		evidence: ['evidence/trust/current/adapter-freeze.json'],
		note: 'Package-exports style-import resolution; per-application firing not determinable from records; adapter-freeze records single-application basis. Defaulted experimental.',
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
		note: 'Target-cell manifest alignment; invoked unconditionally by the era orchestrator across all four Angular applications. Cross-proven in adapter-freeze. Extended by T021 u2 with three readings the Angular holdout demanded — @angular-devkit/build-optimizer and ng2-slim-loading-bar as no-successor, ngx-toastr aligned to ^17.0.2 by its compiled-with stamp — and with `familyPrefixedEcosystemReadings`, which enumerates the packages whose per-package reading overrides their family prefix. A family prefix infers a range from a name; the ecosystem table reads the package, and `alignedVersionRange` consults it first, which is what stops the rule writing a version nobody published. First measured end to end on 2026-08-14: the pigallery2 migrated closure resolves and installs 2278 packages under this alignment.',
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
