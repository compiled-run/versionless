import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { ADAPTER_FREEZE_SUBTREES } from '../../trust/src/freeze.ts';
import {
	buildRefusalCensus,
	CENSUS_ROOTS,
	REFUSAL_CENSUS_FILE,
	REFUSAL_CENSUS_SCHEMA,
	collapseWhitespace,
	slugOf,
	type RefusalCensus,
} from '../src/operator/refusal-census.ts';

const readPublished = async (): Promise<RefusalCensus> =>
	JSON.parse(await readFile(REFUSAL_CENSUS_FILE, 'utf8')) as RefusalCensus;

/**
 * The two refusal strings on record from the fleet dry run. They are quoted
 * here exactly as `evidence/spikes/fleet-batch-dryrun/fleet-summary.json`
 * carries them, because the point of the census is that a string cannot drift
 * without something failing.
 */
const REACT_ADMISSION_REFUSAL =
	'React plan: this tree declares neither react-scripts nor a Vite configuration, so no frozen React adapter claims it. This flow refuses rather than guessing an origin toolchain.';

const ANGULAR_TSCONFIG_REFUSAL =
	'Angular tsconfig migration: the configuration appears to carry comments. This capability rewrites strict JSON only; a JSONC configuration would lose its comments silently, so it is refused instead.';

describe('refusal census — the published document', () => {
	/**
	 * The census is derived from the checkout, so the published copy has to be
	 * exactly what the checkout produces. A refusal that was added, reworded or
	 * removed without regenerating fails here rather than going uncounted.
	 */
	it('is byte-identical to the derivation from this checkout', async () => {
		const derived = await buildRefusalCensus();
		const published = await readFile(REFUSAL_CENSUS_FILE, 'utf8');
		expect(published).toBe(`${JSON.stringify(derived, null, '\t')}\n`);
	});

	it('carries a code, a message and a condition for every site', async () => {
		const census = await readPublished();
		expect(census.schemaVersion).toBe(REFUSAL_CENSUS_SCHEMA);
		expect(census.entries.length).toBeGreaterThan(100);
		for (const entry of census.entries) {
			expect(entry.code.length).toBeGreaterThan(0);
			expect(entry.message.length).toBeGreaterThan(0);
			expect(entry.condition.length).toBeGreaterThan(0);
			expect(['frozen-adapter', 'pipeline']).toContain(entry.origin);
			expect(['refusal', 'defect', 'unclassified']).toContain(entry.classification);
			expect(entry.line).toBeGreaterThan(0);
		}
		/** A code is a tally key, so two sites may not share one. */
		expect(new Set(census.entries.map((entry) => entry.code)).size).toBe(census.entries.length);
		expect(census.summary.sites).toBe(census.entries.length);
	});

	it('reads only the declared roots, and reads the frozen subtrees read-only', async () => {
		const census = await readPublished();
		const roots = CENSUS_ROOTS.map((scanned) => scanned.root);
		expect(census.roots).toEqual(roots);
		for (const entry of census.entries)
			expect(roots.some((root) => entry.file.startsWith(`${root}/`))).toBe(true);
		/** Every frozen-origin site sits inside a subtree the freeze declares. */
		const frozen = ADAPTER_FREEZE_SUBTREES.map((subtree) => subtree.path);
		for (const entry of census.entries)
			if (entry.file.startsWith('packages/cli/src/operator/')) continue;
			else expect(frozen.some((subtree) => entry.file.startsWith(`${subtree}/`))).toBe(true);
		expect(census.adapterFreezeComposite.length).toBe(64);
	});
});

describe('refusal census — the strings it is accountable for', () => {
	it('carries the React admission refusal verbatim, as a frozen-adapter decision', async () => {
		const census = await readPublished();
		const entry = census.entries.find(
			(candidate) => candidate.message === REACT_ADMISSION_REFUSAL,
		);
		expect(entry).toBeDefined();
		expect(entry?.origin).toBe('frozen-adapter');
		expect(entry?.stage).toBe('plan');
		expect(entry?.classification).toBe('refusal');
		expect(entry?.file).toBe('packages/cli/src/operator/plan.ts');
	});

	/**
	 * The Angular tsconfig refusal is assembled at runtime from a template and a
	 * concatenation, so the census records the source form. Every literal run of
	 * it still has to appear inside the string the fleet record shows was
	 * emitted — that is what makes the recorded form checkable rather than
	 * merely plausible.
	 */
	it('accounts for the Angular tsconfig refusal through its literal runs', async () => {
		const census = await readPublished();
		const entry = census.entries.find((candidate) =>
			candidate.staticSegments.some((segment) =>
				segment.includes('This capability rewrites strict JSON only'),
			),
		);
		expect(entry).toBeDefined();
		expect(entry?.origin).toBe('frozen-adapter');
		expect(entry?.messageForm).toBe('composed');
		for (const segment of entry?.staticSegments ?? [])
			expect(ANGULAR_TSCONFIG_REFUSAL).toContain(segment);
	});

	it('separates a refusal from a defect in the pipeline’s own flows', async () => {
		const census = await readPublished();
		const pipeline = census.entries.filter((entry) =>
			entry.file.startsWith('packages/cli/src/operator/'),
		);
		expect(
			pipeline.filter((entry) => entry.classification === 'refusal').length,
		).toBeGreaterThan(15);
		/** The composed-digest mismatch is a defect, and stays one. */
		const defects = pipeline.filter((entry) => entry.classification === 'defect');
		expect(defects.length).toBeGreaterThan(0);
		expect(defects.map((entry) => entry.message).join('\n')).toContain(
			'composed digest mismatch',
		);
	});

	it('counts the two npm policy decisions the spike named as manual residue', async () => {
		const census = await readPublished();
		const codes = census.entries.map((entry) => entry.code);
		expect(codes).toContain('install.remote-tarball-policy-not-declared');
		expect(codes).toContain('install.install-script-policy-not-declared');
		for (const code of [
			'install.remote-tarball-policy-not-declared',
			'install.install-script-policy-not-declared',
		]) {
			const entry = census.entries.find((candidate) => candidate.code === code);
			expect(entry?.stage).toBe('install');
			expect(entry?.origin).toBe('pipeline');
		}
	});

	/**
	 * The era cell is the third admission parameter, and spike C named it the
	 * one that stopped the baseline rather than a cost it measured. Its refusals
	 * are countable through this census like the other two, which is what keeps
	 * "the host could not provide the cell" a tally key instead of a stack
	 * trace an operator reads.
	 */
	it('counts the era-cell refusals the spike named as the wall', async () => {
		const census = await readPublished();
		const codes = census.entries.map((entry) => entry.code);
		for (const code of [
			'era-cell.node-major-not-inferable',
			'era-cell.cell-not-declared-for-framework',
			'era-cell.required-node-not-installed',
			'era-cell.arch-not-available',
		]) {
			expect(codes).toContain(code);
			const entry = census.entries.find((candidate) => candidate.code === code);
			expect(entry?.stage).toBe('era-cell');
			expect(entry?.origin).toBe('pipeline');
			expect(entry?.classification).toBe('refusal');
			expect(entry?.file).toBe('packages/cli/src/operator/era-cell.ts');
		}
		/** The arm64 reading is the spike's own, quoted rather than paraphrased. */
		const architecture = census.entries.find(
			(entry) => entry.code === 'era-cell.arch-not-available',
		);
		expect(architecture?.message).toContain('${sentence(architectureBasis)}');
	});

	/**
	 * The frozen subtrees also refuse by recording a reason through a local
	 * helper rather than by throwing. T001 enumerated neither. Counting them is
	 * the difference between a bounded gap and an unknown one.
	 */
	it('counts the refusals the frozen subtrees record rather than throw', async () => {
		const census = await readPublished();
		expect(census.summary.recordedRefusalSites).toBe(census.recordedRefusals.length);
		expect(census.recordedRefusals.length).toBeGreaterThan(0);
		for (const recorded of census.recordedRefusals) {
			expect(recorded.origin).toBe('frozen-adapter');
			expect(recorded.message.length).toBeGreaterThan(0);
			expect(recorded.file.startsWith('packages/cli/src/operator/')).toBe(false);
		}
		expect(census.notEstablished.join('\n')).toContain('recordedRefusals');
	});

	it('states what it does not cover', async () => {
		const census = await readPublished();
		const joined = census.notEstablished.join('\n');
		expect(joined).toContain('shells out to');
		expect(joined).toContain('not a coverage number');
		expect(census.notEstablished.length).toBeGreaterThan(3);
	});
});

describe('refusal census — the derivation helpers', () => {
	it('collapses a multi-line guard onto one line without losing a token', () => {
		expect(collapseWhitespace('a\n\t&&\n\tb')).toBe('a && b');
		expect(collapseWhitespace('  ')).toBe('');
	});

	it('derives a readable, bounded slug from a message', () => {
		expect(slugOf('React plan: this tree declares neither react-scripts')).toBe(
			'react-plan-this-tree-declares-neither-react-scripts',
		);
		expect(slugOf('!!!')).toBe('unnamed');
		expect(slugOf('x'.repeat(200)).length).toBeLessThanOrEqual(64);
	});
});
