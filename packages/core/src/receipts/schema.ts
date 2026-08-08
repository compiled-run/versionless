export interface Artifact {
	path: string;
	sha256: string;
}
export interface Locality {
	mode: 'offline';
	scope: string;
	osWideIsolation: false;
	successfulNonLoopback: 0;
	browserBlockedRequests: number;
}
export interface ReactMigration {
	file: string;
	transform: string;
	edits: number;
	dependency: { name: string; from: string; to: string; license: string };
	lockPatch: string;
}
export interface AngularJsMigration {
	file: string;
	transform: string;
	edits: number;
	track: 'angularjs-special-track';
	changedFiles: [string, ...string[]];
	outerController: 'constructable-function';
	injectionAnnotation: 'unchanged';
	orders?: ['lexical-first', 'route-first'];
	executionTraces?: [string[], string[]];
	actualOrdersExecuted?: true;
	atomic?: true;
	publication?: 'same-filesystem-staged-directory-rename';
	viteOutput?: 'self-contained-rehashable';
	serviceWorker?: 'out-of-scope-not-emitted';
}
export interface ReactDataFlowMigration {
	file: string;
	transform: 'react-data-flow-connect-to-hooks';
	edits: number;
	changedFiles: [string, string];
	sourceHashes: { homePage: string; repoListItem: string };
}
export interface Next12DerivedStateMigration {
	file: 'components/App.tsx';
	transform: 'next12-derived-state-to-useMemo';
	edits: 3;
	changedFiles: ['components/App.tsx'];
	sourceSha256: string;
	targetSha256: string;
}
export interface ReactComposedMigration {
	file: string;
	transform: 'react-composed-connect-to-hooks';
	edits: number;
	changedFiles: [string, string, string, string, string];
	orders: ['locale-first', 'data-flow-first'];
	executionTraces: [string[], string[]];
	actualOrdersExecuted: true;
	atomic: true;
	publication: 'same-filesystem-staged-directory-rename';
	injectedWriteFailure: 'refused';
	lateFailureRollback: 'published-target-unmodified';
	failedStageCleanup: true;
	harnessOnlyAdapterExcluded: true;
	sourceHashes: Record<string, string>;
	targetHashes: Record<string, string>;
}

export const REACT_COMPOSED_CHANGED_FILES = [
	'app/containers/LocaleToggle/index.js',
	'app/containers/HomePage/index.js',
	'app/containers/RepoListItem/index.js',
	'package.json',
	'package-lock.json',
] as const;
export const REACT_COMPOSED_SOURCE_HASHES = {
	'app/containers/LocaleToggle/index.js':
		'70c2ea867367b5dbd0820413f344bcd6c19729ef04d41c1fd9e12d43d72e8dfa',
	'app/containers/HomePage/index.js':
		'db0413d948d68980dd24db7660e1bd854cabcc4642ec15fff710f5c95131f232',
	'app/containers/RepoListItem/index.js':
		'21a570ed27af053040ce6b503f1af0c22bbdfea52284dccb47b2dc382844d867',
	'package.json': 'a3383c3ccce6bd460952c5ac8b721ed5f7087ffc5a96713b6e9103f2ba3a8d76',
	'package-lock.json': '09a37fc1d35eb4cfaab46e0ac8c0d3f33824b300a731ec25f1e50998e9c14edb',
} as const;
export const REACT_COMPOSED_TARGET_HASHES = {
	'app/containers/LocaleToggle/index.js':
		'db70524e86f9a5983d18f6ad1f2d72fec14b71bd5701d66da475ff600703e9b3',
	'app/containers/HomePage/index.js':
		'9132cb8b6ab4af9c88499ae4daa6783229a8d4898266f2953d0bc99a5ff168c1',
	'app/containers/RepoListItem/index.js':
		'5669977385fb57491fcb117cd65ffaa2a4ab86d2258bf36c7fa81ff880387517',
	'package.json': '7fb3098e57021e790638e31677d3cbfe815087f889b708cab4e1efdc9785414a',
	'package-lock.json': '42ffa936b19115ad380e77dcbc3800c7adf117aa560c5f678c837b7f4b09e00d',
} as const;
export const REACT_COMPOSED_EXECUTION_TRACES = [
	['locale-toggle', 'home-page', 'repo-list-item', 'maintained-package-lock'],
	['home-page', 'repo-list-item', 'locale-toggle', 'maintained-package-lock'],
] as const;
export interface MigrationReceipt {
	schemaVersion: 'versionless.receipt.v1';
	runId: string;
	fixture: string;
	source: {
		repository: string;
		revision: string;
		archiveSha256: string;
		license: string;
		licenseSha256: string;
	};
	tooling: Record<string, string>;
	consent: Array<{ id: string; purpose: string; mode: 'consented' }>;
	migration:
		| ReactMigration
		| AngularJsMigration
		| ReactDataFlowMigration
		| ReactComposedMigration
		| Next12DerivedStateMigration;
	verification: {
		result: 'pass';
		builds: 'pass';
		journeys: 'pass';
		mutation: 'pass';
		locality: Locality;
		deterministicCore: { first: string; second: string; equal: true };
		serviceWorker?: {
			workerPath: 'sw.js';
			manifestPath: 'precache-manifest.json';
			scope: '/';
			manifestSha256: string;
			cacheName: string;
			currentCacheOnly: true;
			inventoryMatchesManifest: true;
			exactCurrentCacheFetch: true;
			upgradeOrders?: ['base-to-data-flow', 'data-flow-to-base'];
			buildsEqual: true;
			registration: 'active';
			controller: 'activated';
			offlineJourney: 'pass';
			mutation: 'intended-failure';
			restoration: 'byte-identical';
			coverage: 'exact-qualified-journey-only';
		};
	};
	artifacts: Artifact[];
	integrity: { algorithm: 'sha256'; canonicalDigest: string; authenticity: 'not-established' };
	limitations: string[];
}

const hex = createRegExp(charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd());
function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Receipt schema invalid ${label}`);
	return value as Record<string, unknown>;
}
function string(value: unknown, label: string): asserts value is string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Receipt schema invalid ${label}`);
}

export function parseMigrationReceipt(value: unknown): MigrationReceipt {
	const root = record(value, 'root');
	for (const key of [
		'schemaVersion',
		'runId',
		'fixture',
		'source',
		'tooling',
		'consent',
		'migration',
		'verification',
		'artifacts',
		'integrity',
		'limitations',
	])
		if (!(key in root)) throw new Error(`Receipt schema missing ${key}`);
	if (root.schemaVersion !== 'versionless.receipt.v1')
		throw new Error('Unsupported receipt schema');
	string(root.runId, 'runId');
	string(root.fixture, 'fixture');
	const source = record(root.source, 'source');
	for (const key of ['repository', 'revision', 'archiveSha256', 'license', 'licenseSha256'])
		string(source[key], `source.${key}`);
	if (!hex.test(source.archiveSha256 as string) || !hex.test(source.licenseSha256 as string))
		throw new Error('Receipt schema invalid source hashes');
	const tooling = record(root.tooling, 'tooling');
	if (Object.keys(tooling).length === 0) throw new Error('Receipt schema invalid tooling');
	for (const [key, value] of Object.entries(tooling)) string(value, `tooling.${key}`);
	if (
		!Array.isArray(root.consent) ||
		root.consent.length === 0 ||
		!Array.isArray(root.artifacts) ||
		!Array.isArray(root.limitations)
	)
		throw new Error('Receipt schema invalid arrays');
	for (const item of root.consent) {
		const c = record(item, 'consent');
		string(c.id, 'consent.id');
		string(c.purpose, 'consent.purpose');
		if (c.mode !== 'consented') throw new Error('Receipt schema invalid consent.mode');
	}
	for (const item of root.artifacts) {
		const a = record(item, 'artifact');
		string(a.path, 'artifact.path');
		if (typeof a.sha256 !== 'string' || !hex.test(a.sha256))
			throw new Error('Receipt schema invalid artifact.sha256');
	}
	const migration = record(root.migration, 'migration');
	for (const key of ['file', 'transform']) string(migration[key], `migration.${key}`);
	if (!Number.isInteger(migration.edits) || (migration.edits as number) < 1)
		throw new Error('Receipt schema invalid migration.edits');
	if ('dependency' in migration) {
		string(migration.lockPatch, 'migration.lockPatch');
		const dependency = record(migration.dependency, 'migration.dependency');
		for (const key of ['name', 'from', 'to', 'license'])
			string(dependency[key], `dependency.${key}`);
	} else if (migration.transform === 'react-composed-connect-to-hooks') {
		const exact = (left: unknown, right: unknown): boolean =>
			JSON.stringify(left) === JSON.stringify(right);
		const expectedArtifacts = [
			'preparation.json',
			'composition.json',
			'transform.json',
			'build.json',
			'journey.json',
			'mutation.json',
			'migration-diff.json',
			'locality.json',
			'runtime.json',
			'deterministic-core.json',
		].map((name) => `evidence/runs/react-boilerplate-v4-composed/artifacts/${name}`);
		if (
			root.runId !== 'T060-react-boilerplate-v4-composed' ||
			root.fixture !== 'react-boilerplate-v4-composed' ||
			!exact(migration.changedFiles, REACT_COMPOSED_CHANGED_FILES) ||
			migration.file !== (migration.changedFiles as string[]).join(' + ') ||
			!exact(migration.orders, ['locale-first', 'data-flow-first']) ||
			!exact(migration.executionTraces, REACT_COMPOSED_EXECUTION_TRACES) ||
			migration.actualOrdersExecuted !== true ||
			migration.atomic !== true ||
			migration.publication !== 'same-filesystem-staged-directory-rename' ||
			migration.injectedWriteFailure !== 'refused' ||
			migration.lateFailureRollback !== 'published-target-unmodified' ||
			migration.failedStageCleanup !== true ||
			migration.harnessOnlyAdapterExcluded !== true ||
			!exact(migration.sourceHashes, REACT_COMPOSED_SOURCE_HASHES) ||
			!exact(migration.targetHashes, REACT_COMPOSED_TARGET_HASHES) ||
			!exact(
				(root.artifacts as Array<Record<string, unknown>>).map((artifact) => artifact.path),
				expectedArtifacts,
			)
		)
			throw new Error('Receipt schema invalid React composed migration evidence');
	} else if (migration.transform === 'react-data-flow-connect-to-hooks') {
		if (
			!Array.isArray(migration.changedFiles) ||
			migration.changedFiles.length !== 2 ||
			migration.file !== migration.changedFiles.join(' + ')
		)
			throw new Error('Receipt schema invalid React data-flow changed files');
		const sourceHashes = record(migration.sourceHashes, 'migration.sourceHashes');
		if (
			!hex.test(String(sourceHashes.homePage)) ||
			!hex.test(String(sourceHashes.repoListItem))
		)
			throw new Error('Receipt schema invalid React data-flow source hashes');
	} else if (migration.transform === 'next12-derived-state-to-useMemo') {
		if (
			root.runId !== 'T236-next-killedbygoogle-derived-state-to-memo' ||
			root.fixture !== 'next-killedbygoogle-derived-state-to-memo' ||
			migration.file !== 'components/App.tsx' ||
			migration.edits !== 3 ||
			JSON.stringify(migration.changedFiles) !== JSON.stringify(['components/App.tsx']) ||
			typeof migration.sourceSha256 !== 'string' ||
			!hex.test(migration.sourceSha256) ||
			typeof migration.targetSha256 !== 'string' ||
			!hex.test(migration.targetSha256)
		)
			throw new Error('Receipt schema invalid Killed by Google migration evidence');
	} else {
		const isPhonecatVite = root.fixture === 'angular-phonecat-vite8';
		const exact = (left: unknown, right: unknown): boolean =>
			JSON.stringify(left) === JSON.stringify(right);
		const expectedViteArtifacts = [
			'preparation.json',
			'transform-order.json',
			'migration-diff.json',
			'vite-build.json',
			'publication.json',
			'journey.json',
			'locality.json',
			'mutation.json',
			'runtime.json',
			'deterministic-core.json',
		].map((name) => `evidence/runs/angular-phonecat-vite8/artifacts/${name}`);
		if (
			migration.track !== 'angularjs-special-track' ||
			migration.outerController !== 'constructable-function' ||
			migration.injectionAnnotation !== 'unchanged' ||
			!Array.isArray(migration.changedFiles) ||
			migration.changedFiles.length < 1 ||
			(migration.changedFiles.length === 1
				? migration.changedFiles[0] !== migration.file
				: migration.changedFiles.join(' + ') !== migration.file) ||
			(isPhonecatVite &&
				(root.runId !== 'T069-angular-phonecat-vite8' ||
					!exact(migration.changedFiles, [
						'app/app.config.js',
						'app/phone-list/phone-list.component.js',
						'app/phone-detail/phone-detail.component.js',
					]) ||
					!exact(migration.orders, ['lexical-first', 'route-first']) ||
					!exact(migration.executionTraces, [
						['phone-detail', 'app-config', 'phone-list'],
						['app-config', 'phone-list', 'phone-detail'],
					]) ||
					migration.actualOrdersExecuted !== true ||
					migration.atomic !== true ||
					migration.publication !== 'same-filesystem-staged-directory-rename' ||
					migration.viteOutput !== 'self-contained-rehashable' ||
					migration.serviceWorker !== 'out-of-scope-not-emitted' ||
					!exact(
						(root.artifacts as Array<Record<string, unknown>>).map(
							(artifact) => artifact.path,
						),
						expectedViteArtifacts,
					)))
		)
			throw new Error('Receipt schema invalid AngularJS migration evidence');
	}
	const verification = record(root.verification, 'verification');
	for (const key of ['result', 'builds', 'journeys', 'mutation'])
		if (verification[key] !== 'pass')
			throw new Error(`Receipt schema invalid verification.${key}`);
	const locality = record(verification.locality, 'verification.locality');
	if (
		locality.mode !== 'offline' ||
		locality.osWideIsolation !== false ||
		locality.successfulNonLoopback !== 0 ||
		typeof locality.browserBlockedRequests !== 'number'
	)
		throw new Error('Receipt schema invalid locality');
	string(locality.scope, 'locality.scope');
	const deterministic = record(verification.deterministicCore, 'verification.deterministicCore');
	if (
		deterministic.equal !== true ||
		typeof deterministic.first !== 'string' ||
		deterministic.first !== deterministic.second ||
		!hex.test(deterministic.first)
	)
		throw new Error('Receipt schema invalid deterministic core');
	const serviceWorkerFixtures = new Map([
		['react-boilerplate-v4-vite8', 'T028-react-boilerplate-v4-vite8'],
		['react-boilerplate-v4-data-flow', 'T054-react-boilerplate-v4-data-flow'],
		['react-boilerplate-v4-composed', 'T060-react-boilerplate-v4-composed'],
	]);
	const expectedRun = serviceWorkerFixtures.get(root.fixture as string);
	if (expectedRun) {
		const serviceWorker = record(verification.serviceWorker, 'verification.serviceWorker');
		const manifestSha256 = serviceWorker.manifestSha256;
		const upgradeOrders =
			root.fixture === 'react-boilerplate-v4-data-flow'
				? ['base-to-data-flow', 'data-flow-to-base']
				: undefined;
		if (
			root.runId !== expectedRun ||
			typeof manifestSha256 !== 'string' ||
			!hex.test(manifestSha256) ||
			JSON.stringify(serviceWorker) !==
				JSON.stringify({
					workerPath: 'sw.js',
					manifestPath: 'precache-manifest.json',
					scope: '/',
					manifestSha256,
					cacheName: `versionless-react-vite8-${String(manifestSha256)}`,
					currentCacheOnly: true,
					inventoryMatchesManifest: true,
					exactCurrentCacheFetch: true,
					...(upgradeOrders ? { upgradeOrders } : {}),
					buildsEqual: true,
					registration: 'active',
					controller: 'activated',
					offlineJourney: 'pass',
					mutation: 'intended-failure',
					restoration: 'byte-identical',
					coverage: 'exact-qualified-journey-only',
				})
		)
			throw new Error('Receipt schema invalid service-worker evidence');
	} else if ('serviceWorker' in verification) {
		throw new Error('Receipt schema unexpected service-worker evidence');
	}
	const integrity = record(root.integrity, 'integrity');
	if (
		integrity.algorithm !== 'sha256' ||
		integrity.authenticity !== 'not-established' ||
		typeof integrity.canonicalDigest !== 'string' ||
		!hex.test(integrity.canonicalDigest)
	)
		throw new Error('Receipt schema invalid integrity');
	for (const limitation of root.limitations) string(limitation, 'limitation');
	return value as MigrationReceipt;
}
import { charIn, createRegExp } from 'magic-regexp';
