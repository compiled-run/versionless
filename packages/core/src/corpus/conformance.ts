import { readFile } from 'node:fs/promises';
import { charIn, createRegExp } from 'magic-regexp';
import * as path from 'pathe';
import { normalizeURL, parseURL } from 'ufo';
import { canonicalize, sha256 } from '../receipts/canonicalize.ts';
import {
	parseMigrationReceipt,
	REACT_COMPOSED_CHANGED_FILES,
	REACT_COMPOSED_EXECUTION_TRACES,
	REACT_COMPOSED_SOURCE_HASHES,
	REACT_COMPOSED_TARGET_HASHES,
	type MigrationReceipt,
} from '../receipts/schema.ts';
import { verifyReceipt } from '../receipts/verify.ts';
import {
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT,
	verifyAngularRealworldV15ToV16Evidence,
} from '../receipts/angular-realworld-v15-to-v16.ts';
import {
	NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	nextKilledByGoogleAggregateMember,
	verifyNextKilledByGoogleEvidence,
} from '../receipts/next-killedbygoogle.ts';
import {
	WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
	verifyWitnessAngularRealworldEvidence,
	witnessAngularRealworldAggregateMember,
} from '../receipts/witness-angular-realworld.ts';
import {
	REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
	WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
	verifyWitnessReactBoilerplateEvidence,
	witnessReactBoilerplateAggregateMember,
} from '../receipts/witness-react-boilerplate.ts';
import {
	WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
	verifyWitnessNextKilledByGoogleEvidence,
	witnessNextKilledByGoogleAggregateMember,
} from '../receipts/witness-next-killedbygoogle.ts';
import {
	REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH,
	reactAvataaarsCompatibilityAggregateMember,
	verifyReactAvataaarsCompatibilityEvidence,
} from '../receipts/react-avataaars-compatibility.ts';
import {
	REACT_CALCULATOR_RECEIPT_PATH,
	reactCalculatorAggregateMember,
	verifyReactCalculatorEvidence,
} from '../receipts/react-calculator.ts';
import {
	REACT_GRAPHIQL_013_RECEIPT_PATH,
	reactGraphiQL013AggregateMember,
	verifyReactGraphiQL013Evidence,
} from '../receipts/react-graphiql-013.ts';
import {
	WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
	verifyWitnessReactBoilerplateZeroSwEvidence,
	witnessReactBoilerplateZeroSwAggregateMember,
} from '../receipts/react-boilerplate-zero-sw.ts';

export const CORPUS_CONFORMANCE_SCHEMA = 'versionless.corpus-conformance.v1' as const;
const REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH =
	'evidence/runs/react-boilerplate-v4-zero-sw/t693-run.json' as const;

export const NEXTJS_SYNTHETIC_NOT_TESTED_LANES = [
	{ id: 'synthetic-next12-pages', nextLane: '12', routing: 'pages' },
	{ id: 'synthetic-next13-transition-app', nextLane: '13', routing: 'mixed' },
	{ id: 'synthetic-next14-app', nextLane: '14', routing: 'app' },
].map((lane) => ({
	...lane,
	framework: 'nextjs' as const,
	synthetic: true as const,
	provenance: 'not-tested' as const,
	migration: 'not-tested' as const,
	build: 'not-tested' as const,
	browser: 'not-tested' as const,
	locality: 'not-tested' as const,
	compilerBundlerRuntime: 'not-tested' as const,
	tier: 'not-tested' as const,
	pilot: 'not-tested' as const,
	support: 'not-tested' as const,
}));

const sha256Pattern = createRegExp(
	charIn('0123456789').from('a', 'f').times(64).at.lineStart().at.lineEnd(),
);

const canonicalReceipts = [
	{
		id: 'react-boilerplate-v4',
		path: 'evidence/runs/react-boilerplate-v4/t008-run.json',
		digest: '4d32ae0a46041e5ec2ac68aa31a9b8f86bd9d294d312ce41968ddd99dc5ee758',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'webpack 4.30.0',
		runtime: 'Node 16.20.2 EOL compatibility sandbox',
	},
	{
		id: 'angular-phonecat',
		path: 'evidence/runs/angular-phonecat/t014-run.json',
		digest: 'a6798081c0b005c76534b5acd4dc647d77d497b0b649748c685b779451035f51',
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static',
		runtime: 'Node 16 legacy / Node 24 target tooling',
	},
	{
		id: 'react-boilerplate-v4-node24',
		path: 'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
		digest: '815a5416b90c0a0c0a2f0adb779308c0ba0447d67c965003f15d343940d9b593',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'webpack 4.47.0',
		runtime: 'Node 24.15.0 darwin-arm64',
	},
	{
		id: 'react-boilerplate-v4-vite8',
		path: 'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
		digest: '1caf9dfa24b14b83ac63ceab9ca90829346045aac690c7b95a952ae4d9e72849',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'Vite 8.0.16',
		runtime: 'Node 24.15.0 darwin-arm64',
	},
	{
		id: 'angular-phonecat-route-resolve',
		path: 'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
		digest: 'aa8b2923a38aa5f1adc870b48cdd938b739e107c927aac71b8c2890705f6beef',
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static',
		runtime: 'Node 16 legacy / Node 24 target tooling',
	},
	{
		id: 'angular-phonecat-composed',
		path: 'evidence/runs/angular-phonecat-composed/t048-run.json',
		digest: null,
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static',
		runtime: 'Node 16 legacy / Node 24 target tooling',
	},
	{
		id: 'react-boilerplate-v4-data-flow',
		path: 'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
		digest: '2bd6e145d611fb0bb5fb89c9d6ed164a3b30e9c0b1b2a290032f56908e5035da',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'Vite 8.0.16',
		runtime: 'Node 24.15.0 darwin-arm64',
	},
	{
		id: 'react-boilerplate-v4-composed',
		path: 'evidence/runs/react-boilerplate-v4-composed/t060-run.json',
		digest: '52400147929220935a9ebe47a16c8dff50b5c28e9d51c930d000c99c2bdc8a21',
		application: 'react-boilerplate',
		framework: 'react',
		bundler: 'webpack 4.30.0 / Vite 8.0.16',
		runtime: 'Node 16.20.2 legacy / Node 24.15.0 target',
	},
	{
		id: 'angular-phonecat-vite8',
		path: 'evidence/runs/angular-phonecat-vite8/t069-run.json',
		digest: '033fc40237975e28df36117cc309625632610a399b5c0f88735079ed21fcad0d',
		application: 'angular-phonecat',
		framework: 'angularjs',
		bundler: 'none-static / Vite 8.0.16',
		runtime: 'Node 16.20.2 legacy / Node 24.15.0 target',
	},
] as const;

const orderedPrepublicationReceipts = [
	'evidence/runs/react-boilerplate-v4/t008-run.json',
	'evidence/runs/angular-phonecat/t014-run.json',
	'evidence/runs/react-boilerplate-v4-node24/t022-run.json',
	'evidence/runs/angular-phonecat-route-resolve/t032-run.json',
	'evidence/runs/angular-phonecat-composed/t048-run.json',
	'evidence/runs/react-boilerplate-v4-vite8/t028-run.json',
	'evidence/runs/angular-phonecat-vite8/t069-run.json',
	ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
	'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json',
	REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH,
] as const;

function assertOrderedAggregate(
	actual: string[],
	expected: readonly string[],
	label: string,
): void {
	if (canonicalize(actual) !== canonicalize(expected))
		throw new Error(`${label} aggregate receipt order differs`);
}

type CanonicalReceipt = (typeof canonicalReceipts)[number];

interface CorpusConformanceOptions {
	rootDir?: string;
}

interface JourneyProjection {
	result: string;
	selectedLocale: string;
	translatedHeading: string;
}

export interface CorpusConformance {
	schemaVersion: typeof CORPUS_CONFORMANCE_SCHEMA;
	summary: {
		verticals: 10 | 11 | 12;
		sourceApplications: 3 | 4 | 5;
		designatedPilotsVerified: 0;
	};
	verticals: Array<Record<string, unknown>>;
	applications: Array<Record<string, unknown>>;
	frameworkLanes: Array<Record<string, unknown>>;
	coverage: Record<string, unknown>;
	integrity: { algorithm: 'sha256'; canonicalDigest: string };
}

export type CorpusTransactionState = Readonly<
	| {
			kind: 'prepublication';
			nextKilledByGoogleIntegrated: false;
			angularRealworldWitnessIntegrated: false;
			reactBoilerplateWitnessIntegrated: false;
			nextKilledByGoogleWitnessIntegrated: false;
			verticals: 10;
			sourceApplications: 3;
			receipts: 10;
			resolvedDependencies: 23;
	  }
	| {
			kind: 'postintegration';
			nextKilledByGoogleIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 11;
			resolvedDependencies: 24;
			angularRealworldWitnessIntegrated: false;
			reactBoilerplateWitnessIntegrated: false;
			nextKilledByGoogleWitnessIntegrated: false;
	  }
	| {
			kind: 'production-readiness';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 12;
			resolvedDependencies: 25;
			reactBoilerplateWitnessIntegrated: false;
			nextKilledByGoogleWitnessIntegrated: false;
	  }
	| {
			kind: 'react-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 13;
			resolvedDependencies: 26;
			nextKilledByGoogleWitnessIntegrated: false;
	  }
	| {
			kind: 'next-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 14;
			resolvedDependencies: 27;
	  }
	| {
			kind: 'react-zero-sw-reconciliation';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 16;
			resolvedDependencies: 29;
	  }
	| {
			kind: 'react-avataaars-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 11;
			sourceApplications: 4;
			receipts: 15;
			resolvedDependencies: 28;
	  }
	| {
			kind: 'react-calculator-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 12;
			sourceApplications: 5;
			receipts: 15;
			resolvedDependencies: 28;
	  }
	| {
			kind: 'react-graphiql-013-candidate';
			nextKilledByGoogleIntegrated: true;
			angularRealworldWitnessIntegrated: true;
			reactBoilerplateWitnessIntegrated: true;
			nextKilledByGoogleWitnessIntegrated: true;
			verticals: 12;
			sourceApplications: 5;
			receipts: 15;
			resolvedDependencies: 28;
	  }
>;

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Corpus conformance ${label} must be an object`);
	return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0)
		throw new Error(`Corpus conformance ${label} must be a non-empty string`);
	return value;
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8'));
}

function sourceIdentity(receipt: MigrationReceipt): Record<string, string> {
	const parsed = parseURL(receipt.source.repository);
	if (parsed.protocol !== 'https:' || !parsed.host || !parsed.pathname)
		throw new Error(
			`Corpus source repository is not a canonical HTTPS URL: ${receipt.fixture}`,
		);
	return {
		repository: normalizeURL(receipt.source.repository),
		revision: receipt.source.revision,
		archiveSha256: receipt.source.archiveSha256,
		license: receipt.source.license,
		licenseSha256: receipt.source.licenseSha256,
	};
}

function keys(value: Record<string, unknown>): string[] {
	return Object.keys(value).sort();
}

function uniqueCanonical<T>(values: T[]): T[] {
	const found = new Map(values.map((value) => [canonicalize(value), value]));
	return [...found.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([, value]) => value);
}

function journeyArtifact(receipt: MigrationReceipt): { path: string; sha256: string } {
	const artifact = receipt.artifacts.find((item) => path.basename(item.path) === 'journey.json');
	if (!artifact) throw new Error(`Corpus receipt omits journey artifact: ${receipt.fixture}`);
	return artifact;
}

function reactProjection(value: unknown, fixture: string): JourneyProjection {
	const item = record(value, `${fixture} journey row`);
	return {
		result: string(item.result, `${fixture} journey result`),
		selectedLocale: string(item.selectedLocale, `${fixture} selected locale`),
		translatedHeading: string(item.translatedHeading, `${fixture} translated heading`),
	};
}

function blockedUrls(value: unknown, fixture: string): string[] {
	const blocked = record(value, `${fixture} journey row`).blocked;
	if (!Array.isArray(blocked)) throw new Error(`Corpus ${fixture} blocked observation missing`);
	return blocked.map((item) => normalizeURL(string(item, `${fixture} blocked URL`))).sort();
}

function receiptShape(receipt: MigrationReceipt, journey: unknown[]): Record<string, unknown> {
	const migration = receipt.migration as unknown as Record<string, unknown>;
	return {
		schemaVersion: receipt.schemaVersion,
		toolingFields: keys(receipt.tooling),
		migrationFields: keys(migration),
		journeyFields: uniqueCanonical(
			journey.map((value) => keys(record(value, `${receipt.fixture} journey row`))),
		),
	};
}

function assertAggregateFixture(
	value: unknown,
	expected: CanonicalReceipt,
): Record<string, unknown> {
	const fixture = record(value, `aggregate fixture ${expected.id}`);
	if (
		fixture.id !== expected.id ||
		fixture.receipt !== expected.path ||
		(expected.digest !== null && fixture.digest !== expected.digest) ||
		fixture.result !== 'pass' ||
		fixture.framework !== expected.framework ||
		(expected.id === 'angular-phonecat-vite8' &&
			(fixture.bundler !== 'none-static-to-vite-8' ||
				fixture.track !== 'angularjs-special-track' ||
				fixture.runtime !== 'node-16-to-node-24.15.0'))
	)
		throw new Error(`Aggregate membership mismatch: ${expected.id}`);
	return fixture;
}

export function deriveCorpusTransactionState(fixtures: unknown): CorpusTransactionState {
	if (!Array.isArray(fixtures)) throw new Error('Aggregate fixtures must be an array');
	const byPath = new Map<string, unknown>();
	const orderedPaths: string[] = [];
	for (const value of fixtures) {
		const fixture = record(value, 'aggregate fixture');
		const receiptPath = string(fixture.receipt, 'aggregate receipt path');
		if (byPath.has(receiptPath))
			throw new Error('Aggregate membership contains duplicate receipts');
		byPath.set(receiptPath, value);
		orderedPaths.push(receiptPath);
	}
	for (const expected of canonicalReceipts) {
		const value = byPath.get(expected.path);
		if (!value) throw new Error(`Aggregate is missing receipt: ${expected.path}`);
		assertAggregateFixture(value, expected);
		const digest = record(value, `aggregate fixture ${expected.id}`).digest;
		if (typeof digest !== 'string' || !sha256Pattern.test(digest))
			throw new Error(`Aggregate digest is invalid: ${expected.id}`);
	}
	const angular = byPath.get(ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path);
	if (
		!angular ||
		canonicalize(record(angular, 'Angular RealWorld aggregate fixture')) !==
			canonicalize({
				id: 'angular-realworld-v15-to-v16',
				framework: 'angular',
				track: 'angular2-plus-adjacent-major',
				bundler: 'angular-cli-architect-aot-15-to-16',
				runtime: 'node-18.20.8',
				result: 'pass',
				receipt: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
				digest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
			})
	)
		throw new Error('Angular RealWorld aggregate membership mismatch');
	const next = byPath.get(NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH);
	if (next) {
		const nextRecord = record(next, 'Killed by Google aggregate fixture');
		const digest = string(nextRecord.digest, 'Killed by Google aggregate digest');
		if (
			!sha256Pattern.test(digest) ||
			canonicalize(nextRecord) !== canonicalize(nextKilledByGoogleAggregateMember(digest))
		)
			throw new Error('Killed by Google aggregate membership mismatch');
		const witness = byPath.get(WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH);
		if (witness) {
			const witnessRecord = record(witness, 'Witness Angular RealWorld aggregate fixture');
			const witnessDigest = string(
				witnessRecord.digest,
				'Witness Angular RealWorld aggregate digest',
			);
			if (
				!sha256Pattern.test(witnessDigest) ||
				canonicalize(witnessRecord) !==
					canonicalize(witnessAngularRealworldAggregateMember(witnessDigest))
			)
				throw new Error('Witness Angular RealWorld aggregate membership mismatch');
			const react = byPath.get(WITNESS_REACT_BOILERPLATE_RECEIPT_PATH);
			if (react) {
				const reactRecord = record(react, 'Witness React Boilerplate aggregate fixture');
				const reactDigest = string(
					reactRecord.digest,
					'Witness React Boilerplate aggregate digest',
				);
				if (
					!sha256Pattern.test(reactDigest) ||
					canonicalize(reactRecord) !==
						canonicalize(witnessReactBoilerplateAggregateMember(reactDigest))
				)
					throw new Error('Witness React Boilerplate aggregate membership mismatch');
				const nextWitness = byPath.get(WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH);
				if (nextWitness) {
					const nextWitnessRecord = record(
						nextWitness,
						'Witness Next KilledByGoogle aggregate fixture',
					);
					const nextWitnessDigest = string(
						nextWitnessRecord.digest,
						'Witness Next KilledByGoogle aggregate digest',
					);
					if (
						!sha256Pattern.test(nextWitnessDigest) ||
						canonicalize(nextWitnessRecord) !==
							canonicalize(
								witnessNextKilledByGoogleAggregateMember(nextWitnessDigest),
							)
					)
						throw new Error(
							'Witness Next KilledByGoogle aggregate membership mismatch',
						);
					const avataaars = byPath.get(REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH);
					const calculator = byPath.get(REACT_CALCULATOR_RECEIPT_PATH);
					const graphiql = byPath.get(REACT_GRAPHIQL_013_RECEIPT_PATH);
					const candidateOrder = [
						...orderedPrepublicationReceipts.slice(0, 8),
						WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
						NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
						...orderedPrepublicationReceipts.slice(8),
						WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
						WITNESS_NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
					];
					const zeroSw = byPath.get(WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH);
					if (zeroSw) {
						const zeroSwMigration = byPath.get(REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH);
						const zeroSwRecord = record(
							zeroSw,
							'React Boilerplate zero-SW aggregate fixture',
						);
						const digest = string(
							zeroSwRecord.digest,
							'React Boilerplate zero-SW aggregate digest',
						);
						if (
							zeroSwMigration === undefined ||
							canonicalize(
								record(
									zeroSwMigration,
									'React Boilerplate zero-SW migration aggregate fixture',
								),
							) !==
								canonicalize({
									id: 'react-boilerplate-v4-zero-sw',
									framework: 'react',
									track: 'current-zero-service-worker-policy-reconciliation',
									bundler: 'webpack-4.30.0-to-vite-8.0.16',
									runtime: 'node-16.20.2-to-node-24.15.0',
									result: 'pass',
									receipt: REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
									digest: record(
										zeroSwMigration,
										'React Boilerplate zero-SW migration aggregate fixture',
									).digest,
								}) ||
							!sha256Pattern.test(digest) ||
							canonicalize(zeroSwRecord) !==
								canonicalize(
									witnessReactBoilerplateZeroSwAggregateMember(digest),
								) ||
							byPath.size !== canonicalReceipts.length + 7
						)
							throw new Error(
								'React Boilerplate zero-SW aggregate membership mismatch',
							);
						assertOrderedAggregate(
							orderedPaths,
							[
								...candidateOrder,
								REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
								WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH,
							],
							'React zero-SW reconciliation',
						);
						return {
							kind: 'react-zero-sw-reconciliation',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 11,
							sourceApplications: 4,
							receipts: 16,
							resolvedDependencies: 29,
						};
					}
					if (avataaars) {
						const avataaarsRecord = record(
							avataaars,
							'React Avataaars aggregate fixture',
						);
						const digest = string(
							avataaarsRecord.digest,
							'React Avataaars aggregate digest',
						);
						if (
							canonicalize(avataaarsRecord) !==
								canonicalize(reactAvataaarsCompatibilityAggregateMember(digest)) ||
							byPath.size !== canonicalReceipts.length + 6
						)
							throw new Error('React Avataaars aggregate membership mismatch');
						assertOrderedAggregate(
							orderedPaths,
							[...candidateOrder, REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH],
							'React Avataaars candidate',
						);
						return {
							kind: 'react-avataaars-candidate',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 11,
							sourceApplications: 4,
							receipts: 15,
							resolvedDependencies: 28,
						};
					}
					if (calculator) {
						const calculatorRecord = record(
							calculator,
							'React Calculator aggregate fixture',
						);
						const digest = string(
							calculatorRecord.digest,
							'React Calculator aggregate digest',
						);
						if (
							canonicalize(calculatorRecord) !==
								canonicalize(reactCalculatorAggregateMember(digest)) ||
							byPath.size !== canonicalReceipts.length + 6
						)
							throw new Error('React Calculator aggregate membership mismatch');
						assertOrderedAggregate(
							orderedPaths,
							[...candidateOrder, REACT_CALCULATOR_RECEIPT_PATH],
							'React Calculator candidate',
						);
						return {
							kind: 'react-calculator-candidate',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 12,
							sourceApplications: 5,
							receipts: 15,
							resolvedDependencies: 28,
						};
					}
					if (graphiql) {
						const graphiqlRecord = record(graphiql, 'React GraphiQL aggregate fixture');
						const digest = string(
							graphiqlRecord.digest,
							'React GraphiQL aggregate digest',
						);
						if (
							canonicalize(graphiqlRecord) !==
								canonicalize(reactGraphiQL013AggregateMember(digest)) ||
							byPath.size !== canonicalReceipts.length + 6
						)
							throw new Error('React GraphiQL aggregate membership mismatch');
						assertOrderedAggregate(
							orderedPaths,
							[...candidateOrder, REACT_GRAPHIQL_013_RECEIPT_PATH],
							'React GraphiQL candidate',
						);
						return {
							kind: 'react-graphiql-013-candidate',
							nextKilledByGoogleIntegrated: true,
							angularRealworldWitnessIntegrated: true,
							reactBoilerplateWitnessIntegrated: true,
							nextKilledByGoogleWitnessIntegrated: true,
							verticals: 12,
							sourceApplications: 5,
							receipts: 15,
							resolvedDependencies: 28,
						};
					}
					if (byPath.size !== canonicalReceipts.length + 5)
						throw new Error(
							'Witness Next KilledByGoogle aggregate membership mismatch',
						);
					assertOrderedAggregate(orderedPaths, candidateOrder, 'Next candidate');
					return {
						kind: 'next-candidate',
						nextKilledByGoogleIntegrated: true,
						angularRealworldWitnessIntegrated: true,
						reactBoilerplateWitnessIntegrated: true,
						nextKilledByGoogleWitnessIntegrated: true,
						verticals: 11,
						sourceApplications: 4,
						receipts: 14,
						resolvedDependencies: 27,
					};
				}
				if (
					byPath.size !== canonicalReceipts.length + 4 ||
					orderedPaths.at(-1) !== WITNESS_REACT_BOILERPLATE_RECEIPT_PATH ||
					!orderedPaths.includes(REACT_BOILERPLATE_CANONICAL_RECEIPT_PATH)
				)
					throw new Error('Witness React Boilerplate aggregate membership mismatch');
				assertOrderedAggregate(
					orderedPaths,
					[
						...orderedPrepublicationReceipts.slice(0, 8),
						WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
						NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
						...orderedPrepublicationReceipts.slice(8),
						WITNESS_REACT_BOILERPLATE_RECEIPT_PATH,
					],
					'React candidate',
				);
				return {
					kind: 'react-candidate',
					nextKilledByGoogleIntegrated: true,
					angularRealworldWitnessIntegrated: true,
					reactBoilerplateWitnessIntegrated: true,
					verticals: 11,
					sourceApplications: 4,
					receipts: 13,
					resolvedDependencies: 26,
					nextKilledByGoogleWitnessIntegrated: false,
				};
			}
			if (byPath.size !== canonicalReceipts.length + 3)
				throw new Error(
					'Production-readiness aggregate must contain exactly twelve receipts',
				);
			assertOrderedAggregate(
				orderedPaths,
				[
					...orderedPrepublicationReceipts.slice(0, 8),
					WITNESS_ANGULAR_REALWORLD_RECEIPT_PATH,
					NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
					...orderedPrepublicationReceipts.slice(8),
				],
				'Production-readiness',
			);
			return {
				kind: 'production-readiness',
				nextKilledByGoogleIntegrated: true,
				angularRealworldWitnessIntegrated: true,
				verticals: 11,
				sourceApplications: 4,
				receipts: 12,
				resolvedDependencies: 25,
				reactBoilerplateWitnessIntegrated: false,
				nextKilledByGoogleWitnessIntegrated: false,
			};
		}
		if (byPath.size !== canonicalReceipts.length + 2)
			throw new Error(
				'Postintegration aggregate must contain exactly eleven canonical receipts',
			);
		assertOrderedAggregate(
			orderedPaths,
			[
				...orderedPrepublicationReceipts.slice(0, 8),
				NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
				...orderedPrepublicationReceipts.slice(8),
			],
			'Postintegration',
		);
		return {
			kind: 'postintegration',
			nextKilledByGoogleIntegrated: true,
			angularRealworldWitnessIntegrated: false,
			reactBoilerplateWitnessIntegrated: false,
			nextKilledByGoogleWitnessIntegrated: false,
			verticals: 11,
			sourceApplications: 4,
			receipts: 11,
			resolvedDependencies: 24,
		};
	}
	if (byPath.size !== canonicalReceipts.length + 1)
		throw new Error('Prepublication aggregate must contain exactly ten canonical receipts');
	assertOrderedAggregate(orderedPaths, orderedPrepublicationReceipts, 'Prepublication');
	return {
		kind: 'prepublication',
		nextKilledByGoogleIntegrated: false,
		angularRealworldWitnessIntegrated: false,
		reactBoilerplateWitnessIntegrated: false,
		nextKilledByGoogleWitnessIntegrated: false,
		verticals: 10,
		sourceApplications: 3,
		receipts: 10,
		resolvedDependencies: 23,
	};
}

export async function analyzeCorpusConformance(
	options: CorpusConformanceOptions = {},
): Promise<CorpusConformance> {
	const root = path.resolve(options.rootDir ?? '.');
	const aggregate = record(
		await readJson(path.join(root, 'evidence/runs/aggregate.json')),
		'aggregate',
	);
	const transaction = deriveCorpusTransactionState(aggregate.fixtures);
	const aggregateByPath = new Map(
		(aggregate.fixtures as unknown[]).map((value) => {
			const fixture = record(value, 'aggregate fixture');
			return [string(fixture.receipt, 'aggregate receipt path'), value];
		}),
	);
	const nextKilledByGoogleDigest = transaction.nextKilledByGoogleIntegrated
		? string(
				record(
					aggregateByPath.get(NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH),
					'Killed by Google aggregate fixture',
				).digest,
				'Killed by Google aggregate digest',
			)
		: null;

	const inspected = [];
	for (const expected of canonicalReceipts) {
		const aggregateFixture = aggregateByPath.get(expected.path);
		if (!aggregateFixture) throw new Error(`Aggregate is missing receipt: ${expected.path}`);
		assertAggregateFixture(aggregateFixture, expected);
		const file = path.join(root, expected.path);
		const verified = await verifyReceipt(file);
		const aggregateDigest = string(
			record(aggregateFixture, `aggregate fixture ${expected.id}`).digest,
			`aggregate digest ${expected.id}`,
		);
		const expectedDigest = expected.digest ?? aggregateDigest;
		if (
			verified.digest !== expectedDigest ||
			aggregateDigest !== expectedDigest ||
			!sha256Pattern.test(verified.digest)
		)
			throw new Error(`Canonical receipt digest mismatch: ${expected.path}`);
		const receipt = parseMigrationReceipt(await readJson(file));
		if (receipt.fixture !== expected.id)
			throw new Error(`Receipt fixture identity mismatch: ${expected.path}`);
		const journeyRef = journeyArtifact(receipt);
		const journey = await readJson(path.join(root, journeyRef.path));
		if (!Array.isArray(journey) || journey.length === 0)
			throw new Error(`Corpus journey is empty: ${expected.id}`);
		if (
			[
				'react-boilerplate-v4-vite8',
				'react-boilerplate-v4-data-flow',
				'react-boilerplate-v4-composed',
			].includes(expected.id)
		) {
			const receiptWorker = receipt.verification.serviceWorker;
			if (
				!receiptWorker ||
				receiptWorker.cacheName !==
					`versionless-react-vite8-${receiptWorker.manifestSha256}` ||
				receiptWorker.currentCacheOnly !== true ||
				receiptWorker.inventoryMatchesManifest !== true ||
				receiptWorker.exactCurrentCacheFetch !== true
			)
				throw new Error(`Corpus service-worker semantic binding mismatch: ${expected.id}`);
			const buildReference = receipt.artifacts.find((item) =>
				['service-worker.json', 'build.json'].includes(path.basename(item.path)),
			);
			if (!buildReference)
				throw new Error(`Service-worker build artifact missing: ${expected.id}`);
			const buildValue = await readJson(path.join(root, buildReference.path));
			const workerByLane = new Map<string, Record<string, unknown>>();
			if (expected.id === 'react-boilerplate-v4-vite8') {
				const evidence = record(buildValue, `${expected.id} service-worker build`);
				workerByLane.set('target', {
					manifestSha256: record(evidence.manifest, 'manifest').sha256,
					entries: evidence.entries,
				});
			} else {
				if (!Array.isArray(buildValue))
					throw new Error(`Service-worker build rows missing: ${expected.id}`);
				for (const value of buildValue) {
					const build = record(value, `${expected.id} build row`);
					if (build.serviceWorker)
						workerByLane.set(
							string(build.lane, `${expected.id} build lane`),
							record(build.serviceWorker, `${expected.id} build worker`),
						);
				}
			}
			const targetWorker = workerByLane.get('target');
			if (!targetWorker || targetWorker.manifestSha256 !== receiptWorker.manifestSha256)
				throw new Error(`Corpus service-worker receipt/build mismatch: ${expected.id}`);
			for (const value of journey) {
				const row = record(value, `${expected.id} offline journey row`);
				const worker = record(row.serviceWorker, `${expected.id} service worker`);
				const lane =
					expected.id === 'react-boilerplate-v4-vite8'
						? 'target'
						: string(row.lane, `${expected.id} journey lane`);
				const buildWorker = workerByLane.get(lane);
				const entries = buildWorker?.entries;
				const expectedCache = buildWorker
					? `versionless-react-vite8-${String(buildWorker.manifestSha256)}`
					: null;
				if (
					row.offlineReload !== 'pass' ||
					worker.registration !== 'active' ||
					worker.scope !== '/' ||
					worker.controller !== 'activated' ||
					!Array.isArray(worker.cacheNames) ||
					worker.cacheNames.length === 0 ||
					!Array.isArray(worker.inventory) ||
					worker.inventory.length === 0 ||
					(buildWorker &&
						(canonicalize(worker.cacheNames) !== canonicalize([expectedCache]) ||
							!Array.isArray(entries) ||
							canonicalize(worker.inventory) !==
								canonicalize(
									entries.map((entry) =>
										string(record(entry, 'precache entry').url, 'precache URL'),
									),
								)))
				)
					throw new Error(
						`Corpus service-worker offline evidence mismatch: ${expected.id}`,
					);
			}
			if (expected.id === 'react-boilerplate-v4-data-flow') {
				const upgradeReference = receipt.artifacts.find(
					(item) => path.basename(item.path) === 'upgrade.json',
				);
				if (!upgradeReference)
					throw new Error(
						'Service-worker upgrade artifact missing: react-boilerplate-v4-data-flow',
					);
				const upgrades = await readJson(path.join(root, upgradeReference.path));
				if (
					!Array.isArray(upgrades) ||
					canonicalize(upgrades.map((value) => record(value, 'upgrade row').order)) !==
						canonicalize(['base-to-data-flow', 'data-flow-to-base'])
				)
					throw new Error('Service-worker upgrade order evidence mismatch');
				for (const value of upgrades) {
					const upgrade = record(value, 'upgrade row');
					if (!Array.isArray(upgrade.phases) || upgrade.phases.length !== 2)
						throw new Error('Service-worker upgrade phases mismatch');
					const expectedLanes =
						upgrade.order === 'base-to-data-flow'
							? ['legacy', 'target']
							: ['target', 'legacy'];
					if (
						canonicalize(
							upgrade.phases.map((phase) => record(phase, 'upgrade phase').lane),
						) !== canonicalize(expectedLanes) ||
						new Set(
							upgrade.phases.map((phase) => record(phase, 'upgrade phase').origin),
						).size !== 1
					)
						throw new Error('Service-worker upgrade origin/lane evidence mismatch');
					for (const phaseValue of upgrade.phases) {
						const phase = record(phaseValue, 'upgrade phase');
						const laneWorker = workerByLane.get(string(phase.lane, 'upgrade lane'));
						if (
							!laneWorker ||
							canonicalize(phase.cacheNames) !==
								canonicalize([
									`versionless-react-vite8-${String(laneWorker.manifestSha256)}`,
								]) ||
							canonicalize(phase.inventory) !==
								canonicalize(
									(laneWorker.entries as unknown[]).map((entry) =>
										string(record(entry, 'upgrade entry').url, 'upgrade URL'),
									),
								) ||
							phase.scope !== '/' ||
							phase.controller !== 'activated' ||
							phase.offlineReload !== 'pass'
						)
							throw new Error('Service-worker upgrade semantic evidence mismatch');
					}
				}
			}
			const mutationRef = receipt.artifacts.find(
				(item) => path.basename(item.path) === 'mutation.json',
			);
			if (!mutationRef)
				throw new Error(`Service-worker mutation artifact missing: ${expected.id}`);
			const mutation = record(
				await readJson(path.join(root, mutationRef.path)),
				`${expected.id} mutation artifact`,
			);
			const mutationRows = Array.isArray(mutation.mutations)
				? mutation.mutations
				: [mutation];
			const workerMutation = mutationRows
				.map((value) => record(value, `${expected.id} mutation row`))
				.find(
					(value) =>
						value.seam === 'service-worker-registration' ||
						value.mutationKind === 'service-worker-registration-disabled',
				);
			if (
				!workerMutation ||
				(workerMutation.result ?? workerMutation.mutation) !== 'intended-failure' ||
				workerMutation.restoration !== 'byte-identical' ||
				workerMutation.reproduced !== 'pass'
			)
				throw new Error(`Service-worker mutation evidence mismatch: ${expected.id}`);
		}
		let composition: Record<string, unknown> | null = null;
		if (expected.id === 'angular-phonecat-composed') {
			const compositionRef = receipt.artifacts.find(
				(item) => path.basename(item.path) === 'composition.json',
			);
			if (!compositionRef)
				throw new Error('Composed PhoneCat receipt omits composition artifact');
			composition = record(
				await readJson(path.join(root, compositionRef.path)),
				'PhoneCat composition artifact',
			);
			if (
				receipt.migration.transform !==
					'phone-detail-lexical-this+phone-route-resolve-component-binding' ||
				composition.orderIndependent !== true
			)
				throw new Error('Composed PhoneCat order-independence evidence missing');
		}
		if (expected.id === 'angular-phonecat-vite8') {
			const artifactRecord = async (name: string): Promise<Record<string, unknown>> => {
				const reference = receipt.artifacts.find(
					(item) => path.basename(item.path) === name,
				);
				if (!reference) throw new Error(`PhoneCat Vite receipt omits ${name}`);
				return record(
					await readJson(path.join(root, reference.path)),
					`PhoneCat Vite ${name} artifact`,
				);
			};
			const preparation = await artifactRecord('preparation.json');
			const transformOrder = await artifactRecord('transform-order.json');
			const viteBuild = await artifactRecord('vite-build.json');
			const publication = await artifactRecord('publication.json');
			const mutation = await artifactRecord('mutation.json');
			const buildsEqual = viteBuild.equal === true;
			const libraryInput = record(preparation.libraryInput, 'PhoneCat Vite library input');
			const firstBuild = record(viteBuild.first, 'PhoneCat Vite first build');
			const secondBuild = record(viteBuild.second, 'PhoneCat Vite second build');
			const buildEntries = firstBuild.entries;
			const mutations = Array.isArray(mutation.mutations) ? mutation.mutations : [];
			if (
				receipt.migration.transform !==
					'phone-detail-lexical-this+phone-route-resolve-component-binding' ||
				transformOrder.orderIndependent !== true ||
				canonicalize(transformOrder.changedFiles) !==
					canonicalize([
						'app/app.config.js',
						'app/phone-list/phone-list.component.js',
						'app/phone-detail/phone-detail.component.js',
					]) ||
				canonicalize(
					(transformOrder.orders as Array<Record<string, unknown>> | undefined)?.map(
						(value) => ({ order: value.order, trace: value.trace }),
					),
				) !==
					canonicalize([
						{
							order: [
								'phone-detail-lexical-this',
								'phone-route-resolve-component-binding',
							],
							trace: ['phone-detail', 'app-config', 'phone-list'],
						},
						{
							order: [
								'phone-route-resolve-component-binding',
								'phone-detail-lexical-this',
							],
							trace: ['app-config', 'phone-list', 'phone-detail'],
						},
					]) ||
				canonicalize(libraryInput) !==
					canonicalize({
						treeSha256:
							'811fb0f3190dc4f07398c326dfd47b501d677b8c4662621ccaefe472bf0a717b',
						manifestSha256:
							'747a69dbe4fffca6deb1eb12517c7d80e5a829b1a27616d2a04350c015373d2e',
						provenanceSha256:
							'e3f7dcb0034b6092ee5576de1a2a227c067835b39713ce93fb5ac37feff3b878',
						entries: 65,
					}) ||
				!buildsEqual ||
				canonicalize(firstBuild) !== canonicalize(secondBuild) ||
				!Array.isArray(buildEntries) ||
				buildEntries.length !== 187 ||
				viteBuild.serviceWorker !== 'out-of-scope-not-emitted' ||
				publication.method !== 'same-filesystem-staged-directory-rename' ||
				publication.validatedBeforePublish !== true ||
				publication.injectedFailure !== 'refused' ||
				publication.publishedTarget !== 'unchanged' ||
				publication.failedStageCleanup !== true ||
				mutations.length !== 2 ||
				mutations.some((value) => {
					const row = record(value, 'PhoneCat Vite mutation row');
					return (
						row.result !== 'intended-failure' ||
						row.restoration !== 'byte-identical' ||
						row.reproduced !== 'pass'
					);
				})
			)
				throw new Error('PhoneCat Vite exact migration evidence mismatch');
			composition = transformOrder;
		}
		if (expected.id === 'react-boilerplate-v4-composed') {
			const artifactRecord = async (name: string): Promise<Record<string, unknown>> => {
				const reference = receipt.artifacts.find(
					(item) => path.basename(item.path) === name,
				);
				if (!reference) throw new Error(`Composed React receipt omits ${name}`);
				return record(
					await readJson(path.join(root, reference.path)),
					`React ${name} artifact`,
				);
			};
			composition = await artifactRecord('composition.json');
			const transform = await artifactRecord('transform.json');
			const migrationDiff = await artifactRecord('migration-diff.json');
			const mutation = await artifactRecord('mutation.json');
			const expectedComposition = {
				schemaVersion: 'versionless.react-composed-plan.v1',
				requestedOrders: ['locale-first', 'data-flow-first'],
				executionTraces: [
					{ order: 'locale-first', steps: REACT_COMPOSED_EXECUTION_TRACES[0] },
					{ order: 'data-flow-first', steps: REACT_COMPOSED_EXECUTION_TRACES[1] },
				],
				actualOrdersExecuted: true,
				outputsEqual: true,
				latePreconditionFailure: 'refused',
				publish: 'same-filesystem-staged-directory-rename',
				injectedWriteFailure: 'refused',
				stagedWritesBeforeFailure: 1,
				rollback: 'published-target-unmodified',
				failedStageCleanup: true,
			};
			if (
				receipt.migration.transform !== 'react-composed-connect-to-hooks' ||
				canonicalize(composition) !== canonicalize(expectedComposition) ||
				canonicalize(transform.changedFiles) !==
					canonicalize(REACT_COMPOSED_CHANGED_FILES) ||
				transform.edits !== 13 ||
				canonicalize(transform.semanticEngine) !==
					canonicalize({
						parser: 'yuku-parser@0.7.0',
						analyzer: 'yuku-analyzer@0.7.0',
						diagnostics: 0,
					}) ||
				canonicalize(transform.sourceHashes) !==
					canonicalize(REACT_COMPOSED_SOURCE_HASHES) ||
				canonicalize(transform.targetHashes) !==
					canonicalize(REACT_COMPOSED_TARGET_HASHES) ||
				canonicalize(migrationDiff) !==
					canonicalize({
						changedFiles: REACT_COMPOSED_CHANGED_FILES,
						harnessOnlyAdapterExcluded: true,
						sourceHashes: REACT_COMPOSED_SOURCE_HASHES,
						targetHashes: REACT_COMPOSED_TARGET_HASHES,
					}) ||
				canonicalize(mutation) !==
					canonicalize({
						mutations: [
							{
								seam: 'home-reducer-injection',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									REACT_COMPOSED_TARGET_HASHES[
										'app/containers/HomePage/index.js'
									],
								reproduced: 'pass',
							},
							{
								seam: 'locale-dispatch',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									REACT_COMPOSED_TARGET_HASHES[
										'app/containers/LocaleToggle/index.js'
									],
								reproduced: 'pass',
							},
							{
								seam: 'repository-load',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									REACT_COMPOSED_TARGET_HASHES[
										'app/containers/HomePage/index.js'
									],
								reproduced: 'pass',
							},
							{
								seam: 'service-worker-registration',
								result: 'intended-failure',
								restoration: 'byte-identical',
								restoredSha256:
									'17f8b8601929cd25a8557a6351d429ba24bd8871d557552351afb53363871c78',
								reproduced: 'pass',
							},
						],
						isolated: true,
					})
			)
				throw new Error('Composed React exact migration evidence mismatch');
			if (journey.length !== 4)
				throw new Error('Composed React journey must contain four exact runs');
			for (const [index, value] of journey.entries()) {
				const row = record(value, 'React composed journey row');
				const lane = index < 2 ? 'legacy' : 'target';
				const run = (index % 2) + 1;
				const expectedBlocked =
					lane === 'legacy'
						? ['https://fonts.googleapis.com/css?family=Open+Sans:400,700']
						: [];
				if (
					row.lane !== lane ||
					row.run !== run ||
					row.result !== 'pass' ||
					row.selectedLocale !== 'de' ||
					row.username !== 'octocat' ||
					canonicalize(row.repositories) !==
						canonicalize(['owned-repo', 'fork-owner/forked-repo']) ||
					canonicalize(row.issueCounts) !== canonicalize([3, 7]) ||
					canonicalize(row.blocked) !== canonicalize(expectedBlocked) ||
					canonicalize(row.successfulNonLoopback) !== canonicalize([]) ||
					canonicalize(row.consoleErrors) !== canonicalize([]) ||
					canonicalize(row.pageErrors) !== canonicalize([])
				)
					throw new Error('Composed React journey contract mismatch');
				const requests = row.syntheticRequests;
				if (
					!Array.isArray(requests) ||
					canonicalize(requests) !==
						canonicalize([
							{
								method: 'GET',
								url: 'https://api.github.com/users/octocat/repos?type=all&sort=updated',
								kind: 'synthetic-interception',
							},
						])
				)
					throw new Error('Composed React synthetic journey request mismatch');
			}
		}
		inspected.push({
			expected,
			receipt,
			journey,
			journeyRef,
			source: sourceIdentity(receipt),
			composition,
		});
	}
	if (
		aggregateByPath.size !==
		inspected.length +
			1 +
			(transaction.nextKilledByGoogleIntegrated ? 1 : 0) +
			(transaction.angularRealworldWitnessIntegrated ? 1 : 0) +
			(transaction.reactBoilerplateWitnessIntegrated ? 1 : 0) +
			(transaction.nextKilledByGoogleWitnessIntegrated ? 1 : 0) +
			(transaction.kind === 'react-avataaars-candidate' ||
			transaction.kind === 'react-calculator-candidate' ||
			transaction.kind === 'react-graphiql-013-candidate' ||
			transaction.kind === 'react-zero-sw-reconciliation'
				? transaction.kind === 'react-zero-sw-reconciliation'
					? 2
					: 1
				: 0)
	)
		throw new Error('Aggregate contains an unknown or extra receipt');
	const angularRealworld = await verifyAngularRealworldV15ToV16Evidence(root);
	const angularRealworldWitness = transaction.angularRealworldWitnessIntegrated
		? await verifyWitnessAngularRealworldEvidence(root)
		: null;
	const reactBoilerplateWitness = transaction.reactBoilerplateWitnessIntegrated
		? await verifyWitnessReactBoilerplateEvidence(root)
		: null;
	const nextKilledByGoogleWitness = transaction.nextKilledByGoogleWitnessIntegrated
		? await verifyWitnessNextKilledByGoogleEvidence(root)
		: null;
	if (transaction.kind === 'react-zero-sw-reconciliation') {
		const migration = await verifyReceipt(REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH, {
			repositoryRoot: root,
		});
		const migrationMember = record(
			aggregateByPath.get(REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH),
			'React Boilerplate zero-SW migration aggregate fixture',
		);
		if (migrationMember.digest !== migration.digest)
			throw new Error('React Boilerplate zero-SW migration aggregate digest differs');
		const verified = await verifyWitnessReactBoilerplateZeroSwEvidence(root);
		const member = record(
			aggregateByPath.get(WITNESS_REACT_BOILERPLATE_ZERO_SW_RECEIPT_PATH),
			'React Boilerplate zero-SW aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React Boilerplate zero-SW aggregate digest differs');
	}
	const nextKilledByGoogle = transaction.nextKilledByGoogleIntegrated
		? await verifyNextKilledByGoogleEvidence(root)
		: null;
	if (transaction.kind === 'react-avataaars-candidate') {
		const verified = await verifyReactAvataaarsCompatibilityEvidence(root);
		const member = record(
			aggregateByPath.get(REACT_AVATAAARS_COMPATIBILITY_RECEIPT_PATH),
			'React Avataaars aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React Avataaars aggregate digest differs');
	}
	if (transaction.kind === 'react-calculator-candidate') {
		const verified = await verifyReactCalculatorEvidence(root);
		const member = record(
			aggregateByPath.get(REACT_CALCULATOR_RECEIPT_PATH),
			'React Calculator aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React Calculator aggregate digest differs');
	}
	if (transaction.kind === 'react-graphiql-013-candidate') {
		const verified = await verifyReactGraphiQL013Evidence(root);
		const member = record(
			aggregateByPath.get(REACT_GRAPHIQL_013_RECEIPT_PATH),
			'React GraphiQL aggregate fixture',
		);
		if (member.digest !== verified.digest)
			throw new Error('React GraphiQL aggregate digest differs');
	}
	if (nextKilledByGoogle && nextKilledByGoogle.digest !== nextKilledByGoogleDigest)
		throw new Error('Killed by Google aggregate digest differs');

	const sourceGroups = new Map<string, typeof inspected>();
	for (const item of inspected) {
		const key = canonicalize(item.source);
		const group = sourceGroups.get(key) ?? [];
		group.push(item);
		sourceGroups.set(key, group);
	}
	if (sourceGroups.size !== 2)
		throw new Error(
			`Corpus must resolve to exactly two immutable source applications, found ${sourceGroups.size}`,
		);
	for (const item of inspected) {
		const peers = sourceGroups.get(canonicalize(item.source)) ?? [];
		if (peers.some((peer) => peer.expected.application !== item.expected.application))
			throw new Error('Corpus source identity crosses expected application boundaries');
	}

	const react = inspected.filter((item) => item.expected.application === 'react-boilerplate');
	const phonecat = inspected.filter((item) => item.expected.application === 'angular-phonecat');
	if (react.length !== 5 || phonecat.length !== 4)
		throw new Error(
			'Corpus application grouping does not preserve five React and four PhoneCat verticals',
		);
	if (new Set(react.map((item) => canonicalize(item.source))).size !== 1)
		throw new Error('React Boilerplate immutable source divergence');
	const reactWorkerBuild = async (id: string): Promise<unknown> => {
		const item = react.find((value) => value.expected.id === id);
		const reference = item?.receipt.artifacts.find(
			(value) => path.basename(value.path) === 'build.json',
		);
		if (!reference) throw new Error(`React service-worker build missing: ${id}`);
		const builds = await readJson(path.join(root, reference.path));
		if (!Array.isArray(builds)) throw new Error(`React service-worker builds invalid: ${id}`);
		const target = builds
			.map((value) => record(value, `${id} build`))
			.find((value) => value.lane === 'target');
		if (!target?.serviceWorker) throw new Error(`React target service worker missing: ${id}`);
		return target.serviceWorker;
	};
	if (
		canonicalize(await reactWorkerBuild('react-boilerplate-v4-data-flow')) !==
		canonicalize(await reactWorkerBuild('react-boilerplate-v4-composed'))
	)
		throw new Error('React composed target is not the identical transformed Vite output');
	if (new Set(phonecat.map((item) => canonicalize(item.source))).size !== 1)
		throw new Error('Angular PhoneCat immutable source divergence');

	const projections = react.map((item) => {
		const values = uniqueCanonical(
			item.journey.map((value) => reactProjection(value, item.expected.id)),
		);
		if (values.length !== 1)
			throw new Error(`React behavior drift within vertical: ${item.expected.id}`);
		return values[0] as JourneyProjection;
	});
	if (uniqueCanonical(projections).length !== 1)
		throw new Error('React common user-observable projection drift');
	const commonProjection = projections[0];
	if (!commonProjection || commonProjection.result !== 'pass')
		throw new Error('React common user-observable projection is not passing');

	const phonecatJourneyDigests = new Set(phonecat.map((item) => item.journeyRef.sha256));
	if (phonecatJourneyDigests.size !== 1) throw new Error('PhoneCat journey digest drift');
	const phonecatJourneyDigest = phonecat[0]?.journeyRef.sha256;
	if (!phonecatJourneyDigest || !sha256Pattern.test(phonecatJourneyDigest))
		throw new Error('PhoneCat journey digest is invalid');

	const verticals: Array<Record<string, unknown>> = inspected.map((item) => ({
		id: item.expected.id,
		application: item.expected.application,
		framework: item.expected.framework,
		receiptPath: item.expected.path,
		receiptDigest: item.receipt.integrity.canonicalDigest,
		receiptSchema: receiptShape(item.receipt, item.journey),
		runtime: item.expected.runtime,
		bundler: item.expected.bundler,
		locality: {
			mode: 'offline',
			scope: item.receipt.verification.locality.scope,
			osWideIsolation: false,
			successfulNonLoopback: 0,
			browserBlockedRequests: item.receipt.verification.locality.browserBlockedRequests,
		},
		...(item.expected.id === 'react-boilerplate-v4-vite8' ||
		item.expected.id === 'react-boilerplate-v4-data-flow' ||
		item.expected.id === 'react-boilerplate-v4-composed' ||
		item.expected.id === 'angular-phonecat-vite8'
			? {
					adapter: 'fixture-specific',
					oldVite: 'not-tested',
					genericAdapter: 'not-tested',
					unplugin: 'not-tested',
				}
			: {}),
		...(item.expected.id === 'angular-phonecat'
			? { lexicalThis: 'verified' }
			: item.expected.id === 'angular-phonecat-route-resolve'
				? { routeResolves: 'verified', componentBindings: 'one-way-verified' }
				: item.expected.id === 'angular-phonecat-composed'
					? {
							composition: 'verified',
							orderIndependent: item.composition?.orderIndependent,
							lexicalThis: 'verified',
							routeResolves: 'verified',
							componentBindings: 'one-way-verified',
						}
					: item.expected.id === 'angular-phonecat-vite8'
						? {
								composition: 'verified',
								orderIndependent: item.composition?.orderIndependent,
								lexicalThis: 'verified',
								routeResolves: 'verified',
								componentBindings: 'one-way-verified',
								viteOutput: 'self-contained-rehashable',
								serviceWorker: 'out-of-scope-not-emitted',
							}
						: {}),
		...(item.expected.framework === 'angularjs'
			? {
					track: 'angularjs-special-track',
					angular2Plus: 'not-applicable',
					angularCliAot: 'not-applicable',
					designatedPilot: false,
				}
			: { designatedPilot: false }),
	}));
	verticals.push({
		id: 'angular-realworld-v15-to-v16',
		application: 'angular-realworld',
		framework: 'angular',
		receiptPath: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.path,
		receiptDigest: ANGULAR_REALWORLD_V15_TO_V16_RECEIPT.canonicalDigest,
		receiptSchema: {
			schemaVersion: angularRealworld.receipt.schemaVersion,
			toolingFields: ['npmVersion', 'legacyPeerDeps', 'compatibilityReason'],
			migrationFields: ['applicationFilesChanged', 'changedFiles'],
			journeyFields: uniqueCanonical(
				angularRealworld.receipt.journeys.map((value) =>
					keys(record(value, 'Angular RealWorld journey')),
				),
			),
		},
		runtime: 'Node 18.20.8',
		bundler: 'Angular CLI/Architect production AOT 15-to-16',
		locality: {
			mode: 'offline',
			scope: 'process-scoped',
			osWideIsolation: false,
			successfulNonLoopback: 0,
			browserBlockedRequests: 2,
		},
		track: 'angular2-plus-adjacent-major',
		angular2Plus: 'verified-one-adjacent-major',
		angularCliAot: 'verified',
		productionReadiness:
			angularRealworldWitness === null ? 'not-tested' : 'verified-direct-witness',
		readinessScoreboard:
			angularRealworldWitness === null
				? { angularLineage: { ready: 0, total: 4 }, harness: { ready: 0, total: 4 } }
				: angularRealworldWitness.receipt.readiness,
		designatedPilot: false,
	});
	if (nextKilledByGoogle)
		verticals.push({
			id: 'next-killedbygoogle-derived-state-to-memo',
			application: 'killedbygoogle',
			framework: 'react',
			receiptPath: NEXT_KILLED_BY_GOOGLE_RECEIPT_PATH,
			receiptDigest: nextKilledByGoogle.digest,
			receiptSchema: {
				schemaVersion: nextKilledByGoogle.receipt.schemaVersion,
				toolingFields: keys(
					record(nextKilledByGoogle.receipt.tooling, 'Killed by Google tooling'),
				),
				migrationFields: keys(
					record(nextKilledByGoogle.receipt.migration, 'Killed by Google migration'),
				),
				journeyFields: ['baseline', 'migrated', 'normalizedEquivalent', 'restored'],
			},
			runtime: 'Node 16.20.2 EOL compatibility sandbox',
			bundler: 'Next 12.0.10 webpack 5',
			locality: {
				mode: 'offline',
				scope: 'process-scoped',
				osWideIsolation: false,
				successfulNonLoopback: 0,
			},
			track: 'next12-pages-derived-state-to-use-memo',
			traceDiagnosticReproducibility: 'not-claimed',
			designatedPilot: false,
		});

	const result: CorpusConformance = {
		schemaVersion: CORPUS_CONFORMANCE_SCHEMA,
		summary: {
			verticals: transaction.verticals,
			sourceApplications: transaction.sourceApplications,
			designatedPilotsVerified: 0,
		},
		verticals,
		applications: [
			{
				id: 'react-boilerplate',
				source: react[0]?.source,
				verticals: react.map((item) => item.expected.id),
				conformance: {
					scope: 'common-user-observable-projection-only',
					projection: commonProjection,
					projectionSha256: sha256(canonicalize(commonProjection)),
					blockedNetworkObservations: react.map((item) => ({
						vertical: item.expected.id,
						browserBlockedRequests:
							item.receipt.verification.locality.browserBlockedRequests,
						blockedUrls: uniqueCanonical(
							item.journey.flatMap((value) => blockedUrls(value, item.expected.id)),
						),
					})),
				},
				boundaries: {
					viteAdapter: 'fixture-specific',
					oldVite: 'not-tested',
					genericAdapter: 'not-tested',
					unplugin: 'not-tested',
					fullEquivalence: 'not-claimed',
				},
			},
			{
				id: 'angular-phonecat',
				source: phonecat[0]?.source,
				verticals: phonecat.map((item) => item.expected.id),
				conformance: {
					journeySha256: phonecatJourneyDigest,
					journeyDigestIdentical: true,
					migrationsRemainDistinct: true,
				},
				boundaries: {
					track: 'angularjs-special-track',
					bundler: 'none-static / Vite 8.0.16',
					angular2Plus: 'not-applicable',
					angularCliAot: 'not-applicable',
					adjacentMajor: 'not-applicable',
					designatedPilot: false,
				},
			},
			{
				id: 'angular-realworld',
				source: {
					repository: normalizeURL(
						'https://github.com/realworld-apps/angular-realworld-example-app',
					),
					parentRevision: 'e28c8969aab9a27ece9873118b1ab7251f9ccb0c',
					targetRevision: '0d28f5c63b9cd678a3f1f724f68d6e41363bdd5a',
					archiveSha256:
						'b834410ded0baae07950ba680d2ee82a5d7b797ee01bd86d9a901d3e696544a2',
					license: 'MIT',
					licenseSha256:
						'dd241fc76d00987f9a025558ec977a2df69875320ab0379bd8f5865ad1033c7b',
				},
				verticals: ['angular-realworld-v15-to-v16'],
				conformance: {
					adjacentMajor: 'angular-15-to-16-verified',
					productionAot: true,
					journeys: 4,
					mutation: 'target-api-origin-rejection-verified',
					productionReadiness:
						angularRealworldWitness === null ? 'not-tested' : 'direct-witness-verified',
					readinessScoreboard:
						angularRealworldWitness === null
							? {
									angularLineage: { ready: 0, total: 4 },
									harness: { ready: 0, total: 4 },
								}
							: angularRealworldWitness.receipt.readiness,
				},
				boundaries: {
					track: 'angular2-plus-adjacent-major',
					designatedPilot: false,
					genericAngularSupport: 'not-claimed',
					locality: 'process-scoped-not-os-wide',
				},
			},
			...(nextKilledByGoogle
				? [
						{
							id: 'killedbygoogle',
							source: {
								repository: normalizeURL(
									'https://github.com/codyogden/killedbygoogle',
								),
								revision: '56809c31592e6ca1edce8af9bfe842fbcdf71f4d',
								archiveSha256:
									'c28878d0f65b56aa595763c852477fb0c1e3533e5c7f7ea9daa2be16f102368d',
								license: 'MIT',
							},
							verticals: ['next-killedbygoogle-derived-state-to-memo'],
							conformance: {
								productionBuild: true,
								browserJourneys: 4,
								mutationRestoration: 'verified',
								productionOutputConformance: 'verified',
							},
							boundaries: {
								traceDiagnosticReproducibility: 'not-claimed',
								genericNextSupport: 'not-claimed',
								productionReadiness: 'not-claimed',
								locality: 'process-scoped-not-os-wide',
							},
						},
					]
				: []),
		],
		frameworkLanes: NEXTJS_SYNTHETIC_NOT_TESTED_LANES,
		coverage: {
			takenote: 'not-tested',
			angular2Hn: 'not-tested',
			oldVite: 'not-tested',
			genericAdapter: 'not-tested',
			unplugin: 'not-tested',
			nextjs: nextKilledByGoogle ? 'fixture-specific-next12-pages-verified' : 'not-tested',
			authenticity: 'not-established',
			certification: 'not-claimed',
			locality: 'process-scoped-not-os-wide',
			productionReadiness: {
				reactLineage: {
					ready: reactBoilerplateWitness === null ? 0 : 1,
					total: 4,
					counted: reactBoilerplateWitness !== null,
					candidate: reactBoilerplateWitness === null ? 'not-tested' : 'judge-approved',
				},
				angularLineage: {
					ready: angularRealworldWitness === null ? 0 : 1,
					total: 4,
				},
				olderNext: {
					ready: 0,
					total: 4,
					counted: false,
					candidate:
						nextKilledByGoogleWitness === null
							? 'not-tested'
							: 'verified-pending-judge',
				},
				harness: { ready: 0, total: 4 },
				phonecat: 'unsupported-visible-transition-not-counted',
			},
		},
		integrity: { algorithm: 'sha256', canonicalDigest: '' },
	};
	result.integrity.canonicalDigest = sha256(canonicalize(result));
	return result;
}

export function verifyCorpusConformanceDigest(value: CorpusConformance): string {
	if (value.schemaVersion !== CORPUS_CONFORMANCE_SCHEMA)
		throw new Error('Unsupported corpus conformance schema');
	const copy = structuredClone(value);
	const declared = copy.integrity.canonicalDigest;
	copy.integrity.canonicalDigest = '';
	const calculated = sha256(canonicalize(copy));
	if (!sha256Pattern.test(declared) || calculated !== declared)
		throw new Error('Corpus conformance canonical digest mismatch');
	return calculated;
}
