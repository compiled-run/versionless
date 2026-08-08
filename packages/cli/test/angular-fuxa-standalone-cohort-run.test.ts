import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import * as path from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256 } from '../../core/src/index.ts';
import {
	createAngularFuxaStandaloneCohortEvidence,
	verifyAngularFuxaStandaloneCohort,
} from '../src/fixture/angular-fuxa-standalone-cohort-run.ts';

const temporary: string[] = [];
const root = path.resolve(import.meta.dirname, '../../..');

async function directory(): Promise<string> {
	const value = await mkdtemp(path.join(os.tmpdir(), 'versionless-t155-'));
	temporary.push(value);
	return value;
}

afterEach(async () => {
	for (const target of temporary.splice(0)) await rm(target, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

describe('Angular FUXA standalone cohort evidence', () => {
	it('requires explicit dual offline controls before source access', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', undefined);
		vi.stubEnv('NPM_CONFIG_OFFLINE', undefined);
		const base = await directory();
		await expect(
			createAngularFuxaStandaloneCohortEvidence({
				outputRoot: path.join(base, 'output'),
				workRoot: path.join(base, 'work'),
				replay: false,
				verifyT153: false,
			}),
		).rejects.toThrow('explicit offline mode');
	});

	it('publishes convergent seven-file, eleven-span evidence with distinct traces and no residue', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', 'offline');
		vi.stubEnv('NPM_CONFIG_OFFLINE', 'true');
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		const beforeT153 = sha256(
			await readFile(path.join(root, 'evidence/runs/angular-fuxa-standalone/receipt.json')),
		);
		const artifacts = await createAngularFuxaStandaloneCohortEvidence({
			outputRoot,
			workRoot,
			replay: false,
			verifyT153: false,
		});
		expect(Object.keys(artifacts).sort()).toEqual([
			'gauges-first.json',
			'graph.json',
			'iframe-first.json',
			'patch.diff',
			'receipt.json',
		]);
		const receipt = JSON.parse(artifacts['receipt.json']!) as {
			migration: Record<string, unknown>;
			preservation: Record<string, unknown>;
			verification: { mutations: unknown[]; networkAttempts: number; residue: string };
			nonclaims: string[];
		};
		expect(receipt.migration).toMatchObject({
			changedFiles: 7,
			spans: 11,
			orderConvergent: true,
			distinctTraces: true,
		});
		expect(receipt.preservation).toMatchObject({
			emptyTemplates: 2,
			inheritance: true,
			staticMethods: true,
			imports: true,
			editorReferences: true,
			gaugesReferences: true,
			selectors: true,
			unrelatedBytes: true,
			t153ByteIdentical: true,
		});
		expect(receipt.verification).toMatchObject({ networkAttempts: 0, residue: 'none' });
		expect(receipt.verification.mutations).toHaveLength(10);
		expect(artifacts['patch.diff']!.trim().split('\n')).toHaveLength(12);
		expect(artifacts['iframe-first.json']).not.toBe(artifacts['gauges-first.json']);
		expect(receipt.nonclaims[0]).toContain(
			'no dependency, install, compiler, Angular CLI, build',
		);
		await expect(access(workRoot)).rejects.toThrow();
		expect(
			sha256(
				await readFile(
					path.join(root, 'evidence/runs/angular-fuxa-standalone/receipt.json'),
				),
			),
		).toBe(beforeT153);
		expect(
			await verifyAngularFuxaStandaloneCohort({
				outputRoot,
				workRoot,
				replay: false,
				verifyT153: false,
			}),
		).toHaveLength(64);
	});

	it('refuses trace mutation and cleans the verification worktree', async () => {
		vi.stubEnv('VERSIONLESS_NETWORK_MODE', 'offline');
		vi.stubEnv('NPM_CONFIG_OFFLINE', 'true');
		const base = await directory();
		const outputRoot = path.join(base, 'output');
		const workRoot = path.join(base, 'work');
		await createAngularFuxaStandaloneCohortEvidence({
			outputRoot,
			workRoot,
			replay: false,
			verifyT153: false,
		});
		const tracePath = path.join(outputRoot, 'gauges-first.json');
		await writeFile(
			tracePath,
			(await readFile(tracePath, 'utf8')).replace('gauges-first', 'gauges-second'),
		);
		await expect(
			verifyAngularFuxaStandaloneCohort({
				outputRoot,
				workRoot,
				replay: false,
				verifyT153: false,
			}),
		).rejects.toThrow('evidence differs');
		await expect(access(workRoot)).rejects.toThrow();
	});
});
