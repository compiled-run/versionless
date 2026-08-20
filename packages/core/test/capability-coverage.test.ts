import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	buildCapabilityCoverage,
	CAPABILITY_COVERAGE_SCHEMA,
	classifyCapability,
	CROSS_PROVEN_THRESHOLD,
	verifyCapabilityCoverage,
} from '../src/receipts/capability-coverage.ts';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

function angularBarrelModules(source: string): string[] {
	return [...source.matchAll(/\.\/([a-z0-9-]+)\.ts/g)].map((match) => match[1]);
}

describe('capability-coverage map', () => {
	it('derives and self-verifies the enumerated map', () => {
		const coverage = buildCapabilityCoverage();
		expect(coverage.schemaVersion).toBe(CAPABILITY_COVERAGE_SCHEMA);
		expect(() => verifyCapabilityCoverage(coverage)).not.toThrow();
	});

	it('enumerates every exported capability from both framework barrels', async () => {
		const coverage = buildCapabilityCoverage();
		const reactBarrel = await readFile(
			path.join(repoRoot, 'packages/frameworks/react/src/index.ts'),
			'utf8',
		);
		const angularBarrel = await readFile(
			path.join(repoRoot, 'packages/frameworks/angular/src/index.ts'),
			'utf8',
		);
		const named = new Set(coverage.capabilities.map((capability) => capability.name));
		for (const module of angularBarrelModules(reactBarrel))
			expect(named.has(module)).toBe(true);
		for (const module of angularBarrelModules(angularBarrel))
			expect(named.has(module)).toBe(true);
		expect(coverage.summary.react.total).toBe(angularBarrelModules(reactBarrel).length);
		expect(coverage.summary.angular.total).toBe(angularBarrelModules(angularBarrel).length);
	});

	it('classifies purely from the count of distinct proving applications', () => {
		expect(classifyCapability([]).classification).toBe('experimental');
		expect(classifyCapability(['one-app']).classification).toBe('experimental');
		expect(classifyCapability(['a', 'b']).classification).toBe('cross-proven');
		// The same application listed twice cannot reach the threshold.
		expect(classifyCapability(['a', 'a']).proofCount).toBe(1);
		expect(classifyCapability(['a', 'a']).classification).toBe('experimental');
		expect(CROSS_PROVEN_THRESHOLD).toBe(2);
	});

	it('never lets a capability with fewer than two applications be cross-proven', () => {
		const coverage = buildCapabilityCoverage();
		for (const capability of coverage.capabilities) {
			if (capability.classification === 'cross-proven') {
				expect(capability.proofCount).toBeGreaterThanOrEqual(CROSS_PROVEN_THRESHOLD);
				expect(new Set(capability.provenApps).size).toBe(capability.provenApps.length);
			} else {
				expect(capability.proofCount).toBeLessThan(CROSS_PROVEN_THRESHOLD);
			}
			expect(capability.proofCount).toBe(new Set(capability.provenApps).size);
		}
	});

	it('rejects a hand-set classification that a proof count would not derive', () => {
		const coverage = structuredClone(buildCapabilityCoverage()) as unknown as {
			capabilities: Array<Record<string, unknown>>;
		};
		const experimental = coverage.capabilities.find(
			(capability) => capability.classification === 'experimental',
		);
		expect(experimental).toBeDefined();
		(experimental as Record<string, unknown>).classification = 'cross-proven';
		expect(() => verifyCapabilityCoverage(coverage)).toThrow(/classification is not derived/);
	});

	it('rejects a proof count that does not match the listed applications', () => {
		const coverage = structuredClone(buildCapabilityCoverage()) as unknown as {
			capabilities: Array<Record<string, unknown>>;
		};
		coverage.capabilities[0].proofCount = (coverage.capabilities[0].proofCount as number) + 1;
		expect(() => verifyCapabilityCoverage(coverage)).toThrow(/proof count does not match/);
	});

	it('rejects an unproven capability that lists applications', () => {
		const coverage = structuredClone(buildCapabilityCoverage()) as unknown as {
			capabilities: Array<Record<string, unknown>>;
		};
		const target = coverage.capabilities.find(
			(capability) => capability.provenApps && (capability.provenApps as string[]).length > 0,
		);
		expect(target).toBeDefined();
		(target as Record<string, unknown>).coverage = 'unproven';
		expect(() => verifyCapabilityCoverage(coverage)).toThrow(/unproven yet lists applications/);
	});

	it('publishes the machine-readable evidence record that matches the derivation', async () => {
		const emitted = JSON.parse(
			await readFile(
				path.join(repoRoot, 'evidence/trust/current/capability-coverage.json'),
				'utf8',
			),
		);
		expect(() => verifyCapabilityCoverage(emitted)).not.toThrow();
		expect(emitted).toEqual(buildCapabilityCoverage());
	});
});
