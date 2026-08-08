import { readFile, readdir } from 'node:fs/promises';
import * as path from 'pathe';
import { describe, expect, test } from 'vitest';
import { canonicalize, sha256 } from '../../core/src/receipts/canonicalize.ts';
import { parseMigrationReceipt, type MigrationReceipt } from '../../core/src/receipts/schema.ts';
import {
	parseAngularPhonecatReceiptWithDiagnostic,
	resolveAngularPhonecatReceiptIdentity,
	type AngularPhonecatInternalReceiptIdentity,
} from '../src/fixture/angular-phonecat-vite8-run.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('Angular PhoneCat Vite 8 fixture', () => {
	test('keeps canonical receipt identity and closes internal identities to two unaggregated orders', () => {
		expect(resolveAngularPhonecatReceiptIdentity(undefined, true)).toEqual({
			runId: 'T069-angular-phonecat-vite8',
			fixture: 'angular-phonecat-vite8',
		});
		const identities = (['react-first', 'phonecat-first'] as const).map((identity) =>
			resolveAngularPhonecatReceiptIdentity(identity, false),
		);
		expect(identities).toEqual([
			{
				runId: 'vite8-shared-adapter-cohort-react-first-phonecat-internal',
				fixture: 'angular-phonecat-vite8-shared-adapter-internal',
			},
			{
				runId: 'vite8-shared-adapter-cohort-phonecat-first-phonecat-internal',
				fixture: 'angular-phonecat-vite8-shared-adapter-internal',
			},
		]);
		for (const identity of ['react-first', 'phonecat-first'] as const)
			expect(() => resolveAngularPhonecatReceiptIdentity(identity, true)).toThrow(
				'cannot be aggregated',
			);
		for (const identity of [
			'T069-angular-phonecat-vite8',
			'angular-phonecat-vite8',
			'arbitrary',
		])
			expect(() =>
				resolveAngularPhonecatReceiptIdentity(
					identity as AngularPhonecatInternalReceiptIdentity,
					false,
				),
			).toThrow('Unknown Angular PhoneCat internal receipt identity');
	});

	test('parses canonical and truthful internal receipt identities without weakening T069 paths', async () => {
		const canonical = JSON.parse(
			await readFile(
				path.join(root, 'evidence/runs/angular-phonecat-vite8/t069-run.json'),
				'utf8',
			),
		) as MigrationReceipt;
		expect(parseMigrationReceipt(canonical)).toMatchObject({
			runId: 'T069-angular-phonecat-vite8',
			fixture: 'angular-phonecat-vite8',
		});
		const alternatePaths = canonical.artifacts.map(
			(artifact) =>
				`.versionless/work/vite8-shared-adapter-cohort/react-first/phonecat-artifacts/${path.basename(artifact.path)}`,
		);
		const invalidCanonical = structuredClone(canonical);
		invalidCanonical.artifacts.forEach((artifact, index) => {
			artifact.path = alternatePaths[index]!;
		});
		expect(() => parseMigrationReceipt(invalidCanonical)).toThrow(
			'Receipt schema invalid AngularJS migration evidence',
		);

		for (const identity of ['react-first', 'phonecat-first'] as const) {
			const derivative = structuredClone(invalidCanonical);
			Object.assign(derivative, resolveAngularPhonecatReceiptIdentity(identity, false));
			const parsed = parseMigrationReceipt(derivative);
			expect(parsed.artifacts.map((artifact) => artifact.path)).toEqual(alternatePaths);
			expect(parsed.migration).toMatchObject({ serviceWorker: 'out-of-scope-not-emitted' });
			expect('aggregate' in parsed).toBe(false);
		}
	});

	test('retains the complete unmodified receipt and original cause in diagnostics', async () => {
		const receipt = JSON.parse(
			await readFile(
				path.join(root, 'evidence/runs/angular-phonecat-vite8/t069-run.json'),
				'utf8',
			),
		) as MigrationReceipt;
		Object.assign(receipt, resolveAngularPhonecatReceiptIdentity('react-first', false));
		receipt.artifacts.forEach((artifact) => {
			artifact.path = `.versionless/work/vite8-shared-adapter-cohort/react-first/phonecat-artifacts/${path.basename(artifact.path)}`;
		});
		(receipt as unknown as Record<string, unknown>).schemaVersion = 'invalid';
		const before = canonicalize(receipt);
		let failure: Error | undefined;
		try {
			parseAngularPhonecatReceiptWithDiagnostic(receipt);
		} catch (error) {
			failure = error instanceof Error ? error : new Error(String(error));
		}
		expect(failure?.cause).toBeInstanceOf(Error);
		expect(failure?.message).toContain(
			'versionless.angular-phonecat-receipt-validation-diagnostic.v1',
		);
		expect(failure?.message).toContain('Unsupported receipt schema');
		expect(failure?.message).toContain(receipt.runId);
		expect(failure?.message).toContain(receipt.fixture);
		for (const artifact of receipt.artifacts) expect(failure?.message).toContain(artifact.path);
		expect(failure?.message).toContain(before);
		expect(canonicalize(receipt)).toBe(before);
	});

	test('pins the immutable source and fixture-specific adapter', async () => {
		const manifest = JSON.parse(
			await readFile(path.join(root, 'fixtures/angular-phonecat-vite8/fixture.json'), 'utf8'),
		) as Record<string, Record<string, string> | string>;
		expect(manifest.id).toBe('angular-phonecat-vite8');
		expect(manifest.track).toBe('angularjs-special-track');
		expect((manifest.source as Record<string, string>).revision).toBe(
			'ef6f6eb672ded472b4e442d598f5df40d0e0642c',
		);
		expect((manifest.vite as Record<string, string>).version).toBe('8.0.16');
		expect((manifest.vite as Record<string, string>).adapter).toBe(
			'fixtures/angular-phonecat-vite8/vite.adapter.ts',
		);
	});

	test('binds the exact content-addressed library closure and provenance', async () => {
		const digest = '811fb0f3190dc4f07398c326dfd47b501d677b8c4662621ccaefe472bf0a717b';
		const cache = path.join(
			root,
			'.versionless/cache/angular-phonecat-vite8/library-trees',
			digest,
		);
		const filesBelow = async (directory: string): Promise<string[]> => {
			const files: string[] = [];
			for (const entry of await readdir(directory, { withFileTypes: true })) {
				const item = path.join(directory, entry.name);
				if (entry.isDirectory()) files.push(...(await filesBelow(item)));
				else if (entry.isFile()) files.push(item);
			}
			return files.sort();
		};
		const library = path.join(cache, 'app/lib');
		const entries = await Promise.all(
			(await filesBelow(library)).map(async (file) => ({
				path: path.relative(library, file).split(path.sep).join('/'),
				sha256: sha256(await readFile(file)),
			})),
		);
		const manifest = JSON.parse(await readFile(path.join(cache, 'manifest.json'), 'utf8')) as {
			treeSha256: string;
			entries: Array<{ path: string; sha256: string }>;
		};
		const provenance = JSON.parse(
			await readFile(path.join(cache, 'provenance.json'), 'utf8'),
		) as Record<string, unknown>;
		expect(manifest.entries).toEqual(entries);
		expect(manifest.treeSha256).toBe(digest);
		expect(sha256(canonicalize(entries))).toBe(digest);
		expect(provenance).toMatchObject({
			packageLockSha256: '29da5826ec1bc5fa1c0a0b1a5091acbcf5bb5d700adac1dc3169031e1395aeb8',
			verifiedLibraryTreeSha256: digest,
		});
	});

	test('derives the shared profile from the immutable fixture adapter and core kernel', async () => {
		const profile = await readFile(
			path.join(root, 'fixtures/angular-phonecat-vite8/vite.shared-adapter.ts'),
			'utf8',
		);
		expect(profile).toContain("import adapter from './vite.adapter.ts'");
		expect(profile).toContain('createVite8AdapterKernel');
		expect(profile).toContain("profile: 'angular-phonecat'");
	});
});
