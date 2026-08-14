/**
 * The composed Angular CLI era migration: workspace configuration, TypeScript
 * configuration, package manifest and application source, lifted onto one
 * declared target cell and reported as a single itemised changeset.
 *
 * The changeset is the product. It records, per file, the bytes before and
 * after as digests and the individual changes that produced them, and it
 * separates application files from workspace files so that a count of changed
 * application files means what it says: source the application owns, changed by
 * a transform, not a version number edited in a manifest.
 */

import { createHash } from 'node:crypto';
import {
	alignAngularPackageManifest,
	compareStrings,
	type AngularTargetCell,
	type DependencyChange,
} from './angular-target-cell.ts';
import { migrateAngularSourceModule, type SourceChange } from './angular-source-migration.ts';
import {
	migrateModalContentParams,
	type ModalContentParamsChange,
	type ModuleResolution,
} from './modal-content-params-migration.ts';
import { migrateNgrxEffectDecorators, type NgrxEffectChange } from './ngrx-effects-migration.ts';
import {
	migratePackageStyleImports,
	type PackageExportsReading,
	type StyleImportChange,
} from './package-exports-style-imports.ts';
import { migrateSentryV8Tracing, type SentryV8Change } from './sentry-v8-migration.ts';
import {
	removeEntryComponents,
	type EntryComponentsChange,
} from './entry-components-removal.ts';
import {
	readDirectiveBindingDependencies,
	reorderTemplateBindings,
	type BindingReorderChange,
	type DirectiveBindingReading,
} from './template-binding-reorder.ts';
import {
	declareUndeclaredRuntimeDependencies,
	undeclaredRuntimeDependencies,
	type InstalledPackage,
} from './undeclared-runtime-dependency.ts';
import {
	migrateAngularTsConfig,
	migrateAngularWorkspace,
	normalizeFragmentPath,
	type ConfigChange,
} from './angular-workspace-migration.ts';
import {
	isAngularCliOneWorkspace,
	synthesizeAngularWorkspace,
	type SynthesizedWorkspace,
} from './angular-cli-json-workspace-synthesis.ts';
import { tslintConfigRemovals } from './tslint-toolchain-removal.ts';
import { supersedeEraLockfiles } from './superseded-era-lockfile.ts';
import { retargetWorkspaceScripts, type ScriptFlagChange } from './workspace-script-flags.ts';
import { declareBuilderPackages } from './builder-package-declaration.ts';
import { retargetWorkspaceEngines } from './workspace-engines-retarget.ts';
import {
	addModuleWithProvidersTypeArgument,
	type ModuleWithProvidersChange,
} from './module-with-providers-type-argument.ts';
import {
	parameteriseVoidSubjects,
	type VoidSubjectChange,
} from './subject-void-type-argument.ts';
import {
	parameteriseVoidPromiseExecutors,
	type VoidExecutorChange,
} from './promise-executor-void-parameter.ts';
import {
	parameteriseBaseClasses,
	type BaseClassParameterisationChange,
	type GenericBaseClassReading,
	type UnparameterisedBaseClassDiagnostic,
} from './unparameterised-base-class.ts';
import {
	decorateUndecoratedBaseClasses,
	type UndecoratedBaseClassChange,
} from './undecorated-angular-base-class.ts';
import {
	accommodateDepartedDomMembers,
	type DepartedDomMemberChange,
} from './departed-dom-lib-member.ts';
import { type MissingMemberDiagnostic } from './declared-type-member-rename.ts';
import {
	declareApplicationSourceDependencies,
	readApplicationPackageUses,
} from './application-source-dependency.ts';
import {
	redirectUnreachableImports,
	type DeepImportChange,
	type DeepImportReading,
} from './deep-import-redirection.ts';
import {
	ANGULAR_HTTP_USE_POSITION_SUCCESSORS,
	readRemovedSpecifierImports,
	succeedRemovedSymbolUses,
	type DocumentedUsePositionSuccessor,
	type UsePositionChange,
} from './use-position-symbol-successor.ts';
import { type RootSurfaceReading } from './removed-entry-point-symbol-successor.ts';
import {
	ANGULAR_HTTP_CALL_SURFACE,
	migrateHttpClientCallSurface,
	type HttpCallSurfaceChange,
	type HttpCallSurfaceClaim,
	type SuccessorClassSurfaceReading,
} from './http-client-call-surface.ts';
import {
	DOCUMENTED_STATIC_MODULE_METHOD_REMOVALS,
	removeRemovedStaticModuleMethods,
	type ModuleClassSurfaceReading,
	type StaticModuleMethodChange,
} from './removed-static-module-method.ts';
import {
	migrateRxjsPrototypePatches,
	type PatchedCallDiagnostic,
	type RxjsPipeChange,
	type RxjsSurfaceReading,
} from './rxjs-prototype-patch-migration.ts';
import {
	dropWebpackTildeSpecifiers,
	type ClosureFileReading,
	type TildeSpecifierChange,
} from './webpack-tilde-style-specifier.ts';

export type WorkspaceFile = Readonly<{ path: string; source: string }>;

export type AngularMigrationInput = Readonly<{
	packageManifest: WorkspaceFile;
	workspaceConfig: WorkspaceFile;
	tsConfig: WorkspaceFile;
	/** Application source modules, as read from the workspace. */
	sourceModules: readonly WorkspaceFile[];
	/**
	 * Component templates the application owns, kept apart from
	 * {@link sourceModules} because they are not modules: no source transform
	 * parses them, and the only capability that reads them reorders directive
	 * bindings a component class proves are order-dependent. A tree that supplies
	 * none has none reordered, which is a different thing from having none to
	 * reorder.
	 */
	templates?: readonly WorkspaceFile[];
	/**
	 * Webpack fragments a wrapper builder reads, keyed by the path the workspace
	 * writes for them. A fragment a target references but that is not supplied
	 * here is reported unread and its wrapper builder is left in place.
	 */
	webpackFragments?: readonly WorkspaceFile[];
	/**
	 * Every workspace-relative path the tree carries, for capabilities that
	 * decide a file should no longer exist. Only paths are needed: a file removed
	 * because the toolchain that read it is gone does not have to be parsed. A
	 * tree that supplies no list has no files removed.
	 */
	workspaceFiles?: readonly string[];
	/**
	 * Stylesheets the application owns, kept apart from {@link sourceModules}
	 * because they are not modules: no source transform parses them, and the only
	 * capability that reads them resolves package subpaths against an exports map.
	 */
	styleSheets?: readonly WorkspaceFile[];
	/**
	 * The published surface of packages whose stylesheet subpaths the application
	 * imports, as read from the installed closure. A package not read here has its
	 * style imports left exactly as they are.
	 */
	packageExports?: readonly PackageExportsReading[];
	/**
	 * The installed dependency closure, reduced to declarations and shipped
	 * imports. Supplying it is what lets undeclared runtime dependencies be
	 * detected; a tree that supplies none has none detected, which is a different
	 * thing from having none.
	 */
	installedPackages?: readonly InstalledPackage[];
	/** How the workspace resolves module specifiers written in its own source. */
	moduleResolution?: ModuleResolution;
	/**
	 * `TS2314` as the target line's compiler reported it, per application module.
	 * A generic base class the application extends bare cannot be parameterised
	 * from the source alone — the argument is a fact about the installed
	 * declaration, and which clause is wrong is a fact the compiler states — so
	 * this capability is reachable only for a caller that has compiled the tree. A
	 * tree that supplies no diagnostics has no `extends` clause parameterised,
	 * which is a different thing from having none to parameterise.
	 */
	baseClassDiagnostics?: readonly BaseClassDiagnosticReading[];
	/**
	 * The generic base classes the application extends, read from the installed
	 * closure. Supplied beside {@link baseClassDiagnostics}: a diagnostic names the
	 * clause and this names what the declaration publishes, and the capability
	 * refuses every site it cannot prove from both.
	 */
	genericBaseClasses?: readonly GenericBaseClassReading[];
	/**
	 * `TS2339` as the target line's compiler reported it, per application module.
	 * A member the current `lib.dom.d.ts` no longer declares is not readable from
	 * the source — the source is exactly what it always was — so the seam is the
	 * same supply-gated one {@link baseClassDiagnostics} uses. A tree that supplies
	 * none has none accommodated.
	 */
	missingMemberDiagnostics?: readonly MissingMemberDiagnosticReading[];
	/**
	 * What packages whose subpaths the application imports actually publish, read
	 * from the installed closure. A package not read here has its deep imports left
	 * exactly as they are: whether a subpath is reachable is a fact about the
	 * installed package's `exports` map, and nothing in the source states it.
	 */
	deepImportReadings?: readonly DeepImportReading[];
	/**
	 * The lockfiles the workspace carries, read rather than named. A tree that
	 * supplies none has none declared superseded: whether a resolution still
	 * describes the manifest the migration just rewrote is a reading of the
	 * lockfile's own bytes, and a path is not those bytes.
	 */
	lockfiles?: readonly WorkspaceFile[];
	/**
	 * The `@types/` packages the *era* closure carried, by name. A package this
	 * application imports directly and the era manifest never declared may have had
	 * its type declarations supplied the same accidental way its runtime was; this
	 * reading is what lets that companion be declared beside it rather than
	 * inferred from a name.
	 */
	eraClosureTypePackages?: readonly string[];
	/**
	 * What the successor of a removed *package* publishes, read from the installed
	 * closure. Supplying it is what makes the use-position successor reachable: the
	 * capability refuses every site it cannot prove from the reading, and a tree
	 * that supplies none has no removed symbol carried anywhere — which is a
	 * different thing from having none to carry.
	 */
	removedSymbolSurfaces?: readonly RootSurfaceReading[];
	/**
	 * The claims the use-position successor is asked to check. The adapter's own
	 * documented table is used when none is supplied; a caller that supplies one
	 * replaces it rather than adding to it, so a claim is never carried in by
	 * accident.
	 */
	removedSymbolSuccessors?: readonly DocumentedUsePositionSuccessor[];
	/**
	 * What the installed declaration of a module class publishes, per exported
	 * class. Supplying it is what makes the removed-static-module-method capability
	 * reachable: whether a line still declares `forRoot` is a fact about the
	 * installed `.d.ts` and nothing in the application states it.
	 */
	moduleClassSurfaces?: readonly ModuleClassSurfaceReading[];
	/**
	 * What the installed *successor* classes publish, member by member: the type
	 * each member returns and the option keys it takes. Supplying it is what makes
	 * the call-surface migration reachable, because every one of its rules is a
	 * claim about behaviour — whether a mutator clones, whether a member still
	 * publishes the option an era call carried — and nothing in the application
	 * states either.
	 */
	successorClassSurfaces?: readonly SuccessorClassSurfaceReading[];
	/**
	 * The call-surface claim the migration is asked to check. The adapter's own
	 * documented `@angular/http` claim is used when none is supplied.
	 */
	httpCallSurface?: HttpCallSurfaceClaim;
	/**
	 * `TS2339` on an RxJS receiver, as the target line's compiler reported it, per
	 * application module. Which `.map(` is an observable's is a question only the
	 * type checker answers, so this seam is the same supply-gated one
	 * {@link baseClassDiagnostics} uses.
	 */
	rxjsPatchDiagnostics?: readonly RxjsPatchDiagnosticReading[];
	/**
	 * The installed RxJS surface, read from the closure. Supplied beside
	 * {@link rxjsPatchDiagnostics}: the diagnostic names the call site and this
	 * names what the package publishes to move it to.
	 */
	rxjsSurface?: RxjsSurfaceReading;
	/**
	 * The installed closure, asked the one question the tilde-specifier capability
	 * has: does this path exist. A tree that supplies no reading has no `~`
	 * specifier un-prefixed, because dropping the prefix without resolving the
	 * result moves the failure rather than answering it.
	 */
	styleClosure?: ClosureFileReading;
}>;

/**
 * The RxJS `TS2339` diagnostics one application module carries, keyed by the
 * path the workspace writes for it — the compiler's own 1-based positions into
 * the bytes the caller compiled.
 */
export type RxjsPatchDiagnosticReading = Readonly<{
	path: string;
	diagnostics: readonly PatchedCallDiagnostic[];
}>;

/**
 * The `TS2339` diagnostics one application module carries, keyed by the path the
 * workspace writes for it — the compiler's own 1-based positions into the bytes
 * the caller compiled.
 */
export type MissingMemberDiagnosticReading = Readonly<{
	path: string;
	diagnostics: readonly MissingMemberDiagnostic[];
}>;

/**
 * The `TS2314` diagnostics one application module carries, keyed by the path the
 * workspace writes for it. `line` and `column` are the compiler's own 1-based
 * pair, and they are positions in the bytes the caller compiled: the capability
 * checks that the name it was told to fill is written where it was told, and
 * refuses by name rather than editing when it is not.
 */
export type BaseClassDiagnosticReading = Readonly<{
	path: string;
	diagnostics: readonly UnparameterisedBaseClassDiagnostic[];
}>;

export type MigratedFile = Readonly<{
	path: string;
	kind: 'application' | 'workspace';
	changed: boolean;
	sha256Before: string;
	sha256After: string;
	source: string;
	changes: readonly string[];
}>;

export type AngularMigration = Readonly<{
	cell: string;
	files: readonly MigratedFile[];
	applicationFilesChanged: number;
	workspaceFilesChanged: number;
	applicationFilesScanned: number;
	unhandled: readonly string[];
	/**
	 * Capabilities the migrated workspace deliberately no longer has, one line
	 * per removal — a dropped lint target, a dropped configuration file, a
	 * package the cell read and found no successor for. A reader is owed these by
	 * name: they are the difference between the era workspace and this one that a
	 * clean changeset would otherwise hide.
	 */
	declaredDifferences: readonly string[];
	/** Files the migration decided the tree should no longer carry. */
	removedFiles: readonly string[];
}>;

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

/**
 * Parse a workspace document only far enough to decide which format it is in.
 *
 * A document that is not JSON at all is handed on unparsed: the migration that
 * reads it next refuses it with the diagnosable error it already writes, and
 * duplicating that refusal here would report the same defect twice under two
 * different names.
 */
function safeParseJson(source: string): unknown {
	try {
		return JSON.parse(source) as unknown;
	} catch {
		return null;
	}
}

function describeConfigChange(change: ConfigChange): string {
	if (change.to === null) return `removed ${change.path} (was ${change.from ?? 'absent'})`;
	if (change.from === null) return `added ${change.path} = ${change.to}`;
	return `${change.path}: ${change.from} -> ${change.to}`;
}

function describeDependencyChange(change: DependencyChange): string {
	const target = `${change.field}.${change.name}`;
	return change.to === null
		? `removed ${target} (was ${change.from}) — ${change.reason}`
		: `${target}: ${change.from} -> ${change.to} — ${change.reason}`;
}

/**
 * A script-flag change names the script it edited, because a manifest carries
 * many and the reader has to be able to check the command line rather than the
 * flag.
 */
function describeScriptFlagChange(change: ScriptFlagChange): string {
	const target = `scripts.${change.script}`;
	return change.to === null
		? `removed ${change.from} from ${target} — ${change.reason}`
		: `${target}: ${change.from} -> ${change.to} — ${change.reason}`;
}

function describeSourceChange(
	change:
		| SourceChange
		| NgrxEffectChange
		| SentryV8Change
		| ModalContentParamsChange
		| StyleImportChange,
): string {
	return `line ${change.line}: ${change.kind} ${change.from} -> ${change.to}`;
}

/**
 * An entry-components removal names no successor, because the property has
 * none: what a reader needs from it is which components the dropped list named,
 * so the proof that each is still reached can be checked against the literal.
 */
function describeEntryComponentsChange(change: EntryComponentsChange): string {
	return `line ${change.line}: ${change.kind} of ${change.symbols.join(', ')}`;
}

/**
 * A type-position insertion names no predecessor, because there was none: what a
 * reader needs is the argument that was written and where the capability read it,
 * so the claim can be checked against the same two places the source states it.
 */
function describeModuleWithProvidersChange(change: ModuleWithProvidersChange): string {
	return `line ${change.line}: ${change.kind} <${change.argument}> read from ${change.readFrom}`;
}

/**
 * `void` is a claim about every value a subject or a promise will ever carry, and
 * the evidence for it is the count of zero-argument settlements the capability
 * read. The count is reported so the claim can be checked against the binding.
 */
function describeVoidSubjectChange(change: VoidSubjectChange): string {
	return (
		`line ${change.line}: ${change.kind} <void> on ${change.binding}, proved by ` +
		`${String(change.callSites)} zero-argument next call(s)`
	);
}

function describeVoidExecutorChange(change: VoidExecutorChange): string {
	return (
		`line ${change.line}: ${change.kind} <void>, proved by ${String(change.callSites)} ` +
		`zero-argument ${change.parameter} call(s)`
	);
}

/**
 * A base-class parameterisation carries two facts a reader is owed beyond the
 * argument: the package the argument was imported from, and whether importing it
 * meant a new declaration in the module.
 */
function describeBaseClassChange(change: BaseClassParameterisationChange): string {
	return (
		`line ${change.line}: ${change.kind} ${change.base}<${change.argument}> from ` +
		`${change.specifier} (${change.importAdded ? 'import added' : 'existing import extended'})`
	);
}

/**
 * A synthesized decorator names no predecessor, because there was none. What a
 * reader needs is which Angular features the class used — the whole of the
 * evidence that it needed a decorator at all — so the claim can be checked
 * against the class the compiler will now compile.
 */
function describeUndecoratedBaseClassChange(change: UndecoratedBaseClassChange): string {
	return (
		`line ${change.line}: ${change.kind} ${change.decorator} on ${change.className}, which uses ` +
		`${change.features.join(', ')} (${change.importAdded ? 'import added' : 'existing import extended'})`
	);
}

/**
 * A widened receiver names the type the compiler resolved and the type it was
 * widened to, so the claim can be checked against the declaration that stopped
 * carrying the member.
 */
function describeDepartedDomMemberChange(change: DepartedDomMemberChange): string {
	return (
		`line ${change.line}: ${change.kind} ${change.receiver}.${change.member} — ` +
		`${change.declaredType} no longer declares it, receiver widened to ${change.widenedTo}`
	);
}

/**
 * A use-position change names the positions it was written at, because that is
 * the whole of what separates it from a rename: a reader who wants to check the
 * claim needs to know which of the five positions the substitution landed in.
 */
function describeUsePositionChange(change: UsePositionChange): string {
	return change.to === null
		? `line ${change.line}: ${change.kind} ${change.from} dropped from ${change.specifier} at ` +
				`${change.positions.join(', ')} (${change.useSites} use site(s))`
		: `line ${change.line}: ${change.kind} ${change.from} -> ${change.to} from ` +
				`${String(change.successor)} at ${change.positions.join(', ')} ` +
				`(${change.useSites} use site(s))`;
}

function describeHttpCallSurfaceChange(change: HttpCallSurfaceChange): string {
	return (
		`line ${change.line}: ${change.kind} ${change.from} -> ${change.to === '' ? '(removed)' : change.to}` +
		` — ${change.detail}`
	);
}

function describeStaticModuleMethodChange(change: StaticModuleMethodChange): string {
	return (
		`line ${change.line}: ${change.kind} ${change.from} -> ${change.to} — ` +
		`${change.package} no longer declares ${change.symbol}.${change.method}`
	);
}

function describeRxjsPipeChange(change: RxjsPipeChange): string {
	return `line ${change.line}: ${change.kind} ${change.from} -> ${change.to || '(removed)'}`;
}

function describeTildeChange(change: TildeSpecifierChange): string {
	return `line ${change.line}: ${change.kind} ${change.from} -> ${change.to} (${change.resolved})`;
}

function describeDeepImportChange(change: DeepImportChange): string {
	return `line ${change.line}: ${change.kind} ${change.from} -> ${change.to} (${change.symbols.join(', ')})`;
}

function describeBindingReorderChange(change: BindingReorderChange): string {
	return (
		`line ${change.line}: ${change.kind} on <${change.element}> (${change.directive}) — ` +
		`${change.before.join(', ')} -> ${change.after.join(', ')}, forced by ${change.edges.join('; ')}`
	);
}

function file(
	input: WorkspaceFile,
	source: string,
	kind: MigratedFile['kind'],
	changes: readonly string[],
): MigratedFile {
	return Object.freeze({
		path: input.path,
		kind,
		changed: source !== input.source,
		sha256Before: sha256(input.source),
		sha256After: sha256(source),
		source,
		changes: Object.freeze([...changes]),
	});
}

/**
 * Apply every capability of the adapter to one workspace.
 *
 * Order matters in three places, and each is named where it happens: the
 * workspace migration decides which builder targets cannot be carried, and the
 * packages those targets released are what the manifest alignment then removes;
 * `entryComponents` is dropped after the capabilities that rewrite the literal it
 * reads; and the one capability positioned by compiler coordinates runs before
 * the capabilities that move them. Nothing else is ordered, and no capability
 * reads a file it was not handed.
 */
export function migrateAngularCliEraWorkspace(
	input: AngularMigrationInput,
	cell: AngularTargetCell,
): AngularMigration {
	const unhandled: string[] = [];
	const declaredDifferences: string[] = [];
	const fragments: Record<string, string> = {};
	for (const fragment of input.webpackFragments ?? [])
		fragments[normalizeFragmentPath(fragment.path)] = fragment.source;
	/**
	 * A workspace in the pre-`angular.json` Angular CLI 1.x format is translated
	 * into the modern one before anything else reads it. Every capability below
	 * expects a `projects` map with `architect` targets, and the era document has
	 * neither; synthesizing first is what lets the rest of the adapter run on a
	 * CLI 1.x tree without one of them learning a second workspace format.
	 */
	let synthesis: SynthesizedWorkspace | null = null;
	let workspaceConfigSource = input.workspaceConfig.source;
	if (isAngularCliOneWorkspace(safeParseJson(input.workspaceConfig.source))) {
		synthesis = synthesizeAngularWorkspace(
			input.workspaceConfig.source,
			cell,
			input.workspaceConfig.path,
		);
		workspaceConfigSource = synthesis.config;
		unhandled.push(...synthesis.unhandled);
		declaredDifferences.push(...synthesis.declaredDifferences);
	}
	const workspace = migrateAngularWorkspace(workspaceConfigSource, cell, fragments);
	unhandled.push(...workspace.unhandled);
	declaredDifferences.push(...workspace.declaredDifferences);
	const configRemovals = tslintConfigRemovals(input.workspaceFiles ?? [], cell);
	declaredDifferences.push(...configRemovals.map((removal) => removal.reason));
	for (const absorbed of workspace.absorbedFragments)
		unhandled.push(
			`${absorbed.path} was absorbed into the official builder and is no longer referenced by any ` +
				`target; it was left in the tree rather than deleted. Absorbed capabilities: ` +
				absorbed.capabilities.map((entry) => `${entry.kind} ${entry.detail}`).join(', '),
		);
	const manifest: unknown = JSON.parse(input.packageManifest.source);
	if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
		throw new Error('Angular migration: the package manifest is not a JSON object');
	const aligned = alignAngularPackageManifest(
		manifest as Readonly<Record<string, unknown>>,
		cell,
		workspace.removedPackages,
	);
	unhandled.push(...aligned.unhandled);
	declaredDifferences.push(...aligned.declaredDifferences);
	/**
	 * Holes the closure carries are closed after the cell alignment, not before:
	 * the cell decides which lines the workspace runs, and an undeclared edge is
	 * declared at the line the cell read for it.
	 */
	const holes = undeclaredRuntimeDependencies(input.installedPackages ?? []);
	const declared = declareUndeclaredRuntimeDependencies(aligned.manifest, holes, cell);
	unhandled.push(...declared.unhandled);
	declaredDifferences.push(...declared.declaredDifferences);
	/**
	 * The holes the *application's own source* carries are closed after the cell
	 * alignment for a second reason: the alignment is what drops the packages the
	 * cell found no successor for, and a package the application imports directly
	 * that the era closure supplied through one of those is only visible as a hole
	 * once the wrapper is gone. Reading it before the disposition would report the
	 * edge as satisfied and leave the migrated tree unable to resolve it.
	 */
	const applicationDependencies = declareApplicationSourceDependencies(
		declared.manifest,
		readApplicationPackageUses(input.sourceModules),
		cell,
		input.eraClosureTypePackages ?? [],
	);
	unhandled.push(...applicationDependencies.unhandled);
	declaredDifferences.push(...applicationDependencies.declaredDifferences);
	/**
	 * The packages the migrated workspace's own targets name are declared last,
	 * after every capability that decides which targets survive: a builder
	 * declaration for a target the workspace migration removed would install a
	 * toolchain nothing runs.
	 */
	const builders = declareBuilderPackages(
		applicationDependencies.manifest,
		workspace.config,
		cell,
	);
	unhandled.push(...builders.unhandled);
	/**
	 * The workspace's own runtime declaration is retargeted after every
	 * capability that decides what the closure is: `engines.node` is a statement
	 * about the cell the manifest now installs for, so it is written once the
	 * manifest has finished becoming that cell's manifest. It stands down on a
	 * workspace that declares no engines, and on one whose declaration already
	 * admits the cell's Node line.
	 */
	const engines = retargetWorkspaceEngines(builders.manifest, cell);
	unhandled.push(...engines.unhandled);
	declaredDifferences.push(...engines.declaredDifferences);
	/**
	 * The command lines that invoke the workspace are retargeted after the
	 * workspace document itself: which builder options survive is the workspace
	 * migration's decision, and this carries what that decision means for the
	 * scripts that pass them. It is handed that migration's own changes rather
	 * than a list of flags, so a workspace that declared none of them has none
	 * dropped.
	 */
	const scripts = retargetWorkspaceScripts(
		engines.manifest,
		workspace.changes,
		cell,
		workspace.config,
	);
	unhandled.push(...scripts.unhandled);
	/**
	 * The era lockfile is decided last, because the question is whether the tree's
	 * own resolution still describes the manifest — and the manifest is only
	 * finished once every capability above it has written what it writes.
	 */
	const lockfiles = supersedeEraLockfiles(input.lockfiles ?? [], scripts.manifest);
	unhandled.push(...lockfiles.unhandled);
	declaredDifferences.push(...lockfiles.superseded.map((entry) => entry.reason));
	const tsConfig = migrateAngularTsConfig(input.tsConfig.source, cell);
	unhandled.push(...tsConfig.unhandled);
	const files: MigratedFile[] = [
		file(
			input.packageManifest,
			`${JSON.stringify(scripts.manifest, null, 2)}\n`,
			'workspace',
			[
				...aligned.changes.map(describeDependencyChange),
				...scripts.changes.map(describeScriptFlagChange),
				...declared.declarations.map(
					(entry) =>
						`added ${entry.field}.${entry.name} = ${entry.range} — ${entry.reason}`,
				),
				...applicationDependencies.declarations.map(
					(entry) =>
						`added ${entry.field}.${entry.name} = ${entry.range} — ${entry.reason}`,
				),
				...builders.declarations.map(
					(entry) =>
						`added ${entry.field}.${entry.name} = ${entry.range} — ${entry.reason}`,
				),
				...(engines.retarget === null
					? []
					: [
							`retargeted ${engines.retarget.field} from ${engines.retarget.from} to ` +
								`${engines.retarget.to} — ${engines.retarget.reason}`,
						]),
			],
		),
		file(
			synthesis === null
				? input.workspaceConfig
				: { path: synthesis.path, source: input.workspaceConfig.source },
			workspace.config,
			'workspace',
			synthesis === null
				? workspace.changes.map(describeConfigChange)
				: [
						`synthesized ${synthesis.path} from ${synthesis.replacedPath}, the pre-angular.json ` +
							'Angular CLI 1.x workspace format; the digest recorded before is that file',
						...synthesis.changes.map(describeConfigChange),
						...workspace.changes.map(describeConfigChange),
					],
		),
		file(
			input.tsConfig,
			tsConfig.config,
			'workspace',
			tsConfig.changes.map(describeConfigChange),
		),
	];
	/**
	 * Source capabilities run in sequence over each module, each one handed what
	 * the last produced. They are independent — one rewrites module specifiers,
	 * the next replaces a removed NgRx decorator — and a module is counted as
	 * changed if any of them changed a byte of it.
	 */
	/**
	 * One capability is not per-module and cannot be: rewriting a modal call site
	 * without rewriting the content component it supplied is the silent failure
	 * that capability exists to refuse. It runs over the whole tree first, and
	 * what it produced is what the per-module capabilities then see.
	 */
	const modal = migrateModalContentParams(input.sourceModules, input.moduleResolution ?? {});
	unhandled.push(...modal.unhandled);
	const modalByPath = new Map(modal.files.map((entry) => [entry.path, entry]));
	const baseClassDiagnostics = new Map(
		(input.baseClassDiagnostics ?? []).map((entry) => [entry.path, entry.diagnostics]),
	);
	const missingMembers = new Map(
		(input.missingMemberDiagnostics ?? []).map((entry) => [entry.path, entry.diagnostics]),
	);
	const rxjsDiagnostics = new Map(
		(input.rxjsPatchDiagnostics ?? []).map((entry) => [entry.path, entry.diagnostics]),
	);
	/**
	 * The use-position successor is the one source capability that decides a
	 * question about the *application* rather than about the module in front of it:
	 * whether a module with no successor may be dropped depends on whether anything
	 * in the application asks for what it provided. The reading is taken once, over
	 * the era bytes, before any capability rewrites an import — a name imported at
	 * the pin is a name the application asked for, whatever a later transform does
	 * to the declaration that carried it.
	 */
	const removedSymbolSuccessors =
		input.removedSymbolSuccessors ?? ANGULAR_HTTP_USE_POSITION_SUCCESSORS;
	const removedSpecifierImports =
		(input.removedSymbolSurfaces ?? []).length === 0
			? []
			: readRemovedSpecifierImports(input.sourceModules, [
					...new Set(removedSymbolSuccessors.map((claim) => claim.specifier)),
				]);
	for (const module of [...input.sourceModules].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		const modalFile = modalByPath.get(module.path);
		const entrySource = modalFile?.source ?? module.source;
		/**
		 * The compiler-positioned capability runs first of the per-module
		 * capabilities, because its input is a pair of coordinates into bytes the
		 * caller compiled and every capability that edits the module moves them. It
		 * is safe wherever it is placed — it refuses a position where the name it was
		 * told to fill is not written — but placed first it is refused least often
		 * for a reason that is about ordering rather than about the application.
		 */
		const baseClasses = parameteriseBaseClasses(
			module.path,
			entrySource,
			baseClassDiagnostics.get(module.path) ?? [],
			input.genericBaseClasses ?? [],
		);
		/**
		 * The second compiler-positioned capability runs beside the first and for
		 * the same reason: a `TS2339` position is a position in the bytes the caller
		 * compiled, and the base-class parameterisation above only ever writes inside
		 * an `extends` clause's type arguments — so a position it moved is a position
		 * on the same line, and this capability re-checks the member is written where
		 * it was told before it edits anything.
		 */
		const departedDomMembers = accommodateDepartedDomMembers(
			module.path,
			baseClasses.source,
			missingMembers.get(module.path) ?? [],
		);
		/**
		 * The third compiler-positioned capability. It runs beside the other two and
		 * after them, and like them it re-places every diagnostic against the bytes it
		 * is handed — a position the two above moved is a position it refuses rather
		 * than mis-edits.
		 *
		 * It is offered a module only when the caller named a diagnostic in it. That
		 * gate is not a convenience: the capability also drops the `rxjs/add/**` side
		 * effect imports once every named call site has moved, and a module with no
		 * named call sites is a module where dropping them would remove the patching
		 * without moving anything that depended on it.
		 */
		const rxjsNamed = rxjsDiagnostics.get(module.path);
		const rxjsPatches =
			rxjsNamed === undefined || rxjsNamed.length === 0
				? { source: departedDomMembers.source, changes: [] as readonly RxjsPipeChange[], unhandled: [] as readonly string[] }
				: migrateRxjsPrototypePatches(
						module.path,
						departedDomMembers.source,
						rxjsNamed,
						input.rxjsSurface ?? { version: 'unread', rootExports: [], operatorExports: [] },
					);
		const migrated = migrateAngularSourceModule(module.path, rxjsPatches.source);
		const effects = migrateNgrxEffectDecorators(module.path, migrated.source);
		const sentry = migrateSentryV8Tracing(module.path, effects.source);
		/**
		 * Deep imports are redirected after the specifier rewrites and before the
		 * capabilities that read module literals: an unreachable subpath is a
		 * question about the specifier, and the answer changes which declaration each
		 * symbol arrives on. Every reading the caller supplied is offered the module
		 * in turn, because two packages are two exports maps.
		 */
		let deepImportSource = sentry.source;
		const deepImportChanges: DeepImportChange[] = [];
		for (const reading of input.deepImportReadings ?? []) {
			const redirected = redirectUnreachableImports(module.path, deepImportSource, reading);
			unhandled.push(...redirected.unhandled);
			deepImportChanges.push(...redirected.changes);
			deepImportSource = redirected.source;
		}
		/**
		 * A removed package's symbols are carried to their successors after the
		 * specifier rewrites and the deep-import redirection, and for the same reason
		 * those two are ordered before it: each of them can change which declaration a
		 * symbol arrives on, and this capability reads declarations. It is supply-gated
		 * on a reading of the successor's installed surface, so a tree with no closure
		 * to read has nothing carried.
		 */
		const usePositions = succeedRemovedSymbolUses(
			module.path,
			deepImportSource,
			removedSymbolSuccessors,
			input.removedSymbolSurfaces ?? [],
			removedSpecifierImports,
		);
		declaredDifferences.push(...usePositions.declaredDifferences);
		/**
		 * The call surface of a removed HTTP client is carried after the per-position
		 * carriage and never before it: the two read the same declaration, and the
		 * position table is the one that decides which names it can answer by rename
		 * alone. What it refuses — a service, a header collection and a response type
		 * whose successors behave differently — is exactly what this one is written
		 * for, and it is supply-gated twice over: on the successor package's surface
		 * and on the installed declaration of the successor classes themselves.
		 */
		const callSurface = migrateHttpClientCallSurface(
			module.path,
			usePositions.source,
			input.httpCallSurface ?? ANGULAR_HTTP_CALL_SURFACE,
			input.removedSymbolSurfaces ?? [],
			input.successorClassSurfaces ?? [],
		);
		declaredDifferences.push(...callSurface.declaredDifferences);
		/**
		 * The static configuration method a module class no longer publishes is
		 * dropped after the successor carriage, because the carriage can put a new
		 * module into the same `imports` array this reads — and reading the array as
		 * the capability before it left it is what keeps the two from disagreeing
		 * about what the literal contains.
		 */
		const staticModuleMethods = removeRemovedStaticModuleMethods(
			module.path,
			callSurface.source,
			DOCUMENTED_STATIC_MODULE_METHOD_REMOVALS,
			input.moduleClassSurfaces ?? [],
		);
		/**
		 * `entryComponents` is dropped last of the per-module capabilities, and the
		 * order is not arbitrary: the capability proves, per literal, that every
		 * component the property names is still reached by `declarations` or
		 * `bootstrap` of the same literal, and it should see the literal as the
		 * capabilities before it left it rather than as the era file wrote it.
		 */
		const entryComponents = removeEntryComponents(module.path, staticModuleMethods.source);
		/**
		 * Three type-position insertions close the sequence. Each one is a claim
		 * about a type the source itself already states — the module a static factory
		 * is declared on, and the `void` a subject or a promise executor proves by
		 * settling with nothing — so each gates on its own construct and inserts
		 * nothing where it cannot read one. They are placed after the specifier
		 * rewrites because the bindings they resolve are the bindings those rewrites
		 * left, and before nothing: no later capability reads a module.
		 */
		const moduleWithProviders = addModuleWithProvidersTypeArgument(
			module.path,
			entryComponents.source,
		);
		const voidSubjects = parameteriseVoidSubjects(module.path, moduleWithProviders.source);
		const voidExecutors = parameteriseVoidPromiseExecutors(module.path, voidSubjects.source);
		/**
		 * The decorator synthesis closes the sequence. It inserts a line above a class
		 * declaration and a name into an import declaration, which moves every offset
		 * below both — so it runs after every capability positioned by an offset, and
		 * it reads its own precondition out of the module the others left.
		 */
		const undecorated = decorateUndecoratedBaseClasses(
			module.path,
			voidExecutors.source,
			cell,
		);
		unhandled.push(
			...departedDomMembers.unhandled,
			...rxjsPatches.unhandled,
			...usePositions.unhandled,
			...callSurface.unhandled,
			...staticModuleMethods.unhandled,
			...undecorated.unhandled,
			...baseClasses.unhandled,
			...migrated.unhandled,
			...effects.unhandled,
			...sentry.unhandled,
			...entryComponents.unhandled,
			...moduleWithProviders.unhandled,
			...voidSubjects.unhandled,
			...voidExecutors.unhandled,
		);
		files.push(
			file(module, undecorated.source, 'application', [
				...(modalFile?.changes ?? []).map(describeSourceChange),
				...baseClasses.changes.map(describeBaseClassChange),
				...departedDomMembers.changes.map(describeDepartedDomMemberChange),
				...rxjsPatches.changes.map(describeRxjsPipeChange),
				...deepImportChanges.map(describeDeepImportChange),
				...usePositions.changes.map(describeUsePositionChange),
				...callSurface.changes.map(describeHttpCallSurfaceChange),
				...staticModuleMethods.changes.map(describeStaticModuleMethodChange),
				...undecorated.changes.map(describeUndecoratedBaseClassChange),
				...migrated.changes.map(describeSourceChange),
				...effects.changes.map(describeSourceChange),
				...sentry.changes.map(describeSourceChange),
				...entryComponents.changes.map(describeEntryComponentsChange),
				...moduleWithProviders.changes.map(describeModuleWithProvidersChange),
				...voidSubjects.changes.map(describeVoidSubjectChange),
				...voidExecutors.changes.map(describeVoidExecutorChange),
			]),
		);
	}
	/**
	 * Templates are the last application capability, and it is cross-file by
	 * nature: whether a call site's binding order is safe is a question about the
	 * directive the element resolves to, read from that directive's own class.
	 * The readings are taken from the modules as the per-module capabilities left
	 * them, so a directive whose imports those capabilities rewrote still
	 * resolves. A template no directive reading touches is carried through
	 * unchanged and still counted, so the scanned total means what it says.
	 */
	const directiveReadings: DirectiveBindingReading[] = [];
	for (const entry of files)
		if (entry.kind === 'application' && entry.path.endsWith('.ts'))
			directiveReadings.push(...readDirectiveBindingDependencies(entry.path, entry.source));
	for (const template of [...(input.templates ?? [])].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		const reordered = reorderTemplateBindings(template.path, template.source, directiveReadings);
		unhandled.push(...reordered.unhandled);
		files.push(
			file(
				template,
				reordered.source,
				'application',
				reordered.changes.map(describeBindingReorderChange),
			),
		);
	}
	/**
	 * Stylesheets are application files too, and a blocked package subpath is an
	 * application file that no longer builds. Each is offered to every package
	 * reading the caller supplied; a stylesheet no reading touches is carried
	 * through unchanged and still counted, so the scanned total means what it says.
	 */
	for (const sheet of [...(input.styleSheets ?? [])].sort((left, right) =>
		compareStrings(left.path, right.path),
	)) {
		let source = sheet.source;
		const changes: string[] = [];
		for (const reading of input.packageExports ?? []) {
			const styles = migratePackageStyleImports(sheet.path, source, reading);
			unhandled.push(...styles.unhandled);
			declaredDifferences.push(...styles.declaredDifferences);
			changes.push(...styles.changes.map(describeSourceChange));
			source = styles.source;
		}
		/**
		 * The webpack module prefix is dropped last of the stylesheet capabilities and
		 * only where a reading of the installed closure was supplied. It is ordered
		 * after the exports-map rewrite because that one can change the specifier this
		 * one then has to resolve, and the resolution is the whole of the check: a `~`
		 * import of something the closure does not carry is reported by name, never
		 * un-prefixed.
		 */
		if (input.styleClosure !== undefined) {
			const tilde = dropWebpackTildeSpecifiers(sheet.path, source, input.styleClosure);
			unhandled.push(...tilde.unhandled);
			changes.push(...tilde.changes.map(describeTildeChange));
			source = tilde.source;
		}
		files.push(file(sheet, source, 'application', changes));
	}
	const applicationFiles = files.filter((entry) => entry.kind === 'application');
	return Object.freeze({
		cell: cell.id,
		files: Object.freeze(files),
		applicationFilesChanged: applicationFiles.filter((entry) => entry.changed).length,
		workspaceFilesChanged: files.filter((entry) => entry.kind === 'workspace' && entry.changed)
			.length,
		applicationFilesScanned: applicationFiles.length,
		unhandled: Object.freeze([...new Set(unhandled)]),
		declaredDifferences: Object.freeze([...new Set(declaredDifferences)]),
		removedFiles: Object.freeze([
			...configRemovals.map((removal) => removal.at),
			...lockfiles.superseded.map((entry) => entry.at),
			...(synthesis === null ? [] : [synthesis.replacedPath]),
		]),
	});
}
