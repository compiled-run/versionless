import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
	ANGULAR_TINY_TRANSLATOR_APP,
	ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
	WITNESS_ANGULAR_TINY_TRANSLATOR_SEAM_ORIGINS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES,
	WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES,
} from '../../core/src/receipts/witness-angular-tiny-translator.ts';
import {
	WITNESS_DOWNLOAD_CAPTURE_RULE,
	WITNESS_FILE_INPUT_LOAD_RULE,
} from '../../core/src/receipts/witness-real-app.ts';
import {
	angularTinyTranslatorTransport,
	angularTinyTranslatorWitnessSpec,
	buildDownloadCaptureInventory,
	buildFileInputLoadInventory,
	TINY_TRANSLATOR_JOURNEY_NAVIGATIONS,
	TINY_TRANSLATOR_MUTATION_SEAM,
	WITNESS_ANGULAR_TINY_TRANSLATOR_CONSOLE_ERRORS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FAILED_REQUESTS,
	WITNESS_ANGULAR_TINY_TRANSLATOR_SEAMS,
} from '../src/witness/real-app-run.ts';
import { witnessBrowserContextOptions } from '../src/witness/playwright-host.ts';
import { WITNESS_ANGULAR_TINY_TRANSLATOR_NONCLAIMS } from '../src/witness/angular-tiny-translator-run.ts';

const spec = angularTinyTranslatorWitnessSpec();

describe('the TinyTranslator journey wiring', () => {
	it('is the Angular vertical the receipt schema names, on the roots it binds', () => {
		expect(spec.app).toBe(ANGULAR_TINY_TRANSLATOR_APP);
		expect(spec.framework).toBe('angular');
		const bound = Object.fromEntries(
			ANGULAR_TINY_TRANSLATOR_CANONICAL_RECEIPTS.map((receipt) => [
				receipt.lane,
				receipt.canonicalRoot,
			]),
		);
		// The lane roots the spec serves must END with the canonical output root
		// the schema pins for that lane; serving a sibling would be serving one
		// build rather than the lane its byte-identical pair makes canonical.
		expect(spec.sources.baseline.endsWith(bound.baseline!)).toBe(true);
		expect(spec.sources.migrated.endsWith(bound.migrated!)).toBe(true);
	});

	it('deep-links to a hash route, so every recorded route is one', () => {
		expect(spec.initialRoute).toBe('/#/home');
		expect(TINY_TRANSLATOR_JOURNEY_NAVIGATIONS).toBeGreaterThan(0);
	});

	it('measures against a stated viewport, because it claims scroll absence', () => {
		expect(spec.viewport).toEqual({ width: 1280, height: 1024 });
	});

	it('declares the exact probe list the schema checks, in the schema order', () => {
		expect(spec.renderedStyleProbes).toEqual(WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES);
		// Every declared difference has to name a probe that is actually measured,
		// or the receipt would declare a difference in something nobody looked at.
		for (const difference of WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_DIFFERENCES)
			expect(
				WITNESS_ANGULAR_TINY_TRANSLATOR_STYLE_PROBES.map((probe) => probe.label),
			).toContain(difference.label);
	});

	it('holds both lanes to an empty exact console and failed-request inventory', () => {
		expect(WITNESS_ANGULAR_TINY_TRANSLATOR_CONSOLE_ERRORS).toEqual({
			baseline: [],
			migrated: [],
		});
		expect(WITNESS_ANGULAR_TINY_TRANSLATOR_FAILED_REQUESTS).toEqual({
			baseline: [],
			migrated: [],
		});
		expect(spec.consoleErrorInventory).toBe(WITNESS_ANGULAR_TINY_TRANSLATOR_CONSOLE_ERRORS);
		expect(spec.failedRequestInventory).toBe(WITNESS_ANGULAR_TINY_TRANSLATOR_FAILED_REQUESTS);
	});

	it('publishes nonclaims that name what the proof does not establish', () => {
		expect(WITNESS_ANGULAR_TINY_TRANSLATOR_NONCLAIMS.length).toBeGreaterThan(0);
		for (const claim of WITNESS_ANGULAR_TINY_TRANSLATOR_NONCLAIMS)
			expect(claim.length).toBeGreaterThan(0);
	});
});

describe('the per-lane font seam', () => {
	it('is the pinned stylesheet in the era lane and a font file in the migrated one', () => {
		expect(spec.mockedNonLoopbackSeams).toBe(WITNESS_ANGULAR_TINY_TRANSLATOR_SEAMS);
		expect(WITNESS_ANGULAR_TINY_TRANSLATOR_SEAMS.baseline).toEqual(
			WITNESS_ANGULAR_TINY_TRANSLATOR_BASELINE_SEAMS,
		);
		expect(WITNESS_ANGULAR_TINY_TRANSLATOR_SEAMS.migrated.length).toBeGreaterThan(0);
		for (const seam of WITNESS_ANGULAR_TINY_TRANSLATOR_SEAMS.migrated) {
			expect(seam.method).toBe('GET');
			expect(
				seam.path.startsWith(`${WITNESS_ANGULAR_TINY_TRANSLATOR_SEAM_ORIGINS.migrated}/`),
			).toBe(true);
			expect(
				seam.path.startsWith(WITNESS_ANGULAR_TINY_TRANSLATOR_SEAM_ORIGINS.baseline),
			).toBe(false);
		}
	});

	it('pins every seam query-free, so no provider parameter reaches the evidence', () => {
		for (const lane of ['baseline', 'migrated'] as const)
			for (const seam of WITNESS_ANGULAR_TINY_TRANSLATOR_SEAMS[lane])
				expect(seam.path).not.toContain('?');
	});

	it('answers both of them in context with an empty body, so neither leaves the machine', async () => {
		const stylesheet = await angularTinyTranslatorTransport({
			method: 'GET',
			protocol: 'https:',
			host: 'fonts.googleapis.com',
			pathname: '/icon',
		} as Parameters<typeof angularTinyTranslatorTransport>[0]);
		const font = await angularTinyTranslatorTransport({
			method: 'GET',
			protocol: 'https:',
			host: 'fonts.gstatic.com',
			pathname: '/s/materialicons/v145/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2',
		} as Parameters<typeof angularTinyTranslatorTransport>[0]);
		expect(stylesheet.action).toBe('fulfill');
		expect(font.action).toBe('fulfill');
		expect(stylesheet).toMatchObject({ status: 200, contentType: 'text/css' });
		expect(font).toMatchObject({ status: 200, contentType: 'font/woff2' });
	});
});

describe('the two opt-in mechanisms, as this application declares them', () => {
	it('declares exactly the file-input surface the schema binds', () => {
		expect(spec.fileInputs?.surfaces).toEqual([
			...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
		]);
		expect(path.isAbsolute(spec.fileInputs!.root)).toBe(true);
		// The recorded path is repository-relative; the absolute root it resolves
		// against is the machine's and is never recorded.
		for (const surface of spec.fileInputs!.surfaces)
			expect(path.isAbsolute(surface.fixturePath)).toBe(false);
	});

	it('declares the download surface, which is the only thing that accepts one', () => {
		expect(spec.downloads).toBe('capture');
		expect(WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE.expectedDownloads).toBe(1);
		expect(
			witnessBrowserContextOptions({ downloads: spec.downloads }).acceptDownloads,
		).toBe(true);
	});

	it('builds a file-input inventory the receipt schema accepts', () => {
		const surface = WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES[0]!;
		const inventory = buildFileInputLoadInventory(
			[...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES],
			[
				{
					...surface,
					fileName: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.fileName,
					bytes: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.bytes,
					sha256: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.sha256,
				},
			],
		);
		expect(inventory.policy).toBe('declared-file-input-surfaces-only');
		expect(inventory.rule).toBe(WITNESS_FILE_INPUT_LOAD_RULE);
		expect(inventory.unused).toEqual([]);
		expect(inventory.outsideDeclaration).toEqual([]);
		expect(inventory.loaded).toHaveLength(1);
	});

	it('records a declared surface that was never loaded as unused rather than as absent', () => {
		const inventory = buildFileInputLoadInventory(
			[...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES],
			[],
		);
		expect(inventory.loaded).toEqual([]);
		expect(inventory.unused).toEqual([...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES]);
	});

	it('refuses a load whose surface nobody declared', () => {
		expect(() =>
			buildFileInputLoadInventory(
				[...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES],
				[
					{
						label: 'undeclared',
						selector: 'input[type=file]',
						fixturePath: 'fixtures/x.xlf',
						fileName: 'x.xlf',
						bytes: 1,
						sha256: 'a'.repeat(64),
					},
				],
			),
		).toThrow(/left the declaration/);
	});

	it('builds a download inventory that states the capability it was granted', () => {
		const inventory = buildDownloadCaptureInventory([
			{ suggestedFilename: 'synthetic-messages.xlf', bytes: 1200, sha256: 'b'.repeat(64) },
		]);
		expect(inventory.policy).toBe('declared-download-surface-only');
		expect(inventory.rule).toBe(WITNESS_DOWNLOAD_CAPTURE_RULE);
		expect(inventory.acceptDownloads).toBe(true);
		expect(inventory.captured).toHaveLength(
			WITNESS_ANGULAR_TINY_TRANSLATOR_DOWNLOAD_SURFACE.expectedDownloads,
		);
	});
});

describe('the mutation seam', () => {
	it('is a visible string the journey itself asserts, not an internal token', () => {
		expect(TINY_TRANSLATOR_MUTATION_SEAM).toBe('Upload a translation file (xlf, xtb)');
		expect(TINY_TRANSLATOR_MUTATION_SEAM.length).toBeGreaterThan(8);
		expect(spec.journey.toString()).toContain('TINY_TRANSLATOR_MUTATION_SEAM');
	});
});
