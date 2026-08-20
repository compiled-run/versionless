/**
 * The capability map, derived from this repository's own run records.
 *
 * The core package pins the derivation rule; this file pins the wiring — that
 * the published `capability-coverage.json` is what `buildCapabilityCoverage`
 * produces when it is handed the same run records the corpus and the coverage
 * report read, and that a capability's proof set really does move when a clean
 * run names its entry point. The pin lives here because `readRunRecords` is the
 * single run-record reader in this repository and it lives in this package.
 */

import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	buildCapabilityCoverage,
	CAPABILITY_SEALED_BASELINE,
	CAPABILITY_SEALED_BASELINE_SUMMARY,
	deriveCapabilityProofs,
	verifyCapabilityCoverage,
} from '../../core/src/receipts/capability-coverage.ts';
import { readRunRecords } from '../src/coverage-report.ts';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

describe('published capability coverage', () => {
	it('is the derivation over the run records this repository files', async () => {
		const runRecords = await readRunRecords(repoRoot);
		const emitted = JSON.parse(
			await readFile(
				path.join(repoRoot, 'evidence/trust/current/capability-coverage.json'),
				'utf8',
			),
		);
		expect(emitted).toEqual(buildCapabilityCoverage({ runRecords }));
		expect(() => verifyCapabilityCoverage(emitted)).not.toThrow();
	});

	it('reproduces the sealed classification totals it was derived from', async () => {
		const runRecords = await readRunRecords(repoRoot);
		const coverage = buildCapabilityCoverage({ runRecords });
		expect(coverage.summary.total).toBe(CAPABILITY_SEALED_BASELINE_SUMMARY.total);
		expect(coverage.summary.crossProven).toBe(CAPABILITY_SEALED_BASELINE_SUMMARY.crossProven);
		expect(coverage.summary.experimental).toBe(
			CAPABILITY_SEALED_BASELINE_SUMMARY.experimental,
		);
		expect(coverage.summary.total).toBe(59);
		expect(coverage.summary.crossProven).toBe(8);
		expect(coverage.summary.experimental).toBe(51);
	});

	it('carries every derived proof beside the sealed one, with its own run record cited', async () => {
		const runRecords = await readRunRecords(repoRoot);
		const derived = deriveCapabilityProofs(runRecords);
		const coverage = buildCapabilityCoverage({ runRecords });
		for (const sealed of CAPABILITY_SEALED_BASELINE) {
			const published = coverage.capabilities.find(
				(capability) => capability.name === sealed.name,
			);
			const additions = (derived.get(sealed.name) ?? []).filter(
				(proof) => !sealed.provenApps.includes(proof.application),
			);
			expect(published?.provenApps).toEqual([
				...sealed.provenApps,
				...additions.map((proof) => proof.application),
			]);
			for (const proof of additions) expect(published?.evidence).toContain(proof.evidence);
		}
	});

	it('attributes a run only where the corpus already admits it as a source application', async () => {
		const runRecords = await readRunRecords(repoRoot);
		const attributed = new Set(
			[...deriveCapabilityProofs(runRecords).values()].flatMap((proofs) =>
				proofs.map((proof) => proof.application),
			),
		);
		for (const application of attributed) {
			const record = runRecords.find((entry) => entry.id === application);
			expect(record?.terminalClassification).toBe('proven');
			expect(record?.interventions?.count).toBe(0);
			expect(record?.stages?.every((stage) => stage.status === 'ran')).toBe(true);
		}
	});
});
