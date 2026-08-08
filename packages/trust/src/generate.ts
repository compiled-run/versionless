import { access, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { anyOf, charIn, createRegExp, exactly, oneOrMore } from 'magic-regexp';
import * as path from 'pathe';
import { encodeParam, joinURL } from 'ufo';
import {
	analyzeCorpusConformance,
	deriveCorpusTransactionState,
	type CorpusConformance,
} from '../../core/src/corpus/conformance.ts';
import { assertSyntheticEvidence } from '../../core/src/policy/payment-signals.ts';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import { verifyReceipt } from '../../core/src/receipts/verify.ts';
import {
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT,
	verifyAngularRealworldV15ToV16Evidence,
} from '../../core/src/receipts/angular-realworld-v15-to-v16.ts';
import {
	NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	verifyNextKilledByGoogleEvidence,
} from '../../core/src/receipts/next-killedbygoogle.ts';
import {
	WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	verifyWitnessAngularRealworldEvidence,
} from '../../core/src/receipts/witness-angular-realworld.ts';
import { verifyScriptSurface } from '../../core/src/enterprise/script-surface.ts';
import {
	parseRuntimeObservationConfig,
	type RuntimeScriptObservation,
	verifyRuntimeScriptObservationEvidence,
} from '../../core/src/enterprise/runtime-script-observation.ts';
import { lockPackages, osvRequest } from './ingest.ts';
import { renderTrustReport } from './render.ts';
import {
	CISA_KEV_URL,
	MAX_VULNERABILITY_AGE_MS,
	OSV_BATCH_URL,
	TRUST_SCHEMA,
	assertPortableEvidence,
	asRecord,
	asString,
	parseIngestRecord,
	type EvidenceState,
	type ManifestArtifact,
	type PackageCoordinate,
	type TrustManifest,
	packageVersionWithoutPeerContext,
	validatePackageCoordinate,
} from './schema.ts';

const PRESERVED_RECEIPTS = [
	{
		path: 'evidence/runs/react-boilerplate-v4/t008-run.json',
		digest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
	},
	{
		path: 'evidence/runs/angular-phonecat/t014-run.json',
		digest: 'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
	},
] as const;
const MAINTAINED_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
	digest: null,
} as const;
const VITE8_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
	digest: null,
} as const;
const PHONECAT_ROUTE_RECEIPT = {
	path: 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
	digest: null,
} as const;
const PHONECAT_COMPOSED_RECEIPT = {
	path: 'evidence/runs/angular-phonecat-composed/t048-run.json',
	digest: null,
} as const;
const DATA_FLOW_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
	digest: null,
} as const;
const REACT_COMPOSED_RECEIPT = {
	path: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
	digest: null,
} as const;
const PHONECAT_VITE_RECEIPT = {
	path: 'evidence/runs/angular-phonecat-vite8/t069-run.json',
	digest: null,
} as const;
const ANGULAR_REALWORLD_RECEIPT = {
	path: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
	digest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
} as const;
const NEXT_KILLED_BY_GOOGLE_RECEIPT = {
	path: NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	digest: null,
} as const;
const WITNESS_ANGULAR_REALWORLD_RECEIPT = {
	path: WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	digest: null,
} as const;
export const NPM_LOCK_ACQUISITION_PREFLIGHT = {
	path: 'evidence/dependencies/dashboard-contacts/t190-preflight.json',
	sha256: '262abe9b19a10804808eadd5ae2dfcbc1fd9ac4119f9dc9571cb3df89df1d351',
	canonicalDigest: 'a14e94d4729f50cf6260431d5dea53e0ac72fa77668e9612ea17cc216c9ed044',
} as const;
const workspaceReference = createRegExp(
	exactly('workspace:')
		.at.lineStart()
		.and(anyOf('.', oneOrMore(charIn('0123456789._/-').from('A', 'Z').from('a', 'z'))))
		.at.lineEnd(),
);

function isLicenseFilename(name: string): boolean {
	const normalized = name.toLowerCase();
	return (
		normalized === 'license' ||
		normalized === 'licence' ||
		normalized.startsWith('license.') ||
		normalized.startsWith('licence.')
	);
}

export interface GenerateTrustOptions {
	rootDir?: string;
	cacheDir?: string;
	policyPath: string;
	outputDir: string;
	offline: boolean;
	environment?: NodeJS.ProcessEnv;
	observedAt?: string;
}

async function exists(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

async function filesBelow(directory: string): Promise<string[]> {
	if (!(await exists(directory))) return [];
	const output: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) output.push(...(await filesBelow(item)));
		else if (entry.isFile()) output.push(item);
	}
	return output.sort();
}

export function validateNpmLockAcquisitionPreflight(bytes: Buffer): void {
	let value: unknown;
	try {
		value = JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new Error('T190 npm lock acquisition preflight is invalid JSON');
	}
	const receipt = asRecord(value, 'T190 npm lock acquisition preflight');
	const integrity = asRecord(receipt.integrity, 'T190 preflight integrity');
	const replay = asRecord(receipt.replay, 'T190 preflight replay');
	const acquisition = asRecord(receipt.proposedAcquisition, 'T190 proposed acquisition');
	const consent = asRecord(acquisition.consent, 'T190 proposed consent');
	const network = asRecord(acquisition.network, 'T190 proposed network');
	const transaction = asRecord(acquisition.transaction, 'T190 proposed transaction');
	if (
		receipt.schemaVersion !== 'versionless.npm-lock-acquisition-preflight.v1' ||
		receipt.result !== 'not-ready' ||
		integrity.algorithm !== 'sha256' ||
		integrity.canonicalDigest !== NPM_LOCK_ACQUISITION_PREFLIGHT.canonicalDigest ||
		replay.runs !== 2 ||
		replay.identical !== true ||
		replay.networkAttempts !== 0 ||
		replay.residue !== 'none' ||
		consent.status !== 'proposed-unconsumed' ||
		consent.consumed !== false ||
		network.enabled !== false ||
		network.maximumResponseBytes !== null ||
		network.maximumAggregateBytes !== null ||
		transaction.state !== 'not-created' ||
		transaction.stagingPath !== null ||
		transaction.publicationPath !== null
	)
		throw new Error('T190 npm lock acquisition preflight safety facts differ');
	const canonical = structuredClone(receipt);
	asRecord(canonical.integrity, 'T190 canonical integrity').canonicalDigest = '';
	if (sha256(canonicalize(canonical)) !== NPM_LOCK_ACQUISITION_PREFLIGHT.canonicalDigest)
		throw new Error('T190 npm lock acquisition preflight canonical digest differs');
	if (sha256(bytes) !== NPM_LOCK_ACQUISITION_PREFLIGHT.sha256)
		throw new Error('T190 npm lock acquisition preflight file digest differs');
}

export async function workspaceManifestPaths(root: string): Promise<string[]> {
	const relativePaths = [
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
	const manifests = relativePaths.map((relativePath) => path.join(root, relativePath));
	for (const manifest of manifests)
		if (!(await exists(manifest)))
			throw new Error(
				`Required workspace manifest missing: ${path.relative(root, manifest)}`,
			);
	return manifests;
}

export function packagePurl(name: string, version: string): string {
	validatePackageCoordinate({ name, version }, 'npm purl coordinate');
	const encodePurlSegment = (value: string) => encodeParam(value).replaceAll('@', '%40');
	const [scope, packageName] = name.slice(1).split('/');
	const encoded = name.startsWith('@')
		? joinURL(`%40${encodePurlSegment(scope ?? '')}`, encodePurlSegment(packageName ?? ''))
		: encodePurlSegment(name);
	return `pkg:npm/${encoded}@${encodePurlSegment(version)}`;
}

async function dependencyGraph(
	root: string,
	lockText: string,
	manifests: Array<{ path: string; value: Record<string, unknown> }>,
): Promise<Record<string, unknown>> {
	const resolved = lockPackages(lockText);
	const workspace = await Promise.all(
		manifests.map(async ({ path: manifestPath, value }) => ({
			type: 'application',
			'bom-ref': `workspace:${path.dirname(path.relative(root, manifestPath)) || '.'}`,
			name:
				typeof value.name === 'string'
					? value.name
					: path.basename(path.dirname(manifestPath)),
			version: typeof value.version === 'string' ? value.version : 'unknown',
			hashes: [{ alg: 'SHA-256', content: sha256(await readFile(manifestPath)) }],
			properties: [
				{ name: 'versionless:source', value: path.relative(root, manifestPath) },
				{ name: 'versionless:state', value: 'verified' },
			],
		})),
	);
	const components = [
		...workspace,
		...resolved.map((item) => ({
			type: 'library',
			'bom-ref': packagePurl(item.name, item.version),
			name: item.name,
			version: item.version,
			purl: packagePurl(item.name, item.version),
			properties: [{ name: 'versionless:source', value: 'pnpm-lock.yaml' }],
		})),
	];
	const rootRef = 'workspace:.';
	return {
		bomFormat: 'CycloneDX',
		specVersion: '1.7',
		version: 1,
		metadata: {
			component: components.find((item) => item['bom-ref'] === rootRef),
			properties: [
				{ name: 'versionless:validation', value: 'local-profile' },
				{ name: 'versionless:validation-claim', value: 'not-independent-or-official' },
				{ name: 'versionless:graph-model', value: 'complete-resolved-inventory-rooted' },
				{ name: 'versionless:topology', value: 'exact-transitive-topology-not-proven' },
			],
		},
		components,
		dependencies: components.map((item) => ({
			ref: item['bom-ref'],
			...(item['bom-ref'] === rootRef
				? {
						dependsOn: components
							.filter((other) => other['bom-ref'] !== rootRef)
							.map((other) => other['bom-ref']),
					}
				: {}),
		})),
	};
}

interface InstalledManifest {
	identity: string;
	manifestPath: string;
	directory: string;
	value: Record<string, unknown>;
}

function portableRelative(root: string, file: string): string {
	const identifier = path.relative(root, file).split(path.sep).join('/');
	if (!identifier || path.isAbsolute(identifier))
		throw new Error('Portable evidence identity missing');
	assertPortableEvidence(identifier, 'portable evidence identity');
	return identifier;
}

async function installedManifestCatalog(root: string): Promise<Map<string, InstalledManifest[]>> {
	const catalog = new Map<string, InstalledManifest[]>();
	const virtualStore = path.join(root, '.versionless/cache/pnpm-virtual-store');
	for (const file of await filesBelow(virtualStore)) {
		if (
			path.basename(file) !== 'package.json' ||
			!file.includes(`${path.sep}node_modules${path.sep}`)
		)
			continue;
		let value: Record<string, unknown>;
		try {
			value = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
		} catch {
			continue;
		}
		if (typeof value.name !== 'string' || typeof value.version !== 'string') continue;
		const key = `${value.name}@${value.version}`;
		const item = {
			identity: portableRelative(root, file),
			manifestPath: await realpath(file),
			directory: path.dirname(file),
			value,
		};
		const existing = catalog.get(key) ?? [];
		if (!existing.some((candidate) => candidate.manifestPath === item.manifestPath))
			existing.push(item);
		catalog.set(
			key,
			existing.sort((a, b) => a.identity.localeCompare(b.identity)),
		);
	}
	return catalog;
}

async function licenseFields(
	candidates: InstalledManifest[],
): Promise<{ spdxExpression: Record<string, unknown>; licenseText: Record<string, unknown> }> {
	if (candidates.length === 0)
		return {
			spdxExpression: {
				state: 'unknown',
				reason: 'Matching installed manifest unavailable.',
			},
			licenseText: {
				state: 'unknown',
				reason: 'Matching installed license text unavailable.',
			},
		};
	const evidence = await Promise.all(
		candidates.map(async (candidate) => {
			const files = (await readdir(candidate.directory)).filter(isLicenseFilename).sort();
			return {
				id: candidate.identity,
				manifestSha256: sha256(await readFile(candidate.manifestPath)),
				spdxExpression:
					typeof candidate.value.license === 'string' ? candidate.value.license : null,
				licenseTexts: await Promise.all(
					files.map(async (name) => ({
						id: name,
						sha256: sha256(await readFile(path.join(candidate.directory, name))),
					})),
				),
			};
		}),
	);
	if (candidates.length > 1)
		return {
			spdxExpression: { state: 'ambiguous', candidates: evidence },
			licenseText: { state: 'ambiguous', candidates: evidence },
		};
	const candidate = candidates[0];
	const candidateEvidence = evidence[0];
	if (!candidate) throw new Error('Installed manifest candidate disappeared');
	if (!candidateEvidence) throw new Error('Installed manifest evidence disappeared');
	const expression = candidate.value.license;
	const texts = candidateEvidence.licenseTexts;
	const hashes = [...new Set(texts.map((item) => item.sha256))];
	return {
		spdxExpression:
			typeof expression === 'string' &&
			expression.trim() === expression &&
			expression.length > 0
				? {
						state: 'verified',
						value: expression,
						candidateId: candidate.identity,
						manifestSha256: candidateEvidence.manifestSha256,
					}
				: {
						state: 'unknown',
						reason: 'Matching installed manifest has no SPDX expression.',
					},
		licenseText:
			hashes.length === 1
				? {
						state: 'verified',
						candidateId: candidate.identity,
						sha256: hashes[0],
						files: texts.map((item) => item.id),
					}
				: hashes.length === 0
					? { state: 'unknown', reason: 'Matching installed license text unavailable.' }
					: { state: 'ambiguous', candidates: texts },
	};
}

function stateCounts(
	entries: Array<Record<string, unknown>>,
	field: string,
): Record<string, number> {
	const counts: Record<string, number> = { verified: 0, unknown: 0, ambiguous: 0 };
	for (const entry of entries) {
		const evidence = asRecord(entry[field], `license ${field}`);
		const state = asString(evidence.state, `license ${field}.state`);
		if (!(state in counts)) throw new Error(`Unsupported license state: ${state}`);
		counts[state] = (counts[state] ?? 0) + 1;
	}
	return counts;
}

export async function licenseInventory(
	root: string,
	packages: PackageCoordinate[],
	manifests: Array<{ path: string; value: Record<string, unknown> }>,
): Promise<Record<string, unknown>> {
	const entries: Array<Record<string, unknown>> = [];
	for (const { path: manifestPath, value } of manifests) {
		const directory = path.dirname(manifestPath);
		const licenseFile = (await readdir(directory)).find(isLicenseFilename);
		const fields = await licenseFields([
			{
				identity: portableRelative(root, manifestPath),
				manifestPath: await realpath(manifestPath),
				directory,
				value,
			},
		]);
		entries.push({
			name: value.name,
			version: value.version,
			source: path.relative(root, manifestPath),
			spdxExpression: fields.spdxExpression,
			licenseText: licenseFile
				? fields.licenseText
				: { state: 'unknown', reason: 'License text is absent.' },
		});
	}
	const catalog = await installedManifestCatalog(root);
	for (const item of packages) {
		const installedVersion = packageVersionWithoutPeerContext(item.version);
		const fields = await licenseFields(catalog.get(`${item.name}@${installedVersion}`) ?? []);
		entries.push({
			name: item.name,
			version: item.version,
			source: 'pnpm-lock.yaml',
			spdxExpression: fields.spdxExpression,
			licenseText: fields.licenseText,
		});
	}
	return {
		schemaVersion: TRUST_SCHEMA,
		coverage: { workspaceManifests: manifests.length, resolvedPackages: packages.length },
		rootLicenseText: { state: 'unknown', reason: 'No root LICENSE file exists.' },
		summary: {
			spdxExpression: stateCounts(entries, 'spdxExpression'),
			licenseText: stateCounts(entries, 'licenseText'),
		},
		entries,
	};
}

function vulnerabilityReport(
	packages: Array<{ name: string; version: string }>,
	osv: Record<string, unknown>,
	kev: Record<string, unknown>,
	observations: Array<{ kind: string; observedAt: string; sha256: string }>,
	generatedAt: string,
): { report: Record<string, unknown>; freshness: EvidenceState } {
	const observedAt = observations
		.map((item) => item.observedAt)
		.sort((a, b) => a.localeCompare(b))[0];
	if (!observedAt) throw new Error('Vulnerability source observations are absent');
	const age = Date.parse(generatedAt) - Date.parse(observedAt);
	const freshness: EvidenceState =
		age >= 0 && age <= MAX_VULNERABILITY_AGE_MS ? 'verified' : 'stale';
	const results = Array.isArray(osv.results) ? osv.results : [];
	if (results.length !== packages.length)
		throw new Error('OSV batch result count does not match request');
	const known = new Set(
		(Array.isArray(kev.vulnerabilities) ? kev.vulnerabilities : []).flatMap((entry) => {
			const record = asRecord(entry, 'KEV entry');
			return typeof record.cveID === 'string' ? [record.cveID] : [];
		}),
	);
	return {
		freshness,
		report: {
			schemaVersion: TRUST_SCHEMA,
			freshness: {
				state: freshness,
				observedAt,
				maximumAgeDays: 7,
				freshUntil: new Date(
					Date.parse(observedAt) + MAX_VULNERABILITY_AGE_MS,
				).toISOString(),
			},
			packages: packages.map((item, index) => {
				const result = asRecord(results[index] ?? {}, `OSV result ${index}`);
				const vulns = Array.isArray(result.vulns) ? result.vulns : [];
				return {
					...item,
					state: freshness,
					vulnerabilities: vulns.map((value) => {
						const vuln = asRecord(value, 'OSV vulnerability');
						const aliases = Array.isArray(vuln.aliases)
							? vuln.aliases.filter(
									(alias): alias is string => typeof alias === 'string',
								)
							: [];
						return {
							id: vuln.id,
							aliases,
							modified: vuln.modified,
							knownExploited:
								aliases.some((alias) => known.has(alias)) ||
								known.has(String(vuln.id)),
							disposition: {
								state: 'unknown',
								reason: 'No disposition owner or SLA is recorded.',
							},
						};
					}),
				};
			}),
			cisaKev: { entries: known.size, source: CISA_KEV_URL },
			osv: { queries: packages.length, source: OSV_BATCH_URL },
			sourceObservations: observations,
		},
	};
}

function matrix(conformance: CorpusConformance): Record<string, unknown> {
	const verticals = new Map(
		conformance.verticals.map((value) => [asString(value.id, 'corpus vertical id'), value]),
	);
	const maintained = asRecord(
		verticals.get('react-boilerplate-v4-node24'),
		'maintained React conformance',
	);
	const vite8 = asRecord(verticals.get('react-boilerplate-v4-vite8'), 'Vite 8 conformance');
	const dataFlow = asRecord(
		verticals.get('react-boilerplate-v4-data-flow'),
		'React data-flow conformance',
	);
	const reactComposed = asRecord(
		verticals.get('react-boilerplate-v4-composed'),
		'React composed conformance',
	);
	const phonecatRoute = asRecord(
		verticals.get('angular-phonecat-route-resolve'),
		'PhoneCat route conformance',
	);
	const phonecatComposed = asRecord(
		verticals.get('angular-phonecat-composed'),
		'PhoneCat composed conformance',
	);
	const phonecatVite = asRecord(
		verticals.get('angular-phonecat-vite8'),
		'PhoneCat Vite conformance',
	);
	const angularRealworld = asRecord(
		verticals.get('angular-realworld-v15-to-v16'),
		'Angular RealWorld conformance',
	);
	const nextKilledByGoogle = verticals.get('next-killedbygoogle-derived-state-to-memo');
	return {
		schemaVersion: TRUST_SCHEMA,
		derivedFrom: {
			path: 'corpus-conformance.json',
			sha256: conformance.integrity.canonicalDigest,
		},
		cells: [
			{
				id: 'react-boilerplate-v4',
				framework: 'react',
				designatedPilot: false,
				runtime: 'Node 16 EOL compatibility sandbox',
				bundler: 'webpack-4',
				state: 'verified',
				maintainedTarget: 'verified',
				maintainedRuntime: maintained.runtime,
				maintainedBundler: maintained.bundler,
			},
			{
				id: 'react-boilerplate-v4-vite8',
				framework: 'react',
				designatedPilot: false,
				runtime: 'Node 24.15.0 darwin-arm64',
				bundler: 'Vite 8.0.16',
				state: 'verified',
				adapter: vite8.adapter,
				oldVite: vite8.oldVite,
				genericAdapter: vite8.genericAdapter,
				unplugin: vite8.unplugin,
			},
			{
				id: 'react-boilerplate-v4-data-flow',
				framework: 'react',
				designatedPilot: false,
				runtime: dataFlow.runtime,
				bundler: dataFlow.bundler,
				state: 'verified',
				migration: 'connect-to-hooks',
				adapter: dataFlow.adapter,
			},
			{
				id: 'react-boilerplate-v4-composed',
				framework: 'react',
				designatedPilot: false,
				runtime: reactComposed.runtime,
				bundler: reactComposed.bundler,
				state: 'verified',
				migration: 'atomic-composed-connect-to-hooks',
				adapter: reactComposed.adapter,
			},
			{
				id: 'angular-phonecat',
				framework: 'angularjs',
				track: 'angularjs-special-track',
				designatedPilot: false,
				runtime: 'Node 16 legacy / Node 24 target tooling',
				bundler: 'none-static',
				state: 'verified',
				angular2Plus: 'not-applicable',
				angularCliAot: 'not-applicable',
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-phonecat-route-resolve',
				framework: 'angularjs',
				track: phonecatRoute.track,
				designatedPilot: phonecatRoute.designatedPilot,
				runtime: phonecatRoute.runtime,
				bundler: phonecatRoute.bundler,
				state: 'verified',
				routeResolves: phonecatRoute.routeResolves,
				componentBindings: phonecatRoute.componentBindings,
				angular2Plus: phonecatRoute.angular2Plus,
				angularCliAot: phonecatRoute.angularCliAot,
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-phonecat-composed',
				framework: 'angularjs',
				track: phonecatComposed.track,
				designatedPilot: phonecatComposed.designatedPilot,
				runtime: phonecatComposed.runtime,
				bundler: phonecatComposed.bundler,
				state: 'verified',
				composition: phonecatComposed.composition,
				orderIndependent: phonecatComposed.orderIndependent,
				angular2Plus: phonecatComposed.angular2Plus,
				angularCliAot: phonecatComposed.angularCliAot,
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-phonecat-vite8',
				framework: 'angularjs',
				track: phonecatVite.track,
				designatedPilot: phonecatVite.designatedPilot,
				runtime: phonecatVite.runtime,
				bundler: 'Vite 8.0.16',
				state: 'verified',
				adapter: phonecatVite.adapter,
				oldVite: phonecatVite.oldVite,
				genericAdapter: phonecatVite.genericAdapter,
				unplugin: phonecatVite.unplugin,
				serviceWorker: phonecatVite.serviceWorker,
				angular2Plus: phonecatVite.angular2Plus,
				angularCliAot: phonecatVite.angularCliAot,
				adjacentMajor: 'not-applicable',
			},
			{
				id: 'angular-realworld-v15-to-v16',
				framework: 'angular',
				track: angularRealworld.track,
				designatedPilot: false,
				runtime: angularRealworld.runtime,
				bundler: angularRealworld.bundler,
				state: 'verified',
				angular2Plus: angularRealworld.angular2Plus,
				angularCliAot: angularRealworld.angularCliAot,
				adjacentMajor: 'angular-15-to-16-verified',
				locality: angularRealworld.locality,
				productionReadiness: angularRealworld.productionReadiness,
				readinessScoreboard: angularRealworld.readinessScoreboard,
			},
			{
				id: 'takenote',
				framework: 'react',
				designatedPilot: true,
				runtime: 'Node 12/native dependency lane unavailable',
				bundler: 'webpack',
				state: 'not-tested',
				maintainedTarget: 'not-tested',
			},
			{
				id: 'angular2-hn',
				framework: 'angular',
				designatedPilot: true,
				runtime: 'supported Node 12/Yarn or external CI lane unavailable',
				bundler: 'angular-cli',
				state: 'not-tested',
				angular2Plus: 'not-tested',
				angularCliAot: 'not-tested',
				adjacentMajor: 'not-tested',
			},
			{
				id: 'old-vite',
				framework: 'unknown',
				designatedPilot: false,
				runtime: 'unknown',
				bundler: 'vite-old',
				state: 'not-tested',
			},
			...(nextKilledByGoogle
				? [
						{
							id: 'next-killedbygoogle-derived-state-to-memo',
							framework: 'react',
							platform: 'nextjs',
							designatedPilot: false,
							runtime: asRecord(nextKilledByGoogle, 'Killed by Google conformance')
								.runtime,
							bundler: asRecord(nextKilledByGoogle, 'Killed by Google conformance')
								.bundler,
							state: 'verified',
							scope: 'fixture-specific-next12-pages',
							genericNextSupport: 'not-claimed',
						},
					]
				: []),
			...conformance.frameworkLanes.map((lane) => ({
				...lane,
				state: 'not-tested',
				designatedPilot: false,
				productionStack: 'nextjs-preserved-not-tested',
			})),
		],
	};
}

function validatePolicy(value: unknown): Record<string, unknown> {
	const policy = asRecord(value, 'trust policy');
	if (policy.schemaVersion !== 'versionless.trust-policy.v1')
		throw new Error('Unsupported trust policy');
	for (const required of [
		'owner',
		'retention',
		'vulnerabilityDisposition',
		'controls',
		'dataFlows',
	])
		if (!(required in policy)) throw new Error(`Trust policy missing ${required}`);
	return policy;
}

export function validateCycloneDx17(
	value: unknown,
	expected?: {
		workspace: Array<{ name: string; version: string; ref: string; source: string }>;
		packages: PackageCoordinate[];
	},
): void {
	const bom = asRecord(value, 'CycloneDX document');
	if (bom.bomFormat !== 'CycloneDX' || bom.specVersion !== '1.7' || bom.version !== 1)
		throw new Error('CycloneDX 1.7 profile mismatch');
	if (!Array.isArray(bom.components) || !Array.isArray(bom.dependencies))
		throw new Error('CycloneDX components/dependencies missing');
	const refs = new Set<string>();
	const libraries: PackageCoordinate[] = [];
	const applications: Array<{ name: string; version: string; ref: string; source: string }> = [];
	for (const value of bom.components) {
		const component = asRecord(value, 'CycloneDX component');
		const name = asString(component.name, 'CycloneDX component.name');
		const version = asString(component.version, 'CycloneDX component.version');
		validatePackageCoordinate({ name, version }, 'CycloneDX component coordinate');
		const ref = asString(component['bom-ref'], 'CycloneDX component reference');
		if (refs.has(ref))
			throw new Error('CycloneDX component reference is missing or duplicated');
		if (component.type === 'library') {
			const purl = packagePurl(name, version);
			if (component.purl !== purl || ref !== purl)
				throw new Error('CycloneDX npm purl/reference mismatch');
			libraries.push({ name, version });
		} else if (component.type === 'application') {
			if (!workspaceReference.test(ref) || component.purl !== undefined)
				throw new Error('CycloneDX workspace reference is malformed');
			if (!Array.isArray(component.properties))
				throw new Error('CycloneDX workspace properties are missing');
			const properties = new Map(
				component.properties.map((value) => {
					const property = asRecord(value, 'CycloneDX workspace property');
					return [property.name, property.value];
				}),
			);
			if (
				properties.size !== 2 ||
				properties.get('versionless:state') !== 'verified' ||
				typeof properties.get('versionless:source') !== 'string'
			)
				throw new Error('CycloneDX workspace properties are malformed');
			applications.push({
				name,
				version,
				ref,
				source: String(properties.get('versionless:source')),
			});
		} else throw new Error('CycloneDX component type is unsupported');
		refs.add(ref);
	}
	if (bom.dependencies.length !== refs.size) throw new Error('CycloneDX graph omits components');
	for (const value of bom.dependencies) {
		const dependency = asRecord(value, 'CycloneDX dependency');
		if (typeof dependency.ref !== 'string' || !refs.has(dependency.ref))
			throw new Error('CycloneDX dependency has an unknown reference');
		if (
			Array.isArray(dependency.dependsOn) &&
			dependency.dependsOn.some((ref) => !refs.has(ref))
		)
			throw new Error('CycloneDX dependency edge has an unknown target');
	}
	const metadata = asRecord(bom.metadata, 'CycloneDX metadata');
	if (!Array.isArray(metadata.properties)) throw new Error('CycloneDX profile claims missing');
	const properties = new Map(
		metadata.properties.map((value) => {
			const item = asRecord(value, 'CycloneDX metadata property');
			return [item.name, item.value];
		}),
	);
	if (
		properties.get('versionless:validation') !== 'local-profile' ||
		properties.get('versionless:validation-claim') !== 'not-independent-or-official' ||
		properties.get('versionless:graph-model') !== 'complete-resolved-inventory-rooted' ||
		properties.get('versionless:topology') !== 'exact-transitive-topology-not-proven'
	)
		throw new Error('CycloneDX local-profile/topology claim mismatch');
	if (expected) {
		if (bom.components.length !== expected.workspace.length + expected.packages.length)
			throw new Error('CycloneDX inventory count mismatch');
		const actual = canonicalize(
			libraries.sort((a, b) =>
				`${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
			),
		);
		if (actual !== canonicalize(expected.packages))
			throw new Error('CycloneDX resolved inventory does not match pnpm packages');
		const actualWorkspace = applications.sort((a, b) => a.ref.localeCompare(b.ref));
		const expectedWorkspace = [...expected.workspace].sort((a, b) =>
			a.ref.localeCompare(b.ref),
		);
		if (canonicalize(actualWorkspace) !== canonicalize(expectedWorkspace))
			throw new Error('CycloneDX workspace inventory does not match manifests');
	}
}

async function writeJson(file: string, value: unknown): Promise<void> {
	assertSyntheticEvidence(value);
	assertPortableEvidence(value);
	await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function generateTrustPackage(options: GenerateTrustOptions): Promise<TrustManifest> {
	const environment = options.environment ?? process.env;
	if (!options.offline || environment.VERSIONLESS_NETWORK_MODE !== 'offline')
		throw new Error('Trust generation requires --offline and VERSIONLESS_NETWORK_MODE=offline');
	const root = path.resolve(options.rootDir ?? '.');
	const cache = path.resolve(root, options.cacheDir ?? '.versionless/cache/trust');
	const output = path.resolve(root, options.outputDir);
	const generatedAt = options.observedAt ?? new Date().toISOString();
	const ingest = parseIngestRecord(
		JSON.parse(await readFile(path.join(cache, 'ingest.json'), 'utf8')),
	);
	const expectedRequestDigest = sha256(osvRequest(ingest.packages));
	if (ingest.sources[0].requestSha256 !== expectedRequestDigest)
		throw new Error('Cached OSV request digest does not match cached package coordinates');
	for (const source of ingest.sources) {
		const expected = source.kind === 'osv-batch' ? OSV_BATCH_URL : CISA_KEV_URL;
		if (source.url !== expected) throw new Error(`Unexpected cached source URL: ${source.url}`);
		const body = await readFile(path.join(cache, source.responsePath), 'utf8');
		if (sha256(body) !== source.sha256)
			throw new Error(`Cached source digest mismatch: ${source.kind}`);
	}
	const lockText = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
	const packages = lockPackages(lockText);
	if (packages.length === 0) throw new Error('Resolved package inventory is empty');
	if (canonicalize(packages) !== canonicalize(ingest.packages))
		throw new Error('Cached OSV request does not cover the current lockfile');
	const manifestPaths = await workspaceManifestPaths(root);
	const manifests = await Promise.all(
		manifestPaths.map(async (manifestPath) => ({
			path: manifestPath,
			value: JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>,
		})),
	);
	if (manifests.length !== 10)
		throw new Error(`Expected ten workspace manifests, found ${manifests.length}`);
	const aggregate = JSON.parse(
		await readFile(path.join(root, 'evidence/runs/aggregate.json'), 'utf8'),
	);
	const acquisitionPreflightBytes = await readFile(
		path.join(root, NPM_LOCK_ACQUISITION_PREFLIGHT.path),
	);
	validateNpmLockAcquisitionPreflight(acquisitionPreflightBytes);
	assertSyntheticEvidence(aggregate);
	const aggregateRecord = asRecord(aggregate, 'aggregate evidence');
	if (!Array.isArray(aggregateRecord.fixtures))
		throw new Error('Aggregate fixtures must be an array');
	const aggregateFixtures = aggregateRecord.fixtures;
	const transaction = deriveCorpusTransactionState(aggregateFixtures);
	const hasMaintainedReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === MAINTAINED_RECEIPT.path,
		);
	const hasVite8Receipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === VITE8_RECEIPT.path,
		);
	const hasPhonecatRouteReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === PHONECAT_ROUTE_RECEIPT.path,
		);
	const hasPhonecatComposedReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) =>
				asRecord(value, 'aggregate fixture').receipt === PHONECAT_COMPOSED_RECEIPT.path,
		);
	const hasDataFlowReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === DATA_FLOW_RECEIPT.path,
		);
	const hasReactComposedReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === REACT_COMPOSED_RECEIPT.path,
		);
	const hasPhonecatViteReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) => asRecord(value, 'aggregate fixture').receipt === PHONECAT_VITE_RECEIPT.path,
		);
	const hasAngularRealworldReceipt =
		Array.isArray(aggregateRecord.fixtures) &&
		aggregateRecord.fixtures.some(
			(value) =>
				asRecord(value, 'aggregate fixture').receipt === ANGULAR_REALWORLD_RECEIPT.path,
		);
	const hasNextKilledByGoogleReceipt = transaction.nextKilledByGoogleIntegrated;
	const hasWitnessAngularRealworldReceipt = transaction.angularRealworldWitnessIntegrated;
	const receipts = [
		...PRESERVED_RECEIPTS,
		...(hasMaintainedReceipt ? [MAINTAINED_RECEIPT] : []),
		...(hasVite8Receipt ? [VITE8_RECEIPT] : []),
		...(hasPhonecatRouteReceipt ? [PHONECAT_ROUTE_RECEIPT] : []),
		...(hasPhonecatComposedReceipt ? [PHONECAT_COMPOSED_RECEIPT] : []),
		...(hasDataFlowReceipt ? [DATA_FLOW_RECEIPT] : []),
		...(hasReactComposedReceipt ? [REACT_COMPOSED_RECEIPT] : []),
		...(hasPhonecatViteReceipt ? [PHONECAT_VITE_RECEIPT] : []),
		...(hasAngularRealworldReceipt ? [ANGULAR_REALWORLD_RECEIPT] : []),
		...(hasNextKilledByGoogleReceipt ? [NEXT_KILLED_BY_GOOGLE_RECEIPT] : []),
		...(hasWitnessAngularRealworldReceipt ? [WITNESS_ANGULAR_REALWORLD_RECEIPT] : []),
	];
	if (receipts.length !== transaction.receipts)
		throw new Error('Aggregate evidence does not preserve the required receipts');
	const verifiedReceipts = [];
	for (const expected of receipts) {
		const verified =
			expected.path === ANGULAR_REALWORLD_RECEIPT.path
				? await verifyAngularRealworldV15ToV16Evidence(root)
				: expected.path === WITNESS_ANGULAR_REALWORLD_RECEIPT.path
					? await verifyWitnessAngularRealworldEvidence(root)
					: expected.path === NEXT_KILLED_BY_GOOGLE_RECEIPT.path
						? await verifyNextKilledByGoogleEvidence(root, true)
						: await verifyReceipt(path.join(root, expected.path));
		const aggregateFixture = aggregateFixtures.find(
			(value) => asRecord(value, 'aggregate fixture').receipt === expected.path,
		);
		const aggregateDigest = aggregateFixture
			? asString(
					asRecord(aggregateFixture, 'aggregate fixture').digest,
					'aggregate fixture digest',
				)
			: '';
		const expectedDigest = expected.digest ?? aggregateDigest;
		if (verified.digest !== expectedDigest)
			throw new Error(`Preserved receipt digest mismatch: ${expected.path}`);
		verifiedReceipts.push({
			path: expected.path,
			digest: verified.digest,
			artifacts: verified.artifacts,
			state: 'verified' as const,
		});
	}
	const buildFiles = (await filesBelow(path.join(root, 'packages'))).filter((file) =>
		file.includes(`${path.sep}dist${path.sep}`),
	);
	if (buildFiles.length === 0)
		throw new Error('No generated Versionless package artifacts found');
	const buildArtifacts = await Promise.all(
		buildFiles.map(async (file) => ({
			path: path.relative(root, file),
			sha256: sha256(await readFile(file)),
		})),
	);
	const policy = validatePolicy(
		JSON.parse(await readFile(path.resolve(root, options.policyPath), 'utf8')),
	);
	assertSyntheticEvidence(policy);
	const graph = await dependencyGraph(root, lockText, manifests);
	validateCycloneDx17(graph, {
		workspace: manifests.map((item) => ({
			name: String(item.value.name),
			version: String(item.value.version),
			ref: `workspace:${path.dirname(path.relative(root, item.path)) || '.'}`,
			source: path.relative(root, item.path),
		})),
		packages,
	});
	if ((graph.components as unknown[]).length !== packages.length + manifests.length)
		throw new Error('CycloneDX graph does not cover every resolved and workspace package');
	const licenses = await licenseInventory(root, packages, manifests);
	const osv = JSON.parse(await readFile(path.join(cache, 'osv.json'), 'utf8')) as Record<
		string,
		unknown
	>;
	const kev = JSON.parse(await readFile(path.join(cache, 'cisa-kev.json'), 'utf8')) as Record<
		string,
		unknown
	>;
	const vulnerability = vulnerabilityReport(
		packages,
		osv,
		kev,
		ingest.sources.map((source) => ({
			kind: source.kind,
			observedAt: source.observedAt,
			sha256: source.sha256,
		})),
		generatedAt,
	);
	vulnerability.report.ingest = {
		schemaVersion: ingest.schemaVersion,
		purpose: ingest.purpose,
		consent: ingest.consent,
		sources: ingest.sources,
	};
	const conformance = await analyzeCorpusConformance({ rootDir: root });
	const scriptSurface = await verifyScriptSurface({ rootDir: root, environment });
	const runtimeObservationConfig = parseRuntimeObservationConfig(
		JSON.parse(
			await readFile(path.join(root, 'trust/runtime-script-observation.json'), 'utf8'),
		),
	);
	const runtimeScriptObservation = (await verifyRuntimeScriptObservationEvidence(
		JSON.parse(
			await readFile(
				path.join(
					root,
					'evidence/runtime-script-observation/current/runtime-script-observation.json',
				),
				'utf8',
			),
		),
		{ rootDir: root, config: runtimeObservationConfig, surface: scriptSurface },
	)) as RuntimeScriptObservation;
	const corpus = matrix(conformance);
	const provenance = {
		_type: 'https://in-toto.io/Statement/v1',
		subject: buildArtifacts.map((item) => ({
			name: item.path,
			digest: { sha256: item.sha256 },
		})),
		predicateType: 'https://slsa.dev/provenance/v1',
		predicate: {
			buildDefinition: {
				buildType: 'https://versionless.dev/trust/local-v1',
				externalParameters: { policy: options.policyPath, networkMode: 'offline' },
				internalParameters: {
					state: 'not-applicable',
					reason: 'No hidden parameters are asserted.',
				},
				resolvedDependencies: [
					{ uri: 'pnpm-lock.yaml', digest: { sha256: sha256(lockText) } },
					{
						uri: 'evidence/runs/aggregate.json',
						digest: {
							sha256: sha256(
								await readFile(path.join(root, 'evidence/runs/aggregate.json')),
							),
						},
					},
					{
						uri: NPM_LOCK_ACQUISITION_PREFLIGHT.path,
						digest: { sha256: NPM_LOCK_ACQUISITION_PREFLIGHT.sha256 },
					},
					...(await Promise.all(
						manifests.map(async (item) => ({
							uri: path.relative(root, item.path),
							digest: { sha256: sha256(await readFile(item.path)) },
						})),
					)),
					...verifiedReceipts.map((item) => ({
						uri: item.path,
						digest: { sha256: item.digest },
					})),
				],
			},
			runDetails: {
				builder: { id: 'versionless-local-trust-generator', state: 'verified' },
				metadata: {
					invocationId: 'not-applicable',
					startedOn: 'not-applicable',
					finishedOn: 'not-applicable',
				},
				byproducts: buildArtifacts,
			},
		},
		claims: {
			slsaLevel: 'not-claimed',
			signerAuthenticity: 'unknown',
			gitProvenance: 'unknown',
			aggregateFixtures: aggregateFixtures.length,
		},
	};
	const controls = {
		schemaVersion: TRUST_SCHEMA,
		policy,
		securityPolicy: { state: 'unknown', reason: 'SECURITY.md is absent.' },
		gitProvenance: { state: 'unknown', reason: 'Git metadata is absent.' },
		signingIdentity: { state: 'unknown', reason: 'No project signing identity is designated.' },
		locality: {
			state: 'verified',
			scope: 'Versionless-spawned processes and browser routing',
			osWideIsolation: false,
		},
		scriptSurface: {
			state: 'verified',
			scope: 'eighteen exact static deployment entrypoints',
			excludedVerticals: ['angular-realworld-v15-to-v16'],
			exclusionReason: 'T220 static script surface was not separately observed.',
			paymentPageApplicability: 'not-established',
			dynamicScriptInsertion: 'not-tested',
			pciCompliance: 'not-claimed',
		},
		runtimeScriptObservation: {
			state: 'verified',
			scope: 'exact qualified journeys',
			excludedVerticals: ['angular-realworld-v15-to-v16'],
			exclusionReason: 'T220 qualified runtime scripts were not separately observed.',
			globalDynamicInsertionCoverage: 'not-established',
			paymentPageApplicability: 'not-established',
			pciCompliance: 'not-claimed',
		},
	};
	const retention = {
		schemaVersion: TRUST_SCHEMA,
		retention: policy.retention,
		purgeStatus: {
			state: 'not-tested',
			reason: 'No approved retention duration or purge exercise exists.',
		},
	};
	await mkdir(output, { recursive: true });
	const deterministic: Array<[string, unknown]> = [
		['dependency-graph.cdx.json', graph],
		['licenses.json', licenses],
		['vulnerabilities.json', vulnerability.report],
		['provenance.json', provenance],
		['matrix.json', corpus],
		['controls.json', controls],
		['retention.json', retention],
		['corpus-conformance.json', conformance],
		['script-surface.json', scriptSurface],
		['runtime-script-observation.json', runtimeScriptObservation],
	];
	for (const [name, value] of deterministic) await writeJson(path.join(output, name), value);
	const artifacts: ManifestArtifact[] = await Promise.all(
		deterministic.map(async ([name]) => ({
			path: name,
			sha256: sha256(await readFile(path.join(output, name))),
		})),
	);
	const coreDigest = sha256(canonicalize({ artifacts, receipts: verifiedReceipts }));
	const trustManifest: TrustManifest = {
		schemaVersion: TRUST_SCHEMA,
		canonicalDigest: '',
		integrity: {
			algorithm: 'sha256',
			authenticity: 'not-established',
			certification: 'not-claimed',
		},
		deterministicCore: { algorithm: 'sha256', digest: coreDigest, artifacts },
		receipts: verifiedReceipts,
		observation: { generatedAt, vulnerabilityFreshness: vulnerability.freshness },
		derivedReport: 'report.md',
	};
	trustManifest.canonicalDigest = sha256(canonicalize(trustManifest));
	await writeJson(path.join(output, 'manifest.json'), trustManifest);
	const report = renderTrustReport({
		manifest: trustManifest,
		licenses,
		vulnerabilities: vulnerability.report,
		matrix: corpus,
		controls,
		conformance,
		scriptSurface,
		runtimeScriptObservation,
		transaction,
	});
	await writeFile(path.join(output, 'report.md'), report);
	return trustManifest;
}
