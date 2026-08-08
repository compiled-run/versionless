import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createAngularFuxaStandaloneEvidence,
	verifyAngularFuxaStandalone,
} from '../src/fixture/angular-fuxa-standalone-run.ts';

const temporary: string[] = [];

async function directory(): Promise<string> {
	const value = await mkdtemp(path.join(os.tmpdir(), 'versionless-t153-'));
	temporary.push(value);
	return value;
}

afterEach(async () => {
	for (const target of temporary.splice(0)) await rm(target, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

describe('Angular FUXA standalone evidence runner', () => {
	it('requires both explicit offline controls before reading the source closure', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', undefined);
		vi.stubEnv('NPM_CONFIG_OFFLINE', undefined);
		const base = await directory();
		await expect(
			createAngularFuxaStandaloneEvidence({
				outputRoot: path.join(base, 'output'),
				workRoot: path.join(base, 'work'),
				replay: false,
			}),
		).rejects.toThrow('explicit offline mode');
	});

	it('publishes canonical graph, four-span patch, receipt, and no worktree residue', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', 'offline');
		vi.stubEnv('NPM_CONFIG_OFFLINE', 'true');
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		const evidence = await createAngularFuxaStandaloneEvidence({
			outputRoot,
			workRoot,
			replay: false,
		});
		expect(evidence.patch.trim().split('\n')).toHaveLength(5);
		const receipt = JSON.parse(evidence.receipt) as {
			migration: unknown;
			template: unknown;
			selectorUses: { total: number; templates: unknown[] };
			verification: Record<string, unknown> & { mutations: unknown[] };
			nonclaims: string[];
		};
		expect(receipt.migration).toMatchObject({
			component: 'IframeComponent',
			selector: 'app-iframe',
			changedFiles: 3,
			spans: 4,
		});
		expect(receipt.template).toEqual({ byteIdentical: true, sandboxPreserved: true });
		expect(receipt.selectorUses.total).toBe(5);
		expect(receipt.selectorUses.templates).toHaveLength(4);
		expect(receipt.verification).toMatchObject({
			independentRuns: 2,
			identical: true,
			idempotent: true,
			networkAttempts: 0,
			worktreeResidue: 'none',
		});
		expect(receipt.verification.mutations).toHaveLength(4);
		expect(receipt.nonclaims[0]).toContain(
			'no dependency, install, compiler, Angular CLI, build, server, browser',
		);
		await expect(access(workRoot)).rejects.toThrow();
		expect(
			await verifyAngularFuxaStandalone({ outputRoot, workRoot, replay: false }),
		).toHaveLength(64);
	});

	it('refuses evidence mutations and leaves no verification worktree', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', 'offline');
		vi.stubEnv('NPM_CONFIG_OFFLINE', 'true');
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		await createAngularFuxaStandaloneEvidence({ outputRoot, workRoot, replay: false });
		const graphPath = path.join(outputRoot, 'graph.json');
		const graph = await readFile(graphPath, 'utf8');
		await writeFile(graphPath, graph.replace('selects-app-iframe', 'selects-app-frame'));
		await expect(
			verifyAngularFuxaStandalone({ outputRoot, workRoot, replay: false }),
		).rejects.toThrow('verification differs');
		await expect(access(workRoot)).rejects.toThrow();
	});
});
