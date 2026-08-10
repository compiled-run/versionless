import { describe, expect, test } from 'vitest';
import { canonicalize, sha256 } from '../src/receipts/canonicalize.ts';
import {
	REACT_CALCULATOR_SCHEMA,
	assertReactCalculatorArtifacts,
	parseReactCalculatorReceipt,
	verifyReactCalculatorEvidence,
} from '../src/receipts/react-calculator.ts';

const hex = 'a'.repeat(64);
const clickInteractions = Array.from({ length: 20 }, (_, index) => ({ kind: 'click', index }));
const journey = (lane: 'baseline' | 'target', pass: 1 | 2 | 3) => ({
	lane,
	pass,
	result: 'pass',
	witnessReceiptSha256: hex,
	journeyA: { multiply: '37.5', percent: '0.375', clear: '0' },
	journeyB: {
		division: '2',
		multiplication: '42',
		signToggle: '-5',
		precision: '0.3',
		chained: '9',
	},
	interactions: clickInteractions,
	serviceWorker: { registrations: 0, controller: null, cacheNames: [] },
	successfulNonLoopback: 0,
	pageErrors: [],
	consoleErrors: [],
});

function artifacts() {
	return {
		provenance: {
			source: {
				revision: '37b56077e78b82bf2088ec993d55becb47538de9',
				tree: 'd173cbae55964a2553c308ebbb7ed6e2d14f9a8a',
				license: 'MIT',
				archiveSha256: hex,
			},
			closure: { digest: hex, offlineReplays: 2 },
			targetClosure: { digest: hex, offlineReplays: 2 },
			license: {
				expression: 'MIT',
				assets: [{ path: 'logo.svg', license: 'MIT-root-license' }],
			},
			privacy: {
				backendDependency: false,
				persistenceDependency: false,
				credentials: false,
				customerData: false,
				paymentData: false,
			},
		},
		build: {
			baseline: { runtime: '16.20.2', bundler: 'react-scripts-3.0.1', digests: [hex, hex] },
			target: {
				runtime: '24.15.0',
				bundler: 'vite-8.0.16',
				digests: [hex, hex],
				dependencies: { react: '18.3.1', 'react-dom': '18.3.1', scheduler: '0.23.2' },
			},
		},
		witness: {
			directLinkedWitness: true,
			linkedWitness: {
				dependency: '@async/witness',
				specifier: 'link:../witness',
				version: '0.8.0',
				sourceHash: hex,
				buildHash: hex,
			},
			runs: [
				journey('baseline', 1),
				journey('baseline', 2),
				journey('target', 1),
				journey('target', 2),
			],
			successfulNonLoopback: 0,
			serviceWorkerRegistrations: 0,
			serviceWorkerControllers: 0,
			serviceWorkerCaches: 0,
		},
		mutation: {
			branch: 'operate x/toString repeated multiplication branch',
			intendedFailure: 'Journey B multiplication expected 42',
			red: true,
			redReason: 'calculator-multiplication-42-red',
			green: true,
			mutatedBuildDigest: 'b'.repeat(64),
			restoredRun: journey('target', 3),
			originalSourceSha256: hex,
			restoredSourceSha256: hex,
			originalBuildDigest: hex,
			restoredBuildDigest: hex,
		},
		human: 'candidate remains uncounted; not certification; not signer authenticity; not OS-wide isolation',
	};
}

function receipt(): Record<string, unknown> {
	const value = {
		schemaVersion: REACT_CALCULATOR_SCHEMA,
		result: 'pass',
		counted: false,
		artifacts: [
			'provenance.json',
			'build.json',
			'witness.json',
			'mutation.json',
			'receipt.md',
		].map((name) => ({
			path: `evidence/runs/react-calculator-react16-to-vite8/${name}`,
			sha256: hex,
		})),
		integrity: { algorithm: 'sha256', authenticity: 'not-established', canonicalDigest: '' },
	};
	value.integrity.canonicalDigest = sha256(canonicalize(value));
	return value;
}

describe('React Calculator artifact-bound receipt', () => {
	test('accepts exact count-false envelope and semantic artifacts', () => {
		expect(parseReactCalculatorReceipt(receipt()).counted).toBe(false);
		expect(() => assertReactCalculatorArtifacts(artifacts())).not.toThrow();
	});

	test('rejects artifact path, hash, envelope digest and semantic tampering', () => {
		for (const mutate of [
			(value: Record<string, unknown>) => {
				(value.artifacts as Array<Record<string, unknown>>)[0]!.path = '../escape';
			},
			(value: Record<string, unknown>) => {
				(value.artifacts as Array<Record<string, unknown>>)[0]!.sha256 = 'weak';
			},
			(value: Record<string, unknown>) => {
				(value.integrity as Record<string, unknown>).canonicalDigest = hex;
			},
		]) {
			const value = receipt();
			mutate(value);
			expect(() => parseReactCalculatorReceipt(value)).toThrow();
		}
		const semantic = artifacts();
		semantic.witness.runs[0]!.journeyA.multiply = 'tampered';
		expect(() => assertReactCalculatorArtifacts(semantic)).toThrow();
	});

	test('opens every artifact and rejects byte tampering independently', async () => {
		const repositoryRoot = await mkdtemp(join(tmpdir(), 'versionless-calculator-receipt-'));
		const output = join(repositoryRoot, 'evidence/runs/react-calculator-react16-to-vite8');
		await mkdir(output, { recursive: true });
		const value = artifacts();
		const bodies = [
			`${canonicalize(value.provenance)}\n`,
			`${canonicalize(value.build)}\n`,
			`${canonicalize(value.witness)}\n`,
			`${canonicalize(value.mutation)}\n`,
			value.human,
		];
		const names = [
			'provenance.json',
			'build.json',
			'witness.json',
			'mutation.json',
			'receipt.md',
		];
		for (let index = 0; index < names.length; index += 1)
			await writeFile(join(output, names[index]!), bodies[index]!);
		const envelope = receipt();
		for (let index = 0; index < bodies.length; index += 1)
			(envelope.artifacts as Array<Record<string, unknown>>)[index]!.sha256 = sha256(
				bodies[index]!,
			);
		(envelope.integrity as Record<string, unknown>).canonicalDigest = '';
		(envelope.integrity as Record<string, unknown>).canonicalDigest = sha256(
			canonicalize(envelope),
		);
		await writeFile(join(output, 'receipt.json'), `${canonicalize(envelope)}\n`);
		await expect(verifyReactCalculatorEvidence(repositoryRoot)).resolves.toMatchObject({
			valid: true,
		});
		await writeFile(join(output, 'build.json'), `${bodies[1]} `);
		await expect(verifyReactCalculatorEvidence(repositoryRoot)).rejects.toThrow(
			'artifact bytes differ',
		);
	});
});
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
