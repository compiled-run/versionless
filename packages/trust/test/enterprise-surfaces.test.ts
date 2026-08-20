import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { analyzeCorpusConformance } from '../../core/src/corpus/conformance.ts';
import { buildCapabilityCoverage } from '../../core/src/receipts/capability-coverage.ts';
import {
	ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT,
	ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE,
} from '../../core/src/receipts/angular-pre-ivy-boundary-amendment.ts';
import {
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
	HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME,
} from '../../core/src/receipts/holdout-angular-eshop-webspa.ts';
import {
	assertEnterpriseSurfaceHonesty,
	deriveEnterpriseSurfaces,
	ENTERPRISE_REPORT_JSON,
	ENTERPRISE_REPORT_MARKDOWN,
	verifyEnterpriseSurfaces,
	type EnterpriseSurfaceInputs,
} from '../src/enterprise.ts';
import { adapterFreezeRecord } from '../src/freeze.ts';

const root = path.resolve(process.cwd());
const published = path.join(root, 'evidence/trust/current');

async function surfaceInputs(output: string): Promise<EnterpriseSurfaceInputs> {
	const readJson = async (name: string): Promise<Record<string, unknown>> =>
		JSON.parse(await readFile(path.join(published, name), 'utf8')) as Record<string, unknown>;
	return {
		root,
		output,
		manifest: (await readJson(
			'manifest.json',
		)) as unknown as EnterpriseSurfaceInputs['manifest'],
		conformance: await analyzeCorpusConformance({ rootDir: root }),
		capabilityCoverage: buildCapabilityCoverage(),
		matrix: await readJson('matrix.json'),
		controls: await readJson('controls.json'),
		licenses: await readJson('licenses.json'),
		freeze: adapterFreezeRecord(),
		scriptSurface: await readJson('script-surface.json'),
		runtimeScriptObservation: await readJson('runtime-script-observation.json'),
	};
}

async function withCopy(run: (dir: string) => Promise<void>): Promise<void> {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'versionless-enterprise-'));
	try {
		await cp(published, dir, { recursive: true });
		await run(dir);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

describe('enterprise claims surfaces', () => {
	it('derives exactly the counted green cells off the Judge ledger', async () => {
		const { report } = await deriveEnterpriseSurfaces(await surfaceInputs(published));
		const matrix = report.results.supportMatrix;
		expect(matrix.counted.react?.ready).toBe(6);
		expect(matrix.counted.react?.total).toBe(6);
		expect(matrix.counted.react?.cells).toHaveLength(6);
		expect(matrix.counted.angular?.ready).toBe(4);
		expect(matrix.counted.angular?.total).toBe(4);
		expect(matrix.counted.angular?.cells).toHaveLength(4);
		// The demoted Angular RealWorld cell must stay out of the numerator and out
		// of the denominator, which is the whole reason the Angular total is four.
		expect(matrix.demoted.map((entry) => entry.cell)).toContain('angular-realworld-v15-to-v16');
		for (const cell of [...matrix.counted.react!.cells, ...matrix.counted.angular!.cells])
			expect(cell.witnessReceipt).toMatch(/^evidence\/runs\//);
	});

	it('quotes both published holdouts with their exact receipt outcome strings', async () => {
		const { report } = await deriveEnterpriseSurfaces(await surfaceInputs(published));
		const holdouts = report.results.supportMatrix.holdouts;
		const cypress = holdouts.find((holdout) => holdout.application === 'cypress-realworld-app');
		const eshop = holdouts.find(
			(holdout) => holdout.application === HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION,
		);
		expect(cypress?.outcome).toBe('passed');
		expect(cypress?.digest).toBe(
			'76f0b5bd0d8a3fa0596d3c5d190c764ee7402f4e5c27870d36bdb3fa5f04a73e',
		);
		expect(eshop?.outcome).toBe(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME);
		expect(eshop?.digest).toBe(
			'fb921b46925f03947781629dce85b03fb51ad3a0969197098181d10486563fb9',
		);
		expect(eshop?.surfacesNotCovered).toHaveLength(7);
		for (const holdout of holdouts) expect(holdout.countedInLineageNumerator).toBe(false);
	});

	it('keeps the pigallery2 and eShop frozen-install REDs as permanent falsification history', async () => {
		const { report } = await deriveEnterpriseSurfaces(await surfaceInputs(published));
		const history = report.results.supportMatrix.falsificationHistory;
		expect(history.map((entry) => entry.application)).toEqual(
			expect.arrayContaining(['pigallery2', HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION]),
		);
		for (const entry of history) expect(entry.state).toBe('red');
	});

	it('carries the pre-Ivy boundary prevalence and population statement verbatim', async () => {
		const { report, markdown } = await deriveEnterpriseSurfaces(await surfaceInputs(published));
		const prevalence = report.results.supportMatrix.boundaryPrevalence;
		expect(prevalence.published).toBe('5-of-6');
		expect(prevalence.statement).toBe(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.statement);
		expect(markdown).toContain(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.statement);
		expect(markdown).toContain(ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT);
		expect(markdown).not.toContain(ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.neverPublishedAs);
		expect(report.results.supportMatrix.trancheTwoCommitment).toContain('tranche-two');
		expect(report.results.supportMatrix.trancheTwoCommitment).toContain('Angular 12 or 13');
	});

	it('marks every single-application capability out of the matrix', async () => {
		const { report } = await deriveEnterpriseSurfaces(await surfaceInputs(published));
		const capabilities = report.results.supportMatrix.outOfMatrixCapabilities;
		expect(capabilities.experimental).toBe(51);
		expect(capabilities.entries).toHaveLength(51);
	});

	it('refuses a hand-edited machine artifact', async () => {
		await withCopy(async (dir) => {
			const file = path.join(dir, ENTERPRISE_REPORT_JSON);
			const document = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
			const results = document.results as Record<string, Record<string, never>>;
			const counted = (
				results.supportMatrix as unknown as Record<
					string,
					Record<string, { cells: unknown[] }>
				>
			).counted!;
			counted.angular!.cells.push({
				...(counted.angular!.cells[0] as object),
				cell: 'invented',
			});
			await writeFile(file, `${JSON.stringify(document, null, 2)}\n`);
			await expect(verifyEnterpriseSurfaces(await surfaceInputs(dir))).rejects.toThrow(
				/does not match independent re-derivation/,
			);
		});
	});

	it('refuses a hand-edited human document', async () => {
		await withCopy(async (dir) => {
			const file = path.join(dir, ENTERPRISE_REPORT_MARKDOWN);
			const text = await readFile(file, 'utf8');
			await writeFile(
				file,
				text.replace('6/6 counted green cells', '7/7 counted green cells'),
			);
			await expect(verifyEnterpriseSurfaces(await surfaceInputs(dir))).rejects.toThrow(
				/does not match independent re-derivation/,
			);
		});
	});

	it('refuses blanket-support language, a generic eShop restatement, a rounded prevalence, and a dropped population statement', async () => {
		const { markdown } = await deriveEnterpriseSurfaces(await surfaceInputs(published));
		expect(() => assertEnterpriseSurfaceHonesty(markdown, 'fixture')).not.toThrow();
		expect(() =>
			assertEnterpriseSurfaceHonesty(
				`${markdown}\n\nVersionless is production-ready.`,
				'fixture',
			),
		).toThrow(/blanket-support language/);
		expect(() =>
			assertEnterpriseSurfaceHonesty(
				`${markdown}\n\n- ${HOLDOUT_ANGULAR_ESHOP_WEBSPA_APPLICATION} passed.`,
				'fixture',
			),
		).toThrow(/without its exact bounded outcome string/);
		expect(() =>
			assertEnterpriseSurfaceHonesty(
				`${markdown}\n\n- Prevalence: ${ANGULAR_PRE_IVY_BOUNDARY_PREVALENCE.neverPublishedAs}.`,
				'fixture',
			),
		).toThrow(/prevalence as 5-of-6/);
		expect(() =>
			assertEnterpriseSurfaceHonesty(
				markdown.split(ANGULAR_PRE_IVY_BOUNDARY_POPULATION_STATEMENT).join(''),
				'fixture',
			),
		).toThrow(/population statement/);
	});

	it('holds the published trust and enterprise documents to the same claim vocabulary', async () => {
		for (const name of ['report.md', ENTERPRISE_REPORT_MARKDOWN]) {
			const text = await readFile(path.join(published, name), 'utf8');
			expect(() => assertEnterpriseSurfaceHonesty(text, name)).not.toThrow();
			expect(text).toContain(HOLDOUT_ANGULAR_ESHOP_WEBSPA_OUTCOME);
			expect(text).toMatch(/5 of 6|5-of-6/);
			expect(text).not.toMatch(/production.{0,2}ready\b/i);
		}
	});

	it('keeps the README free of claims broader than the counted green cells', async () => {
		const readme = await readFile(path.join(root, 'README.md'), 'utf8');
		for (const pattern of [
			/production.{0,2}ready\b/i,
			/enterprise.{0,2}ready\b/i,
			/fully[\s-]support/i,
			/\bany (react|angular)\b/i,
			/\bguarantee[sd]?\b/i,
			/(?<!not[\s-])\bcertified\b/i,
		])
			expect(readme).not.toMatch(pattern);
	});
});
