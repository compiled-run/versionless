import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { canonicalize, sha256 } from './canonicalize.ts';

export const REACT_CALCULATOR_SCHEMA = 'versionless.react-calculator-react16-to-vite8.v1' as const;
export const REACT_CALCULATOR_RECEIPT_PATH =
	'evidence/runs/react-calculator-react16-to-vite8/receipt.json' as const;
const artifactRoot = 'evidence/runs/react-calculator-react16-to-vite8';
const artifactNames = [
	'provenance.json',
	'build.json',
	'witness.json',
	'mutation.json',
	'receipt.md',
] as const;

export type ReactCalculatorReceipt = Record<string, unknown> & {
	schemaVersion: typeof REACT_CALCULATOR_SCHEMA;
	result: 'pass';
	counted: false;
	artifacts: Array<{ path: string; sha256: string }>;
	integrity: { algorithm: 'sha256'; canonicalDigest: string; authenticity: 'not-established' };
};

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`React Calculator ${label} must be an object`);
	return value as Record<string, unknown>;
}
function array(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`React Calculator ${label} must be an array`);
	return value;
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
function equal(value: unknown, expected: unknown, label: string): void {
	if (canonicalize(value) !== canonicalize(expected))
		throw new Error(`React Calculator ${label} differs`);
}

function assertJourney(value: unknown, lane: 'baseline' | 'target', pass: 1 | 2 | 3): void {
	const run = record(value, `${lane} Witness ${pass}`);
	const serviceWorker = record(run.serviceWorker, `${lane} service-worker evidence`);
	const journeyA = record(run.journeyA, `${lane} Journey A`);
	const journeyB = record(run.journeyB, `${lane} Journey B`);
	if (
		run.lane !== lane ||
		run.pass !== pass ||
		run.result !== 'pass' ||
		!hex(run.witnessReceiptSha256) ||
		journeyA.multiply !== '37.5' ||
		journeyA.percent !== '0.375' ||
		journeyA.clear !== '0' ||
		journeyB.division !== '2' ||
		journeyB.multiplication !== '42' ||
		journeyB.signToggle !== '-5' ||
		journeyB.precision !== '0.3' ||
		journeyB.chained !== '9' ||
		array(run.interactions, `${lane} interactions`).filter(
			(item) => record(item, `${lane} interaction`).kind === 'click',
		).length < 20 ||
		serviceWorker.registrations !== 0 ||
		serviceWorker.controller !== null ||
		array(serviceWorker.cacheNames, `${lane} cache names`).length !== 0 ||
		run.successfulNonLoopback !== 0 ||
		array(run.pageErrors, `${lane} page errors`).length !== 0 ||
		array(run.consoleErrors, `${lane} console errors`).length !== 0
	)
		throw new Error(`React Calculator ${lane} Witness ${pass} differs`);
}

export function assertReactCalculatorArtifacts(value: {
	provenance: unknown;
	build: unknown;
	witness: unknown;
	mutation: unknown;
	human: string;
}): void {
	const provenance = record(value.provenance, 'provenance artifact');
	const source = record(provenance.source, 'provenance source');
	const closure = record(provenance.closure, 'provenance closure');
	const targetClosure = record(provenance.targetClosure, 'target closure');
	const license = record(provenance.license, 'license');
	const privacy = record(provenance.privacy, 'privacy');
	const build = record(value.build, 'build artifact');
	const baseline = record(build.baseline, 'baseline build');
	const target = record(build.target, 'target build');
	const targetDependencies = record(target.dependencies, 'target dependencies');
	const witness = record(value.witness, 'Witness artifact');
	const linked = record(witness.linkedWitness, 'linked Witness provenance');
	const mutation = record(value.mutation, 'mutation artifact');
	if (
		source.revision !== '37b56077e78b82bf2088ec993d55becb47538de9' ||
		source.tree !== 'd173cbae55964a2553c308ebbb7ed6e2d14f9a8a' ||
		source.license !== 'MIT' ||
		!hex(source.archiveSha256) ||
		!hex(closure.digest) ||
		closure.offlineReplays !== 2 ||
		!hex(targetClosure.digest) ||
		targetClosure.offlineReplays !== 2 ||
		license.expression !== 'MIT' ||
		array(license.assets, 'license assets').some(
			(asset) => record(asset, 'license asset').license !== 'MIT-root-license',
		) ||
		privacy.backendDependency !== false ||
		privacy.persistenceDependency !== false ||
		privacy.credentials !== false ||
		privacy.customerData !== false ||
		privacy.paymentData !== false ||
		baseline.runtime !== '16.20.2' ||
		baseline.bundler !== 'react-scripts-3.0.1' ||
		target.runtime !== '24.15.0' ||
		target.bundler !== 'vite-8.0.16' ||
		targetDependencies.react !== '18.3.1' ||
		targetDependencies['react-dom'] !== '18.3.1' ||
		targetDependencies.scheduler !== '0.23.2'
	)
		throw new Error('React Calculator provenance/build semantics differ');
	const baselineDigests = array(baseline.digests, 'baseline digests');
	const targetDigests = array(target.digests, 'target digests');
	if (
		baselineDigests.length !== 2 ||
		targetDigests.length !== 2 ||
		!baselineDigests.every(hex) ||
		!targetDigests.every(hex) ||
		baselineDigests[0] !== baselineDigests[1] ||
		targetDigests[0] !== targetDigests[1]
	)
		throw new Error('React Calculator deterministic build digests differ');
	if (
		witness.directLinkedWitness !== true ||
		linked.dependency !== '@async/witness' ||
		linked.specifier !== 'link:../witness' ||
		typeof linked.version !== 'string' ||
		!hex(linked.sourceHash) ||
		!hex(linked.buildHash) ||
		array(witness.runs, 'Witness runs').length !== 4 ||
		witness.successfulNonLoopback !== 0 ||
		witness.serviceWorkerRegistrations !== 0 ||
		witness.serviceWorkerControllers !== 0 ||
		witness.serviceWorkerCaches !== 0
	)
		throw new Error('React Calculator linked-Witness/locality semantics differ');
	const runs = array(witness.runs, 'Witness runs');
	assertJourney(runs[0], 'baseline', 1);
	assertJourney(runs[1], 'baseline', 2);
	assertJourney(runs[2], 'target', 1);
	assertJourney(runs[3], 'target', 2);
	if (
		mutation.branch !== 'operate x/toString repeated multiplication branch' ||
		mutation.intendedFailure !== 'Journey B multiplication expected 42' ||
		mutation.red !== true ||
		mutation.redReason !== 'calculator-multiplication-42-red' ||
		mutation.green !== true ||
		!hex(mutation.mutatedBuildDigest) ||
		mutation.mutatedBuildDigest === mutation.originalBuildDigest ||
		!hex(mutation.originalSourceSha256) ||
		mutation.originalSourceSha256 !== mutation.restoredSourceSha256 ||
		!hex(mutation.originalBuildDigest) ||
		mutation.originalBuildDigest !== mutation.restoredBuildDigest
	)
		throw new Error('React Calculator mutation/restoration semantics differ');
	assertJourney(mutation.restoredRun, 'target', 3);
	for (const phrase of [
		'not certification',
		'not signer authenticity',
		'not OS-wide isolation',
		'candidate remains uncounted',
	])
		if (!value.human.includes(phrase))
			throw new Error('React Calculator human nonclaim wording differs');
}

export function parseReactCalculatorReceipt(value: unknown): ReactCalculatorReceipt {
	const receipt = record(value, 'receipt');
	const integrity = record(receipt.integrity, 'integrity');
	const artifacts = array(receipt.artifacts, 'artifacts').map((item) => record(item, 'artifact'));
	if (
		receipt.schemaVersion !== REACT_CALCULATOR_SCHEMA ||
		receipt.result !== 'pass' ||
		receipt.counted !== false ||
		artifacts.length !== artifactNames.length ||
		integrity.algorithm !== 'sha256' ||
		integrity.authenticity !== 'not-established' ||
		!hex(integrity.canonicalDigest)
	)
		throw new Error('React Calculator receipt envelope differs');
	equal(
		artifacts.map((artifact) => artifact.path),
		artifactNames.map((name) => `${artifactRoot}/${name}`),
		'artifact paths',
	);
	if (artifacts.some((artifact) => !hex(artifact.sha256)))
		throw new Error('React Calculator artifact hash differs');
	const copy = structuredClone(receipt);
	record(copy.integrity, 'integrity copy').canonicalDigest = '';
	if (sha256(canonicalize(copy)) !== integrity.canonicalDigest)
		throw new Error('React Calculator receipt canonical digest differs');
	return receipt as ReactCalculatorReceipt;
}

export async function verifyReactCalculatorEvidence(
	repositoryRoot = resolve(import.meta.dirname, '../../../..'),
): Promise<{ valid: true; digest: string }> {
	const receipt = parseReactCalculatorReceipt(
		JSON.parse(await readFile(join(repositoryRoot, REACT_CALCULATOR_RECEIPT_PATH), 'utf8')),
	);
	const bytes = await Promise.all(
		receipt.artifacts.map(async (artifact) => {
			const body = await readFile(join(repositoryRoot, artifact.path));
			if (sha256(body) !== artifact.sha256)
				throw new Error(`React Calculator artifact bytes differ: ${artifact.path}`);
			return body;
		}),
	);
	assertReactCalculatorArtifacts({
		provenance: JSON.parse(bytes[0]!.toString('utf8')),
		build: JSON.parse(bytes[1]!.toString('utf8')),
		witness: JSON.parse(bytes[2]!.toString('utf8')),
		mutation: JSON.parse(bytes[3]!.toString('utf8')),
		human: bytes[4]!.toString('utf8'),
	});
	return { valid: true, digest: receipt.integrity.canonicalDigest };
}

export function reactCalculatorAggregateMember(digest: string) {
	if (!hex(digest)) throw new Error('React Calculator aggregate digest differs');
	return {
		id: 'react-calculator-react16-to-vite8',
		framework: 'react',
		track: 'react-production-candidate-count-false',
		bundler: 'react-scripts-3.0.1-to-vite-8.0.16',
		runtime: 'node-16.20.2-to-node-24.15.0',
		result: 'pass',
		counted: false,
		receipt: REACT_CALCULATOR_RECEIPT_PATH,
		digest,
	};
}
