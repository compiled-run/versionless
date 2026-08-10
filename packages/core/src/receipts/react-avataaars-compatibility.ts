import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

export const REACT_AVATAAARS_COMPATIBILITY_SCHEMA =
	'versionless.react-avataaars-compatibility-to-vite8.v1' as const;
export const REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH =
	'evidence/runs/react-avataaars-compatibility-to-vite8/t608/receipt.json' as const;

export function reactAvataaarsCompatibilityAggregateMember(digest: string) {
	if (!hex(digest)) throw new Error('React Avataaars compatibility aggregate digest differs');
	return {
		id: 'react-avataaars-compatibility-to-vite8',
		framework: 'react',
		track: 'compatibility-baseline-to-vite8-count-false',
		bundler: 'react-scripts-ts-3.1.0-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		counted: false,
		receipt: REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH,
		digest,
	};
}

export type ReactAvataaarsCompatibilityReceipt = Record<string, unknown> & {
	schemaVersion: typeof REACT_AVATAAARS_COMPATIBILITY_SCHEMA;
	result: 'pass';
	counted: false;
	artifacts: Array<{ path: string; sha256: string }>;
	integrity: {
		algorithm: 'sha256';
		canonicalDigest: string;
		authenticity: 'not-established';
	};
};

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`React Avataaars compatibility ${label} must be an object`);
	return value as Record<string, unknown>;
}

function hex(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length === 64 &&
		[...value].every(
			(character) =>
				(character >= '0' && character <= '9') || (character >= 'a' && character <= 'f'),
		)
	);
}

function array(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value))
		throw new Error(`React Avataaars compatibility ${label} must be an array`);
	return value;
}

function exact(value: unknown, expected: unknown, label: string): void {
	if (canonicalize(value) !== canonicalize(expected))
		throw new Error(`React Avataaars compatibility ${label} differs`);
}

function assertWitnessRun(
	value: unknown,
	lane: 'compatibility' | 'migrated',
	pass: number,
	journey: 'selection-history' | 'customization-renderer',
): void {
	const run = record(value, `${lane} ${journey} Witness ${pass}`);
	const interactions = array(run.interactions, `${lane} Witness interactions`).map((item) =>
		record(item, `${lane} Witness interaction`),
	);
	const queries = array(run.queryNavigation, `${lane} Witness query navigation`);
	const serviceWorkers = array(run.serviceWorkers, `${lane} Witness service workers`).map(
		(item) => record(item, `${lane} Witness service worker`),
	);
	if (
		run.lane !== lane ||
		run.pass !== pass ||
		run.journey !== journey ||
		run.result !== 'pass' ||
		!hex(run.receiptSha256) ||
		!hex(run.beforeSvgSha256) ||
		run.accessibilityLabels !== true ||
		!interactions.some((item) => item.kind === 'click') ||
		!queries.some(
			(query) =>
				typeof query === 'string' &&
				query.includes('avatarStyle=Transparent') &&
				query.includes('topType=Eyepatch'),
		) ||
		array(run.pageErrors, `${lane} Witness page errors`).length !== 0 ||
		array(run.failedRequests, `${lane} Witness failed requests`).length !== 0 ||
		serviceWorkers.length !== (journey === 'customization-renderer' ? 2 : 1) ||
		serviceWorkers.some(
			(serviceWorker) =>
				serviceWorker.registrations !== 0 ||
				serviceWorker.controller !== null ||
				array(serviceWorker.cacheNames, `${lane} Witness caches`).length !== 0,
		) ||
		run.successfulNonLoopback !== 0 ||
		run.legacyServiceWorkerRequest !== false ||
		array(run.consoleMessages, `${lane} Witness console messages`).some(
			(item) => record(item, `${lane} Witness console message`).level === 'error',
		)
	)
		throw new Error(`React Avataaars compatibility ${lane} ${journey} ${pass} differs`);
	if (journey === 'selection-history') {
		const generated = record(run.generatedCode, `${lane} Witness generated code`);
		if (
			!hex(run.afterSvgSha256) ||
			run.beforeSvgSha256 === run.afterSvgSha256 ||
			!hex(run.generatedCodeSha256) ||
			generated.avatarStyle !== 'Transparent' ||
			generated.topType !== 'Eyepatch' ||
			generated.visible !== true ||
			run.renderedSvgChanged !== true ||
			run.historyBack !== true ||
			run.reloadPersistence !== true ||
			!interactions.some((item) => item.kind === 'press')
		)
			throw new Error(`React Avataaars compatibility ${lane} selection semantics differ`);
	} else {
		const download = record(run.download, `${lane} Witness SVG download`);
		if (
			!hex(run.rendererSvgSha256) ||
			download.filename !== 'avataaars.svg' ||
			!hex(download.sha256) ||
			typeof download.byteLength !== 'number' ||
			download.byteLength < 100 ||
			run.customizationQuery !== true ||
			run.rendererMode !== '__render__=1'
		)
			throw new Error(`React Avataaars compatibility ${lane} renderer semantics differ`);
	}
}

export function assertReactAvataaarsCompatibilityArtifacts(value: {
	provenance: unknown;
	compatibility: unknown;
	migrated: unknown;
	witness: unknown;
	mutation: unknown;
	human: string;
}): void {
	const provenance = record(value.provenance, 'provenance artifact');
	const closure = record(provenance.targetClosure, 'target closure');
	const consent = record(closure.consent, 'target closure consent');
	const compatibility = record(value.compatibility, 'compatibility artifact');
	const migrated = record(value.migrated, 'migrated artifact');
	const witness = record(value.witness, 'Witness artifact');
	const mutation = record(value.mutation, 'mutation artifact');
	const deltas = array(compatibility.deltas, 'compatibility deltas').map((item) =>
		record(item, 'compatibility delta'),
	);
	const compatibilityDigests = array(compatibility.digests, 'compatibility digests');
	const toolOverlays = array(compatibility.toolOverlays, 'compatibility tool overlays').map(
		(item) => record(item, 'compatibility tool overlay'),
	);
	const migratedDigests = array(migrated.digests, 'migrated digests');
	const dependencies = record(migrated.dependencies, 'migrated dependencies');
	const runs = array(witness.runs, 'Witness runs');
	if (
		compatibility.classification !== 'unsupported-source-commit' ||
		compatibility.sourceCommitExecution !== 'not-executed' ||
		compatibility.compatibilityExecution !== 'generated-config-plus-local-only-overlay' ||
		deltas.length !== 2 ||
		deltas.some(
			(delta) =>
				delta.missingSourcePath !== 'tsconfig.prod.json' ||
				delta.generatedPath !== 'tsconfig.prod.json' ||
				canonicalize(delta.changedFiles) !==
					canonicalize(
						[
							'public/favicon.png',
							'public/index.html',
							'public/manifest.json',
							'src/components/AvatarForm.tsx',
							'src/components/ComponentImg.tsx',
							'src/index.tsx',
							'tsconfig.prod.json',
						].sort(),
					) ||
				canonicalize(delta.removedFiles) !==
					canonicalize(['public/favicon.png', 'public/manifest.json']) ||
				delta.serviceWorkerRegistration !== 'removed' ||
				delta.remoteRuntimeSurfaces !== 'removed-or-localized' ||
				!hex(delta.templateSha256) ||
				!hex(delta.toolTarballSha256),
		) ||
		compatibility.runtime !== '16.20.2' ||
		compatibility.bundler !== 'react-scripts-ts-3.1.0-webpack' ||
		compatibilityDigests.length !== 2 ||
		!compatibilityDigests.every(hex) ||
		compatibilityDigests[0] !== compatibilityDigests[1] ||
		toolOverlays.length !== 2 ||
		toolOverlays.some(
			(overlay) =>
				!hex(overlay.beforeSha256) ||
				!hex(overlay.afterSha256) ||
				overlay.beforeSha256 === overlay.afterSha256,
		) ||
		canonicalize(toolOverlays[0]) !== canonicalize(toolOverlays[1]) ||
		compatibility.deterministic !== true ||
		compatibility.legacyServiceWorkerCall !== 'removed-by-local-only-overlay' ||
		compatibility.serviceWorkerOutput !== 'absent'
	)
		throw new Error('React Avataaars compatibility baseline semantics differ');
	if (
		migrated.runtime !== '24.15.0' ||
		migrated.bundler !== 'vite-8.0.16' ||
		dependencies.react !== '18.3.1' ||
		dependencies['react-dom'] !== '18.3.1' ||
		dependencies.scheduler !== '0.23.2' ||
		migratedDigests.length !== 2 ||
		!migratedDigests.every(hex) ||
		migratedDigests[0] !== migratedDigests[1] ||
		migrated.deterministic !== true ||
		array(migrated.transforms, 'migrated transforms').length !== 2 ||
		migrated.serviceWorkerRemoval !== 'exact-import-and-call-removal'
	)
		throw new Error('React Avataaars compatibility migrated-target semantics differ');
	exact(
		migrated.delta,
		[
			'index.html',
			'package.json',
			'src/components/AvatarForm.tsx',
			'src/components/ComponentImg.tsx',
			'src/components/App.tsx',
			'src/index.tsx',
			'yarn.lock',
		],
		'migrated delta',
	);
	if (
		runs.length !== 8 ||
		witness.contexts !== 8 ||
		witness.directLinkedWitness !== true ||
		witness.serviceWorkers !== 'blocked-and-absent' ||
		witness.registrations !== 0 ||
		witness.controllers !== 0 ||
		witness.caches !== 0 ||
		witness.successfulNonLoopback !== 0
	)
		throw new Error('React Avataaars compatibility Witness summary differs');
	assertWitnessRun(runs[0], 'compatibility', 1, 'selection-history');
	assertWitnessRun(runs[1], 'compatibility', 1, 'customization-renderer');
	assertWitnessRun(runs[2], 'compatibility', 2, 'selection-history');
	assertWitnessRun(runs[3], 'compatibility', 2, 'customization-renderer');
	assertWitnessRun(runs[4], 'migrated', 1, 'selection-history');
	assertWitnessRun(runs[5], 'migrated', 1, 'customization-renderer');
	assertWitnessRun(runs[6], 'migrated', 2, 'selection-history');
	assertWitnessRun(runs[7], 'migrated', 2, 'customization-renderer');
	const restored = array(witness.restored, 'restored Witness runs');
	const mutationRestored = array(mutation.restoredWitness, 'mutation restored Witness runs');
	for (const values of [restored, mutationRestored]) {
		if (values.length !== 2)
			throw new Error('React Avataaars compatibility restored Witness inventory differs');
		assertWitnessRun(values[0], 'migrated', 4, 'selection-history');
		assertWitnessRun(values[1], 'migrated', 4, 'customization-renderer');
	}
	if (
		mutation.mutation !== 'history/query listener replaced by no-op' ||
		mutation.red !== true ||
		mutation.failure !== 'witness-query-persistence-red' ||
		!hex(mutation.originalSourceSha256) ||
		mutation.originalSourceSha256 !== mutation.restoredSourceSha256 ||
		!hex(mutation.originalBuildDigest) ||
		mutation.originalBuildDigest !== mutation.restoredBuildDigest ||
		mutation.green !== true
	)
		throw new Error('React Avataaars compatibility mutation/restoration semantics differ');
	if (
		!hex(closure.digest) ||
		!hex(closure.receiptSha256) ||
		array(closure.artifacts, 'target closure artifacts').length !== 3 ||
		consent.id !== 'T608-react-avataaars-react1831-target-closure-production' ||
		consent.method !== 'GET' ||
		consent.host !== 'registry.npmjs.org' ||
		consent.responses !== 6 ||
		array(closure.nonclaims, 'target closure nonclaims').length !== 2 ||
		provenance.authorship !== 'unknown' ||
		provenance.certification !== false ||
		provenance.signerAuthenticity !== false
	)
		throw new Error('React Avataaars compatibility provenance semantics differ');
	for (const phrase of [
		'unsupported and not executed as-authored',
		'not certification',
		'not OS-wide isolation',
	])
		if (!value.human.includes(phrase))
			throw new Error('React Avataaars compatibility human nonclaims differ');
}

export function parseReactAvataaarsCompatibilityReceipt(
	value: unknown,
): ReactAvataaarsCompatibilityReceipt {
	const receipt = record(value, 'receipt');
	const source = record(receipt.source, 'source');
	const qualification = record(receipt.qualification, 'qualification');
	const integrity = record(receipt.integrity, 'integrity');
	if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length !== 6)
		throw new Error('React Avataaars compatibility artifact inventory differs');
	const artifacts = receipt.artifacts.map((value, index) => {
		const artifact = record(value, `artifact ${index}`);
		if (
			typeof artifact.path !== 'string' ||
			!artifact.path.startsWith(
				'evidence/runs/react-avataaars-compatibility-to-vite8/t608/',
			) ||
			artifact.path.includes('..') ||
			!hex(artifact.sha256)
		)
			throw new Error(`React Avataaars compatibility artifact ${index} differs`);
		return { path: artifact.path, sha256: artifact.sha256 };
	});
	exact(
		artifacts.map((artifact) => artifact.path.split('/').at(-1)).sort(),
		[
			'compatibility-baseline.json',
			'migrated-target.json',
			'mutation-restoration.json',
			'provenance.json',
			'receipt.md',
			'witness.json',
		].sort(),
		'artifact inventory',
	);
	const body = structuredClone(receipt);
	delete body.integrity;
	if (
		receipt.schemaVersion !== REACT_AVATAAARS_COMPATIBILITY_SCHEMA ||
		receipt.runId !== 'T608-react-avataaars-compatibility-to-vite8' ||
		receipt.result !== 'pass' ||
		receipt.counted !== false ||
		receipt.fixture !== 'react-avataaars-compatibility' ||
		source.repository !== 'fangpenlin/avataaars-generator' ||
		source.revision !== 'c191c6c2d27f41245e803912d43c7213436a34d3' ||
		source.tree !== '94a3d1a024682b3f21ad30b9de8d4e1541a376d3' ||
		source.archiveSha256 !==
			'4863a1304b659f1105f69d8ae0c715428c41d2d64b43edfd701148ddfca900da' ||
		qualification.compatibilityBuilds !== 2 ||
		qualification.migratedBuilds !== 2 ||
		qualification.compatibilityWitnessRuns !== 4 ||
		qualification.migratedWitnessRuns !== 4 ||
		qualification.mutationRestoration !== 'pass' ||
		qualification.successfulNonLoopback !== 0 ||
		!Array.isArray(receipt.limitations) ||
		receipt.limitations.length !== 4 ||
		integrity.algorithm !== 'sha256' ||
		integrity.authenticity !== 'not-established' ||
		!hex(integrity.canonicalDigest) ||
		sha256(canonicalize(body)) !== integrity.canonicalDigest
	)
		throw new Error('React Avataaars compatibility receipt differs');
	return { ...receipt, artifacts, integrity } as ReactAvataaarsCompatibilityReceipt;
}

export async function verifyReactAvataaarsCompatibilityEvidence(
	rootDir = '.',
): Promise<{ digest: string; artifacts: number; receipt: ReactAvataaarsCompatibilityReceipt }> {
	const root = resolve(rootDir);
	const receipt = parseReactAvataaarsCompatibilityReceipt(
		JSON.parse(await readFile(join(root, REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH), 'utf8')),
	);
	const contents = new Map<string, Buffer>();
	for (const artifact of receipt.artifacts) {
		const bytes = await readFile(join(root, artifact.path));
		if (sha256(bytes) !== artifact.sha256)
			throw new Error(`React Avataaars compatibility artifact differs: ${artifact.path}`);
		contents.set(artifact.path.split('/').at(-1)!, bytes);
	}
	const json = (name: string): unknown =>
		JSON.parse(contents.get(name)?.toString('utf8') ?? 'null') as unknown;
	assertReactAvataaarsCompatibilityArtifacts({
		provenance: json('provenance.json'),
		compatibility: json('compatibility-baseline.json'),
		migrated: json('migrated-target.json'),
		witness: json('witness.json'),
		mutation: json('mutation-restoration.json'),
		human: contents.get('receipt.md')?.toString('utf8') ?? '',
	});
	return {
		digest: receipt.integrity.canonicalDigest,
		artifacts: receipt.artifacts.length,
		receipt,
	};
}
