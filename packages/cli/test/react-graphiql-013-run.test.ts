import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { join, resolve } from 'pathe';
import {
	assertGraphiQLViteTool,
	assertGraphiQLYarnTool,
	assertGraphiQLRuntimeTools,
	graphIQLWitnessBehaviorCore,
	isGraphiQLIsTestRed,
	runGraphiQLAtomicPublication,
} from '../src/fixture/react-graphiql-013-run.ts';

const root = resolve(import.meta.dirname, '../../..');

describe('GraphiQL 0.13 production runner boundaries', () => {
	test('binds the immutable offline Yarn 1 and Versionless Vite 8 adapter tools', async () => {
		const yarnRoot = join(
			process.env.COREPACK_HOME ?? join(process.env.HOME ?? '', '.cache/node/corepack'),
			'v1/yarn/1.22.22',
		);
		expect(() =>
			assertGraphiQLYarnTool({
				bin: Buffer.alloc(1),
				cli: Buffer.alloc(1),
				manifest: Buffer.alloc(1),
			}),
		).toThrow('tool identity differs');
		assertGraphiQLYarnTool({
			bin: await readFile(join(yarnRoot, 'bin/yarn.js')),
			cli: await readFile(join(yarnRoot, 'lib/cli.js')),
			manifest: await readFile(join(yarnRoot, 'package.json')),
		});
		const viteTool = {
			bin: await readFile(join(root, 'node_modules/vite/bin/vite.js')),
			manifest: await readFile(join(root, 'node_modules/vite/package.json')),
			lock: await readFile(join(root, 'pnpm-lock.yaml')),
		};
		assertGraphiQLViteTool(viteTool);
		expect(() => assertGraphiQLViteTool({ ...viteTool, lock: Buffer.from('changed') })).toThrow(
			'adapter identity differs',
		);
	});

	test('binds exact baseline/target runtimes and Chromium bytes', async () => {
		assertGraphiQLRuntimeTools({
			node16: await readFile(
				join(root, '.versionless/cache/angular-phonecat/node16/bin/node'),
			),
			node24: await readFile(process.execPath),
			chromium: await readFile(
				join(
					root,
					'.versionless/cache/react-boilerplate-v4/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell',
				),
			),
		});
		expect(() =>
			assertGraphiQLRuntimeTools({
				node16: Buffer.alloc(1),
				node24: Buffer.alloc(1),
				chromium: Buffer.alloc(1),
			}),
		).toThrow('runtime tool identity differs');
	});

	test('compares semantic Witness behavior without run IDs or capture bytes', () => {
		const first = {
			result: 'pass',
			journey1: { id: 'abc123' },
			journey2: { historyRestore: true },
			interactions: [],
			graphqlPosts: [],
			serviceWorker: {},
			attemptedNonLoopback: [],
			successfulNonLoopback: 0,
			pageErrors: [],
			consoleErrors: [],
			witness: {
				outcome: 'pass',
				assertions: {},
				interactions: [],
				eventCounts: {},
				navigations: [],
				network: [],
				failedRequests: 0,
				pageErrors: 0,
				consoleErrors: 0,
				logicalRun: 'first',
				captures: [{ sha256: 'a' }],
			},
		};
		const second = structuredClone(first);
		second.witness.logicalRun = 'second';
		second.witness.captures = [{ sha256: 'b' }];
		expect(graphIQLWitnessBehaviorCore(first)).toBe(graphIQLWitnessBehaviorCore(second));
		second.journey2.historyRestore = false;
		expect(graphIQLWitnessBehaviorCore(first)).not.toBe(graphIQLWitnessBehaviorCore(second));
	});

	test('recognizes only the exact causal isTest assertion red', () => {
		expect(isGraphiQLIsTestRed('expected GraphiQL result isTest true, but it was false')).toBe(
			true,
		);
		for (const changed of [
			'expected GraphiQL result isTest true, but no element matched',
			'GraphiQL Journey 1 result differs',
			'expected GraphiQL result isTest false, but it was true',
		])
			expect(isGraphiQLIsTestRed(changed)).toBe(false);
	});

	test('restores aggregate and trust snapshots when publication verification fails', async () => {
		const actions: string[] = [];
		await expect(
			runGraphiQLAtomicPublication({
				snapshot: async () => 'before',
				publish: async () => void actions.push('publish'),
				verify: async () => {
					throw new Error('synthetic verification failure');
				},
				commit: async () => void actions.push('commit'),
				restore: async (snapshot) => void actions.push(`restore:${snapshot}`),
			}),
		).rejects.toThrow('synthetic verification failure');
		expect(actions).toEqual(['publish', 'restore:before']);
	});
});
