import { readFile } from 'node:fs/promises';
import { join, resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	NEXT_KILLEDBYGOOGLE_V3_APP,
	parseWitnessNextKilledbygoogleV3Receipt,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_STYLE_PROBES,
	WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT,
	witnessNextKilledbygoogleV3BehaviorDigest,
	witnessNextKilledbygoogleV3RawDigest,
} from '../../core/src/receipts/witness-next-killedbygoogle-v3.ts';
import {
	main,
	verifyWitnessNextKilledbygoogleV3,
} from '../src/witness/next-killedbygoogle-v3-0-0-run.ts';
import { KBG_MUTATION_SEAM, nextKilledbygoogleV3WitnessSpec } from '../src/witness/real-app-run.ts';

const root = resolve(import.meta.dirname, '../../..');
const output = join(root, 'evidence/runs/witness-next-killedbygoogle-v3-0-0');
const spec = nextKilledbygoogleV3WitnessSpec();

describe('killedbygoogle v3 Witness journey wiring', () => {
	it('is the Next application the corpus names by its pinned version', () => {
		expect(spec.app).toBe(NEXT_KILLEDBYGOOGLE_V3_APP);
		expect(spec.framework).toBe('next');
	});

	it('measures against the stated viewport the scroll claim is about', () => {
		expect(spec.viewport).toEqual(WITNESS_NEXT_KILLEDBYGOOGLE_V3_VIEWPORT);
	});

	it('declares exactly the inventories and probes the receipt schema enforces', () => {
		expect(spec.consoleErrorInventory).toBe(WITNESS_NEXT_KILLEDBYGOOGLE_V3_CONSOLE_ERRORS);
		expect(spec.failedRequestInventory).toBe(WITNESS_NEXT_KILLEDBYGOOGLE_V3_FAILED_REQUESTS);
		expect(spec.mockedNonLoopbackSeams).toBe(WITNESS_NEXT_KILLEDBYGOOGLE_V3_MOCKED_SEAMS);
		expect(spec.renderedStyleProbes).toHaveLength(WITNESS_NEXT_KILLEDBYGOOGLE_V3_STYLE_PROBES);
		expect(spec.cancelledDuplicateFetches).toBeUndefined();
	});

	it('measures probes that are distinctly labelled and ask for real properties', () => {
		const probes = spec.renderedStyleProbes ?? [];
		expect(new Set(probes.map((probe) => probe.label)).size).toBe(probes.length);
		for (const probe of probes) {
			expect(probe.selector.length).toBeGreaterThan(0);
			expect(probe.properties.length).toBeGreaterThan(0);
		}
	});

	it('is bound to the two committed build lanes and their parity receipt', () => {
		expect(spec.sources).toEqual({
			baseline: '.versionless/cache/next-killedbygoogle-v3-0-0-baseline/app/out-run1',
			migrated: '.versionless/work/next-killedbygoogle-v3-0-0/target/dist-vite-run1',
		});
		expect(spec.canonicalReceipt).toBe(
			'evidence/runs/next-killedbygoogle-v3-0-0/t006-build-lanes.json',
		);
		expect(spec.canonicalDigest).toHaveLength(64);
	});
});

describe('killedbygoogle v3 direct Witness command', () => {
	it('rejects incomplete modes without launching a browser', async () => {
		await expect(main([])).rejects.toThrow('--run-twice');
		await expect(
			main(['--publish', 'evidence/runs/witness-next-killedbygoogle-v3-0-0']),
		).rejects.toThrow('--run-twice');
	});

	it('refuses to publish anywhere but the canonical evidence directory', async () => {
		await expect(main(['--run-twice', '--publish', 'evidence/runs/elsewhere'])).rejects.toThrow(
			'publish path differs',
		);
	});

	it('verifies the published browser-proof evidence', async () => {
		const receipt = parseWitnessNextKilledbygoogleV3Receipt(
			JSON.parse(await readFile(join(output, 'receipt.json'), 'utf8')),
		);
		expect(new Set(receipt.runs.map(witnessNextKilledbygoogleV3BehaviorDigest))).toHaveProperty(
			'size',
			1,
		);
		for (const run of receipt.runs)
			expect(run.semanticDigest).toBe(witnessNextKilledbygoogleV3RawDigest(run));
		await expect(verifyWitnessNextKilledbygoogleV3(output)).resolves.toEqual(receipt);
	});

	it('publishes the journey and mutation artifacts beside the build-lane receipt', async () => {
		const artifacts = join(root, 'evidence/runs/next-killedbygoogle-v3-0-0/artifacts');
		const journeys = JSON.parse(
			await readFile(join(artifacts, 'witness-journeys.json'), 'utf8'),
		) as unknown[];
		const mutation = JSON.parse(
			await readFile(join(artifacts, 'witness-mutation.json'), 'utf8'),
		) as {
			seam: string;
			lane: string;
			intendedFailure: boolean;
			restoredByteIdentically: boolean;
			beforeSha256: string;
			mutatedSha256: string;
			afterRestoreSha256: string;
		};
		expect(journeys).toHaveLength(4);
		expect(mutation.lane).toBe('migrated');
		expect(mutation.intendedFailure).toBe(true);
		expect(mutation.restoredByteIdentically).toBe(true);
		expect(mutation.seam).toBe(KBG_MUTATION_SEAM);
		expect(mutation.beforeSha256).toBe(mutation.afterRestoreSha256);
		expect(mutation.mutatedSha256).not.toBe(mutation.beforeSha256);
	});

	it('keeps host identity out of the published receipt', async () => {
		const serialized = await readFile(join(output, 'receipt.json'), 'utf8');
		expect(serialized).not.toContain(root);
		expect(serialized).not.toContain('127.0.0.1');
	});
});
