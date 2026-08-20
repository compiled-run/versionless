import { readFile } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/fixture/angular-factoriolab-migration-run.ts';
import {
	verifySealedRecord,
	type SealedRecord,
} from '../src/fixture/angular-factoriolab-build-lanes-run.ts';
import {
	firstDifference,
	fontFaceRules,
	linkHrefs,
	logicalNameOf,
} from '../src/fixture/angular-super-productivity-u23-font-record.ts';

const RUN = path.join(
	path.dirname(new URL(import.meta.url).pathname),
	'../../../evidence/runs/angular-super-productivity-v2-13-15',
);

const bytesOf = async (name: string): Promise<string> => readFile(path.join(RUN, name), 'utf8');

const read = async (name: string): Promise<Readonly<Record<string, unknown>>> =>
	JSON.parse(await bytesOf(name)) as Readonly<Record<string, unknown>>;

const record = async (): Promise<Readonly<Record<string, unknown>>> =>
	read('u23-offline-font-lane.json');

const section = (
	value: Readonly<Record<string, unknown>>,
	key: string,
): Readonly<Record<string, unknown>> => value[key] as Readonly<Record<string, unknown>>;

describe('emitted-name elision', () => {
	it('elides a content hash wherever it sits in the name, map files included', () => {
		expect(logicalNameOf('main.96bfd856bd1e081a.js')).toBe('main.js');
		expect(logicalNameOf('main.96bfd856bd1e081a.js.map')).toBe('main.js.map');
		expect(logicalNameOf('MaterialIcons-Regular.196fa4a92dd6fa73.ttf')).toBe(
			'MaterialIcons-Regular.ttf',
		);
	});

	it('leaves a name that carries no hash alone', () => {
		expect(logicalNameOf('ngsw.json')).toBe('ngsw.json');
		expect(logicalNameOf('assets/icons/favicon-16x16.png')).toBe(
			'assets/icons/favicon-16x16.png',
		);
		expect(logicalNameOf('safety-worker.js')).toBe('safety-worker.js');
		/** A short word made of hex characters is a word, not a hash. */
		expect(logicalNameOf('face.css')).toBe('face.css');
	});
});

describe('document readings', () => {
	it('reads every link href and counts only the rules the document carries', () => {
		const html =
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto&amp;display=swap">' +
			'<link href="styles.css" rel="stylesheet"><style>@font-face{}@font-face{}</style>';
		expect(linkHrefs(html)).toEqual([
			'https://fonts.googleapis.com/css?family=Roboto&amp;display=swap',
			'styles.css',
		]);
		expect(fontFaceRules(html)).toBe(2);
		expect(fontFaceRules('<html></html>')).toBe(0);
	});

	it('walks to the first byte two chunks disagree on and says what precedes it', () => {
		expect(firstDifference('same', 'same')).toBeNull();
		const left = `${'x'.repeat(50)}_bang{to{box-shadow:201px`;
		const right = `${'x'.repeat(50)}_bang{to{box-shadow:52px`;
		const difference = firstDifference(left, right);
		expect(difference?.offset).toBe(70);
		expect(difference?.insideBangKeyframes).toBe(true);
		expect(firstDifference('abc', 'abd')?.insideBangKeyframes).toBe(false);
	});
});

describe('super-productivity u23 offline-faithful rebuild', () => {
	it('seals, and answers the u21 locality finding by its published digest', async () => {
		const sealed = await record();
		expect(verifySealedRecord(sealed as SealedRecord)).toEqual(sealed);
		expect(sealed['unit']).toBe('lrapr-t006/u23-super-productivity-offline-rebuild');
		const answers = section(sealed, 'answers');
		const finding = await read('u21-font-inline-locality.json');
		expect(answers['digest']).toBe(finding['digest']);
		expect(finding['rebuildRequired']).toBe(true);
	});

	it('keeps the control build red, with the refused fetch recorded rather than inferred', async () => {
		const control = section(await record(), 'control');
		const build = section(control, 'build');
		expect(build['exitStatus']).not.toBe(0);
		expect(String(build['failure'])).toContain('Inlining of fonts failed');
		const attempts = build['egressAttempts'] as readonly Readonly<Record<string, unknown>>[];
		expect(attempts).toHaveLength(1);
		expect(attempts[0]?.['host']).toBe('fonts.googleapis.com');
		expect(String(control['reading'])).toContain('died when it could not have it');
	});

	it('rebuilds twice green with no egress attempt at all', async () => {
		const sealed = await record();
		const builds = sealed['builds'] as readonly Readonly<Record<string, unknown>>[];
		expect(builds).toHaveLength(2);
		for (const build of builds) {
			expect(build['exitStatus']).toBe(0);
			expect(build['egressAttempts']).toEqual([]);
		}
		expect(sealed['egressFree']).toBe(true);
	});

	it('is deterministic modulo the one clock field, read key by key', async () => {
		const determinism = section(await record(), 'determinism');
		expect(determinism['deterministicModuloClock']).toBe(true);
		expect(determinism['differingAcrossRuns']).toEqual(['ngsw.json']);
		expect(determinism['manifestKeysDiffering']).toEqual(['timestamp']);
		expect(determinism['manifestHashTableIdentical']).toBe(true);
		/** The Sass instability is reported where it appeared, not claimed away. */
		expect(String(determinism['sassRandomFiles'])).toContain('None differed BETWEEN');
	});

	it('re-verifies the 62-artifact census and names every file whose bytes moved', async () => {
		const sealed = await record();
		const census = section(sealed, 'census');
		expect(sealed['artifactsEmitted']).toBe(62);
		expect(census['rebuiltFiles']).toBe(census['supersededFiles']);
		expect(census['logicalNamesMatchSuperseded']).toBe(true);
		expect(census['censusHolds']).toBe(true);
		expect(census['changedAgainstSuperseded']).toEqual(['index.html', 'ngsw.json']);
		const sass = section(census, 'sassRandomReading');
		expect(sass['insideBangKeyframes']).toBe(true);
		expect(sass['supersededChunk']).not.toBe(sass['rebuiltChunk']);
	});

	it('carries both worker chunks through the rebuild, unchanged and still wired up', async () => {
		const workers = section(await record(), 'workerChunks');
		const emitted = workers['emitted'] as readonly string[];
		const previous = section(await read('u18j-worker-chunks-parity.json'), 'workerChunks');
		expect(emitted).toEqual(previous['emitted']);
		expect(workers['byteIdenticalToSuperseded']).toBe(true);
		expect(workers['referencedByRuntime']).toHaveLength(2);
		expect(workers['precachedByServiceWorker']).toHaveLength(2);
		expect(workers['hashTableEntries']).toBe(46);
	});

	it('puts the era font seam back: the link restored, the fetched rules gone', async () => {
		const document = section(await record(), 'document');
		expect(document['inlinedFontFaceRules']).toBe(0);
		expect(document['supersededInlinedFontFaceRules']).toBe(45);
		expect(document['preconnectEmitted']).toBe(false);
		expect(document['supersededPreconnectEmitted']).toBe(true);
		expect(document['emittedFontLinksMatchSource']).toBe(true);
		const emitted = document['emittedFontLinks'] as readonly string[];
		expect(emitted).toHaveLength(1);
		expect(emitted[0]).toContain('fonts.googleapis.com/css?family=Roboto');
	});

	it('supersedes u18j by reference, binding the bytes it leaves untouched', async () => {
		const supersedes = section(await record(), 'supersedes');
		expect(supersedes['record']).toBe('u18j-worker-chunks-parity.json');
		expect(supersedes['by']).toBe('reference');
		expect(supersedes['bytesSha256']).toBe(
			sha256(await bytesOf('u18j-worker-chunks-parity.json')),
		);
	});

	it('says what it did not establish, witness work included', async () => {
		const notEstablished = (await record())['notEstablished'] as readonly string[];
		expect(JSON.stringify(notEstablished)).toContain('No witness work');
		expect(JSON.stringify(notEstablished)).toContain('process-scoped');
	});
});
