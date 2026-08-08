import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/receipts/canonicalize.ts';
import {
	assertNoIntroducedExternalScripts,
	scanStaticEntrypoint,
	verifyScriptSurface,
	type ScriptRecord,
} from '../src/enterprise/script-surface.ts';

const root = path.resolve(import.meta.dirname, '../../..');

describe('static deployment script surface', () => {
	it('verifies all eighteen canonical lanes offline', async () => {
		const result = await verifyScriptSurface({
			rootDir: root,
			environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
		});
		expect(result.summary).toEqual({
			verticals: 9,
			sourceApplications: 2,
			lanes: 18,
			externalScriptsIntroduced: 0,
			scripts: 198,
			resources: 72,
			localResources: 66,
			externalResources: 6,
		});
		expect(result.verticals.every((vertical) => !vertical.externalScriptIntroduced)).toBe(true);
		expect(result.boundaries).toMatchObject({
			paymentPageApplicability: 'not-established',
			dynamicScriptInsertion: 'not-tested',
			pciCompliance: 'not-claimed',
		});
	});

	it('hashes local scripts and linked resources while preserving attributes', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-script-surface-'));
		try {
			await mkdir(path.join(directory, 'assets'));
			await writeFile(path.join(directory, 'assets/app.ts'), 'export const value = 1;\n');
			await writeFile(path.join(directory, 'assets/app.css'), 'body {}\n');
			const html =
				'<script type="module" crossorigin src="assets/app.ts"></script><link rel="stylesheet" sizes="all" href="assets/app.css"><link href="https://cdn.example/style.css" integrity="sha256-example">';
			await writeFile(path.join(directory, 'index.html'), html);
			const result = await scanStaticEntrypoint({
				rootDir: directory,
				entrypointPath: 'index.html',
				entrypointSha256: sha256(html),
				expectedScriptSources: ['assets/app.ts'],
				expectedResourceHrefs: ['assets/app.css', 'https://cdn.example/style.css'],
			});
			expect(result.scripts[0]).toMatchObject({
				kind: 'local',
				resolvedPath: 'assets/app.ts',
				type: 'module',
				crossorigin: '',
			});
			expect(result.scripts[0]?.sha256).toBe(
				sha256(await readFile(path.join(directory, 'assets/app.ts'))),
			);
			expect(result.resources[0]).toMatchObject({
				href: 'assets/app.css',
				kind: 'local',
				resolvedPath: 'assets/app.css',
				rel: 'stylesheet',
				sizes: 'all',
			});
			expect(result.resources[0]?.sha256).toBe(
				sha256(await readFile(path.join(directory, 'assets/app.css'))),
			);
			expect(result.resources[1]).toMatchObject({
				href: 'https://cdn.example/style.css',
				kind: 'external',
				integrity: 'sha256-example',
			});
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses malformed, inline, missing, and unaccounted scripts', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-script-refusal-'));
		try {
			for (const [name, html, expected] of [
				['unquoted', '<script src=app.ts></script>', ['app.ts']],
				['inline', '<script>dynamic()</script>', []],
				['missing', '<script src="missing.ts"></script>', ['missing.ts']],
				['unaccounted', '<script src="app.ts"></script>', []],
			] as const) {
				await writeFile(path.join(directory, 'app.ts'), 'export {};\n');
				await writeFile(path.join(directory, `${name}.html`), html);
				await expect(
					scanStaticEntrypoint({
						rootDir: directory,
						entrypointPath: `${name}.html`,
						entrypointSha256: sha256(html),
						expectedScriptSources: [...expected],
						expectedResourceHrefs: [],
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses an unpinned entrypoint and non-offline execution', async () => {
		await expect(
			scanStaticEntrypoint({
				rootDir: root,
				entrypointPath: 'README.md',
				entrypointSha256: '',
				expectedScriptSources: [],
				expectedResourceHrefs: [],
			}),
		).rejects.toThrow('unhashed');
		await expect(
			scanStaticEntrypoint({
				rootDir: root,
				entrypointPath: 'README.md',
				entrypointSha256: '0'.repeat(64),
				expectedScriptSources: [],
				expectedResourceHrefs: [],
			}),
		).rejects.toThrow('SHA-256 mismatch');
		await expect(
			verifyScriptSurface({ rootDir: root, environment: { VERSIONLESS_NETWORK_MODE: '' } }),
		).rejects.toThrow('requires VERSIONLESS_NETWORK_MODE=offline');
	});

	it('rejects canonical identity, source, lane, entrypoint, receipt, and observation rebinding', async () => {
		const original = JSON.parse(
			await readFile(path.join(root, 'trust/script-surface.json'), 'utf8'),
		) as { verticals: Array<Record<string, unknown>> };
		const mutations: Array<(value: typeof original) => void> = [
			(value) => {
				const first = value.verticals[0];
				const third = value.verticals[2];
				if (first && third) [first.id, third.id] = [third.id, first.id];
			},
			(value) => {
				const first = value.verticals[0];
				if (first) first.sourceApplication = 'angular-phonecat';
			},
			(value) => {
				const lanes = value.verticals[0]?.lanes as Array<Record<string, unknown>>;
				if (lanes[0]) lanes[0].lane = 'target';
			},
			(value) => {
				const lanes = value.verticals[0]?.lanes as Array<Record<string, unknown>>;
				lanes.reverse();
			},
			(value) => {
				const lanes = value.verticals[0]?.lanes as Array<Record<string, unknown>>;
				if (lanes[0]) lanes[0].entrypointPath = String(lanes[1]?.entrypointPath);
			},
			(value) => {
				const lanes = value.verticals[2]?.lanes as Array<Record<string, unknown>>;
				if (lanes[1])
					lanes[1].receiptPath = 'evidence/runs/react-boilerplate-v4/t008-run.json';
			},
			(value) => {
				const lanes = value.verticals[2]?.lanes as Array<Record<string, unknown>>;
				if (lanes[1]) lanes[1].receiptDigest = '0'.repeat(64);
			},
			(value) => {
				const lanes = value.verticals[3]?.lanes as Array<Record<string, unknown>>;
				if (lanes[0]) lanes[0].observationLane = 'target';
			},
			(value) => {
				const lanes = value.verticals[7]?.lanes as Array<Record<string, unknown>>;
				if (lanes[0])
					lanes[0].receiptPath =
						'evidence/runs/react-boilerplate-v4-data-flow/t054-run.json';
			},
			(value) => {
				const lanes = value.verticals[7]?.lanes as Array<Record<string, unknown>>;
				if (lanes[1]) lanes[1].receiptDigest = '0'.repeat(64);
			},
			(value) => {
				const lanes = value.verticals[8]?.lanes as Array<Record<string, unknown>>;
				if (lanes[0]) lanes[0].lane = 'target';
			},
			(value) => {
				const lanes = value.verticals[8]?.lanes as Array<Record<string, unknown>>;
				if (lanes[1])
					lanes[1].receiptPath = 'evidence/runs/angular-phonecat-composed/t048-run.json';
			},
		];
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-binding-refusal-'));
		try {
			for (const [index, mutate] of mutations.entries()) {
				const value = structuredClone(original);
				mutate(value);
				const file = path.join(directory, `${index}.json`);
				await writeFile(file, JSON.stringify(value));
				await expect(
					verifyScriptSurface({
						rootDir: root,
						configPath: file,
						environment: { VERSIONLESS_NETWORK_MODE: 'offline' },
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses missing and unaccounted linked resources', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'versionless-link-refusal-'));
		try {
			for (const [name, expected] of [
				['missing', ['missing.css']],
				['unaccounted', []],
			] as const) {
				const html = '<link rel="stylesheet" href="missing.css">';
				if (name === 'unaccounted')
					await writeFile(path.join(directory, 'missing.css'), 'body {}\n');
				await writeFile(path.join(directory, `${name}.html`), html);
				await expect(
					scanStaticEntrypoint({
						rootDir: directory,
						entrypointPath: `${name}.html`,
						entrypointSha256: sha256(html),
						expectedScriptSources: [],
						expectedResourceHrefs: [...expected],
					}),
				).rejects.toThrow();
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it('refuses a target external script absent from legacy', () => {
		const script = (source: string): ScriptRecord => ({
			source,
			kind: 'external',
			resolvedPath: null,
			sha256: sha256(source),
			integrity: 'sha256-pinned',
			crossorigin: null,
			type: null,
		});
		expect(() =>
			assertNoIntroducedExternalScripts(
				[script('https://cdn.example/legacy.js')],
				[script('https://cdn.example/target.js')],
			),
		).toThrow('external script');
	});
});
