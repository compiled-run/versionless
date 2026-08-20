import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	buildCapabilityCoverage,
	CAPABILITY_COVERAGE_SCHEMA,
	CAPABILITY_SEALED_BASELINE,
	CAPABILITY_SEALED_BASELINE_SUMMARY,
	type CapabilityProofRunRecord,
	capabilityEntryPointIndex,
	classifyCapability,
	CROSS_PROVEN_THRESHOLD,
	deriveCapabilityProofs,
	verifyCapabilityCoverage,
} from '../src/receipts/capability-coverage.ts';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

function angularBarrelModules(source: string): string[] {
	return [...source.matchAll(/\.\/([a-z0-9-]+)\.ts/g)].map((match) => match[1]);
}

/**
 * A run record the corpus admission rule accepts, constructed in memory.
 *
 * It is built here rather than filed on disk on purpose: the claim under test
 * is that a capability's proof set moves when a run record is *read*, not that
 * this repository happens to carry one. Every field is the one
 * `deriveRunRecordApplications` reads — a missing one is a refusal, which is
 * what the negative cases below vary.
 */
function provenRunRecord(id: string, engine: string): CapabilityProofRunRecord {
	return {
		id,
		application: id,
		framework: 'react',
		terminalClassification: 'proven',
		interventions: { count: 0 },
		stages: [
			{ name: 'plan', status: 'ran' },
			{ name: 'apply', status: 'ran' },
		],
		engines: [engine],
		runRecordPath: `evidence/runs/${id}/run-record.json`,
		pin: {
			repository: 'https://example.invalid/synthetic.git',
			ref: 'v1.0.0',
			commitSha: '0'.repeat(40),
		},
		licence: { identifier: 'MIT', artifactSha256: '1'.repeat(64) },
	};
}

const capabilityNamed = (coverage: ReturnType<typeof buildCapabilityCoverage>, name: string) => {
	const found = coverage.capabilities.find((capability) => capability.name === name);
	if (found === undefined) throw new Error(`No capability named ${name}`);
	return found;
};

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

	it('publishes a machine-readable evidence record at or above the sealed baseline', async () => {
		const emitted = JSON.parse(
			await readFile(
				path.join(repoRoot, 'evidence/trust/current/capability-coverage.json'),
				'utf8',
			),
		);
		/**
		 * `verifyCapabilityCoverage` is the containment check: it refuses a
		 * published map that enumerates fewer capabilities than the seal, drops a
		 * sealed proving application, or falls below the sealed cross-proven
		 * count. That the emitted file equals the derivation over this
		 * repository's own run records is pinned in the trust package, which is
		 * where the run-record reader lives.
		 */
		expect(() => verifyCapabilityCoverage(emitted)).not.toThrow();
		expect(emitted.summary.total).toBe(CAPABILITY_SEALED_BASELINE_SUMMARY.total);
		expect(emitted.summary.crossProven).toBeGreaterThanOrEqual(
			CAPABILITY_SEALED_BASELINE_SUMMARY.crossProven,
		);
	});
});

describe('capability-coverage derivation', () => {
	it('reproduces the sealed baseline exactly when no run record is supplied', () => {
		const coverage = buildCapabilityCoverage();
		expect(coverage.summary.total).toBe(59);
		expect(coverage.summary.crossProven).toBe(8);
		expect(coverage.summary.experimental).toBe(51);
		expect(CAPABILITY_SEALED_BASELINE_SUMMARY).toEqual({
			total: 59,
			crossProven: 8,
			experimental: 51,
		});
		expect(coverage.capabilities.map((capability) => capability.name)).toEqual(
			CAPABILITY_SEALED_BASELINE.map((sealed) => sealed.name),
		);
		for (const sealed of CAPABILITY_SEALED_BASELINE)
			expect(capabilityNamed(coverage, sealed.name).provenApps).toEqual([
				...sealed.provenApps,
			]);
	});

	it('declares every entry point exactly once, so a run cannot prove two capabilities', () => {
		const index = capabilityEntryPointIndex();
		const declared = CAPABILITY_SEALED_BASELINE.flatMap((sealed) => sealed.entryPoints);
		expect(index.size).toBe(new Set(declared).size);
		expect(index.size).toBe(declared.length);
	});

	it('moves a capability above the sealed baseline from a run record, with no source edit', () => {
		const sealed = CAPABILITY_SEALED_BASELINE.find(
			(entry) => entry.name === 'modal-content-params-migration',
		);
		expect(sealed?.provenApps).toEqual(['angular-jira-clone']);
		const coverage = buildCapabilityCoverage({
			runRecords: [provenRunRecord('synthetic-second-application', 'migrateModalContentParams')],
		});
		const moved = capabilityNamed(coverage, 'modal-content-params-migration');
		expect(moved.provenApps).toEqual(['angular-jira-clone', 'synthetic-second-application']);
		expect(moved.proofCount).toBe(2);
		expect(moved.classification).toBe('cross-proven');
		expect(moved.evidence).toContain(
			'evidence/runs/synthetic-second-application/run-record.json',
		);
		expect(coverage.summary.crossProven).toBe(CAPABILITY_SEALED_BASELINE_SUMMARY.crossProven + 1);
		expect(coverage.summary.total).toBe(CAPABILITY_SEALED_BASELINE_SUMMARY.total);
		expect(() => verifyCapabilityCoverage(coverage)).not.toThrow();
	});

	it('holds the two-application threshold on a capability the seal could not attribute', () => {
		const sealed = CAPABILITY_SEALED_BASELINE.find(
			(entry) => entry.name === 'locale-id-provider',
		);
		expect(sealed?.provenApps).toEqual([]);
		expect(sealed?.coverage).toBe('unproven');
		const one = capabilityNamed(
			buildCapabilityCoverage({
				runRecords: [provenRunRecord('synthetic-locale-one', 'provideEraLocaleId')],
			}),
			'locale-id-provider',
		);
		expect(one.proofCount).toBe(1);
		expect(one.classification).toBe('experimental');
		expect(one.coverage).toBe('proven');
		expect(one.attribution).toBe('run-record');
		const two = capabilityNamed(
			buildCapabilityCoverage({
				runRecords: [
					provenRunRecord('synthetic-locale-one', 'provideEraLocaleId'),
					provenRunRecord('synthetic-locale-two', 'provideEraLocaleId'),
				],
			}),
			'locale-id-provider',
		);
		expect(two.proofCount).toBe(CROSS_PROVEN_THRESHOLD);
		expect(two.classification).toBe('cross-proven');
	});

	it('admits no proof from a run the corpus admission rule refuses', () => {
		const base = provenRunRecord('synthetic-refused', 'migrateModalContentParams');
		const refusals: CapabilityProofRunRecord[] = [
			{ ...base, terminalClassification: 'defect' },
			{ ...base, interventions: { count: 1 } },
			{ ...base, interventions: {} },
			{ ...base, stages: [{ name: 'plan', status: 'did-not-run' }] },
			{ ...base, stages: [] },
			{ ...base, licence: { identifier: 'MIT' } },
			{ ...base, pin: { repository: 'https://example.invalid/synthetic.git', ref: 'v1.0.0' } },
			{ ...base, runRecordPath: undefined },
		];
		for (const refused of refusals) {
			expect(deriveCapabilityProofs([refused]).size).toBe(0);
			expect(
				capabilityNamed(
					buildCapabilityCoverage({ runRecords: [refused] }),
					'modal-content-params-migration',
				).provenApps,
			).toEqual(['angular-jira-clone']);
		}
	});

	it('attributes only a whole entry-point token the capability itself declares', () => {
		// A substring of a declared entry point, and a name no capability declares.
		expect(
			deriveCapabilityProofs([provenRunRecord('synthetic-partial', 'migrateModalContent')])
				.size,
		).toBe(0);
		expect(
			deriveCapabilityProofs([provenRunRecord('synthetic-unknown', 'someOtherEngine')]).size,
		).toBe(0);
		// The engine string a real run records carries prose around the symbol.
		const derived = deriveCapabilityProofs([
			provenRunRecord(
				'synthetic-prose',
				'@versionless/react craEntryDocument (create-react-app adapter)',
			),
		]);
		expect(derived.get('react-cra-vite-adapter')?.map((proof) => proof.application)).toEqual([
			'synthetic-prose',
		]);
	});

	it('names a published map that fell below the sealed baseline instead of renumbering', () => {
		const coverage = structuredClone(buildCapabilityCoverage()) as unknown as {
			capabilities: Array<Record<string, unknown>>;
			summary: Record<string, unknown>;
		};
		const target = coverage.capabilities.find(
			(capability) => capability.name === 'ngrx-effects-migration',
		) as Record<string, unknown>;
		const kept = (target.provenApps as string[]).slice(0, 1);
		target.provenApps = kept;
		target.proofCount = 1;
		target.classification = 'experimental';
		const summary = coverage.summary as Record<string, number>;
		summary.crossProven -= 1;
		summary.experimental += 1;
		const angular = coverage.summary.angular as Record<string, number>;
		angular.crossProven -= 1;
		angular.experimental += 1;
		expect(() => verifyCapabilityCoverage(coverage)).toThrow(
			/drops the sealed proving application angular-super-productivity/,
		);
	});
});
