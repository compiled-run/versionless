import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import {
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE,
	WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
} from '../../core/src/receipts/witness-angular-tiny-translator.ts';
import {
	createPlaywrightWitnessHost,
	recordWitnessCapturedDownload,
	recordWitnessLoadedFileInput,
	validateWitnessFileInputDeclaration,
	witnessBrowserContextOptions,
	witnessFileInputSurface,
	type WitnessFileInputDeclaration,
} from '../src/witness/playwright-host.ts';
import { witnessRealAppSpecs } from '../src/witness/real-app-run.ts';

const root = path.resolve(import.meta.dirname, '../../..');

/**
 * A declaration in exactly the shape an application makes one: an absolute root
 * that is never recorded, and a repository-relative fixture path that is.
 */
const declaration: WitnessFileInputDeclaration = {
	root,
	surfaces: [...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES],
};

/** A host with neither opt-in, which is every vertical that predates them. */
const plainHost = () => createPlaywrightWitnessHost({ chromiumExecutable: '/nonexistent' });

describe('per-application file-input opt-in', () => {
	it('resolves a declared surface by label', () => {
		const surface = witnessFileInputSurface(declaration, 'translation-file');
		expect(surface.selector).toBe('input[type=file]');
		expect(path.isAbsolute(surface.fixturePath)).toBe(false);
	});

	it('records the bytes it hands the page, by name, length and digest', async () => {
		const surface = witnessFileInputSurface(declaration, 'translation-file');
		const bytes = await readFile(path.join(declaration.root, surface.fixturePath));
		const loaded = recordWitnessLoadedFileInput(surface, bytes);
		expect(loaded).toEqual({
			label: 'translation-file',
			selector: 'input[type=file]',
			fixturePath: surface.fixturePath,
			fileName: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.fileName,
			bytes: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.bytes,
			sha256: WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_FIXTURE.sha256,
		});
	});

	it('records no host-specific absolute path in what it hands over', async () => {
		const surface = witnessFileInputSurface(declaration, 'translation-file');
		const bytes = await readFile(path.join(declaration.root, surface.fixturePath));
		expect(JSON.stringify(recordWitnessLoadedFileInput(surface, bytes))).not.toContain(root);
	});

	it('refuses a surface an application never declared', () => {
		expect(() => witnessFileInputSurface(declaration, 'some-other-input')).toThrow(
			/not declared: some-other-input/,
		);
	});

	it('refuses every load where the application declared no surface at all', async () => {
		await expect(plainHost().loadFileInput('translation-file')).rejects.toThrow(
			/file-input mechanism is not declared/,
		);
	});

	it('reads back nothing for a host that was never handed a file', () => {
		expect(plainHost().loadedFileInputs()).toEqual([]);
	});

	it('refuses a declaration whose fixture path is absolute or climbs out of the root', () => {
		expect(() =>
			validateWitnessFileInputDeclaration({
				root,
				surfaces: [{ label: 'a', selector: 'input', fixturePath: '/etc/hosts' }],
			}),
		).toThrow(/malformed/);
		expect(() =>
			validateWitnessFileInputDeclaration({
				root,
				surfaces: [{ label: 'a', selector: 'input', fixturePath: '../outside.xlf' }],
			}),
		).toThrow(/malformed/);
	});

	it('refuses a declaration that names one label twice, or names nothing', () => {
		const surface = { label: 'a', selector: 'input', fixturePath: 'fixtures/a.xlf' };
		expect(() =>
			validateWitnessFileInputDeclaration({ root, surfaces: [surface, surface] }),
		).toThrow(/declared twice/);
		expect(() => validateWitnessFileInputDeclaration({ root, surfaces: [] })).toThrow(
			/names no surface/,
		);
	});

	it('accepts the declaration this corpus actually makes', () => {
		expect(validateWitnessFileInputDeclaration(declaration).surfaces).toHaveLength(1);
	});
});

describe('per-application download-capture opt-in', () => {
	it('puts acceptDownloads on the context only where the application declared it', () => {
		const opted = witnessBrowserContextOptions({ downloads: 'capture' });
		const plain = witnessBrowserContextOptions({});
		expect(opted.acceptDownloads).toBe(true);
		// Absence, not falsity: the key is not on the options object at all, so
		// the browser's own refusing default is what the context is built with.
		expect(Object.hasOwn(plain, 'acceptDownloads')).toBe(false);
		expect(
			Object.hasOwn(
				witnessBrowserContextOptions({ serviceWorkers: 'block' }),
				'acceptDownloads',
			),
		).toBe(false);
	});

	it('leaves every other context option exactly as it was', () => {
		expect(witnessBrowserContextOptions({})).toEqual({ serviceWorkers: 'allow' });
		expect(witnessBrowserContextOptions({ serviceWorkers: 'block' })).toEqual({
			serviceWorkers: 'block',
		});
		expect(witnessBrowserContextOptions({ viewport: { width: 1280, height: 720 } })).toEqual({
			serviceWorkers: 'allow',
			viewport: { width: 1280, height: 720 },
		});
		expect(witnessBrowserContextOptions({ contextProfile: 'canonical-t060' })).toEqual({
			serviceWorkers: 'allow',
			locale: 'en-US',
			timezoneId: 'America/Chicago',
			viewport: { width: 1280, height: 720 },
		});
	});

	it('records a download by suggested filename, length and digest', () => {
		const captured = recordWitnessCapturedDownload(
			'synthetic-messages.xlf',
			Buffer.from('<xliff/>'),
		);
		expect(captured).toEqual({
			suggestedFilename: 'synthetic-messages.xlf',
			bytes: 8,
			sha256: recordWitnessCapturedDownload('x', Buffer.from('<xliff/>')).sha256,
		});
		expect(captured.sha256).toHaveLength(64);
	});

	it('refuses to record a download the browser gave no name for', () => {
		expect(() => recordWitnessCapturedDownload('', Buffer.alloc(1))).toThrow(
			/unnamed download/,
		);
	});

	it('refuses a readback where the application declared no download surface', async () => {
		await expect(plainHost().capturedDownloads()).rejects.toThrow(
			/download capture is not declared/,
		);
	});

	it('reads back an empty ledger for a declared surface that produced nothing', async () => {
		const host = createPlaywrightWitnessHost({
			chromiumExecutable: '/nonexistent',
			downloads: 'capture',
		});
		await expect(host.capturedDownloads()).resolves.toEqual([]);
	});
});

/**
 * Exactly one application declares the mechanisms, and it is named here rather
 * than detected, so a second vertical quietly declaring one would fail the
 * count below instead of joining an exemption.
 */
const DECLARING_APP = 'angular-tiny-translator';
const predatingSpecs = witnessRealAppSpecs.filter((spec) => spec.app !== DECLARING_APP);

describe('the one vertical that declares both mechanisms', () => {
	it('is the only one, and declares a surface and a download surface', () => {
		const declaring = witnessRealAppSpecs.filter(
			(spec) => spec.fileInputs !== undefined || spec.downloads !== undefined,
		);
		expect(declaring.map((spec) => spec.app)).toEqual([DECLARING_APP]);
		const spec = declaring[0]!;
		expect(spec.downloads).toBe('capture');
		expect(spec.fileInputs?.surfaces).toEqual([
			...WITNESS_ANGULAR_TINY_TRANSLATOR_FILE_INPUT_SURFACES,
		]);
		expect(path.isAbsolute(spec.fileInputs!.root)).toBe(true);
	});

	it('is therefore run in a context that accepts downloads and resolves that surface', () => {
		const spec = witnessRealAppSpecs.find((candidate) => candidate.app === DECLARING_APP)!;
		const options = witnessBrowserContextOptions({
			...(spec.viewport === undefined ? {} : { viewport: spec.viewport }),
			...(spec.downloads === undefined ? {} : { downloads: spec.downloads }),
		});
		expect(options.acceptDownloads).toBe(true);
		expect(witnessFileInputSurface(spec.fileInputs, 'translation-file').label).toBe(
			'translation-file',
		);
	});
});

describe('the verticals that predate both mechanisms', () => {
	it('declares neither opt-in in any published application spec', () => {
		expect(predatingSpecs.length).toBeGreaterThan(0);
		expect(predatingSpecs.length).toBe(witnessRealAppSpecs.length - 1);
		for (const spec of predatingSpecs) {
			expect(spec.fileInputs, spec.app).toBeUndefined();
			expect(spec.downloads, spec.app).toBeUndefined();
		}
	});

	it('is therefore run in a context with no downloads capability and no file surface', async () => {
		for (const spec of predatingSpecs) {
			const options = witnessBrowserContextOptions({
				...(spec.serviceWorkers === undefined
					? {}
					: { serviceWorkers: spec.serviceWorkers }),
				...(spec.viewport === undefined ? {} : { viewport: spec.viewport }),
				...(spec.downloads === undefined ? {} : { downloads: spec.downloads }),
			});
			expect(Object.hasOwn(options, 'acceptDownloads'), spec.app).toBe(false);
			await expect(
				createPlaywrightWitnessHost({
					chromiumExecutable: '/nonexistent',
					...(spec.fileInputs === undefined ? {} : { fileInputs: spec.fileInputs }),
				}).loadFileInput('translation-file'),
			).rejects.toThrow(/file-input mechanism is not declared/);
		}
	});
});

/**
 * The third opt-in, walked the same way, at the moment where the count is still
 * zero.
 *
 * The two mechanisms above are checked as "exactly one declares them"; this one
 * is checked as "none does", which is the same discipline one step earlier. It
 * is worth writing down now rather than when the first vertical opts in: a
 * reader of this suite can see that the reader shipped ahead of any application
 * using it, and the day one does, this expectation fails and has to be
 * rewritten deliberately instead of a second vertical quietly joining.
 */
describe('the IndexedDB key reader, before any vertical declares it', () => {
	it('is declared by no published application spec', () => {
		expect(witnessRealAppSpecs.length).toBeGreaterThan(0);
		expect(
			witnessRealAppSpecs.filter((spec) => spec.indexedDb !== undefined).map((spec) => spec.app),
		).toEqual([]);
	});

	it('leaves every published spec in a byte-identical browser context', () => {
		// The reader is the right to ask a question, not a context capability, so
		// unlike `acceptDownloads` there is nothing for it to put on the options.
		// A vertical that opted in would still be run in exactly this context.
		for (const spec of witnessRealAppSpecs) {
			const base = {
				...(spec.serviceWorkers === undefined
					? {}
					: { serviceWorkers: spec.serviceWorkers }),
				...(spec.viewport === undefined ? {} : { viewport: spec.viewport }),
				...(spec.downloads === undefined ? {} : { downloads: spec.downloads }),
			};
			expect(witnessBrowserContextOptions(base), spec.app).toEqual(
				witnessBrowserContextOptions({ ...base }),
			);
		}
	});

	it('therefore refuses the reading for every one of them', async () => {
		for (const spec of witnessRealAppSpecs)
			await expect(
				createPlaywrightWitnessHost({
					chromiumExecutable: '/nonexistent',
					...(spec.indexedDb === undefined ? {} : { indexedDb: spec.indexedDb }),
				}).indexedDbKeys(),
				spec.app,
			).rejects.toThrow(/IndexedDB key reading is not declared/);
	});
});
