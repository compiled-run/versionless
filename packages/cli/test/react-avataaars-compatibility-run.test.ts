import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { basename, join } from 'pathe';
import { describe, expect, test } from 'vitest';
import {
	AVATAAARS_SHOW_REACT_SELECTOR,
	AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR,
	assertAvataaarsServiceWorkerEvidence,
	assertAvataaarsShowReactSelector,
	assertAvataaarsTransparentWrappingLabelSelector,
	createAvataaarsReact1831LockDelta,
	publishAvataaarsAggregateAndTrust,
} from '../src/fixture/react-avataaars-compatibility-run.ts';

const exists = (file: string): Promise<boolean> =>
	access(file).then(
		() => true,
		() => false,
	);

const artifact = (name: string, version: string, dependencies: Record<string, string>) => ({
	name,
	version,
	url: `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`,
	integrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
	shasum: 'a'.repeat(40),
	sha256: 'b'.repeat(64),
	byteLength: 1,
	dependencies,
});

const react17 = `react@^17.0.0:\n  version "17.0.2"\n  resolved "https://registry.yarnpkg.com/react/-/react-17.0.2.tgz#d0b5cc516d29eb3eee383f75b62864cfb6800037"\n  integrity sha512-gnhPt75i/dq/z3/6q/0asP78D0u592D5L1pd7M8P+dck6Fu/jJeL6iVVK23fptSUZj8Vjf++7wXA8UNclGQcbA==\n  dependencies:\n    loose-envify "^1.1.0"\n    object-assign "^4.1.1"`;
const reactDom17 = `react-dom@^17.0.0:\n  version "17.0.2"\n  resolved "https://registry.yarnpkg.com/react-dom/-/react-dom-17.0.2.tgz#ecffb6845e3ad8dbfcdc498f0d0a939736502c23"\n  integrity sha512-s4h96KtLDUQlsENhMn1ar8t2bEa+q/YAtj8pPPdIjPDGBDIVNsrD9aXNWqspUe6AzKCIG0C1HZZLqLV7qpOBGA==\n  dependencies:\n    loose-envify "^1.1.0"\n    object-assign "^4.1.1"\n    scheduler "^0.20.2"`;
const scheduler17 = `scheduler@^0.20.2:\n  version "0.20.2"\n  resolved "https://registry.yarnpkg.com/scheduler/-/scheduler-0.20.2.tgz#4baee39436e34aa93b4874bddcbf0fe8b8b50e91"\n  integrity sha512-2eWfGgAqqWFGqtdMmcL5zCMK1U8KlXv8SQFGglL3CEtd0aDVDWgeF/YoCmvln55m5zSk3J/20hTaSBeSObsQDQ==\n  dependencies:\n    loose-envify "^1.1.0"\n    object-assign "^4.1.1"`;

describe('Avataaars compatibility runner boundaries', () => {
	test('selects exactly one checked transparent input inside its wrapping label', () => {
		const wrapped = {
			relation: 'wrapped' as const,
			id: 'avatar-style-transparent',
			checked: true,
		};
		expect(AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR).toBe(
			'label > input#avatar-style-transparent:checked',
		);
		expect(() =>
			assertAvataaarsTransparentWrappingLabelSelector(
				AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR,
				[wrapped],
			),
		).not.toThrow();
		for (const [selector, inputs] of [
			['label[for="avatar-style-transparent"]', [wrapped]],
			[
				AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR,
				[{ ...wrapped, relation: 'for-based' as const }],
			],
			[
				AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR,
				[{ ...wrapped, relation: 'unwrapped' as const }],
			],
			[AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR, [{ ...wrapped, checked: false }]],
			[
				AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR,
				[{ ...wrapped, id: 'avatar-style-circle' }],
			],
			[AVATAAARS_TRANSPARENT_WRAPPING_LABEL_SELECTOR, [wrapped, wrapped]],
		] as const)
			expect(() => assertAvataaarsTransparentWrappingLabelSelector(selector, inputs)).toThrow(
				'wrapping-label selector differs',
			);
	});

	test('selects exactly one Show React among every source-backed button state', () => {
		const sourceButtons = ['Random', 'PNG', 'SVG', 'Show React', 'Show <img>'];
		expect(AVATAAARS_SHOW_REACT_SELECTOR).toBe('form button:nth-of-type(3)');
		expect(() =>
			assertAvataaarsShowReactSelector(AVATAAARS_SHOW_REACT_SELECTOR, sourceButtons),
		).not.toThrow();
		for (const [selector, labels] of [
			['button', sourceButtons],
			[AVATAAARS_SHOW_REACT_SELECTOR, ['Random', 'PNG', 'SVG', 'Show <img>']],
			[AVATAAARS_SHOW_REACT_SELECTOR, [...sourceButtons, 'Show React']],
			[AVATAAARS_SHOW_REACT_SELECTOR, ['Random', 'PNG', 'SVG', 'Hide React', 'Show <img>']],
		] as const)
			expect(() => assertAvataaarsShowReactSelector(selector, labels)).toThrow(
				'absent, generic, or ambiguous',
			);
	});

	test('creates the exact React 18 target lock delta while retaining legacy Scheduler', () => {
		const result = createAvataaarsReact1831LockDelta(
			`${reactDom17}\n\n${react17}\n\n${scheduler17}\n`,
			[
				artifact('react', '18.3.1', { 'loose-envify': '^1.1.0' }),
				artifact('react-dom', '18.3.1', {
					'loose-envify': '^1.1.0',
					scheduler: '^0.23.2',
				}),
				artifact('scheduler', '0.23.2', { 'loose-envify': '^1.1.0' }),
			],
		);
		expect(result).toContain('react@18.3.1:');
		expect(result).toContain('react-dom@18.3.1:');
		expect(result).toContain('scheduler@^0.20.2:');
		expect(result).toContain('scheduler@^0.23.2:');
		expect(result).not.toContain('react@^17.0.0:');
		expect(() => createAvataaarsReact1831LockDelta(`${react17}\n`, [])).toThrow();
	});

	test('requires zero service-worker state, output requests, and successful nonloopback', () => {
		const clean = {
			serviceWorkers: [{ registrations: 0, controller: null, cacheNames: [] }],
			attemptedNonLoopback: [],
			successfulNonLoopback: 0,
			downloads: [],
			readbacks: [],
		};
		expect(() =>
			assertAvataaarsServiceWorkerEvidence(clean, [
				{ path: '/service-worker.js', status: 200 },
			]),
		).toThrow();
		expect(() => assertAvataaarsServiceWorkerEvidence(clean, [])).not.toThrow();
		expect(() =>
			assertAvataaarsServiceWorkerEvidence(
				{
					...clean,
					serviceWorkers: [{ registrations: 1, controller: null, cacheNames: [] }],
				},
				[],
			),
		).toThrow();
	});

	test('rolls back output, aggregate, and trust on publication failure', async () => {
		const directory = await mkdtemp(join(os.tmpdir(), 'versionless-avataaars-publication-'));
		const aggregateFile = join(directory, 'aggregate.json');
		const positiveOutput = join(directory, 'positive-output');
		const trustReplayDirectory = join(directory, 'trust-replay');
		const trustCurrentDirectory = join(directory, 'trust-current');
		const original =
			'{"schemaVersion":"versionless.aggregate.v1","fixtures":[],"unsupported":[]}\n';
		try {
			await writeFile(aggregateFile, original);
			await mkdir(positiveOutput);
			await writeFile(join(positiveOutput, 'receipt.json'), 'positive');
			await mkdir(trustCurrentDirectory);
			await writeFile(join(trustCurrentDirectory, 'marker'), 'original-trust');
			await expect(
				publishAvataaarsAggregateAndTrust('a'.repeat(64), {
					aggregateFile,
					positiveOutput,
					trustReplayDirectory,
					trustCurrentDirectory,
					analyze: async () => undefined,
					generate: async (outputDir) => {
						if (basename(outputDir) === 'replay') {
							await mkdir(outputDir, { recursive: true });
							await writeFile(join(outputDir, 'marker'), 'candidate-trust');
						}
					},
					verify: async () => undefined,
					now: () => '2026-08-09T00:00:00.000Z',
				}),
			).rejects.toThrow();
			expect(await readFile(aggregateFile, 'utf8')).toBe(original);
			expect(await exists(positiveOutput)).toBe(false);
			expect(await readFile(join(trustCurrentDirectory, 'marker'), 'utf8')).toBe(
				'original-trust',
			);
			expect(await exists(trustReplayDirectory)).toBe(false);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
