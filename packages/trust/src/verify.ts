import { access, readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import {
	analyzeCorpusConformance,
	CORPUS_CONFORMANCE_SCHEMA,
	deriveCorpusTransactionState,
	NEXTJS_SYNTHETIC_NOT_TESTED_LANES,
	type CorpusConformance,
	verifyCorpusConformanceDigest,
} from '../../core/src/corpus/conformance.ts';
import { compareUtf16CodeUnits } from '../../core/src/bundlers/vite8-adapter.ts';
import { assertSyntheticEvidence } from '../../core/src/policy/payment-signals.ts';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import { ANGULAR_REALWORLD_V15_TO_V16_RECEIPT } from '../../core/src/receipts/angular-realworld-v15-to-v16.ts';
import { WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH } from '../../core/src/receipts/witness-angular-realworld.ts';
import { REACT_PAPERCUPS_FIXTURE } from '../../core/src/receipts/witness-react-papercups.ts';
import {
	SCRIPT_SURFACE_SCHEMA,
	verifyScriptSurface,
} from '../../core/src/enterprise/script-surface.ts';
import {
	parseRuntimeObservationConfig,
	verifyRuntimeScriptObservationEvidence,
} from '../../core/src/enterprise/runtime-script-observation.ts';
import {
	NPM_LOCK_ACQUISITION_PREFLIGHT,
	NEXT_TAILWIND_CONSENT_FAILURE,
	NEXT_TAILWIND_EXCLUSION,
	REACT_PAPERCUPS_TRUST_MATRIX_CELLS,
	REACT_PAPERCUPS_TRUST_RECEIPTS,
	compareTrustResolvedDependencies,
	verifyTrustReceipt,
	validateCycloneDx17,
	validateNpmLockAcquisitionPreflight,
	validateNextTailwindConsentFailure,
	validateNextTailwindExclusion,
	workspaceManifestPaths,
} from './generate.ts';
import { lockPackages, osvRequest } from './ingest.ts';
import {
	MAX_VULNERABILITY_AGE_MS,
	TRUST_SCHEMA,
	asRecord,
	assertPortableEvidence,
	parseIngestRecord,
	type TrustManifest,
	validatePackageCoordinate,
} from './schema.ts';

async function filesBelow(directory: string): Promise<string[]> {
	try {
		await access(directory);
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesBelow(item)));
		else if (entry.isFile()) files.push(item);
	}
	return files.sort(compareUtf16CodeUnits);
}

export interface VerifyTrustOptions {
	rootDir?: string;
	outputDir: string;
	compareDir?: string;
	environment?: NodeJS.ProcessEnv;
	now?: string;
}

const expectedWorkspaceManifestSources = [
	'package.json',
	'packages/cli/package.json',
	'packages/core/package.json',
	'packages/experiments/package.json',
	'packages/frameworks/angular/package.json',
	'packages/frameworks/angularjs/package.json',
	'packages/frameworks/nextjs/package.json',
	'packages/frameworks/react/package.json',
	'packages/node-guard/package.json',
	'packages/trust/package.json',
] as const;

function parseManifest(value: unknown): TrustManifest {
	const root = asRecord(value, 'trust manifest');
	if (root.schemaVersion !== TRUST_SCHEMA) throw new Error('Unsupported trust manifest schema');
	const integrity = asRecord(root.integrity, 'trust manifest integrity');
	if (
		integrity.algorithm !== 'sha256' ||
		integrity.authenticity !== 'not-established' ||
		integrity.certification !== 'not-claimed'
	)
		throw new Error('Trust manifest overstates integrity or assurance');
	const core = asRecord(root.deterministicCore, 'deterministic core');
	if (!Array.isArray(core.artifacts) || typeof core.digest !== 'string')
		throw new Error('Trust manifest deterministic core is incomplete');
	if (!Array.isArray(root.receipts) || root.derivedReport !== 'report.md')
		throw new Error('Trust manifest receipt/report linkage is incomplete');
	return value as TrustManifest;
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8'));
}

export async function verifyTrustPackage(options: VerifyTrustOptions): Promise<{
	valid: true;
	digest: string;
	deterministicCore: string;
	artifacts: number;
}> {
	const environment = options.environment ?? process.env;
	if (environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('Trust verification requires VERSIONLESS_NETWORK_MODE=offline');
	const root = path.resolve(options.rootDir ?? '.');
	const output = path.resolve(root, options.outputDir);
	const aggregate = asRecord(
		await readJson(path.join(root, 'evidence/runs/aggregate.json')),
		'aggregate evidence',
	);
	const transaction = deriveCorpusTransactionState(aggregate.fixtures);
	const manifest = parseManifest(await readJson(path.join(output, 'manifest.json')));
	assertSyntheticEvidence(manifest);
	assertPortableEvidence(manifest);
	const canonical = structuredClone(manifest);
	canonical.canonicalDigest = '';
	const calculated = sha256(canonicalize(canonical));
	if (calculated !== manifest.canonicalDigest)
		throw new Error(`Trust manifest canonical digest mismatch: ${calculated}`);
	for (const artifact of manifest.deterministicCore.artifacts) {
		const body = await readFile(path.join(output, artifact.path));
		if (sha256(body) !== artifact.sha256)
			throw new Error(`Trust artifact digest mismatch: ${artifact.path}`);
		assertSyntheticEvidence(JSON.parse(body.toString('utf8')));
		assertPortableEvidence(JSON.parse(body.toString('utf8')));
	}
	const expectedArtifacts = [
		'controls.json',
		'corpus-conformance.json',
		'dependency-graph.cdx.json',
		'licenses.json',
		'matrix.json',
		'provenance.json',
		'retention.json',
		'runtime-script-observation.json',
		'script-surface.json',
		'vulnerabilities.json',
	];
	if (
		canonicalize(manifest.deterministicCore.artifacts.map((item) => item.path).sort()) !==
		canonicalize(expectedArtifacts)
	)
		throw new Error('Trust deterministic core must contain exactly ten required artifacts');
	const emittedScriptSurface = asRecord(
		await readJson(path.join(output, 'script-surface.json')),
		'script surface',
	);
	if (emittedScriptSurface.schemaVersion !== SCRIPT_SURFACE_SCHEMA)
		throw new Error('Unsupported emitted script-surface schema');
	const rederivedScriptSurface = await verifyScriptSurface({ rootDir: root, environment });
	if (canonicalize(emittedScriptSurface) !== canonicalize(rederivedScriptSurface))
		throw new Error('Script surface does not match independent re-derivation');
	const runtimeConfig = parseRuntimeObservationConfig(
		await readJson(path.join(root, 'trust/runtime-script-observation.json')),
	);
	const runtimeObservation = await verifyRuntimeScriptObservationEvidence(
		await readJson(path.join(output, 'runtime-script-observation.json')),
		{ rootDir: root, config: runtimeConfig, surface: rederivedScriptSurface },
	);
	const sourceRuntimeObservation = await verifyRuntimeScriptObservationEvidence(
		await readJson(
			path.join(
				root,
				'evidence/runtime-script-observation/current/runtime-script-observation.json',
			),
		),
		{ rootDir: root, config: runtimeConfig, surface: rederivedScriptSurface },
	);
	if (canonicalize(runtimeObservation) !== canonicalize(sourceRuntimeObservation))
		throw new Error('Runtime script observation does not match qualified evidence');
	const emittedConformance = (await readJson(
		path.join(output, 'corpus-conformance.json'),
	)) as CorpusConformance;
	if (emittedConformance.schemaVersion !== CORPUS_CONFORMANCE_SCHEMA)
		throw new Error('Unsupported corpus conformance schema');
	verifyCorpusConformanceDigest(emittedConformance);
	const rederivedConformance = await analyzeCorpusConformance({ rootDir: root });
	if (canonicalize(emittedConformance) !== canonicalize(rederivedConformance))
		throw new Error('Corpus conformance does not match independent re-derivation');
	if (
		emittedConformance.summary.verticals !== transaction.verticals ||
		emittedConformance.summary.sourceApplications !== transaction.sourceApplications ||
		emittedConformance.summary.designatedPilotsVerified !== 0 ||
		emittedConformance.verticals.length !== transaction.verticals ||
		emittedConformance.applications.length !== transaction.sourceApplications
	)
		throw new Error(
			'Corpus conformance does not match the canonical aggregate transaction state',
		);
	const packages = lockPackages(await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'));
	if (packages.length === 0) throw new Error('Current pnpm resolved inventory is empty');
	const workspacePaths = await workspaceManifestPaths(root);
	const workspaceSources = workspacePaths.map((manifestPath) =>
		path.relative(root, manifestPath),
	);
	if (canonicalize(workspaceSources) !== canonicalize(expectedWorkspaceManifestSources))
		throw new Error('Current workspace inventory is not the exact ten manifests');
	const workspace = await Promise.all(
		workspacePaths.map(async (manifestPath) => {
			const value = asRecord(await readJson(manifestPath), 'workspace manifest');
			const source = path.relative(root, manifestPath);
			return {
				name: String(value.name),
				version: String(value.version),
				ref: `workspace:${path.dirname(source) || '.'}`,
				source,
			};
		}),
	);
	const graph = await readJson(path.join(output, 'dependency-graph.cdx.json'));
	validateCycloneDx17(graph, { workspace, packages });
	const graphRecord = asRecord(graph, 'dependency graph');
	if (
		!Array.isArray(graphRecord.components) ||
		!Array.isArray(graphRecord.dependencies) ||
		graphRecord.components.length !== 197 ||
		graphRecord.dependencies.length !== 197
	)
		throw new Error('Dependency graph must preserve exactly 197 components and dependencies');
	const licenses = asRecord(
		await readJson(path.join(output, 'licenses.json')),
		'license inventory',
	);
	const rootLicense = asRecord(licenses.rootLicenseText, 'root license text');
	if (rootLicense.state !== 'unknown')
		throw new Error('Absent root license text must remain unknown');
	const licenseCoverage = asRecord(licenses.coverage, 'license coverage');
	if (
		licenseCoverage.workspaceManifests !== workspace.length ||
		licenseCoverage.resolvedPackages !== packages.length ||
		!Array.isArray(licenses.entries) ||
		licenses.entries.length !== workspacePaths.length + packages.length
	)
		throw new Error('License inventory count mismatch');
	const workspaceLicenseEntries = licenses.entries
		.filter((value) => asRecord(value, 'license entry').source !== 'pnpm-lock.yaml')
		.map((value) => {
			const entry = asRecord(value, 'workspace license entry');
			return {
				name: String(entry.name),
				version: String(entry.version),
				source: String(entry.source),
			};
		})
		.sort((left, right) => left.source.localeCompare(right.source));
	const expectedWorkspaceLicenses = workspace
		.map(({ name, version, source }) => ({ name, version, source }))
		.sort((left, right) => left.source.localeCompare(right.source));
	if (canonicalize(workspaceLicenseEntries) !== canonicalize(expectedWorkspaceLicenses))
		throw new Error('License inventory does not match exact workspace manifests');
	const resolvedLicenseCoordinates = licenses.entries
		.filter((value) => asRecord(value, 'license entry').source === 'pnpm-lock.yaml')
		.map((value) => validatePackageCoordinate(value, 'resolved license coordinate'));
	if (canonicalize(resolvedLicenseCoordinates) !== canonicalize(packages))
		throw new Error('License inventory does not match pnpm packages');
	for (const value of licenses.entries) {
		const entry = asRecord(value, 'license entry');
		for (const field of ['spdxExpression', 'licenseText']) {
			const evidence = asRecord(entry[field], `license entry ${field}`);
			if (!['verified', 'unknown', 'ambiguous'].includes(String(evidence.state)))
				throw new Error('License evidence has an unsupported state');
		}
	}
	const licenseSummary = asRecord(licenses.summary, 'license summary');
	for (const field of ['spdxExpression', 'licenseText']) {
		const summary = asRecord(licenseSummary[field], `license summary ${field}`);
		const actual = { verified: 0, unknown: 0, ambiguous: 0 };
		for (const value of licenses.entries) {
			const evidence = asRecord(asRecord(value, 'license entry')[field], `license ${field}`);
			const state = String(evidence.state) as keyof typeof actual;
			actual[state]++;
		}
		if (
			summary.verified !== actual.verified ||
			summary.unknown !== actual.unknown ||
			summary.ambiguous !== actual.ambiguous
		)
			throw new Error(`License ${field} summary count mismatch`);
	}
	const provenance = asRecord(await readJson(path.join(output, 'provenance.json')), 'provenance');
	const provenanceClaims = asRecord(provenance.claims, 'provenance claims');
	if (
		provenanceClaims.slsaLevel !== 'not-claimed' ||
		provenanceClaims.signerAuthenticity !== 'unknown' ||
		provenanceClaims.gitProvenance !== 'unknown' ||
		provenanceClaims.aggregateFixtures !== transaction.receipts
	)
		throw new Error('Provenance contains an unsupported assurance state');
	if (!Array.isArray(provenance.subject))
		throw new Error('Provenance generated package subjects are absent');
	const predicate = asRecord(provenance.predicate, 'provenance predicate');
	const buildDefinition = asRecord(predicate.buildDefinition, 'provenance build definition');
	if (!Array.isArray(buildDefinition.resolvedDependencies))
		throw new Error('Provenance resolved dependencies are absent');
	const resolvedDependencies = buildDefinition.resolvedDependencies.map((value) =>
		asRecord(value, 'provenance resolved dependency'),
	);
	const nextTailwindFailureBytes = await readFile(
		path.join(root, NEXT_TAILWIND_CONSENT_FAILURE.path),
	);
	validateNextTailwindConsentFailure(nextTailwindFailureBytes);
	const [nextTailwindExclusionJson, nextTailwindExclusionMarkdown] = await Promise.all([
		readFile(path.join(root, NEXT_TAILWIND_EXCLUSION.json.path)),
		readFile(path.join(root, NEXT_TAILWIND_EXCLUSION.markdown.path)),
	]);
	validateNextTailwindExclusion(nextTailwindExclusionJson, nextTailwindExclusionMarkdown);
	const acquisitionDependencies = resolvedDependencies.filter(
		(dependency) => dependency.uri === NPM_LOCK_ACQUISITION_PREFLIGHT.path,
	);
	if (acquisitionDependencies.length !== 1)
		throw new Error('Provenance must contain exactly one T190 preflight dependency');
	const acquisitionDigest = asRecord(
		acquisitionDependencies[0]!.digest,
		'T190 preflight dependency digest',
	);
	if (acquisitionDigest.sha256 !== NPM_LOCK_ACQUISITION_PREFLIGHT.sha256)
		throw new Error('Provenance T190 preflight dependency digest differs');
	validateNpmLockAcquisitionPreflight(
		await readFile(path.join(root, NPM_LOCK_ACQUISITION_PREFLIGHT.path)),
	);
	const failureDependencies = resolvedDependencies.filter(
		(dependency) => dependency.uri === NEXT_TAILWIND_CONSENT_FAILURE.path,
	);
	if (
		failureDependencies.length !== 1 ||
		asRecord(failureDependencies[0]!.digest, 'T465 disclosure dependency digest').sha256 !==
			NEXT_TAILWIND_CONSENT_FAILURE.sha256
	)
		throw new Error('Provenance must contain exactly one T465 disclosure dependency');
	if (
		manifest.receipts.length !== transaction.receipts ||
		manifest.receipts.some(
			(receipt) =>
				receipt.path === NPM_LOCK_ACQUISITION_PREFLIGHT.path ||
				receipt.path === NEXT_TAILWIND_CONSENT_FAILURE.path ||
				receipt.path === NEXT_TAILWIND_EXCLUSION.json.path ||
				receipt.path === NEXT_TAILWIND_EXCLUSION.markdown.path,
		)
	)
		throw new Error(
			'T190 preflight and Tailwind negative evidence must remain outside migration receipts',
		);
	const aggregateReceiptPaths = (aggregate.fixtures as unknown[])
		.map((value) => String(asRecord(value, 'aggregate fixture').receipt))
		.sort();
	if (
		canonicalize(manifest.receipts.map((receipt) => receipt.path).sort()) !==
		canonicalize(aggregateReceiptPaths)
	)
		throw new Error('Trust manifest receipts do not match canonical aggregate membership');
	const expectedResolvedDependencies = [
		{
			uri: 'pnpm-lock.yaml',
			digest: { sha256: sha256(await readFile(path.join(root, 'pnpm-lock.yaml'))) },
		},
		{
			uri: 'evidence/runs/aggregate.json',
			digest: {
				sha256: sha256(await readFile(path.join(root, 'evidence/runs/aggregate.json'))),
			},
		},
		{
			uri: NPM_LOCK_ACQUISITION_PREFLIGHT.path,
			digest: { sha256: NPM_LOCK_ACQUISITION_PREFLIGHT.sha256 },
		},
		{
			uri: NEXT_TAILWIND_CONSENT_FAILURE.path,
			digest: { sha256: NEXT_TAILWIND_CONSENT_FAILURE.sha256 },
		},
		{
			uri: NEXT_TAILWIND_EXCLUSION.json.path,
			digest: { sha256: NEXT_TAILWIND_EXCLUSION.json.sha256 },
		},
		{
			uri: NEXT_TAILWIND_EXCLUSION.markdown.path,
			digest: { sha256: NEXT_TAILWIND_EXCLUSION.markdown.sha256 },
		},
		...(await Promise.all(
			(
				await workspaceManifestPaths(root)
			).map(async (file) => ({
				uri: path.relative(root, file),
				digest: { sha256: sha256(await readFile(file)) },
			})),
		)),
		...manifest.receipts.map((receipt) => ({
			uri: receipt.path,
			digest: { sha256: receipt.digest },
		})),
	].sort(compareTrustResolvedDependencies);
	const actualResolvedDependencies = resolvedDependencies
		.map((dependency) => ({
			uri: dependency.uri,
			digest: { sha256: asRecord(dependency.digest, 'resolved dependency digest').sha256 },
		}))
		.sort(compareTrustResolvedDependencies);
	if (
		new Set(actualResolvedDependencies.map((item) => item.uri)).size !==
			actualResolvedDependencies.length ||
		canonicalize(actualResolvedDependencies) !== canonicalize(expectedResolvedDependencies)
	)
		throw new Error('Provenance resolved dependencies differ from the exact source inventory');
	const runDetails = asRecord(predicate.runDetails, 'provenance run details');
	if (!Array.isArray(runDetails.byproducts))
		throw new Error('Provenance build byproducts are absent');
	const subjectInventory = provenance.subject
		.map((value) => {
			const subject = asRecord(value, 'provenance subject');
			return {
				path: subject.name,
				sha256: asRecord(subject.digest, 'provenance subject digest').sha256,
			};
		})
		.sort((left, right) => compareUtf16CodeUnits(String(left.path), String(right.path)));
	const byproductInventory = runDetails.byproducts
		.map((value) => {
			const byproduct = asRecord(value, 'provenance byproduct');
			return { path: byproduct.path, sha256: byproduct.sha256 };
		})
		.sort((left, right) => compareUtf16CodeUnits(String(left.path), String(right.path)));
	if (canonicalize(subjectInventory) !== canonicalize(byproductInventory))
		throw new Error('Provenance subjects and byproducts differ');
	const expectedDistributionInventory = await Promise.all(
		(await filesBelow(path.join(root, 'packages')))
			.filter((file) => file.includes(`${path.sep}dist${path.sep}`))
			.map(async (file) => ({
				path: path.relative(root, file),
				sha256: sha256(await readFile(file)),
			})),
	);
	if (
		new Set(subjectInventory.map((item) => item.path)).size !== subjectInventory.length ||
		canonicalize(subjectInventory) !== canonicalize(expectedDistributionInventory)
	)
		throw new Error('Provenance subjects differ from the exact distribution inventory');
	for (const value of provenance.subject) {
		const subject = asRecord(value, 'provenance subject');
		const digest = asRecord(subject.digest, 'provenance subject digest');
		if (typeof subject.name !== 'string' || typeof digest.sha256 !== 'string')
			throw new Error('Provenance subject is incomplete');
		const actual = sha256(await readFile(path.join(root, subject.name)));
		if (actual !== digest.sha256)
			throw new Error(`Generated package artifact digest mismatch: ${subject.name}`);
	}
	const coreSubject = provenance.subject
		.map((value) => asRecord(value, 'provenance subject'))
		.find((subject) => subject.name === 'packages/core/dist/index.js');
	if (!coreSubject)
		throw new Error('Provenance does not attest the exact current core distribution');
	const controls = asRecord(await readJson(path.join(output, 'controls.json')), 'controls');
	const locality = asRecord(controls.locality, 'locality control');
	const securityPolicy = asRecord(controls.securityPolicy, 'security policy control');
	const gitProvenance = asRecord(controls.gitProvenance, 'Git provenance control');
	const signingIdentity = asRecord(controls.signingIdentity, 'signing identity control');
	const scriptSurfaceControl = asRecord(controls.scriptSurface, 'script-surface control');
	const runtimeObservationControl = asRecord(
		controls.runtimeScriptObservation,
		'runtime script-observation control',
	);
	if (
		locality.state !== 'verified' ||
		locality.scope !== 'Versionless-spawned processes and browser routing' ||
		locality.osWideIsolation !== false ||
		securityPolicy.state !== 'unknown' ||
		gitProvenance.state !== 'unknown' ||
		signingIdentity.state !== 'unknown' ||
		scriptSurfaceControl.state !== 'verified' ||
		scriptSurfaceControl.scope !== 'eighteen exact static deployment entrypoints' ||
		canonicalize(scriptSurfaceControl.excludedVerticals) !==
			canonicalize(['angular-realworld-v15-to-v16']) ||
		scriptSurfaceControl.exclusionReason !==
			'T220 static script surface was not separately observed.' ||
		scriptSurfaceControl.paymentPageApplicability !== 'not-established' ||
		scriptSurfaceControl.dynamicScriptInsertion !== 'not-tested' ||
		scriptSurfaceControl.pciCompliance !== 'not-claimed' ||
		runtimeObservationControl.state !== 'verified' ||
		runtimeObservationControl.scope !== 'exact qualified journeys' ||
		canonicalize(runtimeObservationControl.excludedVerticals) !==
			canonicalize(['angular-realworld-v15-to-v16']) ||
		runtimeObservationControl.exclusionReason !==
			'T220 qualified runtime scripts were not separately observed.' ||
		runtimeObservationControl.globalDynamicInsertionCoverage !== 'not-established' ||
		runtimeObservationControl.paymentPageApplicability !== 'not-established' ||
		runtimeObservationControl.pciCompliance !== 'not-claimed'
	)
		throw new Error('Controls contain an unsupported enterprise assurance claim');
	const papercupsIntegrated = transaction.kind === 'react-papercups-browser-proof';
	const matrix = asRecord(await readJson(path.join(output, 'matrix.json')), 'corpus matrix');
	if (
		!Array.isArray(matrix.cells) ||
		matrix.cells.length !==
			15 + (transaction.nextKilledByGoogleIntegrated ? 1 : 0) + (papercupsIntegrated ? 1 : 0)
	)
		throw new Error('Corpus matrix cell count does not match transaction state');
	if (
		papercupsIntegrated &&
		(manifest.receipts.length !== REACT_PAPERCUPS_TRUST_RECEIPTS ||
			matrix.cells.length !== REACT_PAPERCUPS_TRUST_MATRIX_CELLS)
	)
		throw new Error(
			'React Papercups browser proof must pin exactly eighteen receipts and seventeen matrix cells',
		);
	const matrixSource = asRecord(matrix.derivedFrom, 'corpus matrix derivation');
	if (
		matrixSource.path !== 'corpus-conformance.json' ||
		matrixSource.sha256 !== emittedConformance.integrity.canonicalDigest
	)
		throw new Error('Corpus matrix is not derived from corpus conformance');
	const cellEntries = matrix.cells.map((value) => {
		const cell = asRecord(value, 'corpus matrix cell');
		return [cell.id, cell];
	});
	if (
		cellEntries.some(([id]) => typeof id !== 'string') ||
		new Set(cellEntries.map(([id]) => id)).size !== cellEntries.length
	)
		throw new Error('Corpus matrix cell identifiers are missing or duplicated');
	const cells = new Map(cellEntries as Array<[string, Record<string, unknown>]>);
	const syntheticNextCells = matrix.cells
		.map((value) => asRecord(value, 'corpus matrix cell'))
		.filter((cell) => cell.framework === 'nextjs' || cell.synthetic === true)
		.sort((left, right) => String(left.id).localeCompare(String(right.id)));
	const expectedSyntheticNextCells = NEXTJS_SYNTHETIC_NOT_TESTED_LANES.map((lane) => ({
		...lane,
		state: 'not-tested',
		designatedPilot: false,
		productionStack: 'nextjs-preserved-not-tested',
	})).sort((left, right) => left.id.localeCompare(right.id));
	if (canonicalize(syntheticNextCells) !== canonicalize(expectedSyntheticNextCells))
		throw new Error('Synthetic Next.js matrix lanes are missing, duplicated, or overstated');
	const maintainedVerified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
	);
	const vite8Verified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
	);
	const vite8 = cells.get('react-boilerplate-v4-vite8');
	const dataFlowVerified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
	);
	const dataFlow = cells.get('react-boilerplate-v4-data-flow');
	const reactComposedVerified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
	);
	const reactComposed = cells.get('react-boilerplate-v4-composed');
	const phonecatRouteVerified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
	);
	const phonecatRoute = cells.get('angular-phonecat-route-resolve');
	const phonecatComposedVerified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/angular-phonecat-composed/t048-run.json',
	);
	const phonecatComposed = cells.get('angular-phonecat-composed');
	const phonecatViteVerified = manifest.receipts.some(
		(receipt) => receipt.path === 'evidence/runs/angular-phonecat-vite8/t069-run.json',
	);
	const phonecatVite = cells.get('angular-phonecat-vite8');
	const angularRealworldVerified = manifest.receipts.some(
		(receipt) => receipt.path === ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
	);
	const angularRealworldWitnessVerified = manifest.receipts.some(
		(receipt) => receipt.path === WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	);
	const angularRealworld = cells.get('angular-realworld-v15-to-v16');
	const nextKilledByGoogle = cells.get('next-killedbygoogle-derived-state-to-memo');
	if (
		cells.get('takenote')?.state !== 'not-tested' ||
		cells.get('angular2-hn')?.state !== 'not-tested' ||
		cells.get('old-vite')?.state !== 'not-tested' ||
		cells.get('react-boilerplate-v4')?.maintainedTarget !==
			(maintainedVerified ? 'verified' : 'not-tested') ||
		(maintainedVerified &&
			(cells.get('react-boilerplate-v4')?.maintainedRuntime !== 'Node 24.15.0 darwin-arm64' ||
				cells.get('react-boilerplate-v4')?.maintainedBundler !== 'webpack 4.47.0')) ||
		vite8?.state !== (vite8Verified ? 'verified' : 'not-tested') ||
		vite8?.bundler !== 'Vite 8.0.16' ||
		vite8.adapter !== 'fixture-specific' ||
		vite8.oldVite !== 'not-tested' ||
		vite8.genericAdapter !== 'not-tested' ||
		vite8.unplugin !== 'not-tested' ||
		dataFlow?.state !== (dataFlowVerified ? 'verified' : 'not-tested') ||
		dataFlow?.runtime !== 'Node 24.15.0 darwin-arm64' ||
		dataFlow?.bundler !== 'Vite 8.0.16' ||
		dataFlow?.migration !== 'connect-to-hooks' ||
		dataFlow?.adapter !== 'fixture-specific' ||
		dataFlow?.designatedPilot !== false ||
		reactComposed?.state !== (reactComposedVerified ? 'verified' : 'not-tested') ||
		reactComposed?.runtime !== 'Node 16.20.2 legacy / Node 24.15.0 target' ||
		reactComposed?.bundler !== 'webpack 4.30.0 / Vite 8.0.16' ||
		reactComposed?.migration !== 'atomic-composed-connect-to-hooks' ||
		reactComposed?.adapter !== 'fixture-specific' ||
		reactComposed?.designatedPilot !== false ||
		phonecatRoute?.state !== (phonecatRouteVerified ? 'verified' : 'not-tested') ||
		phonecatRoute?.routeResolves !== (phonecatRouteVerified ? 'verified' : 'not-tested') ||
		phonecatRoute?.componentBindings !==
			(phonecatRouteVerified ? 'one-way-verified' : 'not-tested') ||
		phonecatRoute.track !== 'angularjs-special-track' ||
		phonecatRoute.bundler !== 'none-static' ||
		phonecatRoute.designatedPilot !== false ||
		phonecatRoute.angular2Plus !== 'not-applicable' ||
		phonecatRoute.angularCliAot !== 'not-applicable' ||
		phonecatComposed?.state !== (phonecatComposedVerified ? 'verified' : 'not-tested') ||
		phonecatComposed?.composition !== (phonecatComposedVerified ? 'verified' : 'not-tested') ||
		phonecatComposed?.orderIndependent !== (phonecatComposedVerified ? true : false) ||
		phonecatComposed?.track !== 'angularjs-special-track' ||
		phonecatComposed?.bundler !== 'none-static' ||
		phonecatComposed?.designatedPilot !== false ||
		phonecatComposed?.angular2Plus !== 'not-applicable' ||
		phonecatComposed?.angularCliAot !== 'not-applicable' ||
		phonecatVite?.state !== (phonecatViteVerified ? 'verified' : 'not-tested') ||
		phonecatVite?.track !== 'angularjs-special-track' ||
		phonecatVite?.bundler !== 'Vite 8.0.16' ||
		phonecatVite?.adapter !== 'fixture-specific' ||
		phonecatVite?.oldVite !== 'not-tested' ||
		phonecatVite?.genericAdapter !== 'not-tested' ||
		phonecatVite?.unplugin !== 'not-tested' ||
		phonecatVite?.serviceWorker !== 'out-of-scope-not-emitted' ||
		phonecatVite?.designatedPilot !== false ||
		phonecatVite?.angular2Plus !== 'not-applicable' ||
		phonecatVite?.angularCliAot !== 'not-applicable' ||
		angularRealworld?.state !== (angularRealworldVerified ? 'verified' : 'not-tested') ||
		angularRealworld?.framework !== 'angular' ||
		angularRealworld?.track !== 'angular2-plus-adjacent-major' ||
		angularRealworld?.runtime !== 'Node 18.20.8' ||
		angularRealworld?.bundler !== 'Angular CLI/Architect production AOT 15-to-16' ||
		angularRealworld?.angular2Plus !== 'verified-one-adjacent-major' ||
		angularRealworld?.angularCliAot !== 'verified' ||
		angularRealworld?.adjacentMajor !== 'angular-15-to-16-verified' ||
		angularRealworld?.productionReadiness !==
			(angularRealworldWitnessVerified ? 'verified-direct-witness' : 'not-tested') ||
		canonicalize(angularRealworld?.readinessScoreboard) !==
			canonicalize(
				angularRealworldWitnessVerified
					? {
							angularLineage: { ready: 1, total: 4 },
							harness: { ready: 0, total: 4 },
							phonecat: 'unsupported-visible-transition-not-counted',
						}
					: {
							angularLineage: { ready: 0, total: 4 },
							harness: { ready: 0, total: 4 },
						},
			) ||
		angularRealworld?.designatedPilot !== false ||
		(transaction.nextKilledByGoogleIntegrated
			? nextKilledByGoogle?.framework !== 'react' ||
				nextKilledByGoogle.platform !== 'nextjs' ||
				nextKilledByGoogle.state !== 'verified' ||
				nextKilledByGoogle.scope !== 'fixture-specific-next12-pages' ||
				nextKilledByGoogle.genericNextSupport !== 'not-claimed' ||
				nextKilledByGoogle.designatedPilot !== false
			: nextKilledByGoogle !== undefined)
	)
		throw new Error('Required unsupported/not-tested corpus states were upgraded');
	const papercupsCell = cells.get(REACT_PAPERCUPS_FIXTURE);
	const papercupsVertical = emittedConformance.verticals.find(
		(value) => asRecord(value, 'corpus vertical').id === REACT_PAPERCUPS_FIXTURE,
	);
	if (papercupsIntegrated) {
		const row = asRecord(papercupsVertical, 'React Papercups conformance vertical');
		const papercupsApplication = emittedConformance.applications.find(
			(value) => asRecord(value, 'corpus application').id === row.application,
		);
		if (
			papercupsCell === undefined ||
			papercupsApplication === undefined ||
			canonicalize(asRecord(papercupsApplication, 'React Papercups application').verticals) !==
				canonicalize([REACT_PAPERCUPS_FIXTURE]) ||
			papercupsCell.state !== 'verified' ||
			papercupsCell.scope !== 'fixture-specific-create-react-app-to-vite8' ||
			papercupsCell.genericReactSupport !== 'not-claimed' ||
			papercupsCell.framework !== row.framework ||
			papercupsCell.designatedPilot !== row.designatedPilot ||
			papercupsCell.runtime !== row.runtime ||
			papercupsCell.bundler !== row.bundler ||
			papercupsCell.track !== row.track ||
			papercupsCell.browserProof !== row.browserProof ||
			papercupsCell.serviceWorker !== row.serviceWorker ||
			papercupsCell.scrollSurface !== row.scrollSurface ||
			papercupsCell.productionReadiness !== row.productionReadiness ||
			canonicalize(papercupsCell.locality) !== canonicalize(row.locality) ||
			canonicalize(papercupsCell.readinessScoreboard) !==
				canonicalize(row.readinessScoreboard) ||
			canonicalize(row.readinessScoreboard) !==
				canonicalize({
					reactLineage: { ready: 1, total: 4, counted: false },
					overall: { ready: 3, total: 12 },
				})
		)
			throw new Error('React Papercups matrix cell is not derived from corpus conformance');
	} else if (papercupsCell !== undefined || papercupsVertical !== undefined)
		throw new Error('React Papercups evidence is claimed outside its transaction state');
	const phonecat = cells.get('angular-phonecat');
	if (
		phonecat?.framework !== 'angularjs' ||
		phonecat.track !== 'angularjs-special-track' ||
		phonecat.designatedPilot !== false ||
		phonecat.bundler !== 'none-static' ||
		phonecat.angular2Plus !== 'not-applicable' ||
		phonecat.angularCliAot !== 'not-applicable'
	)
		throw new Error('PhoneCat scope is overstated');
	const vulnerabilities = asRecord(
		await readJson(path.join(output, 'vulnerabilities.json')),
		'vulnerability report',
	);
	if (
		!Array.isArray(vulnerabilities.packages) ||
		vulnerabilities.packages.length !== packages.length
	)
		throw new Error('Vulnerability inventory count mismatch');
	const vulnerabilityCoordinates = vulnerabilities.packages.map((value, index) =>
		validatePackageCoordinate(value, `vulnerability package ${index}`),
	);
	if (canonicalize(vulnerabilityCoordinates) !== canonicalize(packages))
		throw new Error('Vulnerability inventory does not match pnpm packages');
	const osv = asRecord(vulnerabilities.osv, 'OSV summary');
	if (osv.queries !== packages.length) throw new Error('OSV query count mismatch');
	const ingestEvidence = asRecord(vulnerabilities.ingest, 'vulnerability ingest evidence');
	const parsedIngest = parseIngestRecord({
		...ingestEvidence,
		packages: vulnerabilityCoordinates,
	});
	if (parsedIngest.sources[0].requestSha256 !== sha256(osvRequest(packages)))
		throw new Error('OSV request digest does not match verified pnpm packages');
	const freshness = asRecord(vulnerabilities.freshness, 'vulnerability freshness');
	const observedAt = Date.parse(String(freshness.observedAt));
	const now = Date.parse(options.now ?? new Date().toISOString());
	const expectedState =
		now - observedAt >= 0 && now - observedAt <= MAX_VULNERABILITY_AGE_MS
			? 'verified'
			: 'stale';
	if (freshness.state !== expectedState)
		throw new Error(`Vulnerability evidence must be visibly ${expectedState}`);
	if (manifest.observation.vulnerabilityFreshness !== freshness.state)
		throw new Error('Manifest vulnerability freshness is inconsistent');
	for (const receipt of manifest.receipts) {
		const result = await verifyTrustReceipt(root, receipt.path);
		if (
			result.digest !== receipt.digest ||
			result.artifacts !== receipt.artifacts ||
			receipt.state !== 'verified'
		)
			throw new Error(`Receipt preservation mismatch: ${receipt.path}`);
	}
	const expectedCore = sha256(
		canonicalize({
			artifacts: manifest.deterministicCore.artifacts,
			receipts: manifest.receipts,
		}),
	);
	if (expectedCore !== manifest.deterministicCore.digest)
		throw new Error('Deterministic-core digest does not match its declared inputs');
	const report = await readFile(path.join(output, manifest.derivedReport), 'utf8');
	if (
		!report.includes(manifest.canonicalDigest) ||
		!report.includes(manifest.deterministicCore.digest) ||
		!report.includes('corpus-conformance.json') ||
		!report.includes('script-surface.json') ||
		!report.includes('runtime-script-observation.json') ||
		!report.includes(emittedConformance.integrity.canonicalDigest)
	)
		throw new Error('Derived Markdown is not linked to the trust manifest');
	if (
		!report.includes('authenticity is not established') ||
		!report.includes('not certification')
	)
		throw new Error('Derived Markdown omits mandatory non-claims');
	if (
		!report.includes(`${transaction.verticals} verified verticals`) ||
		!report.includes(`exactly ${transaction.sourceApplications} source applications`) ||
		(transaction.nextKilledByGoogleIntegrated
			? !report.includes('Killed by Google Next.js 12 Pages/webpack production vertical')
			: !report.includes('Next.js remains **not-tested**') ||
				report.includes('Killed by Google Next.js 12 Pages/webpack production vertical')) ||
		(transaction.angularRealworldWitnessIntegrated
			? !report.includes('Angular-lineage production readiness: **1/4**') ||
				!report.includes('Harness qualification: **0/4**')
			: report.includes('Angular-lineage production readiness: **1/4**')) ||
		(papercupsIntegrated
			? !report.includes('Papercups v1.0.0 create-react-app→Vite 8 direct-Witness browser proof')
			: report.includes('Papercups v1.0.0 create-react-app→Vite 8 direct-Witness browser proof'))
	)
		throw new Error('Derived Markdown does not match canonical transaction state');
	if (options.compareDir) {
		const comparison = parseManifest(
			await readJson(path.join(path.resolve(root, options.compareDir), 'manifest.json')),
		);
		if (comparison.deterministicCore.digest !== manifest.deterministicCore.digest)
			throw new Error('Deterministic-core replay mismatch');
		for (const artifact of manifest.deterministicCore.artifacts) {
			const peer = comparison.deterministicCore.artifacts.find(
				(item) => item.path === artifact.path,
			);
			if (!peer || peer.sha256 !== artifact.sha256)
				throw new Error(`Deterministic replay artifact mismatch: ${artifact.path}`);
		}
	}
	return {
		valid: true,
		digest: calculated,
		deterministicCore: manifest.deterministicCore.digest,
		artifacts: manifest.deterministicCore.artifacts.length,
	};
}
